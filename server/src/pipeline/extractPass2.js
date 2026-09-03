const { callOpenAI, callGemini, callGroq } = require('./llmService');
const { extractHeuristicItems } = require('./fallbackExtractor');

const PASS2_SYSTEM_PROMPT = `You are an experienced Project Manager reviewing communication threads.
Analyze this conversation from an operational perspective.
Identify everything that needs to get done, who owns each responsibility, any deadlines, and decisions or approvals needed.
For each item, return:
- type: 'task' | 'decision' | 'approval_request' | 'deadline'
- description: action-oriented description of what needs to happen
- assigned_to: person or role responsible (resolve references if evident), or null
- due_date: deadline or target timeframe, or null
- source_snippet: the exact quoted sentence(s) from the text supporting this item

Output strictly valid JSON with key "items": Array of items. Do not include markdown commentary.`;

async function extractPass2(rawText, options = {}) {
  // Tier 1: Gemini (Primary - gemini-3.1-flash-lite)
  const geminiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const res = await callGemini({
        systemPrompt: PASS2_SYSTEM_PROMPT,
        userPrompt: `Review this conversation as a Project Manager and extract all action items:\n\n${rawText}`,
        temperature: 0.3,
        apiKey: geminiKey
      });
      if (res && Array.isArray(res.items)) {
        return { pass: 2, method: 'gemini', temperature: 0.3, items: res.items };
      }
    } catch (err) {
      console.warn('[Pass2] Gemini call failed, falling back to Groq:', err.message);
    }
  }

  // Tier 2: Groq (Fallback)
  const groqKey = options.groqApiKey || process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await callGroq({
        systemPrompt: PASS2_SYSTEM_PROMPT,
        userPrompt: `Review this conversation as a Project Manager and extract all action items:\n\n${rawText}`,
        temperature: 0.3,
        apiKey: groqKey
      });
      if (res && Array.isArray(res.items)) {
        return { pass: 2, method: 'groq', temperature: 0.3, items: res.items };
      }
    } catch (err) {
      console.warn('[Pass2] Groq call failed, falling back to local NLP engine:', err.message);
    }
  }

  // Local fallback
  const items = extractHeuristicItems(rawText, 'pass2', options);
  return {
    pass: 2,
    method: 'nlp_engine',
    temperature: 0.4,
    items
  };
}

module.exports = {
  extractPass2,
  PASS2_SYSTEM_PROMPT
};
