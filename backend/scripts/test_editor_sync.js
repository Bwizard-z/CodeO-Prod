// scripts/test_editor_sync.js - Test Yjs & Socket.io Collaborative Editor Engine
require('dotenv').config();
const WebSocket = require('ws');
const { io } = require('socket.io-client');
const Y = require('yjs');
const sync = require('y-protocols/dist/sync.cjs');
const awareness = require('y-protocols/dist/awareness.cjs');
const encoding = require('lib0/dist/encoding.cjs');
const decoding = require('lib0/dist/decoding.cjs');
const axios = require('axios');

const BASE_HTTP_URL = 'http://192.168.0.101:5000';
const WS_URL = 'ws://192.168.0.101:5000/yjs/TESTROOM';

// Helper to wire a Y.Doc to a WebSocket client according to the Yjs protocol
function wireYjsClient(ws, doc) {
  ws.on('message', (data) => {
    const uint8 = Buffer.isBuffer(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
    const decoder = decoding.createDecoder(uint8);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === 0) { // MESSAGE_SYNC
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0);
      sync.readSyncMessage(decoder, encoder, doc, ws);
      if (encoding.length(encoder) > 1 && ws.readyState === WebSocket.OPEN) {
        ws.send(encoding.toUint8Array(encoder));
      }
    }
  });

  // Send local updates to WebSocket
  doc.on('update', (update, origin) => {
    if (origin !== ws && ws.readyState === WebSocket.OPEN) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0); // MESSAGE_SYNC
      sync.writeUpdate(encoder, update);
      ws.send(encoding.toUint8Array(encoder));
    }
  });
}

async function runEditorSyncTests() {
  console.log('========================================================');
  console.log('TESTING CODEO MONACO EDITOR YJS & REAL-TIME SYNC');
  console.log('========================================================\n');

  try {
    // 1. Verify HTTP Health
    console.log('1. Checking backend health...');
    const health = await axios.get(`${BASE_HTTP_URL}/health`);
    console.log(`   Backend health status: ${health.data.status}`);
    console.log('   [PASS] Health check verified.\n');

    // 2. Connect two WebSocket clients to Yjs room
    console.log('2. Connecting Client 1 & Client 2 to Yjs WebSocket (ws://192.168.0.101:5000/yjs/TESTROOM)...');

    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const ws1 = new WebSocket(WS_URL);
    const ws2 = new WebSocket(WS_URL);

    wireYjsClient(ws1, doc1);
    wireYjsClient(ws2, doc2);

    await Promise.all([
      new Promise((resolve, reject) => {
        ws1.on('open', resolve);
        ws1.on('error', reject);
      }),
      new Promise((resolve, reject) => {
        ws2.on('open', resolve);
        ws2.on('error', reject);
      }),
    ]);
    console.log('   Both WebSocket clients connected successfully.');
    console.log('   [PASS] WebSocket connection verified.\n');

    // Send initial SyncStep1 from clients to initiate two-way sync handshake
    {
      const enc1 = encoding.createEncoder();
      encoding.writeVarUint(enc1, 0);
      sync.writeSyncStep1(enc1, doc1);
      ws1.send(encoding.toUint8Array(enc1));

      const enc2 = encoding.createEncoder();
      encoding.writeVarUint(enc2, 0);
      sync.writeSyncStep1(enc2, doc2);
      ws2.send(encoding.toUint8Array(enc2));
    }

    // Wait a brief moment for initial handshake
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 3. Client 1 inserts text into 'monaco' Y.Text
    console.log('3. Client 1 typing in Monaco buffer: "const message = \'Hello Collaborative CodeO!\';"');
    const yText1 = doc1.getText('monaco');
    const yText2 = doc2.getText('monaco');

    yText1.insert(0, "const message = 'Hello Collaborative CodeO!';");

    // Wait for propagation over network (<500ms target)
    console.log('4. Waiting for real-time CRDT sync to Client 2 (<500ms)...');
    await new Promise((resolve) => setTimeout(resolve, 300));

    const receivedText = yText2.toString();
    console.log(`   Client 2 buffer content: "${receivedText}"`);
    if (receivedText !== "const message = 'Hello Collaborative CodeO!';") {
      throw new Error(`CRDT sync mismatch! Expected matching text, got "${receivedText}"`);
    }
    console.log('   [PASS] Real-time Yjs CRDT code sync verified (<300ms).\n');

    // 5. Test Client 2 appending text and Client 1 receiving it
    console.log('5. Client 2 editing simultaneously: appending "\nconsole.log(message);"');
    yText2.insert(yText2.length, '\nconsole.log(message);');

    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log(`   Client 1 buffer after Client 2 edit:\n${yText1.toString()}`);
    if (!yText1.toString().includes('console.log(message);')) {
      throw new Error('Bidirectional Yjs sync failed!');
    }
    console.log('   [PASS] Bidirectional multi-user editing verified.\n');

    // 6. Test Socket.io real-time events
    console.log('6. Connecting to Socket.io for room events...');
    const socketClient1 = io(BASE_HTTP_URL, { transports: ['websocket'] });
    const socketClient2 = io(BASE_HTTP_URL, { transports: ['websocket'] });

    await Promise.all([
      new Promise((res) => socketClient1.on('connect', res)),
      new Promise((res) => socketClient2.on('connect', res)),
    ]);

    socketClient1.emit('join-room', {
      roomCode: 'TESTROOM',
      user: { id: 'u1', name: 'Alice' },
    });

    socketClient2.emit('join-room', {
      roomCode: 'TESTROOM',
      user: { id: 'u2', name: 'Bob' },
    });

    // Wait for room-users broadcast
    const usersReceived = await new Promise((resolve) => {
      socketClient1.on('room-users', (users) => {
        if (users.length >= 2) resolve(users);
      });
    });
    console.log(`   Collaborators active in room: ${usersReceived.map((u) => u.name).join(', ')}`);
    console.log('   [PASS] Socket.io room membership verified.\n');

    // 7. Test Language Change Event Broadcast
    console.log('7. Testing language change broadcast: Alice changes to "python"...');
    const languagePromise = new Promise((resolve) => {
      socketClient2.on('language-changed', resolve);
    });

    socketClient1.emit('language-change', {
      roomCode: 'TESTROOM',
      language: 'python',
    });

    const langEvent = await languagePromise;
    console.log(`   Bob received language change: ${langEvent.language} by ${langEvent.changedBy}`);
    console.log('   [PASS] Real-time language sync verified.\n');

    // 8. Cleanup
    console.log('8. Cleaning up test clients...');
    ws1.close();
    ws2.close();
    socketClient1.disconnect();
    socketClient2.disconnect();

    console.log('--------------------------------------------------------');
    console.log('🎉 ALL MONACO + YJS REAL-TIME SYNC VERIFICATIONS PASSED!');
    console.log('========================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  }
}

runEditorSyncTests();
