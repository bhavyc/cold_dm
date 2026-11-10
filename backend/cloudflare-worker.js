/**
 * Cloudflare Worker for ColdDM Backend Proxy
 * Deploy to Cloudflare Workers with: npx wrangler deploy
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
2. Keep length concise so it easily fits LinkedIn's 300-character connection request note limit when possible.
3. NEVER use corporate clichés or spammy openers:
   - BANNED: "I hope this message finds you well"
   - BANNED: "I came across your profile and was impressed"
   - BANNED: "I would love to pick your brain"
   - BANNED: "Just wanted to reach out / touch base"
   - BANNED: "We offer synergy / game-changing solutions"
4. Write like a knowledgeable peer starting a genuine 1-on-1 chat.
5. Each style MUST have a distinct angle:
   - Style 1: "Compliment / Recent Post" -> Hyper-specific praise referencing their recent post, milestone, or notable achievement.
   - Style 2: "Problem / Role Specific" -> A thoughtful observation or question about a known challenge in their role.
   - Style 3: "Casual / Quick Starter" -> A relaxed, low-friction 1-2 sentence opener that feels effortless to answer.

Output Format:
Return valid JSON only adhering to this schema:
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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

function parseGeminiJSON(rawText) {
  if (!rawText) throw new Error("Empty response from AI");
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  return JSON.parse(cleaned);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(), status: 204 });
    }

    const url = new URL(request.url);

    // Health Check Endpoint
    if (request.method === 'GET' && (url.pathname === '/api/health' || url.pathname === '/')) {
      const apiKey = env.GEMINI_API_KEY;
      return new Response(JSON.stringify({
        status: 'healthy',
        platform: 'Cloudflare Worker',
        timestamp: new Date().toISOString(),
        apiKeyConfigured: Boolean(apiKey)
      }), { headers: corsHeaders() });
    }

    // Generate Endpoint
    if (request.method === 'POST' && url.pathname === '/api/generate') {
      try {
        const body = await request.json();
        const { name, headline, about, recentPost, apiKey: clientKey } = body || {};

        if (!name && !headline) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing prospect details. At least name or headline is required.'
          }), { status: 400, headers: corsHeaders() });
        }

        const apiKey = clientKey || env.GEMINI_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({
            success: false,
            error: 'GEMINI_API_KEY is not configured in Cloudflare Worker environment.'
          }), { status: 500, headers: corsHeaders() });
        }

        const userPrompt = `
Prospect Information:
- Full Name: ${name || 'Unknown'}
- Current Headline & Role: ${headline || 'N/A'}
- About Section: ${about ? about.slice(0, 1000) : 'N/A'}
- Recent Post / Activity: ${recentPost ? recentPost.slice(0, 600) : 'N/A'}

Write 3 tailored icebreakers now following the system rules.
`;

        const start = Date.now();
        let lastError = null;

        for (const model of CANDIDATE_MODELS) {
          try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: `${SYSTEM_INSTRUCTION}\n\n${userPrompt}` }] }],
                generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
              })
            });

            const data = await res.json();
            if (data.error) {
              lastError = new Error(`[${model}] ${data.error.message}`);
              continue;
            }

            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = parseGeminiJSON(rawText);

            const duration = ((Date.now() - start) / 1000).toFixed(2);
            return new Response(JSON.stringify({
              success: true,
              latency: `${duration}s`,
              modelUsed: model,
              prospect: { name: name || 'Prospect', headline: headline || '' },
              icebreakers: parsed.icebreakers
            }), { headers: corsHeaders() });

          } catch (err) {
            lastError = err;
          }
        }

        throw lastError || new Error("All candidate Gemini models failed.");

      } catch (err) {
        return new Response(JSON.stringify({
          success: false,
          error: err.message || 'Internal Cloudflare Worker error.'
        }), { status: 500, headers: corsHeaders() });
      }
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: corsHeaders() });
  }
};
