# Dify 配置指南

## 解决连接错误

如果在 Dify 中配置时遇到 "Connection error occurred" 错误，请按照以下步骤操作：

### 1. 重启服务器

确保应用最新的代码更改（包括 CORS 支持）：

```bash
# 停止当前运行的服务（Ctrl+C）
# 然后重新启动
npm start
```

### 2. 验证服务可访问

在浏览器或使用 curl 测试以下端点：

```bash
# 测试根路径
curl http://localhost:11435/

# 测试健康检查
curl http://localhost:11435/health

# 测试模型列表
curl http://localhost:11435/api/models

# 测试 rerank 端点
curl -X POST http://localhost:11435/api/rerank \
  -H "Content-Type: application/json" \
  -d '{
    "query": "测试",
    "documents": ["文档1", "文档2"]
  }'
```

### 3. 在 Dify 中配置

#### ⚠️ 重要：Dify 在 Docker 中运行时的配置

**如果 Dify 部署在 Docker 容器中**（这是最常见的情况），你需要使用特殊的地址来访问宿主机：

- **macOS/Windows Docker Desktop**: 
  ```
  http://host.docker.internal:11435
  ```

- **Linux Docker**: 
  ```
  http://172.17.0.1:11435
  ```
  或者使用宿主机的实际 IP 地址（推荐）：
  ```
  http://192.168.x.x:11435
  ```

#### 方法 A：作为自定义 Rerank Provider

1. 进入 Dify 设置 → 模型供应商
2. 添加自定义模型供应商
3. 配置如下：
   - **API Base URL**: `http://host.docker.internal:11435` （Docker Desktop）
   - **API Endpoint**: `/api/rerank` 或留空
   - **API Key**: 留空或填写任意值（当前版本不验证）
   - **Model Name**: `dengcao/Qwen3-Reranker-8B:Q5_K_M`

#### 方法 B：如果 Dify 支持 Cohere 格式

1. 选择 Cohere 作为 Rerank Provider
2. 配置自定义 API URL：
   - **API URL**: `http://host.docker.internal:11435/v1/rerank`
   - **API Key**: 随意填写
   - **Model**: `dengcao/Qwen3-Reranker-8B:Q5_K_M`

### 4. 调试技巧

#### 查看服务器日志

服务器会记录所有传入请求，在终端中查看：

```
[2024-12-09T03:37:00.000Z] GET /
[2024-12-09T03:37:05.000Z] POST /api/rerank
```

#### 如果 Dify 在 Docker 中运行

确保 Dify 容器可以访问宿主机的 `localhost:11435`：

- **macOS/Windows Docker Desktop**: 使用 `host.docker.internal:11435`
  ```
  http://host.docker.internal:11435
  ```

- **Linux Docker**: 使用宿主机 IP 地址
  ```
  http://192.168.x.x:11435
  ```

#### 检查防火墙

确保端口 11435 没有被防火墙阻止：

```bash
# macOS - 检查端口是否监听
lsof -i :11435

# 测试本地连接
telnet localhost 11435
```

### 5. 常见问题

**Q: Dify 显示 "Invalid API Key"**  
A: 当前版本不需要 API Key，可以填写任意值。如果必须验证，我们可以添加简单的 API Key 验证。

**Q: Dify 显示 "Model not found"**  
A: 确保在 Dify 中填写的模型名称与服务器配置的一致：`dengcao/Qwen3-Reranker-8B:Q5_K_M`

**Q: 超时错误**  
A: Rerank 模型处理时间可能较长，特别是文档数量多时。可以在 Dify 中增加超时时间。

**Q: Ollama 模型未找到**  
A: 确保已拉取模型：
```bash
ollama pull dengcao/Qwen3-Reranker-8B:Q5_K_M
```

### 6. 验证完整流程

使用测试脚本验证服务工作正常：

```bash
node test.js
```

如果测试成功，说明服务本身没有问题，可能是 Dify 的配置问题。

### 7. 联系支持

如果以上方法都无法解决，请提供：
- Dify 版本
- 详细的错误消息
- 服务器日志输出
- 测试脚本的运行结果
