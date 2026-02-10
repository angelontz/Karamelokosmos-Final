import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Loader from '../components/Loader';
import { useTranslation } from 'react-i18next';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await axios.get('http://localhost:5000/orders', { withCredentials: true });
        setOrders(res.data);
      } catch (err) {
        console.error("Error fetching orders:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="page-container">
      <h2>{t('my_orders')}</h2>
      
      {orders.length === 0 ? (
        <p>{t('no_orders')}</p>
      ) : (
        <div className="orders-list">
          {orders.map(order => (
            <div key={order.order_id} className="order-card">
              <div className="order-header">
                <h3>{t('order_number')} #{order.order_id}</h3>
                <span className="order-status">
                    {order.status}
                </span>
              </div>
              
              <div className="order-body">
                <p className="order-date">
                    {t('date')}: {new Date(order.order_date).toLocaleDateString()}
                </p>
                <p className="order-total">
                    {t('total')}: <strong>{Number(order.total_amount).toFixed(2)} €</strong>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;