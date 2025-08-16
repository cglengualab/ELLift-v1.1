// api/log-error.js
// Simple error logging endpoint

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
    const errorData = req.body;
    
    // Log to console (Vercel logs capture this)
    console.error('🚨 Frontend Error Logged:', {
      timestamp: new Date().toISOString(),
      url: errorData.url,
      message: errorData.message,
      userAgent: errorData.userAgent,
      stack: errorData.stack?.substring(0, 500) // Limit stack trace size
    });
    
    // In production, you could send to external service like:
    // - Sentry
    // - LogRocket  
    // - Datadog
    // - Or your own database
    
    return res.status(200).json({ logged: true });
    
  } catch (error) {
    console.error('Failed to log error:', error);
    return res.status(500).json({ error: 'Failed to log error' });
  }
}
