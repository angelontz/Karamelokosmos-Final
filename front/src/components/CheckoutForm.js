import React, { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);

    // 1. Confirm the payment with Stripe
    // We set redirect: "if_required" so it doesn't leave the page 
    // unless the bank requires a 3D Secure popup.
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "/products", 
      },
      redirect: "if_required" 
    });

    if (result.error) {
      // If there's an error, show it and stop loading
      setMessage(result.error.message);
      setIsLoading(false);
    } else {
      // Small timeout to ensure Stripe processing has fully settled
      setTimeout(async () => {
        try {
          await axios.delete('http://localhost:5000/cart/clear', { withCredentials: true });
          window.dispatchEvent(new Event('cartUpdated'));
          alert("Payment Successful! 🍬 Order placed.");
          navigate("/products");
        } catch (err) {
          console.error("Cart clear error:", err);
          navigate("/products");
        }
      }, 500);
    }
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      <PaymentElement id="payment-element" />
      <button disabled={isLoading || !stripe || !elements} id="submit" className="checkout-btn">
        <span id="button-text">
          {isLoading ? <div className="spinner" id="spinner"></div> : "Pay Now"}
        </span>
      </button>
      {message && <div id="payment-message">{message}</div>}
    </form>
  );
}