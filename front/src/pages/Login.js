import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FcGoogle } from 'react-icons/fc';

const Login = () => {
  const { t, i18n } = useTranslation(); // fixed i18n
  const location = useLocation();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const { email, password } = formData;

  // 1. Listen for the redirect after Google Auth
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token'); 
    // Even though we use sessions, the redirect from the backend 
    // signals a successful login.
    if (token) {
      // Force a full page reload to the home page so App.js triggers the checkAuth
      window.location.href = '/'; 
    }
  }, [location]);

  const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async e => {
    e.preventDefault();
    try {
      // We don't need to store the response in localStorage anymore!
      // The backend sets the session cookie automatically on req.login()
      await axios.post('http://localhost:5000/login', formData);
      
      // Redirect to home and trigger the "Heartbeat" check in App.js
      window.location.href = '/';
    } catch (err) {
      alert('Invalid Credentials');
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:5000/auth/google';
  };

  return (
    <div className="page-container">
      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        <h2>{t('nav_login')}</h2>
        
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="email" 
            placeholder="Email Address" 
            name="email" 
            value={email} 
            onChange={onChange} 
            required 
            className="form-input" // You can style this in App.css
          />
          <input 
            type="password" 
            placeholder="Password" 
            name="password" 
            value={password} 
            onChange={onChange} 
            required 
            className="form-input"
          />
          <button type="submit" className="login-submit-btn">
            {t('nav_login')}
          </button>
        </form>

        <div style={{ margin: '20px 0' }}>{t('or') || 'or'}</div>

        <button onClick={handleGoogleLogin} className="google-btn">
          <FcGoogle size={24} />
          <span>{i18n.language === 'el' ? 'Σύνδεση με Google' : 'Sign in with Google'}</span>
        </button>
      </div>
    </div>
  );
};

export default Login;