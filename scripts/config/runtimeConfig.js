const path = require('path');

function getRuntimeConfig(env) {
  return {
    model: env.OPENAI_MODEL || 'gpt-5-mini',
    modelSettings: {
      reasoning: {
        effort: env.OPENAI_MODEL_REASONING_EFFORT || 'minimal'
      },
      verbosity: env.OPENAI_MODEL_VERBOSITY || 'low'
    }
  };
}

function getLoggingConfig(env, rootDirectory) {
  const shouldLog = String(env.LOG_TO_FILE || '').toLowerCase() === 'true';
  const directory = path.resolve(rootDirectory, 'logs');
  const filePath = path.join(directory, 'server.log');

  return {
    enabled: shouldLog,
    logDirectory: directory,
    logFilePath: filePath
  };
}

module.exports = {
  getRuntimeConfig,
  getLoggingConfig
};
