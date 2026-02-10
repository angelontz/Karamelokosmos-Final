require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(express.json());
app.use(cors({ 
  origin: 'http://localhost:3000', 
  credentials: true 
}));

// --- SESSION CONFIGURATION ---
app.set('trust proxy', 1); // Add this line

app.use(session({
  secret: process.env.SESSION_SECRET || 'karamelokosmos_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Must be false for http://localhost
    sameSite: 'lax', // Helps with cross-origin cookie sharing
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Database connection configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ecommerce_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// --- AUTHENTICATION MIDDLEWARE ---
// This function checks if the user is logged in.
// If yes, it allows the request to continue.
// If no, it blocks it immediately with a 401 error.
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next(); // User is good, proceed to the route!
  }
  // User is not logged in
  res.status(401).json({ message: "Please log in to access this resource" });
};

// --- ROUTES ---

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const firstName = profile.name.givenName;
      const lastName = profile.name.familyName;
      const googleId = profile.id;

      // Check if user exists by email
      let userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      let user;

      if (userRes.rows.length > 0) {
        user = userRes.rows[0];
        // Update user with google_id if they didn't have it (linked account)
        if (!user.google_id) {
          await pool.query('UPDATE users SET google_id = $1 WHERE user_id = $2', [googleId, user.user_id]);
        }
      } else {
        // Create new user and a cart (Transaction)
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const newUserRes = await client.query(
            'INSERT INTO users (first_name, last_name, email, google_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [firstName, lastName, email, googleId]
          );
          user = newUserRes.rows[0];
          await client.query('INSERT INTO carts (user_id) VALUES ($1)', [user.user_id]);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => done(null, user.user_id));
passport.deserializeUser(async (id, done) => {
  try {
    // 1. Log that we are trying to find the user
    // console.log(`[Debug] Deserializing user ID: ${id}`); 

    if (!id) return done(null, false);

    const res = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);

    if (res.rows.length === 0) {
      console.warn(`[Warning] Session active but user ID ${id} not found in DB.`);
      return done(null, false); // User deleted?
    }

    // 2. Success
    done(null, res.rows[0]); 
  } catch (err) {
    console.error("--- DESERIALIZE ERROR ---", err.message);
    // 3. IMPORTANT: valid error handling so it doesn't hang
    done(err, null); 
  }
});

// --- AUTH ROUTES ---


// Start Google Auth
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google Callback
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: 'http://localhost:3000/login' }),
  (req, res) => {
    // Generate JWT for the frontend to use
    const token = jwt.sign({ user_id: req.user.user_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    // Redirect back to frontend with the token in the URL
    // The frontend will grab this token and store it
    res.redirect(`http://localhost:3000/login?token=${token}`);
  }
);

// Check if user is logged in
app.get('/auth/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user); // Returns user data from the session
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

// Logout Route
app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).send("Logout error");
    // For sessions, we usually redirect to the home page or login
    res.json({ message: "Logged out successfully" });
  });
});

// REGISTER ENDPOINT
app.post('/register', async (req, res) => {
  const { first_name, last_name, email, password } = req.body;

  // Start a transaction
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check if user already exists
    const userCheck = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'User already exists' });
    }

    // 2. Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create the User
    const newUserResult = await client.query(
      'INSERT INTO users (first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING user_id, first_name, last_name, email',
      [first_name, last_name, email, hashedPassword]
    );
    const newUser = newUserResult.rows[0];

    // 4. Create a Cart for the new user
    await client.query(
      'INSERT INTO carts (user_id) VALUES ($1)',
      [newUser.user_id]
    );

    await client.query('COMMIT'); // Commit transaction

    // 5. Generate a Token immediately so the user is logged in
    const token = jwt.sign({ user_id: newUser.user_id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ user: newUser, token });

  } catch (err) {
    await client.query('ROLLBACK'); // Cancel transaction on error
    console.error(err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
});

// LOGIN ENDPOINT
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    const user = userResult.rows[0];

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // 3. ESTABLISH SESSION
    // req.login is a Passport method that calls serializeUser and sets the cookie
    req.login(user, (err) => {
      if (err) {
        console.error("Login session error:", err);
        return res.status(500).json({ message: "Error establishing session" });
      }

      // 4. Return user info (The cookie is now set in the browser)
      return res.json({
        user: {
          user_id: user.user_id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          is_admin: user.is_admin
        }
      });
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET SINGLE PRODUCT BY ID
app.get('/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const product = await pool.query('SELECT * FROM products WHERE product_id = $1', [id]);
    
    if (product.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    res.json(product.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET ALL PRODUCTS
app.get('/products', async (req, res) => {
  try {
    const allProducts = await pool.query('SELECT * FROM products ORDER BY name ASC');
    
    // This console log will show up in your terminal (Node) 
    // to confirm the Backend found the data.
    console.log(`Successfully fetched ${allProducts.rows.length} products`);
    
    res.json(allProducts.rows);
  } catch (err) {
    console.error("Database error:", err.message);
    res.status(500).json({ error: 'Server Error fetching products' });
  }
});

// ==========================================
// CART & PAYMENT ROUTES (Protected)
// ==========================================

// 1. Get User's Cart
// Added 'ensureAuthenticated' to protect this route
app.get('/cart', ensureAuthenticated, async (req, res) => {
  try {
    const cartRes = await pool.query(
      `SELECT ci.cart_item_id, ci.quantity, p.product_id, p.name, p.price, p.image_url 
       FROM cart_items ci
       JOIN carts c ON ci.cart_id = c.cart_id
       JOIN products p ON ci.product_id = p.product_id
       WHERE c.user_id = $1`,
      [req.user.user_id]
    );
    res.json(cartRes.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 2. Add Item to Cart
app.post('/cart/add', ensureAuthenticated, async (req, res) => {
  // We removed the "if (!req.user)" check because middleware handles it!
  const { product_id, quantity } = req.body;
  try {
    // 1. Get or Create Cart for User
    let cartRes = await pool.query('SELECT cart_id FROM carts WHERE user_id = $1', [req.user.user_id]);
    
    if (cartRes.rows.length === 0) {
      cartRes = await pool.query(
        'INSERT INTO carts (user_id) VALUES ($1) RETURNING cart_id', 
        [req.user.user_id]
      );
    }
    const cartId = cartRes.rows[0].cart_id;

    // 2. Check if item exists in cart
    const itemRes = await pool.query(
      'SELECT * FROM cart_items WHERE cart_id = $1 AND product_id = $2',
      [cartId, product_id]
    );

    if (itemRes.rows.length > 0) {
      // Update quantity
      const newQuantity = itemRes.rows[0].quantity + quantity;
      await pool.query(
        'UPDATE cart_items SET quantity = $1 WHERE cart_item_id = $2',
        [newQuantity, itemRes.rows[0].cart_item_id]
      );
    } else {
      // Insert new item
      await pool.query(
        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)',
        [cartId, product_id, quantity]
      );
    }
    res.json({ message: "Item added to cart" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 3. Update Cart Item Quantity
app.put('/cart/update', ensureAuthenticated, async (req, res) => {
  const { cart_item_id, quantity } = req.body;
  try {
    await pool.query(
      'UPDATE cart_items SET quantity = $1 WHERE cart_item_id = $2',
      [quantity, cart_item_id]
    );
    res.json("Cart updated");
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 4. Clear Cart (The Safe Version we just fixed)
// Note: Keep this ABOVE the /cart/:id route!
app.delete('/cart/clear', ensureAuthenticated, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM cart_items 
       WHERE cart_id IN (SELECT cart_id FROM carts WHERE user_id = $1)`,
      [req.user.user_id]
    );
    res.json({ message: "Cart cleared" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 5. Delete Single Item
app.delete('/cart/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM cart_items WHERE cart_item_id = $1', [id]);
    res.json("Item deleted");
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 6. Create Payment Intent
app.post('/create-payment-intent', ensureAuthenticated, async (req, res) => {
  try {
    const cartRes = await pool.query(
      `SELECT p.price, ci.quantity 
       FROM cart_items ci 
       JOIN carts c ON ci.cart_id = c.cart_id 
       JOIN products p ON ci.product_id = p.product_id 
       WHERE c.user_id = $1`, 
      [req.user.user_id]
    );

    if (cartRes.rows.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const totalAmount = cartRes.rows.reduce((acc, item) => {
      return acc + (parseFloat(item.price) * 100 * item.quantity); 
    }, 0);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount),
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});