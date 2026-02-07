import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Product from '../components/Product';
import Loader from '../components/Loader';

const Products = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // The empty array [] at the end is CRITICAL. 
  // It tells React: "Only run this ONCE when the page loads."
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const res = await axios.get('http://localhost:5000/products');
        setProducts(res.data);
        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        setLoading(false);
      }
    };

    fetchAllProducts();
  }, []); 

  if (loading) return <Loader />;

  return (
    <div className="products-page">
      <h1 className="products-title">{t('nav_products')}</h1>
      <div className="products-grid">
        {products.length > 0 ? (
          products.map((item) => (
            <Product key={item.product_id} product={item} />
          ))
        ) : (
          <p>No products found in the database.</p>
        )}
      </div>
    </div>
  );
};

export default Products;