import './App.css';
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Login from './pages/Login';
import Register from './pages/Register';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
// Allow cookies to be sent with every request
axios.defaults.withCredentials = true;

function App() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState(null);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get('http://localhost:5000/auth/user');
        setUser(res.data);
      } catch (err) {
        setUser(null);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await axios.get('http://localhost:5000/auth/logout');
      setUser(null);
      window.location.href = '/';
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  // 1. Add cartCount state in App()
const [cartCount, setCartCount] = useState(0);

// 2. Update cartCount whenever user changes or page loads
// In App.js
useEffect(() => {
  const getCount = async () => {
    try {
      const res = await axios.get('http://localhost:5000/cart', { withCredentials: true });
      setCartCount(res.data.reduce((acc, item) => acc + item.quantity, 0));
    } catch (err) { setCartCount(0); }
  };

  if (user) getCount();

  // Listen for the "cartUpdated" event
  window.addEventListener('cartUpdated', getCount);
  return () => window.removeEventListener('cartUpdated', getCount);
}, [user]);

  const Home = () => <div className="page-container"><h1>{t('welcome_msg')}</h1></div>;
  

  return (
    <Router>
      <div className="App">
        <nav className="navbar">
          <div className="nav-left">
            <div className="lang-switcher">
              <button onClick={() => changeLanguage('el')}>EL</button>
              <button onClick={() => changeLanguage('en')}>EN</button>
            </div>
            <span className="divider">|</span>
            <Link to="/" className="nav-link">{t('nav_home')}</Link>
            <Link to="/products" className="nav-link">{t('nav_products')}</Link>

          </div>
          
          <div className="nav-right">
            {user ? (
              <>
                <span className="welcome-text">
                  {i18n.language === 'el' ? `Γεια σου, ${user.first_name}` : `Hello, ${user.first_name}`}
                </span>
                <Link to="/cart" className="nav-link cart-link">
                  🛒 <span className="cart-badge">{cartCount}</span></Link>
                <button onClick={handleLogout} className="logout-btn">
                  {i18n.language === 'el' ? 'Αποσύνδεση' : 'Logout'}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link login-link">{t('nav_login')}</Link>
                <Link to="/register" className="nav-link register-link">
                  {t('nav_register')}</Link>
              </>
            )}
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetails />} />
          <Route path="/cart" element={<Cart />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;