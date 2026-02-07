import React, { useState } from 'react'; // Added useState
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const Product = ({ product }) => {
  const { i18n } = useTranslation();
  const [added, setAdded] = useState(false); // Added local state for feedback
  const fallbackImage = 'https://placehold.co/400x300/e91e63/ffffff?text=Karamelokosmos';

  if (!product) return null;

  const handleQuickAdd = async (e) => {
    e.preventDefault(); // Stop the Link from opening the details page
    try {
      await axios.post(
        'http://localhost:5000/cart/add',
        {
          product_id: product.product_id,
          quantity: 1 // Default to 1 for quick add from the grid
        },
        { withCredentials: true }
      );
      
      // 1. Trigger the Navbar update
      window.dispatchEvent(new Event('cartUpdated'));

      // 2. Show the success checkmark on the button
      setAdded(true);
      setTimeout(() => setAdded(false), 2000); 

    } catch (err) {
      if (err.response && err.response.status === 401) {
        alert(i18n.language === 'el' ? "Συνδεθείτε για αγορές!" : "Login to shop!");
      } else {
        console.error("Quick add error:", err);
      }
    }
  };

  return (
    <div className="product-card">
      <Link 
        to={`/products/${product.product_id}`} 
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <div className="product-image-container">
          <img 
            src={product.image_url || fallbackImage} 
            alt={product.name} 
            className="product-image" 
            onError={(e) => { e.target.src = fallbackImage; }}
          />
        </div>
        
        <div className="product-info">
          <h3>{product.name}</h3>
          <p className="product-description">{product.description}</p>
        </div>
      </Link>

      <div className="product-footer">
        <span className="product-price">{product.price} €</span>
        
        {/* The button now has the 'added' logic exactly like ProductDetails */}
        <button 
          className={`add-to-cart-btn ${added ? 'success' : ''}`} 
          onClick={handleQuickAdd}
        >
          {added ? "✓" : (i18n.language === 'el' ? "Προσθήκη" : "Add")}
        </button>
      </div>
    </div>
  );
};

export default Product;