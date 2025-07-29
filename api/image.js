// api/image.js - Updated with better error logging

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
    
    console.log('Received prompt:', prompt);
    console.log('Prompt type:', typeof prompt);
    console.log('Prompt length:', prompt?.length);
    
    if (!prompt || typeof prompt !== 'string') {
      console.log('Invalid prompt format');
      return res.status(400).json({ error: 'Prompt is required and must be a string' });
    }

    if (prompt.length > 1000) {
      console.log('Prompt too long:', prompt.length);
      return res.status(400).json({ error: 'Prompt too long. Maximum 1000 characters.' });
    }

    // Check API key
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('OpenAI API Key exists:', !!apiKey);
    console.log('API Key length:', apiKey?.length);
    console.log('API Key starts with sk-:', apiKey?.startsWith('sk-'));
    
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    if (!apiKey.startsWith('sk-')) {
      console.log('Invalid API key format');
      return res.status(500).json({ error: 'Invalid OpenAI API key format' });
    }

    console.log('Making request to OpenAI DALL-E API');
    
    const requestBody = {
      model: 'dall-e-3',
      prompt: prompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    // Make request to OpenAI API
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('OpenAI API response status:', response.status);
    console.log('OpenAI API response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('OpenAI API raw response:', responseText);

    if (!response.ok) {
      console.error('OpenAI API error details:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      
      let errorMessage = `OpenAI API error: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch (e) {
        // Response isn't JSON, use the raw text
        errorMessage = responseText || errorMessage;
      }
      
      return res.status(response.status).json({ 
        error: errorMessage,
        details: responseText 
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse OpenAI response as JSON:', e);
      return res.status(500).json({ error: 'Invalid response from OpenAI API' });
    }

    console.log('OpenAI API success');
    console.log('Response data keys:', Object.keys(data));
    
    // Return the image URL and prompt
    return res.status(200).json({
      url: data.data[0].url,
      prompt: prompt
    });

  } catch (error) {
    console.error('Image API function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack
    });
  }
}
