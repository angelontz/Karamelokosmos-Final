import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "nav_home": "Home",
      "nav_products": "Products",
      "nav_login": "Login",
      "nav_register": "Register",
      "nav_profile": "Profile",
      "checkout_boxnow": "Select Box Now Point",
      "order_history": "Order History",
      "welcome_msg": "Welcome to Karamelokosmos",
      "add_to_cart": "Add to Cart",
      "back": "Back",
      "stock": "Stock",
      "your_cart": "Your Cart",
      "empty_cart": "Your cart is empty! 🍬",
      "total": "Total",
      "checkout": "Checkout",
      "loading": "Loading...",
      "go_shopping": "Go Shopping",
      "my_orders": "My Order History",
      "no_orders": "You haven't placed any orders yet.",
      "order_number": "Order",
      "date": "Date"
    }
  },
  el: {
    translation: {
      "nav_home": "Αρχική",
      "nav_products": "Προϊόντα",
      "nav_login": "Σύνδεση",
      "nav_register": "Εγγραφή",
      "nav_profile": "Προφίλ",
      "checkout_boxnow": "Επιλογή Σημείου Box Now",
      "order_history": "Ιστορικό Παραγγελιών",
      "welcome_msg": "Καλώς ήρθατε στον Καραμελόκοσμο",
      "add_to_cart": "Προσθήκη στο καλάθι",
      "back": "Πίσω",
      "stock": "Απόθεμα",
      "your_cart": "Το καλάθι σου",
      "empty_cart": "Το καλάθι σας είναι άδειο! 🍬",
      "total": "Σύνολο",
      "checkout": "Ολοκλήρωση Αγοράς",
      "loading": "Φόρτωση...",
      "go_shopping": "Πάμε για ψώνια",
      "my_orders": "Ιστορικό Παραγγελιών",
      "no_orders": "Δεν έχετε κάνει καμία παραγγελία ακόμα.",
      "order_number": "Παραγγελία",
      "date": "Ημερομηνία"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'el',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;