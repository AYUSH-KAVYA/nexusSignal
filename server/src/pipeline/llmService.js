const https = require('https');
const chrono = require('chrono-node');

/**
 * Low-level HTTP POST helper
 */
function postJson(urlStr, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const data = JSON.stringify(bodyObj);

    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      },
      timeout: 20000
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseBody));
          } catch (e) {
            resolve(responseBody);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Call OpenAI API
 */
async function callOpenAI({ systemPrompt, userPrompt, temperature = 0, apiKey }) {
  const payload = {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature,
    response_format: { type: 'json_object' }
  };

  const res = await postJson('https://api.openai.com/v1/chat/completions', {
    'Authorization': `Bearer ${apiKey}`
  }, payload);

  const content = res.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

function safeParseJson(rawContent) {
  if (!rawContent) return null;
  let str = String(rawContent).trim();
  if (str.startsWith('```')) {
    str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  try {
    return JSON.parse(str);
  } catch (e) {
    const jsonMatch = str.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    throw e;
  }
}

/**
 * Call Gemini API
 */
async function callGemini({ systemPrompt, userPrompt, temperature = 0, apiKey }) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nTask:\n${userPrompt}` }]
      }
    ],
    generationConfig: {
      temperature,
      responseMimeType: 'application/json'
    }
  };

  const res = await postJson(url, {}, payload);
  const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = safeParseJson(text);
  if (Array.isArray(parsed)) {
    return { items: parsed };
  }
  return parsed;
}

/**
 * Call Groq API (High performance inference)
 */
async function callGroq({ systemPrompt, userPrompt, temperature = 0, apiKey }) {
  const key = apiKey || process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature,
    response_format: { type: 'json_object' }
  };

  const res = await postJson('https://api.groq.com/openai/v1/chat/completions', {
    'Authorization': `Bearer ${key}`
  }, payload);

  const content = res.choices?.[0]?.message?.content;
  const parsed = safeParseJson(content);
  if (Array.isArray(parsed)) {
    return { items: parsed };
  }
  return parsed;
}

module.exports = {
  callOpenAI,
  callGemini,
  callGroq,
  safeParseJson
};
