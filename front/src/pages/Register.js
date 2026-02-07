import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const Register = () => {
  const navigate = useNavigate();
  
  // We match these state keys with your database columns
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: ''
  });

  const { first_name, last_name, email, password } = formData;

  const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async e => {
    e.preventDefault();
    try {
      // Sending data to your Node.js server
      const res = await axios.post('http://localhost:5000/register', formData);
      console.log('Registration Success:', res.data);
      
      // Store token for session (we'll use this later)
      localStorage.setItem('token', res.data.token);
      
      // Redirect to home page after successful registration
      navigate('/'); 
    } catch (err) {
      console.error(err.response?.data);
      alert('Error registering user: ' + (err.response?.data?.message || 'Server Error'));
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
      <h2>Create Account</h2>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="text" 
          placeholder="First Name" 
          name="first_name" 
          value={first_name} 
          onChange={onChange} 
          required 
          style={{ padding: '10px' }}
        />
        <input 
          type="text" 
          placeholder="Last Name" 
          name="last_name" 
          value={last_name} 
          onChange={onChange} 
          required 
          style={{ padding: '10px' }}
        />
        <input 
          type="email" 
          placeholder="Email Address" 
          name="email" 
          value={email} 
          onChange={onChange} 
          required 
          style={{ padding: '10px' }}
        />
        <input 
          type="password" 
          placeholder="Password" 
          name="password" 
          value={password} 
          onChange={onChange} 
          required 
          style={{ padding: '10px' }}
        />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#e91e63', color: 'white', border: 'none', cursor: 'pointer' }}>
          Register
        </button>
      </form>
      <p style={{ marginTop: '20px' }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
};

export default Register;