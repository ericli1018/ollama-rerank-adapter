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

// ─── 核心評分函式 ─────────────────────────────────────────────────────────────

async function scoreDocument(query, doc, model) {
  const truncatedDoc = doc.slice(0, MAX_DOC_CHARS);

  // 官方格式：手動拼 raw prompt + suffix token
  // 用 /api/generate + raw:true 確保 suffix <think>\n\n</think>\n\n 真正寫進去
  const rawPrompt =
    `<|im_start|>system\n` +
    `Judge whether the Document meets the requirements based on the Query and the Instruct provided. ` +
    `Note that the answer can only be "yes" or "no".<|im_end|>\n` +
    `<|im_start|>user\n` +
    `<Instruct>: ${INSTRUCTION}\n` +
    `<Query>: ${query}\n` +
    `<Document>: ${truncatedDoc}<|im_end|>\n` +
    `<|im_start|>assistant\n` +
    `<think>\n\n</think>\n\n`;  // 官方 suffix，強制跳過 thinking 直接輸出 yes/no

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: rawPrompt,
      raw: true,        // 不套用 chat template，完全用 rawPrompt
      stream: false,
      options: {
        temperature: 0,
        num_predict: 1, // 只生成一個 token
      },
      logprobs: true,
      top_logprobs: 10, // 加大確保 yes/no 都能抓到
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama API ${response.status}: ${err}`);
  }

  const data = await response.json();

  // ── 從 logprobs 計算 yes/no 機率 ──────────────────────────────────────────
  // /api/generate 格式：data.logprobs[0].top_logprobs → [{token, logprob, bytes}]
  const topLogprobs = data.logprobs?.[0]?.top_logprobs;

  if (Array.isArray(topLogprobs) && topLogprobs.length > 0) {
    // yes 有 yes / Yes / YES 三種大小寫，都要抓，取 logprob 最大（最可能）的
    let yesLogprob = null;
    let noLogprob  = null;

    for (const entry of topLogprobs) {
      const token = entry.token.trim().toLowerCase();
      if (token === 'yes') {
        // 取所有 yes 變體裡 logprob 最高的（最小負數）
        if (yesLogprob === null || entry.logprob > yesLogprob) {
          yesLogprob = entry.logprob;
        }
      }
      if (token === 'no') {
        if (noLogprob === null || entry.logprob > noLogprob) {
          noLogprob = entry.logprob;
        }
      }
    }

    // softmax(yes, no)：兩個都找到才算精確分數
    if (yesLogprob !== null && noLogprob !== null) {
      const yesExp = Math.exp(yesLogprob);
      const noExp  = Math.exp(noLogprob);
      return yesExp / (yesExp + noExp);
    }

    // 只找到 yes：模型非常確定相關，no 不在 top_logprobs 裡
    if (yesLogprob !== null) return Math.exp(yesLogprob);

    // 只找到 no：模型非常確定不相關
    if (noLogprob !== null) return 1 - Math.exp(noLogprob);
  }

  // ── Fallback：logprobs 拿不到，看生成的文字 ──────────────────────────────
  const text = (data.response || '').trim().toLowerCase();
  console.warn(`  ⚠️  logprobs miss, generated: "${text.slice(0, 20)}"`);
  if (text.startsWith('yes')) return 0.85;
  if (text.startsWith('no'))  return 0.15;
  return 0.5;
}

// ─── Rerank 端點 ──────────────────────────────────────────────────────────────

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

    // 提取文字（相容各種格式）
    const docTexts = documents.map(doc => {
      if (typeof doc === 'string')                         return doc;
      if (typeof doc.text === 'string')                   return doc.text;
      if (typeof doc.text === 'object' && doc.text?.text) return doc.text.text;
      return JSON.stringify(doc);
    });

    // Sequential 評分，避免並行請求壓垮 Ollama
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
  version: '2.0.0',
  endpoints: { rerank: '/api/rerank', health: '/health' },
}));

app.get('/api/models', (req, res) => res.json({
  models: [{ id: DEFAULT_MODEL, name: DEFAULT_MODEL, type: 'rerank' }],
}));

// ─── 啟動 ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Ollama Rerank Adapter v2.0 Started');
  console.log('='.repeat(60));
  console.log(`📍 Port:          ${PORT}`);
  console.log(`🔗 Rerank API:    http://localhost:${PORT}/api/rerank`);
  console.log(`🤖 Ollama URL:    ${OLLAMA_URL}`);
  console.log(`📦 Model:         ${DEFAULT_MODEL}`);
  console.log(`✂️  Max doc chars: ${MAX_DOC_CHARS}`);
  console.log('='.repeat(60));
});
