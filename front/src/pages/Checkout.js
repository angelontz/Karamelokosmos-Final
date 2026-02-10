import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import axios from "axios";
import CheckoutForm from "../components/CheckoutForm";
import '../App.css'; 

// Load the key from the environment file
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_KEY);

export default function Checkout() {
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    // Create PaymentIntent as soon as the page loads
    axios.post("http://localhost:5000/create-payment-intent", {}, { withCredentials: true })
      .then((res) => setClientSecret(res.data.clientSecret))
      .catch((err) => console.error("Error init stripe:", err));
  }, []);

  const appearance = { theme: 'stripe' };
  const options = { clientSecret, appearance };

  return (
    <div className="page-container checkout-container">
      <h1>Checkout</h1>
      {clientSecret ? (
        <Elements options={options} stripe={stripePromise}>
          <CheckoutForm />
        </Elements>
      ) : (
        <p>Loading payment details...</p>
      )}
    </div>
  );
}