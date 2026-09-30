const { supabase, supabaseAdmin } = require('../services/supabase');
const axios = require('axios');
const { io: Client } = require('socket.io-client');

const BASE_URL = 'http://192.168.0.101:5000';
const SOCKET_URL = 'http://192.168.0.101:5000';

async function runTests() {
  console.log('=== STARTING HOST CONTROLS TESTS ===\n');

  // 1. Setting up test host user with valid Supabase Auth session
  console.log('1. Setting up test host and member in database...');
  const testEmail = `host_test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  const { data: createdUser, error: createUserErr } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { user_name: 'TestHost' },
  });

  if (createUserErr || !createdUser?.user) {
    console.error('Failed to create test user in Supabase Auth:', createUserErr?.message);
    process.exit(1);
  }

  const hostUser = createdUser.user;
  // Ensure record in public.users
  await supabaseAdmin.from('users').upsert({
    id: hostUser.id,
    email: hostUser.email,
    name: 'TestHost',
  }, { onConflict: 'id' });

  // Sign in with password to obtain a genuine Supabase JWT access token
  const { data: authSession, error: signInErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInErr || !authSession?.session) {
    console.error('Failed to sign in test host:', signInErr?.message);
    process.exit(1);
  }

  const hostToken = authSession.session.access_token;
  console.log(`   - Test host authenticated: ${hostUser.email} (ID: ${hostUser.id})`);

  // Create a room owned by hostUser
  const roomCode = 'HST' + Math.random().toString(36).substring(2, 5).toUpperCase();
  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .insert({
      code: roomCode,
      invite_token: 'tok_' + Math.random().toString(36).substring(2, 10),
      title: 'Host Control Test Room',
      created_by: hostUser.id,
      language: 'javascript',
      is_locked: false,
    })
    .select()
    .single();

  if (roomErr || !room) {
    console.error('Failed to create test room:', roomErr?.message);
    process.exit(1);
  }
  console.log(`   - Created room ${room.code} (ID: ${room.id}) created_by: ${hostUser.id}`);

  // Create test host membership in room_members
  await supabaseAdmin
    .from('room_members')
    .insert({
      room_id: room.id,
      user_id: hostUser.id,
      role: 'host',
      can_edit: true,
      is_active: true,
    });

  // Create test collaborator member in room_members
  const { data: targetMember, error: targetErr } = await supabaseAdmin
    .from('room_members')
    .insert({
      room_id: room.id,
      anonymous_name: 'Target Collaborator',
      anonymous_session_id: '88888888-8888-8888-8888-888888888888',
      role: 'member',
      can_edit: true,
      is_muted: false,
      is_active: true,
    })
    .select()
    .single();

  if (targetErr || !targetMember) {
    console.error('Failed to create target member:', targetErr?.message);
    process.exit(1);
  }
  console.log(`   - Created target collaborator member: ${targetMember.id}`);

  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${hostToken}`,
      'Content-Type': 'application/json',
    },
  });

  // Setup Socket client to observe events
  console.log('\n2. Connecting Socket client to observe broadcast events...');
  const socket = Client(SOCKET_URL, { transports: ['websocket'] });
  const capturedEvents = [];

  await new Promise((resolve) => {
    socket.on('connect', () => {
      socket.emit('join-room', { roomCode: room.code, user: { id: hostUser.id, name: 'Host' } });
      setTimeout(resolve, 500);
    });
  });

  socket.on('room-locked', (d) => capturedEvents.push({ event: 'room-locked', d }));
  socket.on('room-unlocked', (d) => capturedEvents.push({ event: 'room-unlocked', d }));
  socket.on('editor-disabled', (d) => capturedEvents.push({ event: 'editor-disabled', d }));
  socket.on('editor-enabled', (d) => capturedEvents.push({ event: 'editor-enabled', d }));
  socket.on('user-muted', (d) => capturedEvents.push({ event: 'user-muted', d }));
  socket.on('user-unmuted', (d) => capturedEvents.push({ event: 'user-unmuted', d }));
  socket.on('user-kicked', (d) => capturedEvents.push({ event: 'user-kicked', d }));

  // Test 1: Lock room
  console.log('\n3. Testing POST /api/rooms/:id/lock...');
  const lockRes = await client.post(`/api/rooms/${room.code}/lock`);
  console.log('   - Lock response:', lockRes.data);
  console.log('   - is_locked:', lockRes.data.is_locked === true ? 'PASS' : 'FAIL');

  // Test 2: Unlock room
  console.log('\n4. Testing POST /api/rooms/:id/unlock...');
  const unlockRes = await client.post(`/api/rooms/${room.code}/unlock`);
  console.log('   - Unlock response:', unlockRes.data);
  console.log('   - is_locked:', unlockRes.data.is_locked === false ? 'PASS' : 'FAIL');

  // Test 3: Disable editor for member
  console.log('\n5. Testing POST /api/rooms/:id/member/:memberId/disable-editor...');
  const disableRes = await client.post(`/api/rooms/${room.code}/member/${targetMember.id}/disable-editor`);
  console.log('   - Disable editor response:', disableRes.data);
  console.log('   - can_edit:', disableRes.data.can_edit === false ? 'PASS' : 'FAIL');

  // Test 4: Enable editor for member
  console.log('\n6. Testing POST /api/rooms/:id/member/:memberId/enable-editor...');
  const enableRes = await client.post(`/api/rooms/${room.code}/member/${targetMember.id}/enable-editor`);
  console.log('   - Enable editor response:', enableRes.data);
  console.log('   - can_edit:', enableRes.data.can_edit === true ? 'PASS' : 'FAIL');

  // Test 5: Mute member
  console.log('\n7. Testing POST /api/rooms/:id/member/:memberId/mute...');
  const muteRes = await client.post(`/api/rooms/${room.code}/member/${targetMember.id}/mute`);
  console.log('   - Mute response:', muteRes.data);
  console.log('   - is_muted:', muteRes.data.is_muted === true ? 'PASS' : 'FAIL');

  // Test 6: Unmute member
  console.log('\n8. Testing POST /api/rooms/:id/member/:memberId/unmute...');
  const unmuteRes = await client.post(`/api/rooms/${room.code}/member/${targetMember.id}/unmute`);
  console.log('   - Unmute response:', unmuteRes.data);
  console.log('   - is_muted:', unmuteRes.data.is_muted === false ? 'PASS' : 'FAIL');

  // Test 7: Kick member
  console.log('\n9. Testing POST /api/rooms/:id/member/:memberId/kick...');
  const kickRes = await client.post(`/api/rooms/${room.code}/member/${targetMember.id}/kick`);
  console.log('   - Kick response:', kickRes.data);
  console.log('   - Kick success:', kickRes.data.success ? 'PASS' : 'FAIL');

  // Test 8: Fetch room members
  console.log('\n10. Testing GET /api/rooms/:id/members...');
  const membersRes = await client.get(`/api/rooms/${room.code}/members`);
  console.log('   - Members count:', membersRes.data.members?.length);
  console.log('   - Target kicked member not in active list:', !membersRes.data.members?.some(m => m.id === targetMember.id) ? 'PASS' : 'FAIL');

  // Check activity logs
  console.log('\n11. Verifying activity log entries in room_activity_log...');
  const { data: logs } = await supabaseAdmin
    .from('room_activity_log')
    .select('action, created_at')
    .eq('room_id', room.id)
    .order('created_at', { ascending: false });

  console.log('   - Actions recorded:', (logs || []).map(l => l.action).slice(0, 7));
  const hasExpectedActions = ['user_kicked', 'user_unmuted', 'user_muted', 'editor_enabled', 'editor_disabled', 'room_unlocked', 'room_locked']
    .every(act => (logs || []).some(l => l.action === act));
  console.log('   - All 7 actions logged:', hasExpectedActions ? 'PASS' : 'FAIL');

  // Wait for sockets
  await new Promise(r => setTimeout(r, 600));
  console.log('\n12. Verifying Socket events received...');
  const eventNames = capturedEvents.map(e => e.event);
  console.log('   - Socket events received:', eventNames);
  const allEventsCaptured = ['room-locked', 'room-unlocked', 'editor-disabled', 'editor-enabled', 'user-muted', 'user-unmuted', 'user-kicked']
    .every(evt => eventNames.includes(evt));
  console.log('   - All Socket.io moderation events emitted:', allEventsCaptured ? 'PASS' : 'FAIL');

  // Clean up test room
  await supabaseAdmin.from('rooms').delete().eq('id', room.id);
  socket.disconnect();

  console.log('\n=== ALL HOST CONTROL TESTS COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err.response?.data || err.message);
  process.exit(1);
});
