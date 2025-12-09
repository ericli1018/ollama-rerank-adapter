/**
 * Ollama Rerank 适配器测试脚本
 */

const API_URL = 'http://localhost:11435/api/rerank';

async function testRerank() {
  console.log('🧪 开始测试 Rerank API...\n');

  const testData = {
    query: '什么是人工智能？',
    documents: [
      '人工智能（AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。',
      '今天天气很好，适合出去散步。',
      '机器学习是人工智能的一个子领域，它使计算机能够从数据中学习而无需明确编程。',
      '我喜欢吃披萨和意大利面。',
      '深度学习使用神经网络来模拟人脑的工作方式，是现代AI的核心技术。'
    ],
    top_n: 3,
    model: 'dengcao/Qwen3-Reranker-8B:Q5_K_M'
  };

  console.log('📤 请求数据:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    const startTime = Date.now();
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    console.log('✅ 测试成功！\n');
    console.log('📥 响应数据:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');
    
    console.log('📊 排序结果分析:');
    result.results.forEach((item, idx) => {
      console.log(`\n${idx + 1}. [原始索引: ${item.index}] 相关性分数: ${item.relevance_score.toFixed(4)}`);
      console.log(`   文档: ${item.document.text}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log(`⏱️  耗时: ${elapsed}ms`);
    console.log(`🤖 模型: ${result.model}`);
    console.log(`📈 处理文档数: ${testData.documents.length}`);
    console.log(`📋 返回结果数: ${result.results.length}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ 测试失败:');
    console.error(error.message);
    console.error('\n💡 请确保:');
    console.error('   1. Ollama 服务正在运行 (ollama serve)');
    console.error('   2. 已安装所需模型 (ollama pull dengcao/Qwen3-Reranker-8B:Q5_K_M)');
    console.error('   3. Rerank 适配器服务正在运行 (npm start)');
    process.exit(1);
  }
}

async function testHealth() {
  console.log('🏥 测试健康检查端点...\n');
  
  try {
    const response = await fetch('http://localhost:11435/health');
    const result = await response.json();
    
    console.log('✅ 健康检查通过:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ 健康检查失败:', error.message);
    console.error('💡 请确保服务正在运行 (npm start)\n');
    process.exit(1);
  }
}

// 运行测试
(async () => {
  await testHealth();
  await testRerank();
})();
