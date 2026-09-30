// services/judge0.js - Proxy to judge0Service for backward compatibility
const judge0Service = require('./judge0Service');

module.exports = {
  ...judge0Service,
  executeCode: async ({ language, code, input }) => {
    return judge0Service.submitCode(code, language, input);
  },
};
