import React from 'react';

const Loader = () => {
  return (
    <div className="loader-container">
      {/* This represents our "Candy" */}
      <div className="candy-spinner">
        <div className="candy-swirl"></div>
      </div>
      <p className="loading-text">Γεμίζουμε τα βαζάκια...</p>
    </div>
  );
};

export default Loader;