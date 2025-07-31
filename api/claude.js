// api/claude.js - Updated for Claude Sonnet 4

const ANTHROPIC_VERSION = '2023-06-01';

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
    console.log('API function called');
    const { messages, max_tokens = 4096 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      console.log('Invalid messages format');
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Check if we have an API key
    const apiKey = process.env.CLAUDE_API_KEY;
    console.log('API Key exists:', !!apiKey);
    console.log('API Key starts with sk-ant:', apiKey?.startsWith('sk-ant-'));
    
    if (!apiKey) {
      return res.status(500).json({ error: 'Claude API key not configured' });
    }

    console.log('Making request to Claude Sonnet 4 API with version:', ANTHROPIC_VERSION);
    console.log('Requesting max_tokens:', max_tokens);

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    };

    // Claude Sonnet 4 supports up to 8192 output tokens natively
    const requestBody = {
      model: 'claude-sonnet-4-20250514', // Updated to Claude Sonnet 4
      max_tokens: Math.min(max_tokens, 8192), // Sonnet 4 supports up to 8K output
      messages
    };

    console.log('Request body model:', requestBody.model);

    // Make request to Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    console.log('Claude API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Claude API error:', response.status, errorData);
      return res.status(response.status).json({ 
        error: `Claude API error: ${response.status}`,
        details: errorData 
      });
    }

    const data = await response.json();
    console.log('Claude Sonnet 4 API success - Response length:', data.content?.[0]?.text?.length || 0);
    return res.status(200).json(data);

  } catch (error) {
    console.error('API function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
