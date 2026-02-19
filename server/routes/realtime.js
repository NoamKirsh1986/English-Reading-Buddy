const WebSocket = require('ws');

function setupRealtimeProxy(server) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    console.log('[Realtime] WebSocket upgrade request for:', request.url);
    if (request.url === '/ws/realtime') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        handleConnection(ws);
      });
    } else {
      console.log('[Realtime] Rejecting upgrade for unknown path:', request.url);
      socket.destroy();
    }
  });

  console.log('[Realtime] WebSocket proxy initialized, listening for /ws/realtime upgrades');
}

function handleConnection(clientWs) {
  console.log('[Realtime] Client connected, opening connection to OpenAI...');

  const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';

  const wsOptions = {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  };

  // Use proxy agent if available (containerized environments)
  if (global.__proxyAgent) {
    wsOptions.agent = global.__proxyAgent;
    console.log('[Realtime] Using HTTPS proxy agent for OpenAI connection');
  }

  let openaiWs;
  try {
    openaiWs = new WebSocket(url, wsOptions);
  } catch (err) {
    console.error('[Realtime] Failed to create OpenAI WebSocket:', err.message);
    clientWs.close();
    return;
  }

  let openaiReady = false;
  const messageQueue = [];

  openaiWs.on('open', () => {
    console.log('[Realtime] Connected to OpenAI Realtime API');
    openaiReady = true;
    if (messageQueue.length > 0) {
      console.log(`[Realtime] Flushing ${messageQueue.length} queued messages`);
      for (const msg of messageQueue) {
        openaiWs.send(msg);
      }
      messageQueue.length = 0;
    }
  });

  openaiWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data.toString());
    }
  });

  openaiWs.on('error', (err) => {
    console.error('[Realtime] OpenAI WS error:', err.message);
    if (err.code) console.error('[Realtime] Error code:', err.code);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        error: { message: `OpenAI connection error: ${err.message}`, code: err.code || 'unknown' },
      }));
      clientWs.close();
    }
  });

  openaiWs.on('close', (code, reason) => {
    const reasonStr = reason?.toString() || '';
    console.log(`[Realtime] OpenAI WS closed: code=${code} reason="${reasonStr}"`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });

  openaiWs.on('unexpected-response', (req, res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      console.error(`[Realtime] OpenAI unexpected response: ${res.statusCode} ${res.statusMessage}`);
      console.error('[Realtime] Response body:', body);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'error',
          error: { message: `OpenAI returned ${res.statusCode}: ${body}`, code: 'unexpected_response' },
        }));
        clientWs.close();
      }
    });
  });

  clientWs.on('message', (data) => {
    const msg = data.toString();
    if (openaiReady && openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(msg);
    } else {
      messageQueue.push(msg);
    }
  });

  clientWs.on('close', () => {
    console.log('[Realtime] Client disconnected');
    if (openaiWs.readyState === WebSocket.OPEN || openaiWs.readyState === WebSocket.CONNECTING) {
      openaiWs.close();
    }
  });

  clientWs.on('error', (err) => {
    console.error('[Realtime] Client WS error:', err.message);
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
  });
}

module.exports = { setupRealtimeProxy };
