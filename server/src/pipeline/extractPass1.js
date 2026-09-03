const { callOpenAI, callGemini, callGroq } = require('./llmService');
const { extractHeuristicItems } = require('./fallbackExtractor');

const PASS1_SYSTEM_PROMPT = `You are a strict, literal data extraction engine for project communications.
Extract all tasks, decisions, approval requests, and deadlines from the conversation.
For each item, return:
- type: 'task' | 'decision' | 'approval_request' | 'deadline'
- description: concise summary of the action, decision, or requirement
- assigned_to: exact literal name or pronoun as mentioned in text (preserve pronouns like "him", "her", "them" literally, do not infer who they refer to), or null
- due_date: exact deadline string as mentioned in text, or null
- source_snippet: the exact quoted sentence(s) from the text supporting this item

Output strictly valid JSON with key "items": Array of items. Do not include markdown commentary.`;

async function extractPass1(rawText, options = {}) {
  // Tier 1: Gemini (Primary - gemini-3.1-flash-lite)
  const geminiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const res = await callGemini({
        systemPrompt: PASS1_SYSTEM_PROMPT,
        userPrompt: `Extract items strictly from this conversation transcript:\n\n${rawText}`,
        temperature: 0,
        apiKey: geminiKey
      });
      if (res && Array.isArray(res.items)) {
        return { pass: 1, method: 'gemini', temperature: 0, items: res.items };
      }
    } catch (err) {
      console.warn('[Pass1] Gemini call failed, falling back to Groq:', err.message);
    }
  }

  // Tier 2: Groq (Fallback)
  const groqKey = options.groqApiKey || process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await callGroq({
        systemPrompt: PASS1_SYSTEM_PROMPT,
        userPrompt: `Extract items strictly from this conversation transcript:\n\n${rawText}`,
        temperature: 0,
        apiKey: groqKey
      });
      if (res && Array.isArray(res.items)) {
        return { pass: 1, method: 'groq', temperature: 0, items: res.items };
      }
    } catch (err) {
      console.warn('[Pass1] Groq call failed, falling back to local NLP engine:', err.message);
    }
  }

  // Local deterministic fallback
  const items = extractHeuristicItems(rawText, 'pass1', options);
  return {
    pass: 1,
    method: 'nlp_engine',
    temperature: 0,
    items
  };
}

module.exports = {
  extractPass1,
  PASS1_SYSTEM_PROMPT
};
