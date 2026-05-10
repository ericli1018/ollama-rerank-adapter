import express from 'express';
import cors from 'cors';

const app = express();
const PORT          = process.env.PORT              || 11435;
const OLLAMA_URL    = process.env.OLLAMA_BASE_URL   || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL      || 'dengcao/Qwen3-Reranker-8B:Q5_K_M';
const MAX_DOC_CHARS = parseInt(process.env.MAX_DOC_CHARS || '500');
const INSTRUCTION   = process.env.RERANK_INSTRUCTION ||
  'Given a web search query, retrieve relevant passages that answer the query';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

async function scoreDocument(query, doc, model) {
  const truncatedDoc = doc.slice(0, MAX_DOC_CHARS);

  const messages = [
    {
      role: 'system',
      content: 'Judge whether the Document meets the requirements based on the Query and the Instruct provided. Note that the answer can only be "yes" or "no".',
    },
    {
      role: 'user',
      content: `<Instruct>: ${INSTRUCTION}\n<Query>: ${query}\n<Document>: ${truncatedDoc}`,
    },
    {
      role: 'assistant',
      content: '<think>\n\n</think>\n\n',
    },
  ];

  const response = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1,
      temperature: 0,
      logprobs: true,
      top_logprobs: 5,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama API ${response.status}: ${err}`);
  }

  const data = await response.json();

  const topLogprobs = data.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs;

  if (Array.isArray(topLogprobs) && topLogprobs.length > 0) {
    let yesLogprob = null;
    let noLogprob  = null;

    for (const entry of topLogprobs) {
      const token = entry.token.trim().toLowerCase();
      if (token === 'yes' && yesLogprob === null) yesLogprob = entry.logprob;
      if (token === 'no'  && noLogprob  === null) noLogprob  = entry.logprob;
    }

    if (yesLogprob !== null && noLogprob !== null) {
      const yesExp = Math.exp(yesLogprob);
      const noExp  = Math.exp(noLogprob);
      return yesExp / (yesExp + noExp);
    }

    if (yesLogprob !== null) return Math.exp(yesLogprob);

    if (noLogprob !== null) return 1 - Math.exp(noLogprob);
  }

  const text = data.choices?.[0]?.message?.content?.trim().toLowerCase() || '';
  console.warn(`  ⚠️  logprobs unavailable (Ollama >= 0.12.11 required), fallback: "${text.slice(0, 30)}"`);
  if (text.includes('yes')) return 0.85;
  if (text.includes('no'))  return 0.15;
  return 0.5;
}

async function handleRerank(req, res) {
  try {
    const { query, documents, top_n, model } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Missing required parameter: query' });
    }
    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid parameter: documents' });
    }

    const rerankModel = model || DEFAULT_MODEL;
    console.log(`🔍 Query: ${query.slice(0, 80)}`);
    console.log(`📄 Documents: ${documents.length}, model: ${rerankModel}`);

    const docTexts = documents.map(doc => {
      if (typeof doc === 'string')                         return doc;
      if (typeof doc.text === 'string')                   return doc.text;
      if (typeof doc.text === 'object' && doc.text?.text) return doc.text.text;
      return JSON.stringify(doc);
    });

    const scores = [];
    for (let i = 0; i < docTexts.length; i++) {
      try {
        const score = await scoreDocument(query, docTexts[i], rerankModel);
        scores.push({ index: i, relevance_score: score, text: docTexts[i] });
        console.log(`  [${i + 1}/${docTexts.length}] score=${score.toFixed(4)}`);
      } catch (err) {
        console.error(`  ❌ doc[${i}] error: ${err.message}`);
        scores.push({ index: i, relevance_score: 0, text: docTexts[i] });
      }
    }

    scores.sort((a, b) => b.relevance_score - a.relevance_score);
    const results = top_n ? scores.slice(0, top_n) : scores;

    console.log(`✅ Top score: ${results[0]?.relevance_score.toFixed(4)}`);

    res.json({
      results,
      model: rerankModel,
      usage: { total_tokens: documents.length + 1 },
    });
  } catch (error) {
    console.error('❌ Rerank error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ─── 路由 ─────────────────────────────────────────────────────────────────────

app.post('/api/rerank', handleRerank);
app.post('/v1/rerank',  handleRerank);
app.post('/rerank',     handleRerank);

app.get('/health', (req, res) => res.json({
  status: 'ok',
  service: 'Ollama Rerank Adapter',
  ollama_url: OLLAMA_URL,
  default_model: DEFAULT_MODEL,
  max_doc_chars: MAX_DOC_CHARS,
}));

app.get('/', (req, res) => res.json({
  service: 'Ollama Rerank Adapter',
  version: '2.2.0',
  endpoints: { rerank: '/api/rerank', health: '/health' },
}));

app.get('/api/models', (req, res) => res.json({
  models: [{ id: DEFAULT_MODEL, name: DEFAULT_MODEL, type: 'rerank' }],
}));

// ─── 啟動 ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Ollama Rerank Adapter v2.2 Started');
  console.log('='.repeat(60));
  console.log(`📍 Port:          ${PORT}`);
  console.log(`🔗 Rerank API:    http://localhost:${PORT}/api/rerank`);
  console.log(`🤖 Ollama URL:    ${OLLAMA_URL}`);
  console.log(`📦 Model:         ${DEFAULT_MODEL}`);
  console.log(`✂️  Max doc chars: ${MAX_DOC_CHARS}`);
  console.log('⚠️  Need Ollama >= 0.12.11 to support logprobs');
  console.log('='.repeat(60));
});
