// backend/scripts/test_ai_assistant.js
require('dotenv').config();
const http = require('http');
const express = require('express');
const axios = require('axios');
const { isCodingQuestion, generateAIResponse } = require('../services/geminiService');
const aiRoutes = require('../routes/ai');

async function runTests() {
  console.log('==================================================');
  console.log('🤖 TESTING GEMINI AI CODE ASSISTANT & CHAT ENGINE');
  console.log('==================================================\n');

  // 1. Service Test - Coding Question Classification
  console.log('▶ [Test 1] Testing isCodingQuestion Classification...');
  const codingQuery = 'How do I implement a LRU Cache in Python with doubly linked list?';
  const nonCodingQuery = 'Can you give me a good chocolate brownie baking recipe?';
  const codingQuery2 = 'Explain the difference between let, const, and var in JavaScript';

  const isCode1 = await isCodingQuestion(codingQuery);
  const isCode2 = await isCodingQuestion(nonCodingQuery);
  const isCode3 = await isCodingQuestion(codingQuery2);

  console.log(`   - "${codingQuery.slice(0, 45)}...":`, isCode1 ? '✅ CODING' : '❌ FAIL');
  console.log(`   - "${nonCodingQuery.slice(0, 45)}...":`, !isCode2 ? '✅ NON-CODING (Rejected)' : '❌ FAIL');
  console.log(`   - "${codingQuery2.slice(0, 45)}...":`, isCode3 ? '✅ CODING' : '❌ FAIL');

  if (!isCode1 || isCode2 || !isCode3) {
    console.error('❌ Classification tests failed');
    process.exit(1);
  }

  // 2. Service Test - Context-Aware Response Generation
  console.log('\n▶ [Test 2] Testing generateAIResponse with Code Context...');
  const sampleCode = `
function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[arr.length - 1];
  const left = [];
  const right = [];
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] < pivot) left.push(arr[i]);
    else right.push(arr[i]);
  }
  return [...quickSort(left), pivot, ...quickSort(right)];
}
  `.trim();

  const response = await generateAIResponse(
    'How can I optimize the pivot selection to avoid worst-case O(n^2)?',
    sampleCode,
    'javascript',
    [],
    'Algorithm Lab'
  );

  console.log('✅ AI Response Generated:');
  console.log('   - isCodingRelated:', response.isCodingRelated);
  console.log('   - Tokens estimated:', response.tokens);
  console.log('   - Snippet:\n' + response.message.slice(0, 160) + '...\n');

  // 3. Express HTTP Route Integration Tests
  console.log('▶ [Test 3] Testing Express AI Routes (/api/ai)...');
  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRoutes);
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/ai`;

  try {
    // 3a. POST /api/ai/validate
    const valRes = await axios.post(`${baseUrl}/validate`, {
      question: 'How does garbage collection work in V8 engine?',
    });
    console.log('✅ POST /api/ai/validate -> isCodingRelated:', valRes.data.isCodingRelated);

    // 3b. POST /api/ai/chat (Valid coding prompt)
    const chatRes = await axios.post(`${baseUrl}/chat`, {
      message: 'What is the time complexity of binary search?',
      selectedCode: 'function binarySearch(arr, x) { ... }',
      language: 'javascript',
      roomId: 'TEST_AI_ROOM',
      chatHistory: [],
    });
    console.log('✅ POST /api/ai/chat -> HTTP 200, response received:');
    console.log('   - Response text snippet:', chatRes.data.message.slice(0, 100) + '...');
    console.log('   - Timestamp:', chatRes.data.timestamp);

    // 3c. POST /api/ai/chat (Reject non-coding prompt)
    try {
      await axios.post(`${baseUrl}/chat`, {
        message: 'Who won the football world cup in 2022?',
        language: 'javascript',
        roomId: 'TEST_AI_ROOM',
      });
      console.error('❌ Expected 400 rejection for non-coding question');
      process.exit(1);
    } catch (rejectErr) {
      if (rejectErr.response?.status === 400) {
        console.log('✅ POST /api/ai/chat correctly rejected non-coding prompt (400):', rejectErr.response.data.error);
      } else {
        throw rejectErr;
      }
    }

    // 3d. GET /api/ai/history/:roomId
    const histRes = await axios.get(`${baseUrl}/history/TEST_AI_ROOM`);
    console.log('✅ GET /api/ai/history/TEST_AI_ROOM -> returned items:', histRes.data.history?.length);
    if (histRes.data.history?.length > 0) {
      console.log('   - Last message in history:', histRes.data.history[histRes.data.history.length - 1].message);
    }
  } catch (err) {
    console.error('❌ Route integration test failed:', err.response?.data || err.message);
    server.close();
    process.exit(1);
  }

  server.close();
  console.log('\n==================================================');
  console.log('🎉 ALL AI CODE ASSISTANT TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
