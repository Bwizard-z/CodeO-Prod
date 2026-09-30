const http = require('http');

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request('http://192.168.0.101:5000' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get('http://192.168.0.101:5000' + path, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('=== TESTING CODEO ROUTES ===');

  // GET endpoints
  const gets = [
    '/health',
    '/api/health',
    '/api/rooms/user/rooms',
    '/rooms/user/rooms',
    '/api/rooms/user',
    '/rooms/user',
    '/api/rooms/WKU5DJ',
    '/rooms/WKU5DJ',
    '/api/execute/languages',
    '/execute/languages',
    '/api/ai/history/WKU5DJ',
    '/ai/history/WKU5DJ',
  ];

  for (const ep of gets) {
    const res = await getJson(ep);
    console.log(`[GET]  ${res.status} ${ep}`);
    if (res.status !== 200) {
      console.error(`FAILED: ${ep} returned ${res.status}`);
      process.exit(1);
    }
  }

  // POST endpoints
  const p1 = await postJson('/api/ai/validate', { question: 'How do quicksort and mergesort differ?' });
  console.log(`[POST] ${p1.status} /api/ai/validate`);
  if (p1.status !== 200) process.exit(1);

  const p2 = await postJson('/api/execute', { code: 'console.log("CODEO ROUTE TEST");', language: 'javascript' });
  console.log(`[POST] ${p2.status} /api/execute`);
  if (p2.status !== 200) process.exit(1);

  console.log('=== ALL ROUTE TESTS PASSED (100%) ===');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
