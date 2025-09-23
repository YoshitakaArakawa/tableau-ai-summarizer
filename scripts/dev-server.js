const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const extensionDirectory = path.resolve(__dirname, '..', 'extension');
const port = Number(process.env.EXTENSION_PORT) || 8787;

app.use(express.static(extensionDirectory));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Extension dev server running at http://localhost:${port}/index.html`);
});
