# Ollama Rerank Adapter

[中文文档](./README_CN.md) | English

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

A lightweight HTTP service that wraps Ollama's Rerank model into a standard Rerank API, enabling Dify and other applications to use local Ollama models for document reranking.

## 📖 Background

Dify is a powerful LLM application development platform with support for knowledge bases and document retrieval. While it supports various Rerank models (such as Cohere, Jina, etc.), these services typically require internet connectivity or paid subscriptions. This project uses the adapter pattern to enable Dify to use completely local, free Ollama Rerank models.

## ✨ Features

- 🚀 **Fully Local** - No internet required, data privacy guaranteed
- 💰 **Completely Free** - Based on open-source Ollama models
- 🔌 **Plug and Play** - Compatible with Dify's Rerank API format
- 🐳 **Docker Friendly** - Supports Dify deployments in Docker environments
- ⚡ **High Performance** - Supports batch parallel document processing
- 🛠️ **Flexible Configuration** - Customize models and ports via environment variables

## 🎯 Use Cases

- **RAG Application Optimization** - Improve document relevance in Retrieval-Augmented Generation
- **Knowledge Base Search** - Enhance search result ranking in knowledge bases
- **Semantic Retrieval** - Document reranking based on semantic similarity
- **Local Deployment** - Completely offline enterprise-level applications

## 📋 Prerequisites

1. **Node.js**: Version 18.0.0 or higher (requires native fetch API support)
2. **Ollama**: Requires local Ollama service running
   ```bash
   # Install Ollama for macOS/Linux
   # Visit https://ollama.ai/download
   
   # Pull the Rerank model
   ollama pull dengcao/Qwen3-Reranker-8B:Q5_K_M
   ```

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/jtianling/dify-ollama-rerank-adapter.git
cd dify-ollama-rerank-adapter
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Service

```bash
# Start with default configuration
npm start

# Or use custom configuration
OLLAMA_BASE_URL=http://localhost:11434 OLLAMA_MODEL=dengcao/Qwen3-Reranker-8B:Q5_K_M npm start
```

### 4. Test the Service

```bash
# Health check
curl http://localhost:11435/health

# Run test script
node test.js
```

## 🔧 Configuration

### Environment Variables

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `PORT` | `11435` | Service listening port |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama service address |
| `OLLAMA_MODEL` | `dengcao/Qwen3-Reranker-8B:Q5_K_M` | Rerank model to use |

### Configuring in Dify

#### Docker Environment (Recommended)

If Dify is deployed in a Docker container:

```
API Base URL: http://host.docker.internal:11435  (macOS/Windows)
API Base URL: http://172.17.0.1:11435            (Linux)
API Endpoint: /api/rerank
Model: dengcao/Qwen3-Reranker-8B:Q5_K_M
```

#### Local Environment

If both Dify and the adapter are running locally:

```
API Base URL: http://localhost:11435
API Endpoint: /api/rerank
Model: dengcao/Qwen3-Reranker-8B:Q5_K_M
```

For detailed configuration guide, see [DIFY_SETUP.md](DIFY_SETUP.md)

## 📡 API Endpoints

### POST /api/rerank

Document reranking endpoint.

**Request Example:**
```json
{
  "query": "What is artificial intelligence?",
  "documents": [
    "Artificial intelligence is a branch of computer science...",
    "The weather is nice today...",
    "Machine learning is a subfield of AI..."
  ],
  "top_n": 3,
  "model": "dengcao/Qwen3-Reranker-8B:Q5_K_M"
}
```

**Response Example:**
```json
{
  "results": [
    {
      "index": 0,
      "relevance_score": 0.95,
      "text": "Artificial intelligence is a branch of computer science..."
    },
    {
      "index": 2,
      "relevance_score": 0.87,
      "text": "Machine learning is a subfield of AI..."
    }
  ],
  "model": "dengcao/Qwen3-Reranker-8B:Q5_K_M",
  "usage": {
    "total_tokens": 4
  }
}
```

### GET /health

Health check endpoint, returns service status.

### GET /api/models

Returns list of available models.

### GET /

Returns service information and available endpoints.

## 🎨 Recommended Ollama Rerank Models

- **dengcao/Qwen3-Reranker-8B:Q5_K_M** - High-quality Rerank model based on Qwen3 (recommended, default)
- Other Rerank-capable models can be configured via environment variables

```bash
# Pull other models
ollama pull other-rerank-model
```

## 🏗️ How It Works

1. **Receive Request** - Adapter receives Rerank request from Dify
2. **Extract Text** - Extracts plain text content from documents
3. **Model Scoring** - Uses Ollama Rerank model to score relevance between each document and the query
4. **Sort and Return** - Sorts by relevance score in descending order and returns results

## 🛠️ Development

```bash
# Development mode (auto-restart)
npm run dev

# Testing
node test.js
```

## 📝 Troubleshooting

### Port Already in Use

```bash
# macOS/Linux
lsof -ti :11435 | xargs kill -9
```

### Docker Connection Issues

Ensure correct address is used:
- macOS/Windows Docker Desktop: `host.docker.internal`
- Linux Docker: `172.17.0.1` or host machine IP

### Ollama Model Not Found

```bash
# Verify model is pulled
ollama list

# Re-pull the model
ollama pull dengcao/Qwen3-Reranker-8B:Q5_K_M
```

For more troubleshooting, see [DIFY_SETUP.md](DIFY_SETUP.md)

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai/) - For providing local LLM runtime environment
- [Dify](https://dify.ai/) - Excellent LLM application development platform
- [Express.js](https://expressjs.com/) - Fast Node.js web framework

## 🤖 Development Tools

This project was developed with assistance from [Cline](https://github.com/cline/cline) + [Claude Sonnet 4.5](https://www.anthropic.com/claude).

---

**⭐ If this project helps you, please give it a Star!**
