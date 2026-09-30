const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');
const WebSocket = require('ws');

async function testCollaboration() {
  console.log('=== TEST: Yjs Multi-Client Real-Time Collaboration & Awareness Cleanup ===');
  const roomName = `ROOM_COLLAB_${Date.now()}`;
  const serverUrl = 'ws://192.168.0.101:5000/yjs';

  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();

  const provider1 = new WebsocketProvider(serverUrl, roomName, doc1, { WebSocketPolyfill: WebSocket });
  const provider2 = new WebsocketProvider(serverUrl, roomName, doc2, { WebSocketPolyfill: WebSocket });

  const aw1 = provider1.awareness;
  const aw2 = provider2.awareness;

  const t1 = doc1.getText('monaco');
  const t2 = doc2.getText('monaco');

  // Wait for connections
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('\n--- 1. Setting Awareness for Both Clients ---');
  aw1.setLocalStateField('user', { name: 'Bharu', color: '#f59e0b' });
  aw1.setLocalStateField('cursor', { line: 1, column: 5 });

  aw2.setLocalStateField('user', { name: 'Bharanindra', color: '#10b981' });
  aw2.setLocalStateField('cursor', { line: 4, column: 12 });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const states1 = Array.from(aw1.getStates().values());
  const userNames1 = states1.map((s) => s.user?.name).filter(Boolean);
  console.log('Client 1 sees users:', userNames1);

  const states2 = Array.from(aw2.getStates().values());
  const userNames2 = states2.map((s) => s.user?.name).filter(Boolean);
  console.log('Client 2 sees users:', userNames2);

  if (!userNames1.includes('Bharanindra') || !userNames2.includes('Bharu')) {
    throw new Error('Awareness sync failed! Peers do not see each other.');
  }
  console.log('✅ Awareness sync verified: Both peers see each other!');

  console.log('\n--- 2. Simultaneous Multi-Line Typing ---');
  // Client 1 inserts at beginning
  t1.insert(0, 'console.log("Client 1 Line 1");\n\n\n');
  // Client 2 inserts at offset 35 (line 4)
  await new Promise((resolve) => setTimeout(resolve, 300));
  t2.insert(t2.length, 'print("Client 2 Line 4");');

  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log('Doc 1 text:\n' + JSON.stringify(t1.toString()));
  console.log('Doc 2 text:\n' + JSON.stringify(t2.toString()));

  if (t1.toString() !== t2.toString()) {
    throw new Error('CRDT Document content mismatch between Doc 1 and Doc 2!');
  }
  console.log('✅ Real-time multi-client typing verified: Documents are identical!');

  console.log('\n--- 3. Client 2 Leaves Room (Disconnect Cleanup) ---');
  let removedVerified = false;
  aw1.on('change', () => {
    const remaining = Array.from(aw1.getStates().values()).map((s) => s.user?.name).filter(Boolean);
    console.log('Client 1 awareness updated. Remaining users:', remaining);
    if (!remaining.includes('Bharanindra')) {
      removedVerified = true;
    }
  });

  provider2.destroy();
  doc2.destroy();

  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (!removedVerified) {
    throw new Error('Disconnect cleanup failed! Disconnected client still remains in awareness.');
  }
  console.log('✅ Disconnect cleanup verified: Bharanindra was cleanly removed on disconnect!');

  provider1.destroy();
  doc1.destroy();

  console.log('\n🎉 ALL REAL-TIME COLLABORATION TESTS PASSED!');
  process.exit(0);
}

testCollaboration().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
