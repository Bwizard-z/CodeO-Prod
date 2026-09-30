// middleware/errorHandler.js - Global Express error handler
const { errorHandler, AppError, formatAuthError } = require('../utils/errorHandler');

module.exports = {
  errorHandler,
  AppError,
  formatAuthError,
};
