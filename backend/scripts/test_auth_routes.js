// scripts/test_auth_routes.js - End-to-end integration test for auth endpoints
const axios = require('axios');

const BASE_URL = 'http://192.168.0.101:5000';

async function testRoutes() {
  console.log('========================================================');
  console.log('TESTING CODEO BACKEND AUTHENTICATION ENDPOINTS');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  async function runTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.log(`❌ [FAIL] ${name}: ${err.response?.data?.error || err.message}`);
    }
  }

  // Test 1: Health check
  await runTest('GET /health returns 200 OK', async () => {
    const res = await axios.get(`${BASE_URL}/health`);
    if (res.status !== 200 || res.data.status !== 'ok') throw new Error('Unexpected health response');
  });

  // Test 2: Google OAuth URL generation
  await runTest('GET /api/auth/google returns OAuth URL', async () => {
    const res = await axios.get(`${BASE_URL}/api/auth/google?redirect_to=http://localhost:5173/auth/callback`);
    if (res.status !== 200 || !res.data.url) throw new Error('No URL returned');
    if (!res.data.url.includes('google') && !res.data.url.includes('supabase')) throw new Error('Invalid OAuth URL');
  });

  // Test 3: Validation on empty signup
  await runTest('POST /api/auth/signup rejects invalid email/password', async () => {
    try {
      await axios.post(`${BASE_URL}/api/auth/signup`, { email: 'bademail', password: '123' });
      throw new Error('Should have failed');
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error) {
        return; // Expected 400 validation error
      }
      throw err;
    }
  });

  // Test 4: Validation on missing credentials for signin
  await runTest('POST /api/auth/signin rejects missing credentials', async () => {
    try {
      await axios.post(`${BASE_URL}/api/auth/signin`, {});
      throw new Error('Should have failed');
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error) {
        return; // Expected 400
      }
      throw err;
    }
  });

  // Test 5: verifyAuth rejects unauthenticated request to /me
  await runTest('GET /api/auth/me rejects requests without token (401)', async () => {
    try {
      await axios.get(`${BASE_URL}/api/auth/me`);
      throw new Error('Should have failed');
    } catch (err) {
      if (err.response?.status === 401 && err.response?.data?.code === 'UNAUTHORIZED') {
        return; // Expected 401
      }
      throw err;
    }
  });

  // Test 6: verifyAuth rejects malformed token
  await runTest('GET /api/auth/me rejects invalid bearer token (401)', async () => {
    try {
      await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: 'Bearer invalid.fake.token' },
      });
      throw new Error('Should have failed');
    } catch (err) {
      if (err.response?.status === 401) {
        return; // Expected 401
      }
      throw err;
    }
  });

  // Test 7: 404 handler for unknown routes
  await runTest('GET /api/auth/unknown-endpoint returns 404', async () => {
    try {
      await axios.get(`${BASE_URL}/api/auth/unknown-endpoint`);
      throw new Error('Should have failed');
    } catch (err) {
      if (err.response?.status === 404) {
        return; // Expected 404
      }
      throw err;
    }
  });

  console.log('\n--------------------------------------------------------');
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('========================================================');
}

testRoutes();
