import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import moment from 'moment-timezone';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Timezone configuration: GMT-5 (Colombia/Perú)
const TIMEZONE = 'America/Bogota'; // GMT-5 (también funciona para Perú)

// Helper function to get current date in GMT-5
function getDateGMT5() {
  return moment().tz(TIMEZONE).format('YYYY-MM-DD');
}

// Helper function to format timestamp in GMT-5
function formatTimestampGMT5() {
  return moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
}

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom transport class that rotates based on GMT-5 timezone
class GMT5DailyRotateFile extends DailyRotateFile {
  constructor(options) {
    super({
      ...options,
      filename: path.join(logsDir, '%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      auditFile: path.join(logsDir, '.audit.json'),
      createSymlink: true,
      symlinkName: 'current.log'
    });
    
    // Store current GMT-5 date
    this.currentDateGMT5 = getDateGMT5();
  }

  // Override getDate to use GMT-5 timezone instead of server local time
  getDate() {
    return moment().tz(TIMEZONE).format('YYYY-MM-DD');
  }

  // Override shouldRotate to check date change in GMT-5
  shouldRotate(fileInfo, callback) {
    const todayGMT5 = this.getDate();
    
    // If date changed in GMT-5, rotate
    if (this.currentDateGMT5 !== todayGMT5) {
      this.currentDateGMT5 = todayGMT5;
      return callback(null, true);
    }
    
    // Otherwise use parent class logic (check file size, etc.)
    super.shouldRotate(fileInfo, callback);
  }
}

// Define log format with GMT-5 timestamp
const logFormat = winston.format.combine(
  winston.format.timestamp({ 
    format: () => formatTimestampGMT5() 
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

// Daily rotate file transport with GMT-5 timezone
// File rotates at midnight GMT-5 (00:00 Colombia/Perú time)
const fileRotateTransport = new GMT5DailyRotateFile({
  maxSize: '10m', // Rotate if file exceeds 10MB (creates .1, .2, etc.)
  maxFiles: '14d', // Keep only last 14 days
  zippedArchive: true, // Compress old logs (.gz)
  format: logFormat
});

// Console transport (for development) with GMT-5 timestamp
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ 
      format: () => formatTimestampGMT5() 
    }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  )
});

// Helper function to create GMT5DailyRotateFile transport
function createGMT5DailyRotateFile(filename) {
  return new GMT5DailyRotateFile({
    filename: path.join(logsDir, filename),
    maxSize: '10m',
    maxFiles: '14d',
    zippedArchive: true,
    format: logFormat
  });
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    fileRotateTransport,
    consoleTransport
  ],
  exceptionHandlers: [
    createGMT5DailyRotateFile('exceptions-%DATE%.log'),
    consoleTransport
  ],
  rejectionHandlers: [
    createGMT5DailyRotateFile('rejections-%DATE%.log'),
    consoleTransport
  ]
});

// Export logger
export default logger;
