import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 11435;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'dengcao/Qwen3-Reranker-8B:Q5_K_M';

// 启用 CORS
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 调用 Ollama Rerank 模型为文档打分
async function scoreDocument(query, document, model) {
  try {
    // 构建 rerank 提示词
    const prompt = `Query: ${query}\nDocument: ${document}\nRelevance score:`;
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0,
          num_predict: 10,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const responseText = data.response.trim();
    
    // 尝试从响应中提取数字分数
    const scoreMatch = responseText.match(/(\d+\.?\d*)/);
    if (scoreMatch) {
      const score = parseFloat(scoreMatch[1]);
      // 归一化分数到 0-1 之间
      return Math.min(Math.max(score / 10, 0), 1);
    }
    
    // 如果无法提取分数，返回默认值
    return 0.5;
  } catch (error) {
    console.error('Error scoring document with Ollama:', error);
    throw error;
  }
}

// Rerank API 端点
app.post('/api/rerank', async (req, res) => {
  try {
    const { query, documents, top_n, model } = req.body;

    // 验证请求参数
    if (!query) {
      return res.status(400).json({ error: 'Missing required parameter: query' });
    }

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid parameter: documents' });
    }

    const rerankModel = model || DEFAULT_MODEL;
    console.log(`Processing rerank request with model: ${rerankModel}`);
    console.log(`Query: ${query}`);
    console.log(`Documents count: ${documents.length}`);
    console.log(`🔍 First document structure:`, JSON.stringify(documents[0], null, 2));

    // 使用 Ollama Rerank 模型为每个文档打分
    const scoredDocuments = await Promise.all(
      documents.map(async (doc, index) => {
        // 提取文本内容进行评分
        let docText;
        
        if (typeof doc === 'string') {
          docText = doc;
        } else if (typeof doc.text === 'string') {
          docText = doc.text;
        } else if (typeof doc.text === 'object' && doc.text.text) {
          // 处理嵌套的 text 对象
          docText = doc.text.text;
        } else {
          docText = JSON.stringify(doc);
        }
        
        // 使用 rerank 模型为文档打分
        const relevanceScore = await scoreDocument(query, docText, rerankModel);
        
        // 返回结果，Dify 期望扁平结构，不要 document 包装
        return {
          index,
          relevance_score: relevanceScore,
          text: docText  // 直接返回 text 字段，不包装在 document 里
        };
      })
    );

    // 按相关性分数降序排序
    scoredDocuments.sort((a, b) => b.relevance_score - a.relevance_score);

    // 如果指定了 top_n，只返回前 N 个结果
    const results = top_n ? scoredDocuments.slice(0, top_n) : scoredDocuments;

    console.log(`Rerank completed. Top score: ${results[0]?.relevance_score.toFixed(4)}`);

    // 返回 Dify 期望的格式
    res.json({
      results,
      model: rerankModel,
      usage: {
        total_tokens: documents.length + 1 // query + documents
      }
    });

  } catch (error) {
    console.error('Error processing rerank request:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'Ollama Rerank Adapter',
    ollama_url: OLLAMA_BASE_URL,
    default_model: DEFAULT_MODEL
  });
});

// 根路径 - Dify 可能用来验证连接
app.get('/', (req, res) => {
  res.json({
    service: 'Ollama Rerank Adapter',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      rerank: '/api/rerank',
      health: '/health',
      models: '/api/models'
    }
  });
});

// 模型列表端点 - Dify 可能需要这个
app.get('/api/models', (req, res) => {
  res.json({
    models: [
      {
        id: DEFAULT_MODEL,
        name: DEFAULT_MODEL,
        type: 'rerank'
      }
    ]
  });
});

// v1 版本的 rerank 端点（兼容 Cohere 格式）
app.post('/v1/rerank', async (req, res) => {
  // 转发到主 rerank 端点
  req.url = '/api/rerank';
  app._router.handle(req, res);
});

app.post('/rerank', async (req, res) => {
  // 转发到主 rerank 端点
  req.url = '/api/rerank';
  app._router.handle(req, res);
});


// 启动服务器
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Ollama Rerank Adapter 已启动');
  console.log('='.repeat(60));
  console.log(`📍 监听地址: http://localhost:${PORT}`);
  console.log(`🔗 Rerank API: http://localhost:${PORT}/api/rerank`);
  console.log(`🔗 健康检查: http://localhost:${PORT}/health`);
  console.log(`🤖 Ollama URL: ${OLLAMA_BASE_URL}`);
  console.log(`📦 默认模型: ${DEFAULT_MODEL}`);
  console.log('='.repeat(60));
  console.log('💡 提示: 确保 Ollama 服务正在运行');
  console.log('💡 使用环境变量 OLLAMA_BASE_URL 和 OLLAMA_MODEL 可自定义配置');
  console.log('='.repeat(60));
});
