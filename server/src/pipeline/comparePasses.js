const levenshtein = require('fast-levenshtein');
const { callOpenAI, callGemini, callGroq } = require('./llmService');

const COMPARE_SYSTEM_PROMPT = `You are an AI verification judge. Compare two independent extraction passes from the same conversation.
Align matching items based on semantic similarity of action/scope and assignee.
For each item, classify as:
- 'match': Both passes agree on the core item, assignee, and timeframe. Note: Minor stylistic or formatting variations in deadline that refer to the same timeframe or day (e.g., "tomorrow afternoon" vs "tomorrow at 2 PM", or "this Friday" vs "Friday", or "Monday" vs "before Monday") are considered 'match'.
- 'conflict': Both passes captured the same underlying item but disagree on type, assignee (e.g. literal pronoun "him" vs inferred name "Carlos Mendez", or different people), or conflicting deadlines (e.g. "tomorrow" vs "next month").
- 'unique_pass1': Only pass 1 identified this item.
- 'unique_pass2': Only pass 2 identified this item.

Return strictly JSON with key "aligned_items":
[
  {
    "type": "task" | "decision" | "approval_request" | "deadline",
    "description": "...",
    "assigned_to": "...",
    "due_date": "...",
    "source_snippet": "...",
    "agreement_status": "match" | "conflict" | "unique_pass1" | "unique_pass2",
    "conflict_details": {
      "pass1": { ... },
      "pass2": { ... },
      "conflict_fields": ["assigned_to", ...]
    } // null if not conflict
  }
]`;

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  
  // Word token Jaccard similarity
  const words1 = new Set(s1.split(/\W+/).filter(Boolean));
  const words2 = new Set(s2.split(/\W+/).filter(Boolean));
  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }
  const union = new Set([...words1, ...words2]).size;
  const jaccard = intersection / union;

  // Character distance ratio
  const maxLen = Math.max(s1.length, s2.length);
  const lev = levenshtein.get(s1, s2);
  const charRatio = (maxLen - lev) / maxLen;

  return (jaccard * 0.6) + (charRatio * 0.4);
}

function normalizeAssignee(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function alignPassesLocally(pass1Items = [], pass2Items = []) {
  const aligned = [];
  const p2MatchedIndices = new Set();

  for (const p1 of pass1Items) {
    let bestMatchIdx = -1;
    let bestMatchScore = 0;

    for (let j = 0; j < pass2Items.length; j++) {
      if (p2MatchedIndices.has(j)) continue;
      const p2 = pass2Items[j];

      // Direct source snippet equality gives high score
      let score = 0;
      if (p1.source_snippet && p2.source_snippet && p1.source_snippet.trim() === p2.source_snippet.trim()) {
        score += 0.5;
      }

      const descSim = calculateSimilarity(p1.description, p2.description);
      score += descSim * 0.5;

      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatchIdx = j;
      }
    }

    if (bestMatchIdx !== -1 && bestMatchScore >= 0.45) {
      p2MatchedIndices.add(bestMatchIdx);
      const p2 = pass2Items[bestMatchIdx];

      // Check fields for conflict
      const conflictFields = [];
      
      // Type conflict
      if (p1.type !== p2.type) {
        conflictFields.push('type');
      }

      // Assignee conflict (e.g. 'him' vs 'Carlos Mendez', or different people)
      const a1 = normalizeAssignee(p1.assigned_to);
      const a2 = normalizeAssignee(p2.assigned_to);
      if (a1 !== a2) {
        // If one contains the other (like 'raj' and 'rajpatel'), don't call it conflict unless completely different or pronoun
        const isPronoun = ['him', 'her', 'them', 'someone'].includes(p1.assigned_to?.toLowerCase()) ||
                          ['him', 'her', 'them', 'someone'].includes(p2.assigned_to?.toLowerCase());
        if (isPronoun || (!a1.includes(a2) && !a2.includes(a1))) {
          conflictFields.push('assigned_to');
        }
      }

      // Due date conflict
      const d1 = (p1.due_date || '').toLowerCase().trim();
      const d2 = (p2.due_date || '').toLowerCase().trim();
      if (d1 !== d2 && d1 !== '' && d2 !== '') {
        conflictFields.push('due_date');
      }

      if (conflictFields.length > 0) {
        aligned.push({
          type: p1.type || p2.type,
          description: p1.description,
          assigned_to: p1.assigned_to || p2.assigned_to,
          due_date: p1.due_date || p2.due_date,
          source_snippet: p1.source_snippet || p2.source_snippet,
          agreement_status: 'conflict',
          conflict_details: {
            pass1: p1,
            pass2: p2,
            conflict_fields: conflictFields
          }
        });
      } else {
        // Match! Prefer more complete fields
        aligned.push({
          type: p1.type,
          description: p1.description,
          assigned_to: p2.assigned_to || p1.assigned_to,
          due_date: p1.due_date || p2.due_date,
          source_snippet: p1.source_snippet || p2.source_snippet,
          agreement_status: 'match',
          conflict_details: null
        });
      }
    } else {
      // Unique to Pass 1
      aligned.push({
        ...p1,
        agreement_status: 'unique_pass1',
        conflict_details: null
      });
    }
  }

  // Any leftover items in Pass 2 are unique_pass2
  for (let j = 0; j < pass2Items.length; j++) {
    if (!p2MatchedIndices.has(j)) {
      aligned.push({
        ...pass2Items[j],
        agreement_status: 'unique_pass2',
        conflict_details: null
      });
    }
  }

  return aligned;
}

async function comparePasses(pass1Result, pass2Result, options = {}) {
  const p1Items = pass1Result?.items || [];
  const p2Items = pass2Result?.items || [];

  // Tier 1: Gemini (Primary - gemini-3.1-flash-lite)
  const geminiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (geminiKey && p1Items.length > 0 && p2Items.length > 0) {
    try {
      const prompt = `Pass 1 Items:\n${JSON.stringify(p1Items, null, 2)}\n\nPass 2 Items:\n${JSON.stringify(p2Items, null, 2)}`;
      const res = await callGemini({
        systemPrompt: COMPARE_SYSTEM_PROMPT,
        userPrompt: prompt,
        temperature: 0,
        apiKey: geminiKey
      });
      if (res && Array.isArray(res.aligned_items)) {
        return { method: 'gemini', aligned_items: res.aligned_items };
      }
    } catch (err) {
      console.warn('[ComparePasses] Gemini alignment failed, falling back to Groq:', err.message);
    }
  }

  // Tier 2: Groq (Fallback)
  const groqKey = options.groqApiKey || process.env.GROQ_API_KEY;
  if (groqKey && p1Items.length > 0 && p2Items.length > 0) {
    try {
      const prompt = `Pass 1 Items:\n${JSON.stringify(p1Items, null, 2)}\n\nPass 2 Items:\n${JSON.stringify(p2Items, null, 2)}`;
      const res = await callGroq({
        systemPrompt: COMPARE_SYSTEM_PROMPT,
        userPrompt: prompt,
        temperature: 0,
        apiKey: groqKey
      });
      if (res && Array.isArray(res.aligned_items)) {
        return { method: 'groq', aligned_items: res.aligned_items };
      }
    } catch (err) {
      console.warn('[ComparePasses] Groq alignment failed, falling back to local aligner:', err.message);
    }
  }

  const aligned = alignPassesLocally(p1Items, p2Items);
  return {
    method: 'local_semantic_aligner',
    aligned_items: aligned
  };
}

module.exports = {
  comparePasses,
  calculateSimilarity,
  alignPassesLocally
};
