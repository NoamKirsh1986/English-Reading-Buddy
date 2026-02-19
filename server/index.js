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
const express = require('express');
const cors = require('cors');
const storyRoutes = require('./routes/story');
const voiceRoutes = require('./routes/voice');
const { setupRealtimeProxy } = require('./routes/realtime');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/story', storyRoutes);
app.use('/api/voice', voiceRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const server = http.createServer(app);
setupRealtimeProxy(server);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
