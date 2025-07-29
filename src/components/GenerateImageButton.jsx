import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { generateImage } from '../services/imageService';
import LoadingSpinner from './LoadingSpinner';

const GenerateImageButton = ({ prompt }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setIsLoading(true);
    setError('');
    setImageUrl(null);
    try {
      const url = await generateImage(prompt);
      setImageUrl(url);
    } catch (err) {
      setError('Failed to generate image.');
    }
    setIsLoading(false);
  };

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-200 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-800"></div>
            Generating...
          </>
        ) : (
          <>
            <Camera className="h-3 w-3" />
            Generate Image
          </>
        )}
      </button>

      {imageUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setImageUrl(null)}
        >
          <div 
            className="bg-white p-4 rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={imageUrl} alt={prompt} className="max-w-lg max-h-[80vh] rounded" />
            <button 
              onClick={() => setImageUrl(null)}
              className="mt-4 w-full btn-secondary py-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {error && <p className="text-xs text-red-600">{error}</p>}
    </>
  );
};

export default GenerateImageButton;
