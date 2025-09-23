const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

const { createLogger } = require('./utils/logger');
const { getRuntimeConfig, getLoggingConfig } = require('./config/runtimeConfig');
const createSummaryRouter = require('./routes/summary');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const rootDirectory = path.resolve(__dirname, '..');
const extensionDirectory = path.resolve(rootDirectory, 'extension');
const port = Number(process.env.EXTENSION_PORT) || 8787;

const runtimeConfig = getRuntimeConfig(process.env);
const loggingConfig = getLoggingConfig(process.env, rootDirectory);
const logger = createLogger(loggingConfig);

app.use(express.json({ limit: '10mb' }));
app.use(express.static(extensionDirectory));

app.get('/runtime-config.json', (_req, res) => {
  logger.debug('Runtime config requested', runtimeConfig);
  res.json(runtimeConfig);
});

app.use('/api/llm', createSummaryRouter({ logger }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  logger.info('Extension server running', { port, logToFile: loggingConfig.enabled });
});
