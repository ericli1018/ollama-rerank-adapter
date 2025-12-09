# Ollama Rerank 适配器

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

一个轻量级的 HTTP 服务，将 Ollama 的 Rerank 模型包装成标准的 Rerank API，让 Dify 等应用可以使用本地 Ollama 模型进行文档重排序（Reranking）。

## 📖 背景

Dify 是一个强大的 LLM 应用开发平台，支持知识库和文档检索。虽然它支持多种 Rerank 模型（如 Cohere、Jina 等），但这些服务通常需要联网或付费。本项目通过适配器模式，让 Dify 可以使用完全本地化、免费的 Ollama Rerank 模型。

## ✨ 功能特性

- 🚀 **完全本地化** - 无需联网，数据隐私有保障
- 💰 **完全免费** - 基于开源的 Ollama 模型
- 🔌 **即插即用** - 兼容 Dify 的 Rerank API 格式
- 🐳 **Docker 友好** - 支持 Docker 环境下的 Dify 部署
- ⚡ **高性能** - 支持批量并行处理文档
- 🛠️ **灵活配置** - 通过环境变量自定义模型和端口

## 🎯 应用场景

- **RAG 应用优化** - 提升检索增强生成的文档相关性
- **知识库搜索** - 改善知识库的搜索结果排序
- **语义检索** - 基于语义相似度的文档重排序
- **本地化部署** - 完全离线的企业级应用

## 📋 前置要求

1. **Node.js**: 版本 18.0.0 或更高（需要原生 fetch API 支持）
2. **Ollama**: 需要本地运行 Ollama 服务
   ```bash
   # macOS/Linux 安装 Ollama
   # 访问 https://ollama.ai/download
   
   # 拉取 Rerank 模型
   ollama pull dengcao/Qwen3-Reranker-8B:Q5_K_M
   ```

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/ollama-rerank-redirect.git
cd ollama-rerank-redirect
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动服务

```bash
# 使用默认配置启动
npm start

# 或使用自定义配置
OLLAMA_BASE_URL=http://localhost:11434 OLLAMA_MODEL=dengcao/Qwen3-Reranker-8B:Q5_K_M npm start
```

### 4. 测试服务

```bash
# 健康检查
curl http://localhost:11435/health

# 运行测试脚本
node test.js
```

## 🔧 配置

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `11435` | 服务监听端口 |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama 服务地址 |
| `OLLAMA_MODEL` | `dengcao/Qwen3-Reranker-8B:Q5_K_M` | 使用的 Rerank 模型 |

### 在 Dify 中配置

#### Docker 环境（推荐）

如果 Dify 部署在 Docker 容器中：

```
API Base URL: http://host.docker.internal:11435  (macOS/Windows)
API Base URL: http://172.17.0.1:11435            (Linux)
API Endpoint: /api/rerank
Model: dengcao/Qwen3-Reranker-8B:Q5_K_M
```

#### 本地环境

如果 Dify 和适配器都在本地运行：

```
API Base URL: http://localhost:11435
API Endpoint: /api/rerank
Model: dengcao/Qwen3-Reranker-8B:Q5_K_M
```

详细配置指南请参考 [DIFY_SETUP.md](DIFY_SETUP.md)

## 📡 API 接口

### POST /api/rerank

文档重排序接口。

**请求示例：**
```json
{
  "query": "什么是人工智能？",
  "documents": [
    "人工智能是计算机科学的一个分支...",
    "今天天气很好...",
    "机器学习是AI的子领域..."
  ],
  "top_n": 3,
  "model": "dengcao/Qwen3-Reranker-8B:Q5_K_M"
}
```

**响应示例：**
```json
{
  "results": [
    {
      "index": 0,
      "relevance_score": 0.95,
      "text": "人工智能是计算机科学的一个分支..."
    },
    {
      "index": 2,
      "relevance_score": 0.87,
      "text": "机器学习是AI的子领域..."
    }
  ],
  "model": "dengcao/Qwen3-Reranker-8B:Q5_K_M",
  "usage": {
    "total_tokens": 4
  }
}
```

### GET /health

健康检查端点，返回服务状态。

### GET /api/models

返回可用模型列表。

### GET /

返回服务信息和可用端点。

## 🎨 推荐的 Ollama Rerank 模型

- **dengcao/Qwen3-Reranker-8B:Q5_K_M** - 基于 Qwen3 的高质量 Rerank 模型（推荐，默认）
- 其他支持 Rerank 的模型可通过环境变量配置

```bash
# 拉取其他模型
ollama pull other-rerank-model
```

## 🏗️ 工作原理

1. **接收请求** - 适配器接收来自 Dify 的 Rerank 请求
2. **提取文本** - 从文档中提取纯文本内容
3. **模型评分** - 使用 Ollama Rerank 模型为每个文档与查询的相关性打分
4. **排序返回** - 按相关性分数降序排序并返回结果

## 🛠️ 开发

```bash
# 开发模式（自动重启）
npm run dev

# 测试
node test.js
```

## 📝 故障排查

### 端口被占用

```bash
# macOS/Linux
lsof -ti :11435 | xargs kill -9
```

### Docker 连接问题

确保使用正确的地址：
- macOS/Windows Docker Desktop: `host.docker.internal`
- Linux Docker: `172.17.0.1` 或宿主机 IP

### Ollama 模型未找到

```bash
# 确认模型已拉取
ollama list

# 重新拉取
ollama pull dengcao/Qwen3-Reranker-8B:Q5_K_M
```

更多故障排查请参考 [DIFY_SETUP.md](DIFY_SETUP.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Ollama](https://ollama.ai/) - 提供本地 LLM 运行环境
- [Dify](https://dify.ai/) - 优秀的 LLM 应用开发平台
- [Express.js](https://expressjs.com/) - 快速的 Node.js Web 框架

## 🤖 开发工具

本项目由 [Cline](https://github.com/cline/cline) + [Claude Sonnet 4.5](https://www.anthropic.com/claude) 辅助开发。

---

**⭐ 如果这个项目对你有帮助，请给个 Star！**
