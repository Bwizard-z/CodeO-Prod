const judge0Service = require('../services/judge0Service');

async function test() {
  console.log('--- Testing getLanguages() ---');
  const langs = await judge0Service.getLanguages();
  console.log('Languages:', langs);

  console.log('\n--- Testing JavaScript ---');
  const jsRes = await judge0Service.submitCode('console.log("Hello JS from Judge0");', 'javascript');
  console.log('JS output:', JSON.stringify(jsRes.output), 'status:', jsRes.status_id, 'error:', jsRes.error);

  console.log('\n--- Testing Python ---');
  const pyRes = await judge0Service.submitCode('print("Hello Python from Judge0")', 'python');
  console.log('Python output:', JSON.stringify(pyRes.output), 'status:', pyRes.status_id, 'error:', pyRes.error);

  console.log('\n--- Testing C++ ---');
  const cppCode = '#include <iostream>\nint main() { std::cout << "Hello C++"; return 0; }';
  const cppRes = await judge0Service.submitCode(cppCode, 'cpp');
  console.log('C++ output:', JSON.stringify(cppRes.output), 'status:', cppRes.status_id, 'error:', cppRes.error);

  console.log('\n--- Testing Java ---');
  const javaCode = 'public class Main { public static void main(String[] args) { System.out.println("Hello Java"); } }';
  const javaRes = await judge0Service.submitCode(javaCode, 'java');
  console.log('Java output:', JSON.stringify(javaRes.output), 'status:', javaRes.status_id, 'error:', javaRes.error);

  console.log('\n--- Testing Unsupported Language ---');
  try {
    await judge0Service.submitCode('puts "test"', 'ruby');
    console.error('FAILED: Should have thrown for ruby');
  } catch (err) {
    console.log('Properly rejected unsupported language:', err.message);
  }
}

test().catch(console.error);
