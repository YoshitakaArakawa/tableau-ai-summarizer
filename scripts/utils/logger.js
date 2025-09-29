const fs = require('fs');
const path = require('path');

function createLogger({ enabled = false, logDirectory, logFilePath }) {
  const logToFile = Boolean(enabled);
  const resolvedDirectory = logDirectory ? path.resolve(logDirectory) : null;
  const resolvedFilePath = logFilePath ? path.resolve(logFilePath) : null;

  if (logToFile && resolvedDirectory && resolvedFilePath) {
    fs.mkdirSync(resolvedDirectory, { recursive: true });
    const handle = fs.openSync(resolvedFilePath, 'a');
    fs.closeSync(handle);
  }

  function write(level, message, detail) {
    const timestamp = new Date().toISOString();
    const record = { timestamp, level, message };
    const consoleMethod = level === 'error' ? console.error : console.log;
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (detail !== undefined) {
      record.detail = detail;
    }

    const shouldWriteToFile = logToFile && resolvedFilePath;
    const shouldWriteToConsole = !shouldWriteToFile;

    if (shouldWriteToFile) {
      try {
        fs.appendFileSync(resolvedFilePath, JSON.stringify(record) + '\n', 'utf8');
      } catch (error) {
        console.error('[Server][Logger] Failed to write log file', error);
      }
    }

    if (shouldWriteToConsole) {
      if (detail !== undefined) {
        consoleMethod(formattedMessage, detail);
      } else {
        consoleMethod(formattedMessage);
      }
    }
  }

  return {
    info(message, detail) {
      write('info', message, detail);
    },
    warn(message, detail) {
      write('warn', message, detail);
    },
    error(message, detail) {
      write('error', message, detail);
    },
    debug(message, detail) {
      write('debug', message, detail);
    }
  };
}

module.exports = { createLogger };
