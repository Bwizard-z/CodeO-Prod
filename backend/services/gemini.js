// services/gemini.js - Re-export geminiService for backwards compatibility
const geminiService = require('./geminiService');

module.exports = {
  explainCode: geminiService.explainCode,
  ...geminiService,
};
