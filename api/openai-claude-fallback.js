// api/openai-claude-fallback.js - Use OpenAI as fallback for long content

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, max_tokens = 8000, use_openai = false } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    if (use_openai) {
      // Use OpenAI GPT-4 for long content
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }

      console.log('Using OpenAI GPT-4 for long content generation');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Higher output capacity
          max_tokens: Math.min(max_tokens, 16384), // GPT-4 can handle up to 16k output
          messages: messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          temperature: 0.1 // Low temperature for consistent educational content
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API error:', response.status, errorData);
        return res.status(response.status).json({ 
          error: `OpenAI API error: ${response.status}`,
          details: errorData 
        });
      }

      const data = await response.json();
      
      // Convert OpenAI format to Claude format for compatibility
      const claudeFormatResponse = {
        content: [{
          type: 'text',
          text: data.choices[0].message.content
        }],
        usage: {
          input_tokens: data.usage.prompt_tokens,
          output_tokens: data.usage.completion_tokens
        }
      };

      console.log('OpenAI API success - Response length:', data.choices[0].message.content.length);
      return res.status(200).json(claudeFormatResponse);

    } else {
      // Use Claude (existing logic)
      const apiKey = process.env.CLAUDE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Claude API key not configured' });
      }

      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      };

      if (max_tokens > 4096) {
        headers['anthropic-beta'] = 'max-tokens-3-5-sonnet-2024-07-15';
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: 'claude-3-opus-20240229', // Use Opus for better output
          max_tokens,
          messages
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Claude API error:', response.status, errorData);
        return res.status(response.status).json({ 
          error: `Claude API error: ${response.status}`,
          details: errorData 
        });
      }

      const data = await response.json();
      console.log('Claude API success - Response length:', data.content?.[0]?.text?.length || 0);
      return res.status(200).json(data);
    }

  } catch (error) {
    console.error('API function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
