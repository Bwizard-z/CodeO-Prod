// scripts/test_agora.js - Comprehensive Verification for Agora Service, Routes, & Socket Events
require('dotenv').config();
const http = require('http');
const io = require('socket.io-client');
const agoraService = require('../services/agoraService');
const supabaseAuth = require('../services/supabaseAuth');
const { supabaseAdmin } = require('../services/supabase');

function postJson(path, payload, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request('http://192.168.0.101:5000' + path, {
      method: 'POST',
      headers,
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING AGORA AUDIO IMPLEMENTATION TESTS ===\n');

  // 1. Direct Agora Service Tests
  console.log('1. Testing agoraService.generateToken()...');

  // Test valid token generation (audience)
  const tokenAudience = agoraService.generateToken('WKU5DJ', 'user_123', 'audience');
  console.log('   - generateToken audience:', typeof tokenAudience === 'string' && tokenAudience.length > 50 ? 'PASS (Token generated)' : 'FAIL');

  // Test valid token generation (publisher)
  const tokenPublisher = agoraService.generateToken('WKU5DJ', 'user_123', 'publisher');
  console.log('   - generateToken publisher:', typeof tokenPublisher === 'string' && tokenPublisher.length > 50 ? 'PASS (Token generated)' : 'FAIL');

  // Test error handling: missing roomCode
  try {
    agoraService.generateToken('', 'user_123');
    console.log('   - missing roomCode error handling: FAIL (Did not throw)');
  } catch (err) {
    console.log('   - missing roomCode error handling: PASS (' + err.message + ')');
  }

  // Test error handling: missing userId
  try {
    agoraService.generateToken('WKU5DJ', '');
    console.log('   - missing userId error handling: FAIL (Did not throw)');
  } catch (err) {
    console.log('   - missing userId error handling: PASS (' + err.message + ')');
  }

  // 2. Route Authentication & Authorization Tests
  console.log('\n2. Testing POST /api/agora/token endpoint...');

  // Unauthenticated / guest request should return 200 and valid Agora token
  const guestRes = await postJson('/api/agora/token', { roomCode: 'WKU5DJ', userId: 'guest_123' });
  console.log('   - POST /api/agora/token for guest returns 200 + token:', guestRes.status === 200 && Boolean(guestRes.data?.token) ? 'PASS' : `FAIL (${guestRes.status})`);

  // Sign in a test user to get a valid JWT token
  console.log('   - Provisioning test user session via Supabase Admin...');
  let authToken = null;
  let testUserId = null;
  const testEmail = `test.agora.${Date.now()}@codeo.dev`;
  const testPass = 'AgoraPass123!';

  try {
    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPass,
      email_confirm: true,
      user_metadata: { name: 'Agora Tester' },
    });
    if (!createErr && userData?.user) {
      testUserId = userData.user.id;
      const { data: signData, error: signErr } = await supabaseAdmin.auth.signInWithPassword({
        email: testEmail,
        password: testPass,
      });
      if (!signErr && signData?.session) {
        authToken = signData.session.access_token;
      }
    }
  } catch (authErr) {
    console.log('   - Test user setup note:', authErr.message);
  }

  if (authToken) {
    console.log('   - Test user authenticated successfully.');
    // Test authenticated call with existing room (e.g. 'WKU5DJ')
    const validRoomRes = await postJson(
      '/api/agora/token',
      { roomCode: 'WKU5DJ', userId: testUserId, role: 'publisher' },
      authToken
    );
    console.log('   - POST /api/agora/token with valid room returns 200:', validRoomRes.status === 200 ? 'PASS' : `FAIL (${validRoomRes.status})`);
    if (validRoomRes.status === 200) {
      const data = validRoomRes.data;
      console.log('     * token generated:', Boolean(data.token));
      console.log('     * roomCode:', data.roomCode);
      console.log('     * userId:', data.userId);
      console.log('     * appId:', data.appId);
      console.log('     * channelName:', data.channelName);
    }

    // Test non-existent room returns 404
    const nonExistentRes = await postJson(
      '/api/agora/token',
      { roomCode: 'NONEXISTENT999', userId: testUserId },
      authToken
    );
    console.log('   - POST /api/agora/token with non-existent room returns 404:', nonExistentRes.status === 404 ? 'PASS' : `FAIL (${nonExistentRes.status})`);

    // Cleanup test user
    try {
      if (testUserId) await supabaseAdmin.auth.admin.deleteUser(testUserId);
    } catch { }
  } else {
    console.log('   - Could not obtain token for authenticated test.');
  }

  // 3. Socket.io Events Tests
  console.log('\n3. Testing Socket.io Audio Communication Events...');
  await new Promise((resolve) => {
    const socketClient1 = io('http://192.168.0.101:5000', { transports: ['websocket'] });
    const socketClient2 = io('http://192.168.0.101:5000', { transports: ['websocket'] });

    let joinedReceived = false;
    let audioEnabledReceived = false;
    let audioDisabledReceived = false;
    let leftReceived = false;

    socketClient1.on('connect', () => {
      socketClient1.emit('join-room', {
        roomCode: 'WKU5DJ',
        user: { id: 'client_1', name: 'User One' },
      });
    });

    socketClient2.on('connect', () => {
      // Listen for events on Client 2 emitted by Client 1
      socketClient2.on('user-joined', (payload) => {
        console.log('   - socket event "user-joined" received:', payload?.user?.name || payload?.userId);
        joinedReceived = true;
      });

      socketClient2.on('audio-enabled', (payload) => {
        console.log('   - socket event "audio-enabled" received:', payload?.audioEnabled);
        audioEnabledReceived = true;
      });

      socketClient2.on('audio-disabled', (payload) => {
        console.log('   - socket event "audio-disabled" received:', payload?.audioEnabled === false);
        audioDisabledReceived = true;
      });

      socketClient2.on('user-left', (payload) => {
        console.log('   - socket event "user-left" received:', payload?.user?.name || payload?.userId);
        leftReceived = true;
        socketClient1.disconnect();
        socketClient2.disconnect();
        resolve();
      });

      socketClient2.emit('join-room', {
        roomCode: 'WKU5DJ',
        user: { id: 'client_2', name: 'User Two' },
      });

      // After joining, trigger audio events from client 1
      setTimeout(() => {
        socketClient1.emit('audio-enabled', { roomCode: 'WKU5DJ', userId: 'client_1' });
      }, 500);

      setTimeout(() => {
        socketClient1.emit('audio-disabled', { roomCode: 'WKU5DJ', userId: 'client_1' });
      }, 1000);

      setTimeout(() => {
        socketClient1.emit('leave-room', { roomCode: 'WKU5DJ' });
      }, 1500);
    });

    // Safety timeout
    setTimeout(() => {
      socketClient1.disconnect();
      socketClient2.disconnect();
      resolve();
    }, 4000);
  });

  console.log('\n=== ALL AGORA & SOCKET TESTS COMPLETED ===');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
