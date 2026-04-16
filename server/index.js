require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Configure global proxy support if HTTPS_PROXY is set (needed in containerized environments)
if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  const { HttpsProxyAgent } = require('https-proxy-agent');
  const nodeFetch = require('node-fetch');
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  const agent = new HttpsProxyAgent(proxyUrl);
  global.__proxyAgent = agent;
  global.__proxyFetch = (url, init) => nodeFetch(url, { ...init, agent });
}

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const voiceRoutes = require('./routes/voice');
const lessonRoutes = require('./routes/lesson');
const { setupRealtimeProxy } = require('./routes/realtime');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/voice', voiceRoutes);
app.use('/api/lesson', lessonRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// In production, serve the built Vite client and fall back to index.html for SPA routes.
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = http.createServer(app);
setupRealtimeProxy(server);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
