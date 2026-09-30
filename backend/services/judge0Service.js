// services/judge0Service.js - Judge0 code execution service
const axios = require('axios');

// Supported language mappings per requirements
const LANGUAGE_MAP = {
  javascript: 63,
  js: 63,
  python: 71,
  py: 71,
  java: 62,
  'c++': 54,
  cpp: 54,
};

const SUPPORTED_LANGUAGES = {
  63: 'JavaScript',
  71: 'Python',
  62: 'Java',
  54: 'C++',
};

// Cached resolved working base URL for Judge0
let cachedBaseUrl = null;

/**
 * Resolve Judge0 base URL, supporting both standard root and /api/v1 mounts.
 */
function getJudge0Url() {
  if (cachedBaseUrl) return cachedBaseUrl;
  let url = (process.env.JUDGE0_URL || 'http://localhost:2358/api/v1').trim();
  url = url.replace(/\/+$/, '');
  return url;
}

/**
 * Safe base64 decoding helper
 */
function decodeBase64(str) {
  if (!str) return '';
  try {
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return String(str);
  }
}

/**
 * Safe base64 encoding helper
 */
function encodeBase64(str) {
  if (typeof str !== 'string') return '';
  return Buffer.from(str, 'utf-8').toString('base64');
}

/**
 * Make an HTTP request to Judge0 with automatic fallback if /api/v1 is 404
 */
async function judge0Request(method, path, data = null, params = {}) {
  const baseUrl = getJudge0Url();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (process.env.JUDGE0_API_KEY) {
    headers['X-Auth-Token'] = process.env.JUDGE0_API_KEY;
  }

  // Support RapidAPI hosted Judge0
  if (process.env.RAPIDAPI_KEY) {
    headers['x-rapidapi-key'] = process.env.RAPIDAPI_KEY;
    try {
      headers['x-rapidapi-host'] = new URL(baseUrl).host;
    } catch {
      headers['x-rapidapi-host'] = 'judge0-ce.p.rapidapi.com';
    }
  }

  const options = {
    method,
    headers,
    timeout: 10000, // 10 second timeout for production resilience
    params,
    ...(data ? { data } : {})
  };

  try {
    const res = await axios({ ...options, url: `${baseUrl}${path}` });
    cachedBaseUrl = baseUrl;
    return res.data;
  } catch (err) {
    // If baseUrl ends in /api/v1 and returns 404, fallback to root mount
    if (err.response?.status === 404 && baseUrl.endsWith('/api/v1')) {
      const rootUrl = baseUrl.replace(/\/api\/v1$/, '');
      const retryRes = await axios({ ...options, url: `${rootUrl}${path}` });
      cachedBaseUrl = rootUrl;
      return retryRes.data;
    }
    throw err;
  }
}

/**
 * handleExecution:
 * 1. Encodes code (and stdin) in base64
 * 2. Sends to Judge0 /submissions?base64_encoded=true&wait=true
 * 3. Waits for response (5s timeout)
 * 4. Decodes output
 * 5. Returns clean output or error
 *
 * @param {string} code - Source code
 * @param {number} languageId - Judge0 Language ID
 * @param {string} [stdin=''] - Optional standard input
 * @returns {Promise<{ output: string, stderr: string, compile_output: string, status_id: number, status_description: string, execution_time_ms: number, memory_kb: number, error: boolean }>}
 */
async function handleExecution(code, languageId, stdin = '') {
  if (!code || typeof code !== 'string') {
    throw new Error('Code is required for execution');
  }

  const base64Code = encodeBase64(code);
  const base64Stdin = stdin ? encodeBase64(stdin) : null;

  const payload = {
    source_code: base64Code,
    language_id: Number(languageId),
    ...(base64Stdin ? { stdin: base64Stdin } : {}),
  };

  try {
    const data = await judge0Request('POST', '/submissions', payload, {
      base64_encoded: true,
      wait: true,
    });

    // Decode outputs
    const stdout = decodeBase64(data.stdout);
    const stderr = decodeBase64(data.stderr);
    const compileOutput = decodeBase64(data.compile_output);
    const message = decodeBase64(data.message);

    const statusId = data.status?.id || 0;
    const statusDesc = data.status?.description || 'Unknown';
    const isSuccess = statusId === 3; // 3 = Accepted
    const isTimeout = statusId === 5; // 5 = Time Limit Exceeded
    const isCompileError = statusId === 6; // 6 = Compilation Error
    const isRuntimeError = statusId >= 7 && statusId <= 12;

    // Determine clean output
    let cleanOutput = '';
    if (isCompileError) {
      cleanOutput = compileOutput || stderr || 'Compilation Error';
    } else if (isTimeout) {
      cleanOutput = 'Time Limit Exceeded (>5s)';
    } else if (isRuntimeError) {
      cleanOutput = stderr || message || `Runtime Error: ${statusDesc}`;
    } else if (stderr && !stdout) {
      cleanOutput = stderr;
    } else {
      cleanOutput = stdout || 'Program finished with no output.';
    }

    const executionTimeMs = data.time ? Math.round(parseFloat(data.time) * 1000) : 0;

    return {
      output: cleanOutput,
      stdout,
      stderr,
      compile_output: compileOutput,
      message,
      status_id: statusId,
      status_description: statusDesc,
      execution_time_ms: executionTimeMs,
      memory_kb: data.memory || 0,
      error: !isSuccess,
    };
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return {
        output: 'Execution timeout (>5s)',
        stderr: 'Time Limit Exceeded',
        compile_output: '',
        message: 'Request timed out after 5 seconds',
        status_id: 5,
        status_description: 'Time Limit Exceeded',
        execution_time_ms: 5000,
        memory_kb: 0,
        error: true,
      };
    }

    const errMsg = err.response?.data?.error || err.message || 'Judge0 execution failed';
    return {
      output: `[Execution Error]: ${errMsg}`,
      stderr: errMsg,
      compile_output: '',
      message: errMsg,
      status_id: 13,
      status_description: 'Internal Error',
      execution_time_ms: 0,
      memory_kb: 0,
      error: true,
    };
  }
}

/**
 * submitCode:
 * Validates language and calls handleExecution.
 *
 * @param {string} code - Source code
 * @param {string|number} language - Language name or ID
 * @param {string} [stdin=''] - Optional standard input
 * @returns {Promise<{ output: string, stderr: string, status_id: number, compile_output: string, ... }>}
 */
async function submitCode(code, language, stdin = '') {
  let langId = null;

  if (typeof language === 'number') {
    if (SUPPORTED_LANGUAGES[language]) {
      langId = language;
    }
  } else if (typeof language === 'string') {
    const normalized = language.toLowerCase().trim();
    langId = LANGUAGE_MAP[normalized];
  }

  if (!langId) {
    const supportedList = Object.values(SUPPORTED_LANGUAGES).join(', ');
    const err = new Error(`Language '${language}' is not supported. Supported languages: ${supportedList}`);
    err.statusCode = 400;
    err.code = 'LANGUAGE_NOT_SUPPORTED';
    throw err;
  }

  return await handleExecution(code, langId, stdin);
}

/**
 * getLanguages:
 * Fetches supported languages and returns mapping:
 * { 63: 'JavaScript', 71: 'Python', 62: 'Java', 54: 'C++' }
 *
 * @returns {Promise<Object>}
 */
async function getLanguages() {
  try {
    const data = await judge0Request('GET', '/languages');
    if (Array.isArray(data)) {
      const map = {};
      data.forEach((item) => {
        if (SUPPORTED_LANGUAGES[item.id]) {
          map[item.id] = SUPPORTED_LANGUAGES[item.id];
        }
      });
      return Object.keys(map).length > 0 ? map : { ...SUPPORTED_LANGUAGES };
    }
  } catch (err) {
    console.warn('Failed to fetch languages from Judge0, returning supported whitelist:', err.message);
  }
  return { ...SUPPORTED_LANGUAGES };
}

module.exports = {
  submitCode,
  getLanguages,
  handleExecution,
  LANGUAGE_MAP,
  SUPPORTED_LANGUAGES,
};
