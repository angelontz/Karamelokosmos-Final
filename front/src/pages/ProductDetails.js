import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Loader from '../components/Loader';
import { useTranslation } from 'react-i18next';

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const fallbackImage = 'https://placehold.co/600x400/e91e63/ffffff?text=Karamelokosmos';
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const addToCart = async () => {
  try {
    await axios.post(
      'http://localhost:5000/cart/add',
      {
        product_id: product.product_id,
        quantity: quantity // Use the state from your +/- buttons
      },
      { withCredentials: true } // REQUIRED to send the Google Session cookie
    );
    window.dispatchEvent(new Event('cartUpdated'));
    // --- UPDATE LOCAL BUTTON STATE ---
      setAdded(true);
      setTimeout(() => setAdded(false), 3000);
    
    // Show a success message
    //alert(i18n.language === 'el' ? "Προστέθηκε στο καλάθι!" : "Added to cart!");
  } catch (err) {
    if (err.response && err.response.status === 401) {
      alert(i18n.language === 'el' ? "Συνδεθείτε για αγορές!" : "Login to shop!");
    } else {
      console.error("Error adding to cart", err);
    }
  }
};

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/products/${id}`);
        setProduct(res.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching product details", err);
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) return <Loader />;
  if (!product) return <div className="page-container"><h2>Product not found</h2></div>;

  return (
    <div className="page-container product-details-container">
      {/* The class "back-btn" matches the CSS above */}
      <button onClick={() => navigate(-1)} className="back-btn">
        ← {t('back')}
      </button>
      
      <div className="details-layout">
        <div className="details-image">
          <img 
            src={product.image_url || fallbackImage} 
            alt={product.name} 
            onError={(e) => { e.target.src = fallbackImage; }}
          />
        </div>
        
        <div className="details-info">
          <h1>{product.name}</h1>
          <p className="details-price">{product.price} €</p>
          <p className="details-description">{product.description}</p>
          
          <div className="stock-info" style={{ marginBottom: '20px' }}>
             <strong>{t('stock')}:</strong> {product.stock_quantity}
          </div>
          
          <div className="quantity-selector">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</button>
            <span>{quantity}</span>
            <button onClick={() => setQuantity(q => q + 1)}>+</button>
            </div>

            <button className="add-to-cart-large" onClick={addToCart}>
            {added ? "✓ Προστέθηκε!" : t('add_to_cart')}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;