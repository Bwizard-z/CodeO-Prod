// scripts/test_rooms.js - Comprehensive test of CODEO Room System Backend
require('dotenv').config();
const axios = require('axios');
const { supabaseAdmin } = require('../services/supabase');

const BASE_URL = 'http://192.168.0.101:5000';

async function runRoomTests() {
  console.log('========================================================');
  console.log('TESTING CODEO ROOM SYSTEM BACKEND (CRUD & MANAGEMENT)');
  console.log('========================================================\n');

  let hostUser = null;
  let memberUser = null;
  let hostToken = null;
  let memberToken = null;
  const createdRoomIds = [];

  try {
    // 1. Provision Host and Member test users
    console.log('1. Setting up test users via Supabase Admin...');
    const hostEmail = `codeo.host.${Date.now()}@gmail.com`;
    const memberEmail = `codeo.member.${Date.now()}@gmail.com`;
    const password = 'Password123!';

    const { data: hData, error: hErr } = await supabaseAdmin.auth.admin.createUser({
      email: hostEmail,
      password,
      email_confirm: true,
      user_metadata: { name: 'Host Tester' },
    });
    if (hErr) throw hErr;
    hostUser = hData.user;

    const { data: mData, error: mErr } = await supabaseAdmin.auth.admin.createUser({
      email: memberEmail,
      password,
      email_confirm: true,
      user_metadata: { name: 'Member Tester' },
    });
    if (mErr) throw mErr;
    memberUser = mData.user;

    // Sync into public.users
    await supabaseAdmin.from('users').upsert([
      { id: hostUser.id, email: hostEmail, name: 'Host Tester' },
      { id: memberUser.id, email: memberEmail, name: 'Member Tester' },
    ]);

    // Sign in to acquire JWTs
    const hostLogin = await axios.post(`${BASE_URL}/api/auth/signin`, {
      email: hostEmail,
      password,
    });
    hostToken = hostLogin.data.session.access_token;

    const memberLogin = await axios.post(`${BASE_URL}/api/auth/signin`, {
      email: memberEmail,
      password,
    });
    memberToken = memberLogin.data.session.access_token;
    console.log('   Test users ready and authenticated.\n');

    // 2. Test POST /api/rooms (Room Creation)
    console.log('2. Testing POST /api/rooms (Create Room)...');
    const createRes = await axios.post(
      `${BASE_URL}/api/rooms`,
      {
        title: 'Algorithms & Data Structures',
        description: 'Collaborative study session for graph algorithms',
        language: 'python',
      },
      { headers: { Authorization: `Bearer ${hostToken}` } }
    );

    const room = createRes.data.room;
    createdRoomIds.push(room.id);

    const is6CharUpper = /^[A-Z0-9]{6}$/.test(room.code);
    const is32CharToken = typeof room.invite_token === 'string' && room.invite_token.length === 32;

    if (!is6CharUpper) throw new Error(`Code ${room.code} is not 6 uppercase alphanumeric characters.`);
    if (!is32CharToken) throw new Error(`Invite token ${room.invite_token} is not 32 characters.`);

    console.log(`   Room Created: ID=${room.id}, Code=${room.code}, InviteToken=${room.invite_token}`);
    console.log('   [PASS] 6-char code & 32-char token validated.\n');

    // 3. Test GET /api/rooms/:code (Public Room Info)
    console.log(`3. Testing GET /api/rooms/${room.code} (Public Access)...`);
    const publicRes = await axios.get(`${BASE_URL}/api/rooms/${room.code}`);
    const pubRoom = publicRes.data.room;
    const members = publicRes.data.members;

    if (pubRoom.title !== 'Algorithms & Data Structures') throw new Error('Room title mismatch');
    if (!Array.isArray(members) || members.length !== 1 || members[0].role !== 'host') {
      throw new Error('Host not listed as active member');
    }
    console.log(`   Fetched Room: Title="${pubRoom.title}", Members Count=${members.length}`);
    console.log('   [PASS] Public room info & host member verified.\n');

    // 4. Test GET /api/rooms/user/rooms (User Rooms & Limits)
    console.log('4. Testing GET /api/rooms/user/rooms (User Dashboard Rooms)...');
    const userRoomsRes = await axios.get(`${BASE_URL}/api/rooms/user/rooms`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    const userRoomsData = userRoomsRes.data;

    if (userRoomsData.count !== 1 || userRoomsData.limit !== 10 || userRoomsData.remaining !== 9) {
      throw new Error(`Unexpected room limit structure: ${JSON.stringify(userRoomsData)}`);
    }
    console.log(`   User Rooms: Count=${userRoomsData.count}, Limit=${userRoomsData.limit}, Remaining=${userRoomsData.remaining}`);
    console.log('   [PASS] Room limit counting verified.\n');

    // 5. Test PUT /api/rooms/:id (Update Room)
    console.log(`5. Testing PUT /api/rooms/${room.id} (Host Update)...`);
    const updateRes = await axios.put(
      `${BASE_URL}/api/rooms/${room.id}`,
      {
        title: 'Advanced Graph Algorithms',
        language: 'typescript',
        code_content: 'console.log("Hello BFS/DFS");',
      },
      { headers: { Authorization: `Bearer ${hostToken}` } }
    );
    if (updateRes.data.room.title !== 'Advanced Graph Algorithms') {
      throw new Error('Room title was not updated');
    }
    console.log(`   Updated title to: "${updateRes.data.room.title}"`);
    console.log('   [PASS] Room update verified.\n');

    // 6. Test POST /api/rooms/:code/join (Member Join)
    console.log(`6. Testing POST /api/rooms/${room.code}/join (Member Join)...`);
    const joinRes = await axios.post(
      `${BASE_URL}/api/rooms/${room.code}/join`,
      {},
      { headers: { Authorization: `Bearer ${memberToken}` } }
    );
    const joinedRoom = joinRes.data.room;
    if (joinedRoom.members.length !== 2) {
      throw new Error(`Expected 2 members after join, got ${joinedRoom.members.length}`);
    }
    console.log(`   Joined! Room now has ${joinedRoom.members.length} members.`);
    console.log('   [PASS] Join room verified.\n');

    // 7. Test Duplicate Join Rejection
    console.log('7. Testing Duplicate Join (Should Reject)...');
    try {
      await axios.post(
        `${BASE_URL}/api/rooms/${room.code}/join`,
        {},
        { headers: { Authorization: `Bearer ${memberToken}` } }
      );
      throw new Error('Should have rejected duplicate join!');
    } catch (dupErr) {
      if (dupErr.response && dupErr.response.status === 400) {
        console.log(`   Rejected duplicate join: "${dupErr.response.data.error}"`);
        console.log('   [PASS] Duplicate join rejected.\n');
      } else {
        throw dupErr;
      }
    }

    // 8. Test POST /api/rooms/:id/leave (Host leaves, transfers to member)
    console.log(`8. Testing POST /api/rooms/${room.id}/leave (Host Leaves, Transfer to Member)...`);
    const leaveRes = await axios.post(
      `${BASE_URL}/api/rooms/${room.id}/leave`,
      {},
      { headers: { Authorization: `Bearer ${hostToken}` } }
    );
    console.log(`   Leave response: ${leaveRes.data.message}`);

    // Check room public info to verify member is now host
    const afterLeaveRes = await axios.get(`${BASE_URL}/api/rooms/${room.code}`);
    const remainingMembers = afterLeaveRes.data.members;
    if (remainingMembers.length !== 1 || remainingMembers[0].role !== 'host') {
      throw new Error('Host was not transferred to the remaining member!');
    }
    console.log(`   New Host: ${remainingMembers[0].name} (role: ${remainingMembers[0].role})`);
    console.log('   [PASS] Host transfer verified.\n');

    // 9. Test DELETE /api/rooms/:id (Delete Room)
    console.log(`9. Testing DELETE /api/rooms/${room.id} (Delete Room)...`);
    const deleteRes = await axios.delete(
      `${BASE_URL}/api/rooms/${room.id}`,
      { headers: { Authorization: `Bearer ${memberToken}` } }
    );
    console.log(`   Delete response: ${deleteRes.data.message}`);

    // Verify room is now 404 for public access
    try {
      await axios.get(`${BASE_URL}/api/rooms/${room.code}`);
      throw new Error('Deleted room should return 404!');
    } catch (delErr) {
      if (delErr.response && delErr.response.status === 404) {
        console.log(`   Deleted room inaccessible: 404 Not Found`);
        console.log('   [PASS] Room deletion verified.\n');
      } else {
        throw delErr;
      }
    }

    // 10. Test Room Limit Enforced (10 rooms max)
    console.log('10. Testing Room Limit (10 active rooms max)...');
    for (let i = 1; i <= 10; i++) {
      const res = await axios.post(
        `${BASE_URL}/api/rooms`,
        { title: `Batch Room ${i}`, language: 'javascript' },
        { headers: { Authorization: `Bearer ${hostToken}` } }
      );
      createdRoomIds.push(res.data.room.id);
    }
    console.log('    10 active rooms created for host.');

    // 11th room creation must fail
    try {
      await axios.post(
        `${BASE_URL}/api/rooms`,
        { title: 'Exceeding 11th Room', language: 'javascript' },
        { headers: { Authorization: `Bearer ${hostToken}` } }
      );
      throw new Error('Should have rejected 11th room creation!');
    } catch (limitErr) {
      if (limitErr.response && limitErr.response.status === 400) {
        console.log(`    Rejected 11th room: "${limitErr.response.data.error}"`);
        console.log('    [PASS] 10-room limit strictly enforced.\n');
      } else {
        throw limitErr;
      }
    }

    console.log('--------------------------------------------------------');
    console.log('🎉 ALL 7 ROOM SYSTEM ROUTES & LOGIC VERIFIED SUCCESSFULLY!');
    console.log('========================================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
    process.exitCode = 1;
  } finally {
    console.log('🧹 Cleaning up test data from Supabase...');
    // Delete created rooms
    if (createdRoomIds.length > 0) {
      await supabaseAdmin.from('rooms').delete().in('id', createdRoomIds);
    }
    // Delete test users
    if (hostUser) {
      await supabaseAdmin.auth.admin.deleteUser(hostUser.id);
      await supabaseAdmin.from('users').delete().eq('id', hostUser.id);
    }
    if (memberUser) {
      await supabaseAdmin.auth.admin.deleteUser(memberUser.id);
      await supabaseAdmin.from('users').delete().eq('id', memberUser.id);
    }
    console.log('🧹 Cleanup complete.');
  }
}

runRoomTests();
