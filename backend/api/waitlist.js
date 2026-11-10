/**
 * Serverless / Express handler for Pro Early Access waitlist lead capture.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, source } = req.body || {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid work email address.'
      });
    }

    // Log lead cleanly (viewable in Vercel logs or Express stdout)
    console.log(`🎯 [NEW PRO LEAD] Email: ${email} | Source: ${source || 'extension'} | Time: ${new Date().toISOString()}`);

    return res.status(200).json({
      success: true,
      message: 'Added to Pro Early Access waitlist!'
    });
  } catch (err) {
    console.error('Waitlist API error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
