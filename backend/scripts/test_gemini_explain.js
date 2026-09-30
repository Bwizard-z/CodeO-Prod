// backend/scripts/test_gemini_explain.js
require('dotenv').config();
const http = require('http');
const express = require('express');
const axios = require('axios');
const { io: ClientIO } = require('socket.io-client');
const { explainCode } = require('../services/geminiService');
const explainRoutes = require('../routes/explain');
const { initSocket } = require('../socket');

async function runTests() {
  console.log('==============================================');
  console.log('🚀 TESTING GEMINI AI CODE EXPLANATION SERVICE');
  console.log('==============================================\n');

  // 1. Direct Service Test
  console.log('▶ [Test 1] Testing geminiService.explainCode directly...');
  try {
    const sampleCode = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
    `.trim();

    const result = await explainCode(sampleCode, 'javascript');
    console.log('✅ Service Response Received:');
    console.log('   - Language:', result.language);
    console.log('   - Timestamp:', result.timestamp);
    console.log('   - Explanation Length:', result.explanation.length, 'chars');
    console.log('   - Snippet Preview:\n' + result.explanation.slice(0, 150) + '...\n');
  } catch (err) {
    console.error('❌ Service Test Failed:', err.message);
    process.exit(1);
  }

  // 2. Input Validation Test (Empty Code)
  console.log('▶ [Test 2] Testing empty code validation...');
  try {
    await explainCode('', 'javascript');
    console.error('❌ Expected error for empty code, but succeeded.');
  } catch (err) {
    console.log('✅ Correctly rejected empty code:', err.message, `(${err.code || 'VALIDATION_ERROR'})\n`);
  }

  // 3. Express HTTP Route Integration Test
  console.log('▶ [Test 3] Testing POST /api/explain Express Route...');
  const app = express();
  app.use(express.json());
  app.use('/api/explain', explainRoutes);
  const server = http.createServer(app);
  const socketIo = initSocket(server, ['*']);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 3a. Valid request
    const response = await axios.post(`${baseUrl}/api/explain`, {
      code: 'print("Hello, world!")',
      language: 'python',
    });

    if (response.data?.success && response.data?.explanation) {
      console.log('✅ POST /api/explain route returned HTTP 200 with valid explanation');
      console.log('   - Returned Language:', response.data.language);
      console.log('   - Returned Timestamp:', response.data.timestamp);
    } else {
      throw new Error('Invalid response payload format');
    }

    // 3b. Empty code validation over HTTP
    try {
      await axios.post(`${baseUrl}/api/explain`, {
        code: '',
        language: 'python',
      });
      console.error('❌ HTTP endpoint should have returned 400 for empty code');
    } catch (httpErr) {
      if (httpErr.response?.status === 400) {
        console.log('✅ HTTP endpoint correctly returned 400 Bad Request for empty code:', httpErr.response.data.error);
      } else {
        throw httpErr;
      }
    }
  } catch (err) {
    console.error('❌ Route Test Failed:', err.response?.data || err.message);
    server.close();
    process.exit(1);
  }

  // 4. Socket.io Real-Time Broadcast Test
  console.log('\n▶ [Test 4] Testing Socket.io code-explained broadcast event...');
  try {
    const roomCode = 'EXPLAIN_TEST_ROOM';

    const client1 = ClientIO(`${baseUrl}`, { transports: ['websocket'] });
    const client2 = ClientIO(`${baseUrl}`, { transports: ['websocket'] });

    await Promise.all([
      new Promise((res) => client1.on('connect', res)),
      new Promise((res) => client2.on('connect', res)),
    ]);

    client1.emit('join-room', {
      roomCode,
      user: { id: 'user-1', name: 'Alice', color: '#10b981' },
    });

    client2.emit('join-room', {
      roomCode,
      user: { id: 'user-2', name: 'Bob', color: '#3b82f6' },
    });

    await new Promise((res) => setTimeout(res, 300));

    const broadcastPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket broadcast timeout')), 5000);
      client2.on('code-explained', (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

    client1.emit('code-explained', {
      roomCode,
      code: 'const double = (x) => x * 2;',
      language: 'javascript',
      explanation: 'Doubles the given numerical input.',
      user: { id: 'user-1', name: 'Alice' },
    });

    const receivedPayload = await broadcastPromise;
    console.log('✅ Peer Client 2 received code-explained broadcast:');
    console.log('   - Explanation:', receivedPayload.explanation);
    console.log('   - User:', receivedPayload.user?.name);
    console.log('   - Language:', receivedPayload.language);

    client1.disconnect();
    client2.disconnect();
  } catch (err) {
    console.error('❌ Socket Broadcast Test Failed:', err.message);
    server.close();
    process.exit(1);
  }

  server.close();
  console.log('\n==============================================');
  console.log('🎉 ALL GEMINI CODE EXPLANATION TESTS PASSED!');
  console.log('==============================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
