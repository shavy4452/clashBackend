const { createLogger, format, transports } = require('winston');
const path = require('path');

class Logger {
  constructor() {
    // Custom log format
    this.logFormat = format.printf(({ timestamp, level, message, stack }) => {
      // If the message is an instance of Error, log the stack trace
      if (stack) {
        return `${timestamp} [${level.toUpperCase()}]: ${message || ''}\nStack: ${stack}`;
      }
      // If it's a string message, just log the message
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    });

    // Initialize the logger with the given configurations
    this.logger = createLogger({
      level: this.getLogLevel(),
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }), // Capture stack traces for errors 
        format.splat(),
        this.logFormat
      ),
      transports: this.getTransports(),
    });
  }

  /**
   * Determines the logging level based on the environment.
   * @returns {string} Logging level (debug for development, info for production).
   */
  getLogLevel() {
    return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
  }

  /**
   * Sets up the transport configurations for the logger.
   * @returns {Array} Array of Winston transports.
   */
  getTransports() {
    const logDir = path.join(__dirname, '../logs/system');
    return [
      // Console transport with colors and simplified output for better readability
      new transports.Console({
        format: format.combine(
          format.colorize(),  // Colorize log levels for the console
          format.simple()     // Simplified log output for better readability
        ),
      }),
      // File transport for error logs, captures only 'error' level logs
      new transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error', // Only error logs go here
      }),
      // File transport for all logs
      new transports.File({
        filename: path.join(logDir, 'combined.log'),
      }),
    ];
  }

  /**
   * Dynamically change the log level at runtime.
   * @param {string} level - Log level to set (e.g., 'info', 'debug', 'warn').
   */
  setLogLevel(level) {
    this.logger.level = level;
  }

  /**
   * Logs a message at the specified level.
   * @param {string} level - Log level (e.g., 'info', 'error', 'debug').
   * @param {string} message - Log message.
   */
  log(level, message) {
    this.logger.log({ level, message });
  }

  /**
   * Logs an informational message.
   * @param {string} message - Log message.
   */
  info(message, ...optionalParams) {
    this.logger.info(message, ...optionalParams);
  }

  /**
   * Logs an error message.
   * @param {string | Error} error - Error message or object.
   */
  error(error, ...optionalParams){
    if (error instanceof Error) {
      this.logger.error(error.message, { stack: error.stack });
    } else {
      this.logger.error(error, ...optionalParams);
    }
  }

  /**
   * Logs a warning message.
   * @param {string} message - Log message.
   */
  warn(message, ...optionalParams) {
    this.logger.warn(message, ...optionalParams);
  }

  /**
   * Logs a debug message.
   * @param {string} message - Log message.
   */
  debug(message, ...optionalParams) {
    this.logger.debug(message, ...optionalParams);
  }
}

// Exporting an instance of Logger, ensuring it follows the Singleton pattern
module.exports = new Logger();
