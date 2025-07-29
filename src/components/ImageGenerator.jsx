// FileName: src/components/ImageGenerator.jsx

import React, { useState } from 'react';
import { Palette, Download, Copy, Lightbulb, AlertCircle, CheckCircle, Server } from 'lucide-react';
import { generateEducationalImage, downloadImage, copyImageToClipboard } from '../services/imageService';

const ImageGenerator = ({ subject, proficiencyLevel }) => {
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStyle, setImageStyle] = useState('educational');
  const [complexity, setComplexity] = useState('simple');
  const [includeLabels, setIncludeLabels] = useState('no');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Clear success message after 3 seconds
  React.useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Subject-specific quick prompts
  const quickPrompts = {
    'Mathematics': [
      'A colorful pie chart divided into fractions',
      'Geometric shapes (triangle, circle, square) with labels',
      'A coordinate plane with plotted points',
      'A visual representation of multiplication tables',
      'A number line showing positive and negative numbers',
      'A bar graph comparing different quantities'
    ],
    'Algebra': [
      'A coordinate plane showing a linear equation',
      'Visual representation of solving for x',
      'A graph showing slope and y-intercept',
      'Algebraic expressions with variables'
    ],
    'Geometry': [
      'Different types of triangles with angle measurements',
      'A circle with radius, diameter, and circumference labeled',
      '3D shapes (cube, sphere, cylinder) with dimensions',
      'Parallel and perpendicular lines'
    ],
    'Science': [
      'A simple diagram of the water cycle',
      'A cross-section of a plant showing roots, stem, leaves',
      'The solar system with planets in order',
      'A food chain showing predator and prey relationships',
      'The human digestive system',
      'Different states of matter (solid, liquid, gas)'
    ],
    'Biology': [
      'A plant cell with organelles labeled',
      'The human respiratory system',
      'DNA double helix structure',
      'Photosynthesis process diagram'
    ],
    'Chemistry': [
      'The periodic table highlighting key elements',
      'Molecular structure of water (H2O)',
      'Chemical reaction showing reactants and products',
      'Laboratory equipment setup'
    ],
    'Physics': [
      'Simple machines: lever, pulley, inclined plane',
      'Light spectrum showing different colors',
      'Electric circuit with battery and bulb',
      'Wave diagram showing amplitude and frequency'
    ],
    'English Language Arts': [
      'A story map showing beginning, middle, and end',
      'Characters showing different emotions (happy, sad, angry)',
      'A classroom scene with students reading books',
      'A library with books organized on shelves',
      'Parts of speech visual guide',
      'Writing process flowchart'
    ],
    'Social Studies': [
      'A simple world map showing continents',
      'A timeline showing major historical events',
      'Different types of communities (urban, suburban, rural)',
      'Government buildings (courthouse, city hall, capitol)',
      'The three branches of government',
      'A voting process illustration'
    ],
    'History': [
      'Ancient civilizations timeline',
      'Historical figures from different eras',
      'Important historical documents',
      'Maps showing historical territories'
    ]
  };

  const generateImage = async () => {
    if (!imagePrompt.trim()) {
      setError('Please enter a description for your image');
      return;
    }

    setIsGenerating(true);
    setError('');
    setSuccessMessage('');

    try {
      // Build the enhanced prompt
      const enhancedPrompt = buildEducationalPrompt(
        imagePrompt, 
        imageStyle, 
        complexity, 
        includeLabels, 
        subject, 
        proficiencyLevel
      );

      const imageData = await generateEducationalImage(enhancedPrompt);
      setGeneratedImage(imageData);
      setSuccessMessage('Image generated successfully!');
    } catch (err) {
      // Check if it's a backend connection error
      if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
        setError('Image generation requires a backend server setup. This feature is currently not available in the frontend-only version.');
      } else {
        setError(`Failed to generate image: ${err.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const buildEducationalPrompt = (prompt, style, complexity, labels, subject, level) => {
    let enhancedPrompt = `Educational illustration for ${level} level ${subject} students: ${prompt}. `;
    
    // Add style
    switch(style) {
      case 'educational':
        enhancedPrompt += 'Style: Clean educational diagram, simple and clear, suitable for textbooks. ';
        break;
      case 'cartoon':
        enhancedPrompt += 'Style: Friendly cartoon illustration, colorful and engaging, child-friendly. ';
        break;
      case 'realistic':
        enhancedPrompt += 'Style: Realistic but simplified, appropriate for classroom use, clear and detailed. ';
        break;
    }
    
    // Add complexity
    if (complexity === 'simple') {
      enhancedPrompt += 'Keep it simple with minimal details, easy to understand. ';
    } else {
      enhancedPrompt += 'Include rich details for deeper learning, comprehensive illustration. ';
    }
    
    // Add label preference
    if (labels === 'no') {
      enhancedPrompt += 'No text or labels in the image. ';
    } else {
      enhancedPrompt += 'Include clear, simple labels for key elements. ';
    }
    
    enhancedPrompt += 'White background, high contrast, suitable for printing and projection, educational quality.';
    
    return enhancedPrompt;
  };

  const handleDownload = async () => {
    if (!generatedImage?.url) return;
    
    try {
      await downloadImage(generatedImage.url, 'ell-educational-image.png');
      setSuccessMessage('Image downloaded successfully!');
    } catch (err) {
      setError('Failed to download image');
    }
  };

  const handleCopy = async () => {
    if (!generatedImage?.url) return;
    
    try {
      await copyImageToClipboard(generatedImage.url);
      setSuccessMessage('Image copied to clipboard!');
    } catch (err) {
      setError('Failed to copy image to clipboard');
    }
  };

  const clearImage = () => {
    setGeneratedImage(null);
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className="card bg-purple-50 border-purple-200">
      <h2 className="section-header text-purple-800 flex items-center gap-2">
        <Palette className="w-6 h-6" />
        AI Image Generator
        <span className="text-sm font-normal text-purple-600">for Visual Learning Supports</span>
      </h2>

      {/* Backend Required Notice */}
      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Server className="w-5 h-5 text-amber-600" />
          <h3 className="font-medium text-amber-800">Backend Server Required</h3>
        </div>
        <p className="text-sm text-amber-700 mb-2">
          The image generation feature requires a backend server to securely handle API keys. 
          This protects your OpenAI API credentials from being exposed in the frontend code.
        </p>
        <p className="text-sm text-amber-700">
          <strong>For now, you can:</strong> Use the text adaptation features, and consider setting up a backend server later for image generation.
        </p>
      </div>
      
      {/* Main Prompt Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Describe the image you need:
        </label>
        <textarea
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          placeholder="Examples:
- A simple diagram showing the water cycle with labels
- A fraction pizza showing 3/4 slices eaten  
- A friendly cartoon teacher pointing to a whiteboard
- A cross-section of a plant cell with organelles
- A timeline showing the American Revolution events
- Geometric shapes arranged in a pattern"
          className="input-field h-32"
          disabled={true}
        />
      </div>

      {/* Style Options */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Image Style:</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'educational', label: '📚 Educational', desc: 'Clean diagrams' },
            { value: 'cartoon', label: '🎨 Cartoon', desc: 'Fun illustrations' },
            { value: 'realistic', label: '📸 Realistic', desc: 'Photo-like images' }
          ].map(style => (
            <button
              key={style.value}
              onClick={() => setImageStyle(style.value)}
              disabled={true}
              className={`p-3 rounded-lg border-2 text-center transition-all opacity-50 cursor-not-allowed ${
                imageStyle === style.value
                  ? 'border-purple-500 bg-purple-100 text-purple-700'
                  : 'border-gray-200 bg-white hover:border-purple-300'
              }`}
            >
              <div className="font-medium text-sm">{style.label}</div>
              <div className="text-xs text-gray-500 mt-1">{style.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Ideas */}
      {quickPrompts[subject] && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Quick Ideas for {subject}:
          </label>
          <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
            {quickPrompts[subject].map(prompt => (
              <button 
                key={prompt}
                onClick={() => setImagePrompt(prompt)}
                disabled={true}
                className="text-left p-2 bg-gray-50 rounded text-sm opacity-50 cursor-not-allowed"
              >
                💡 {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Options */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Detail Level:</label>
          <select 
            value={complexity} 
            onChange={(e) => setComplexity(e.target.value)}
            className="input-field text-sm"
            disabled={true}
          >
            <option value="simple">Simple & Clear</option>
            <option value="detailed">Rich & Detailed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Labels:</label>
          <select 
            value={includeLabels} 
            onChange={(e) => setIncludeLabels(e.target.value)}
            className="input-field text-sm"
            disabled={true}
          >
            <option value="no">No Text (I'll add later)</option>
            <option value="yes">Include Key Labels</option>
          </select>
        </div>
      </div>

      {/* Generate Button - Disabled */}
      <button
        onClick={generateImage}
        disabled={true}
        className="w-full btn-primary py-3 mb-4 opacity-50 cursor-not-allowed"
      >
        <span className="flex items-center justify-center gap-2">
          <Palette className="w-5 h-5" />
          Generate Image (Requires Backend)
        </span>
      </button>

      {/* Tips */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Image Generation Ideas:
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Visual vocabulary supports (objects, actions, concepts)</li>
          <li>• Subject-specific diagrams (science processes, math concepts)</li>
          <li>• Cultural context images (foods, places, celebrations)</li>
          <li>• Step-by-step process illustrations</li>
          <li>• Character emotions and social situations</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageGenerator;
