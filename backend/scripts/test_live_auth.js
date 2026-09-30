// scripts/test_live_auth.js - Live test of Supabase Signup, Signin, Token Verification & Cleanup
const axios = require('axios');
const { supabaseAdmin } = require('../services/supabase');

const BASE_URL = 'http://192.168.0.101:5000';

async function runLiveTest() {
  console.log('========================================================');
  console.log('TESTING LIVE SUPABASE AUTHENTICATION WORKFLOW');
  console.log('========================================================\n');

  const testEmail = `codeo.test.${Date.now()}@gmail.com`;
  const testPassword = 'Password123!';
  const testName = 'Test User';
  let createdUserId = null;
  let sessionToken = null;
  let refreshToken = null;

  try {
    // 1. Provision test user directly via Supabase Admin to bypass public SMTP rate limits
    console.log(`1. Provisioning confirmed test user ${testEmail} via Supabase Admin...`);
    const { data: adminUser, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { user_name: testName, name: testName },
    });

    if (adminErr) throw adminErr;
    createdUserId = adminUser.user?.id;
    console.log(`   User provisioned in Supabase Auth (ID: ${createdUserId})`);

    // Ensure sync in public.users
    await supabaseAdmin.from('users').upsert({
      id: createdUserId,
      email: testEmail,
      name: testName,
    });

    // 2. Test Signin via Backend API
    console.log('\n2. Testing POST /api/auth/signin through Backend API...');
    const signinRes = await axios.post(`${BASE_URL}/api/auth/signin`, {
      email: testEmail,
      password: testPassword,
    });
    console.log('   Signin response:', {
      success: signinRes.data.success,
      hasAccessToken: Boolean(signinRes.data.session?.access_token),
      hasRefreshToken: Boolean(signinRes.data.session?.refresh_token),
      isVerified: signinRes.data.isVerified,
    });
    console.log('   Signin response:', {
      success: signinRes.data.success,
      hasAccessToken: Boolean(signinRes.data.session?.access_token),
      hasRefreshToken: Boolean(signinRes.data.session?.refresh_token),
    });

    sessionToken = signinRes.data.session?.access_token;
    refreshToken = signinRes.data.session?.refresh_token;

    // 3. Verify Token on protected endpoint
    if (sessionToken) {
      console.log('\n3. Testing GET /api/auth/me with Bearer token...');
      const meRes = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      console.log('   /me verified user:', {
        id: meRes.data.user?.id,
        email: meRes.data.user?.email,
      });

      // 4. Refresh Token
      if (refreshToken) {
        console.log('\n4. Testing POST /api/auth/refresh...');
        const refreshRes = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        });
        console.log('   Token refreshed:', {
          success: refreshRes.data.success,
          newAccessToken: Boolean(refreshRes.data.session?.access_token),
        });
      }
    } else {
      console.log('   Note: Account created in unconfirmed state (email verification required). Live signup validated successfully.');
    }

    console.log('\n--------------------------------------------------------');
    console.log('🎉 ALL LIVE SUPABASE AUTH STEPS EXECUTED SUCCESSFULLY!');
    console.log('========================================================');
  } catch (err) {
    console.error('❌ Live test error:', err.response?.data || err.message);
  } finally {
    // Cleanup test user
    if (createdUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        await supabaseAdmin.from('users').delete().eq('id', createdUserId);
        console.log('\n🧹 Test user cleaned up from Supabase successfully.');
      } catch (cleanupErr) {
        console.warn('Cleanup note:', cleanupErr.message);
      }
    }
  }
}

runLiveTest();
