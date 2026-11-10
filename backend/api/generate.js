/**
 * Serverless / Express handler for Cold DM Icebreaker generation using Google Gemini.
 */

const CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash'
];

const SYSTEM_INSTRUCTION = `
You are an elite B2B cold outreach strategist. Your goal is to generate exactly 3 distinct, high-converting, personalized cold DM icebreakers for LinkedIn based on the prospect's profile data.

Strict Copywriting Guidelines:
1. Maximum 1-3 sentences per icebreaker (under 45 words each).
2. NEVER use corporate clichés or spammy openers:
   - BANNED: "I hope this message finds you well"
   - BANNED: "I came across your profile and was impressed"
   - BANNED: "I would love to pick your brain"
   - BANNED: "Just wanted to reach out / touch base"
   - BANNED: "We offer synergy / game-changing solutions"
3. Write like a knowledgeable peer or colleague starting a real 1-on-1 chat.
4. Each style MUST have a distinct angle:
   - Style 1: "Compliment / Recent Post" -> Hyper-specific praise referencing their recent post, milestone, or notable achievement.
   - Style 2: "Problem / Role Specific" -> A thoughtful, provocative question or observation about a known challenge in their specific role or industry.
   - Style 3: "Casual / Quick Starter" -> A relaxed, friendly 1-2 sentence opener that feels effortless to reply to.

Output Format:
You MUST respond with valid JSON only (no markdown quotes, no extra text outside the JSON) adhering to this schema:
{
  "icebreakers": [
    {
      "id": "style_compliment",
      "style": "Style 1 (Compliment / Recent Post)",
      "tag": "Recent Post & Milestone",
      "text": "Your personalized icebreaker message here",
      "whyItWorks": "Why this hook earns a reply"
    },
    {
      "id": "style_problem",
      "style": "Style 2 (Problem / Role Specific)",
      "tag": "Role Challenge & Value",
      "text": "Your personalized icebreaker message here",
      "whyItWorks": "Why this hook earns a reply"
    },
    {
      "id": "style_casual",
      "style": "Style 3 (Casual / Quick Starter)",
      "tag": "Casual Conversation Starter",
      "text": "Your personalized icebreaker message here",
      "whyItWorks": "Why this hook earns a reply"
    }
  ]
}
`;

/**
 * Strips code fences and parses JSON safely.
 */
function parseGeminiJSON(rawText) {
  if (!rawText) throw new Error("Empty response from AI");
  let cleaned = rawText.trim();
  // Strip markdown code fences if present (```json ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  return JSON.parse(cleaned);
}

/**
 * Calls Gemini API with fallback models.
 */
async function callGemini(apiKey, prompt) {
  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${SYSTEM_INSTRUCTION}\n\n${prompt}` }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
            topP: 0.95
          }
        })
      });

      const data = await response.json();

      if (data.error) {
        lastError = new Error(`[${model}] ${data.error.code}: ${data.error.message}`);
        console.warn(`Gemini Model [${model}] failed:`, data.error.message);
        continue; // Try next model
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = new Error(`[${model}] No text returned in candidate response`);
        continue;
      }

      const parsed = parseGeminiJSON(text);
      if (!parsed.icebreakers || !Array.isArray(parsed.icebreakers)) {
        throw new Error("Invalid response format: 'icebreakers' array missing");
      }

      return {
        icebreakers: parsed.icebreakers,
        modelUsed: model
      };
    } catch (err) {
      lastError = err;
      console.warn(`Attempt with ${model} failed:`, err.message);
    }
  }

  throw lastError || new Error("All Gemini models failed to generate response.");
}

/**
 * Main handler function for Vercel Serverless Function & Express
 */
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { name, headline, about, recentPost, apiKey: clientApiKey } = req.body || {};

    if (!name && !headline) {
      return res.status(400).json({
        error: 'Missing prospect details. At least name or headline is required.'
      });
    }

    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API key is not configured on the server. Please check .env or provide an apiKey.'
      });
    }

    // Format prompt
    const userPrompt = `
Prospect Information:
- Full Name: ${name || 'Unknown'}
- Current Headline & Role: ${headline || 'N/A'}
- About Section: ${about ? about.slice(0, 1000) : 'N/A'}
- Recent Post / Activity: ${recentPost ? recentPost.slice(0, 600) : 'N/A'}

Write 3 tailored icebreakers now following the system rules.
`;

    const startTime = Date.now();
    const result = await callGemini(apiKey, userPrompt);
    const latency = ((Date.now() - startTime) / 1000).toFixed(2);

    return res.status(200).json({
      success: true,
      latency: `${latency}s`,
      modelUsed: result.modelUsed,
      prospect: {
        name: name || 'Prospect',
        headline: headline || ''
      },
      icebreakers: result.icebreakers
    });

  } catch (error) {
    console.error('API Error in /api/generate:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while generating icebreakers.'
    });
  }
}

