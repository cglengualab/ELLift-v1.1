import React from 'react';

const LoadingSpinner = ({ message = 'Loading...' }) => {
  return (
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
      <p className="text-green-600 font-medium">{message}</p>
      <div className="mt-2 text-sm text-gray-500">
        This may take a few moments...
      </div>
    </div>
  );
};

export default LoadingSpinner;
