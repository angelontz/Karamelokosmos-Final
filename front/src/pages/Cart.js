import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Don't forget this import!
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const Cart = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation();

  const fetchCart = async () => {
    try {
      const res = await axios.get('http://localhost:5000/cart', { withCredentials: true });
      setItems(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching cart:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const updateQuantity = async (id, currentQuantity, change) => {
    const newQuantity = currentQuantity + change;
    if (newQuantity < 1) return;

    try {
      await axios.put('http://localhost:5000/cart/update', 
        { cart_item_id: id, quantity: newQuantity },
        { withCredentials: true }
      );
      fetchCart();
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (err) {
      console.error("Error updating quantity:", err);
    }
  };

  const removeItem = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/cart/${id}`, { withCredentials: true });
      fetchCart();
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (err) {
      console.error("Error removing item:", err);
    }
  };

  const total = items.reduce((acc, item) => acc + (parseFloat(item.price) * item.quantity), 0);

  if (loading) return <div className="page-container"><h2>{t('loading')}...</h2></div>;

  return (
    <div className="page-container">
      <h1 className="cart-title">
        {i18n.language === 'el' ? 'Το καλάθι σου' : 'Your Cart'}
      </h1>
      
      {/* Fixed Logic: Only ONE check here */}
      {items.length === 0 ? (
        <div className="empty-cart-container">
          <p className="empty-msg">{t('empty_cart')}</p>
          
          <Link to="/products" className="empty-cart-btn">
            {t('go_shopping')} 🍬
          </Link>
        </div>
      ) : (
        <div className="cart-grid">
          <div className="cart-list">
            {items.map((item) => (
              <div key={item.cart_item_id} className="cart-card">
                <img 
                  src={item.image_url || 'https://placehold.co/100x100?text=Candy'} 
                  alt={item.name} 
                  className="cart-card-img"
                />
                <div className="cart-card-details">
                  <h3>{item.name}</h3>
                  <p className="cart-card-price">{item.price} €</p>
                  
                  <div className="cart-qty-controls">
                    <button 
                      className="qty-btn"
                      onClick={() => updateQuantity(item.cart_item_id, item.quantity, -1)}
                    > - </button>
                    
                    <span className="qty-number">{item.quantity}</span>
                    
                    <button 
                      className="qty-btn"
                      onClick={() => updateQuantity(item.cart_item_id, item.quantity, 1)}
                    > + </button>
                  </div>
                </div>
                <button 
                  onClick={() => removeItem(item.cart_item_id)} 
                  className="cart-remove-btn"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <div className="summary-row">
              <span>{t('total')}:</span>
              <strong>{total.toFixed(2)} €</strong>
            </div>
            <Link to="/checkout"><button className="checkout-action-btn">{t('checkout')}</button></Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;