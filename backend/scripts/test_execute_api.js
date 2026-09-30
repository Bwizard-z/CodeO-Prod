const axios = require('axios');

const API_BASE = 'http://192.168.0.101:5000/api/execute';

async function runTests() {
  console.log('=== TEST 1: GET /api/execute/languages ===');
  const langRes = await axios.get(`${API_BASE}/languages`);
  console.log('Status:', langRes.status);
  console.log('Languages:', langRes.data.languages);
  console.log('Supported:', langRes.data.supported);

  console.log('\n=== TEST 2: POST /api/execute (JavaScript) ===');
  const jsRes = await axios.post(`${API_BASE}`, {
    language: 'javascript',
    code: 'const a = 10; const b = 20; console.log("Sum:", a + b);',
    roomId: 'ASRH8V',
    userName: 'TesterJS',
  });
  console.log('Status:', jsRes.status);
  console.log('Output:', JSON.stringify(jsRes.data.output));
  console.log('Status ID:', jsRes.data.status_id, 'Error:', jsRes.data.error);

  console.log('\n=== TEST 3: POST /api/execute (Python) ===');
  const pyRes = await axios.post(`${API_BASE}`, {
    language: 'python',
    code: 'x = [1, 2, 3, 4]\nprint("Squares:", [n**2 for n in x])',
    roomId: 'ASRH8V',
    userName: 'TesterPy',
  });
  console.log('Status:', pyRes.status);
  console.log('Output:', JSON.stringify(pyRes.data.output));
  console.log('Status ID:', pyRes.data.status_id, 'Error:', pyRes.data.error);

  console.log('\n=== TEST 4: POST /api/execute (C++) ===');
  const cppRes = await axios.post(`${API_BASE}`, {
    language: 'cpp',
    code: '#include <iostream>\nint main() { std::cout << "C++ Execution Successful!" << std::endl; return 0; }',
    roomId: 'ASRH8V',
    userName: 'TesterCpp',
  });
  console.log('Status:', cppRes.status);
  console.log('Output:', JSON.stringify(cppRes.data.output));
  console.log('Status ID:', cppRes.data.status_id, 'Error:', cppRes.data.error);

  console.log('\n=== TEST 5: POST /api/execute (Java) ===');
  const javaRes = await axios.post(`${API_BASE}`, {
    language: 'java',
    code: 'public class Main { public static void main(String[] args) { System.out.println("Java Execution Successful!"); } }',
    roomId: 'ASRH8V',
    userName: 'TesterJava',
  });
  console.log('Status:', javaRes.status);
  console.log('Output:', JSON.stringify(javaRes.data.output));
  console.log('Status ID:', javaRes.data.status_id, 'Error:', javaRes.data.error);

  console.log('\n=== TEST 6: POST /api/execute (Stdin Input) ===');
  const stdinRes = await axios.post(`${API_BASE}`, {
    language: 'python',
    code: 'import sys\nname = sys.stdin.read().strip()\nprint(f"Hello, {name}!")',
    stdin: 'CodeO User',
    roomId: 'ASRH8V',
    userName: 'TesterStdin',
  });
  console.log('Status:', stdinRes.status);
  console.log('Output:', JSON.stringify(stdinRes.data.output));

  console.log('\n=== TEST 7: GET /api/execute/history/:roomId ===');
  const histRes = await axios.get(`${API_BASE}/history/ASRH8V`);
  console.log('Status:', histRes.status);
  console.log('History count:', histRes.data.count);
  if (histRes.data.history.length > 0) {
    const latest = histRes.data.history[0];
    console.log('Latest history entry:', {
      language: latest.language,
      output: latest.output.trim(),
      userName: latest.userName,
      status: latest.status,
      timestamp: latest.timestamp,
    });
  }

  console.log('\n=== TEST 8: Validation - Unsupported Language ===');
  try {
    await axios.post(`${API_BASE}`, {
      language: 'ruby',
      code: 'puts "hello"',
    });
    console.error('FAILED: Unsupported language should return 400');
  } catch (err) {
    console.log('Status:', err.response?.status, 'Error message:', err.response?.data?.error);
  }

  console.log('\n=== TEST 9: Validation - Missing / Empty Code ===');
  try {
    await axios.post(`${API_BASE}`, {
      language: 'javascript',
      code: '   ',
    });
    console.error('FAILED: Empty code should return 400');
  } catch (err) {
    console.log('Status:', err.response?.status, 'Error message:', err.response?.data?.error);
  }

  console.log('\n🎉 ALL EXECUTION API TESTS COMPLETED SUCCESSFULLY!');
}

runTests().catch(console.error);
