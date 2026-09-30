// scripts/test_ping_and_execution_ui.js - Test Live Ping and Real-Time Execution Broadcasting
const { io } = require('socket.io-client');
const axios = require('axios');

const SOCKET_URL = 'http://192.168.0.101:5000';
const API_URL = 'http://192.168.0.101:5000/api';
const TEST_ROOM = 'TEST_ROOM_' + Math.floor(Math.random() * 10000);

async function runTests() {
  console.log('=== TEST SUITE: Live Ping & Real-Time Code Execution UI ===\n');

  // Test 1: Real-Time Ping Latency Measurement
  console.log('--- TEST 1: Socket.io Ping Measurement (Every 500ms equivalent) ---');
  const socketClient1 = io(SOCKET_URL, { transports: ['websocket'] });
  const socketClient2 = io(SOCKET_URL, { transports: ['websocket'] });

  await new Promise((resolve) => {
    let connectedCount = 0;
    const check = () => {
      connectedCount++;
      if (connectedCount === 2) resolve();
    };
    socketClient1.on('connect', check);
    socketClient2.on('connect', check);
  });

  // Join Room
  socketClient1.emit('join-room', { roomCode: TEST_ROOM, user: { name: 'User 1' } });
  socketClient2.emit('join-room', { roomCode: TEST_ROOM, user: { name: 'User 2' } });
  await new Promise((r) => setTimeout(r, 200));

  // Perform 3 live pings
  for (let i = 1; i <= 3; i++) {
    const start = performance.now();
    await new Promise((resolve) => {
      socketClient1.emit('ping', {}, (res) => {
        const latency = Math.round(performance.now() - start);
        console.log(`  Ping #${i}: ${latency}ms (Quality: ${latency < 100 ? 'good (Green)' : latency < 500 ? 'ok (Yellow)' : 'bad (Red)'})`);
        if (res && res.timestamp) {
          console.log(`  Server acknowledged ping with timestamp: ${res.timestamp}`);
        }
        resolve();
      });
    });
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log('✅ Live ping response verified!\n');

  // Test 2: Real-Time Code Execution Broadcasting between User 1 and User 2
  console.log('--- TEST 2: Real-time Code Execution Broadcasting ---');
  const receivedResultPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for code-result broadcast')), 5000);
    socketClient2.on('code-result', (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  // User 1 broadcasts execution
  socketClient1.emit('code-executed', {
    roomCode: TEST_ROOM,
    output: 'Output from User 1 execution\n',
    language: 'python',
    executionTime: 42,
    status: 'success',
    userName: 'User 1',
  });

  const receivedData = await receivedResultPromise;
  console.log('  User 2 received broadcasted execution output:');
  console.log(`  - Output: "${receivedData.output.trim()}"`);
  console.log(`  - Language: ${receivedData.language}`);
  console.log(`  - Executed by: ${receivedData.userName}`);
  console.log(`  - Status: ${receivedData.status}`);
  console.log(`  - Time: ${receivedData.executionTime}ms`);
  console.log('✅ Real-time code broadcast verified across room peers!\n');

  // Test 3: Backend REST Execution with Stdin
  console.log('--- TEST 3: POST /api/execute with Stdin ---');
  const stdinCode = 'import sys\nname = sys.stdin.readline().strip()\nprint(f"Welcome, {name}!")';
  const stdinInput = 'CodeO Tester';

  const res = await axios.post(`${API_URL}/execute`, {
    language: 'python',
    code: stdinCode,
    stdin: stdinInput,
    userName: 'User 1',
  });

  console.log('  Status:', res.status);
  console.log('  Output:', JSON.stringify(res.data.output));
  if (res.data.output && res.data.output.includes('Welcome, CodeO Tester!')) {
    console.log('✅ Stdin execution verified via Judge0!\n');
  } else {
    throw new Error('Stdin output did not match expected output');
  }

  // Cleanup
  socketClient1.disconnect();
  socketClient2.disconnect();

  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
