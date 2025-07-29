// This is a Vercel Serverless Function

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3", // Or "dall-e-2"
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      return res.status(response.status).json({ error: 'Failed to generate image from OpenAI.' });
    }

    const data = await response.json();
    const imageUrl = data.data[0].url;

    // Send the generated image URL back to the frontend
    res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('Internal Server Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}
