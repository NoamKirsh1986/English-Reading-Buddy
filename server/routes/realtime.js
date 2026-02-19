const WebSocket = require('ws');

function setupRealtimeProxy(server) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws/realtime') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        handleConnection(ws);
      });
    } else {
      socket.destroy();
    }
  });
}

function handleConnection(clientWs) {
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
  }

  const openaiWs = new WebSocket(url, wsOptions);

  let openaiReady = false;
  const messageQueue = [];

  openaiWs.on('open', () => {
    console.log('Connected to OpenAI Realtime API');
    openaiReady = true;
    for (const msg of messageQueue) {
      openaiWs.send(msg);
    }
    messageQueue.length = 0;
  });

  openaiWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data.toString());
    }
  });

  openaiWs.on('error', (err) => {
    console.error('OpenAI WS error:', err.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });

  openaiWs.on('close', (code, reason) => {
    console.log('OpenAI WS closed:', code, reason?.toString());
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
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
    console.log('Client disconnected from realtime');
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
  });

  clientWs.on('error', (err) => {
    console.error('Client WS error:', err.message);
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
  });
}

module.exports = { setupRealtimeProxy };
