const express = require('express');
const router = express.Router();
const { DEMO_TRANSCRIPTS } = require('../pipeline/demoData');

router.get('/transcripts', (req, res) => {
  res.json(DEMO_TRANSCRIPTS);
});

router.get('/status', (req, res) => {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  res.json({
    llm_available: hasGemini || hasOpenAI,
    active_engine: hasGemini ? 'Gemini 1.5 Flash' : (hasOpenAI ? 'OpenAI GPT-4o-mini' : 'Nexus Deterministic AI Engine (NLP & Heuristics)'),
    has_gemini: hasGemini,
    has_openai: hasOpenAI,
    mode: hasGemini || hasOpenAI ? 'Live Cloud LLM' : 'Zero-Config Autonomous Engine'
  });
});

module.exports = router;
