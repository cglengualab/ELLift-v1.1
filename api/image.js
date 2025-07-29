// api/image.js - Vercel serverless function for OpenAI DALL-E image generation

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Image API function called');
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      console.log('Invalid prompt format');
      return res.status(400).json({ error: 'Prompt is required and must be a string' });
    }

    // Check if we have an API key
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('OpenAI API Key exists:', !!apiKey);
    console.log('API Key starts with sk-:', apiKey?.startsWith('sk-'));
    
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('Making request to OpenAI DALL-E API');
    console.log('Prompt length:', prompt.length);
    
    // Make request to OpenAI API
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        size: '1024x1024',
        quality: 'standard',
        n: 1
      })
    });

    console.log('OpenAI API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      return res.status(response.status).json({ 
        error: `OpenAI API error: ${response.status}`,
        details: errorData 
      });
    }

    const data = await response.json();
    console.log('OpenAI API success');
    
    // Return the image URL and prompt
    return res.status(200).json({
      url: data.data[0].url,
      prompt: prompt
    });

  } catch (error) {
    console.error('Image API function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
