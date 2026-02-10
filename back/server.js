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

// ADD TO CART
app.post('/cart/add', async (req, res) => {
  // Check Auth
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Please login first" });
  }

  const { product_id, quantity } = req.body;
  const user_id = req.user.user_id;

  try {
    // 1. Get the user's cart (Each user has exactly one based on your schema)
    let cartRes = await pool.query("SELECT cart_id FROM carts WHERE user_id = $1", [user_id]);
    
    let cart_id;
    if (cartRes.rows.length === 0) {
      // Create it if it doesn't exist (safety check)
      const newCart = await pool.query(
        "INSERT INTO carts (user_id) VALUES ($1) RETURNING cart_id", 
        [user_id]
      );
      cart_id = newCart.rows[0].cart_id;
    } else {
      cart_id = cartRes.rows[0].cart_id;
    }

    // 2. Use your existing UNIQUE constraint (cart_id, product_id) to update or insert
    // This is the cleanest way to handle "Add to Cart" in Postgres
    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity) 
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, product_id) 
       DO UPDATE SET quantity = cart_items.quantity + $3`,
      [cart_id, product_id, quantity || 1]
    );

    res.json({ message: "Successfully added to your candy jar!" });
  } catch (err) {
    console.error("Cart Logic Error:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// Update Cart Item Quantity
app.put('/cart/update', async (req, res) => {
  const { cart_item_id, quantity } = req.body;

  try {
    // 1. Check if quantity is valid (must be at least 1)
    if (quantity < 1) {
      return res.status(400).json({ error: "Quantity must be at least 1" });
    }

    // 2. Update the database
    await pool.query(
      'UPDATE cart_items SET quantity = $1 WHERE cart_item_id = $2',
      [quantity, cart_item_id]
    );

    res.json({ message: "Quantity updated" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 1. GET ALL ITEMS IN CART
app.get('/cart', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json([]);
  try {
    const cartItems = await pool.query(
      `SELECT ci.cart_item_id, p.product_id, p.name, p.price, p.image_url, ci.quantity 
       FROM cart_items ci
       JOIN carts c ON ci.cart_id = c.cart_id
       JOIN products p ON ci.product_id = p.product_id
       WHERE c.user_id = $1`,
      [req.user.user_id]
    );
    res.json(cartItems.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});


// Clear Cart (Safe Subquery Version)
app.delete('/cart/clear', async (req, res) => {
  // 1. Authenticated Check
  if (!req.user || !req.user.user_id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    console.log(`[Clear Cart] Clearing for User ID: ${req.user.user_id}`);

    // 2. The Fix: Use a Subquery. 
    // "Delete all items where the cart_id belongs to this user"
    const result = await pool.query(
      `DELETE FROM cart_items 
       WHERE cart_id IN (SELECT cart_id FROM carts WHERE user_id = $1)`,
      [req.user.user_id]
    );

    console.log(`[Clear Cart] Success! Deleted ${result.rowCount} items.`);
    res.json({ success: true, message: "Cart cleared" });

  } catch (err) {
    console.error("--- DB ERROR IN CLEAR CART ---", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE ITEM FROM CART
app.delete('/cart/:id', async (req, res) => {
  try {
    await pool.query("DELETE FROM cart_items WHERE cart_item_id = $1", [req.params.id]);
    res.json({ message: "Item removed" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Create Payment Intent (Stripe)
app.post('/create-payment-intent', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  try {
    // FIXED QUERY: Join cart_items -> carts -> products
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

    // Calculate total in CENTS
    const totalAmount = cartRes.rows.reduce((acc, item) => {
      return acc + (parseFloat(item.price) * 100 * item.quantity); 
    }, 0);

    // Create the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount),
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
    });

  } catch (err) {
    console.error("Stripe Error:", err.message);
    res.status(500).json({ message: "Payment Error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});