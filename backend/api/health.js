/**
 * Serverless Health Check endpoint for Vercel
 */

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'healthy',
    platform: 'Vercel Serverless',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
}
