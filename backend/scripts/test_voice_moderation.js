// scripts/test_voice_moderation.js - Automated Verification for Voice Moderation & Host Controls
require('dotenv').config();
const io = require('socket.io-client');
const { supabaseAdmin } = require('../services/supabase');

async function testVoiceModeration() {
  console.log('=== STARTING VOICE MODERATION & HOST PERMISSIONS TEST ===\n');

  // Find host user for room WKU5DJ
  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select('id, code, created_by')
    .eq('code', 'WKU5DJ')
    .maybeSingle();

  if (roomErr || !room) {
    console.error('Failed to find test room WKU5DJ:', roomErr);
    process.exit(1);
  }

  const hostUserId = room.created_by;
  const nonHostUserId = 'guest_non_host_999';
  console.log(`Room: ${room.code}, Host User ID: ${hostUserId}`);

  // Create two socket clients: Host and Participant
  const hostClient = io('http://192.168.0.101:5000', { transports: ['websocket'] });
  const participantClient = io('http://192.168.0.101:5000', { transports: ['websocket'] });

  await new Promise((resolve) => {
    let hostJoined = false;
    let participantJoined = false;

    hostClient.on('connect', () => {
      hostClient.emit('join-room', {
        roomCode: 'WKU5DJ',
        user: { id: hostUserId, name: 'Room Host', role: 'host' },
      });
      hostJoined = true;
      if (participantJoined) resolve();
    });

    participantClient.on('connect', () => {
      participantClient.emit('join-room', {
        roomCode: 'WKU5DJ',
        user: { id: nonHostUserId, name: 'Normal Participant', role: 'member' },
      });
      participantJoined = true;
      if (hostJoined) resolve();
    });
  });

  console.log('1. Both Host and Participant joined room WKU5DJ.');

  // Test 1: Non-host attempts to mute host (should fail permission check)
  console.log('2. Testing unauthorized non-host moderation...');
  let nonHostDenied = false;
  participantClient.once('error', (err) => {
    console.log('   - Non-host mute attempt rejected by server:', err.message);
    if (err.message.includes('Only the room host')) {
      nonHostDenied = true;
    }
  });
  participantClient.emit('host-mute-user', {
    roomCode: 'WKU5DJ',
    targetUserId: hostUserId,
  });

  await new Promise((r) => setTimeout(r, 1000));
  console.log('   - Server authorization enforcement:', nonHostDenied ? 'PASS' : 'FAIL');

  // Test 2: Host mutes participant
  console.log('3. Testing authorized host-mute-user...');
  let participantReceivedMute = false;
  participantClient.once('mute-user', (payload) => {
    console.log('   - Participant received mute-user command from:', payload.mutedBy);
    if (payload.targetUserId === nonHostUserId) {
      participantReceivedMute = true;
    }
  });

  hostClient.emit('host-mute-user', {
    roomCode: 'WKU5DJ',
    targetUserId: nonHostUserId,
  });

  await new Promise((r) => setTimeout(r, 600));
  console.log('   - Host remote mute delivery:', participantReceivedMute ? 'PASS' : 'FAIL');

  // Test 3: Host mute-all
  console.log('4. Testing host-mute-all...');
  let participantReceivedMuteAll = false;
  participantClient.once('mute-all-by-host', (payload) => {
    console.log('   - Participant received mute-all-by-host command from host:', payload.hostUserId);
    if (payload.hostUserId === hostUserId) {
      participantReceivedMuteAll = true;
    }
  });

  hostClient.emit('host-mute-all', {
    roomCode: 'WKU5DJ',
  });

  await new Promise((r) => setTimeout(r, 600));
  console.log('   - Host mute-all delivery:', participantReceivedMuteAll ? 'PASS' : 'FAIL');

  // Test 4: Host remove from voice
  console.log('5. Testing host-remove-from-voice...');
  let participantReceivedRemove = false;
  participantClient.once('removed-from-voice', (payload) => {
    console.log('   - Participant received removed-from-voice command for user:', payload.targetUserId);
    if (payload.targetUserId === nonHostUserId) {
      participantReceivedRemove = true;
    }
  });

  hostClient.emit('host-remove-from-voice', {
    roomCode: 'WKU5DJ',
    targetUserId: nonHostUserId,
  });

  await new Promise((r) => setTimeout(r, 600));
  console.log('   - Host remove-from-voice delivery:', participantReceivedRemove ? 'PASS' : 'FAIL');

  // Clean up
  hostClient.disconnect();
  participantClient.disconnect();

  const allPassed = nonHostDenied && participantReceivedMute && participantReceivedMuteAll && participantReceivedRemove;
  console.log('\n=== VOICE MODERATION TEST RESULT:', allPassed ? 'ALL TESTS PASSED ===' : 'SOME TESTS FAILED ===');
  process.exit(allPassed ? 0 : 1);
}

testVoiceModeration().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
