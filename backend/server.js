import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import generateHandler from './api/generate.js';
import waitlistHandler from './api/waitlist.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for Chrome Extensions and web origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

// In-Memory Rate Limiter (Protects backend from spam & DDoS)
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 60; // Max 60 requests per 10 mins per IP
const requestHistory = new Map();

function rateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = requestHistory.get(ip);
  if (!entry) {
    entry = [];
    requestHistory.set(ip, entry);
  }

  // Filter timestamps within the current window
  const validTimestamps = entry.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  validTimestamps.push(now);
  requestHistory.set(ip, validTimestamps);

  // Set rate limit headers
  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - validTimestamps.length);
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
  res.setHeader('X-RateLimit-Remaining', remaining);

  if (validTimestamps.length > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a few minutes before trying again.'
    });
  }

  next();
}

// Clean up stale rate limit memory every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestHistory.entries()) {
    const fresh = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) {
      requestHistory.delete(ip);
    } else {
      requestHistory.set(ip, fresh);
    }
  }
}, 15 * 60 * 1000);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'ColdDM Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      generate: '/api/generate (POST)'
    }
  });
});

app.get('/api/health', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: hasKey
  });
});

// Route for generation with Rate Limiting protection
app.post('/api/generate', rateLimiter, (req, res) => {
  return generateHandler(req, res);
});

// Route for Pro Waitlist lead capture
app.post('/api/waitlist', rateLimiter, (req, res) => {
  return waitlistHandler(req, res);
});

// Start listening
app.listen(PORT, () => {
  console.log(`\n🚀 ColdDM Backend running at http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`⚡ Generate API: http://localhost:${PORT}/api/generate`);
  console.log(`🔑 Gemini Key Configured: ${process.env.GEMINI_API_KEY ? 'YES (Active)' : 'NO (Missing)'}\n`);
});
