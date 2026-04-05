import { WebSocketServer } from 'ws';
const sessions = new Map(); // keyword -> Set of ws
let wss = null;

function createSocketServer(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    let joined = null;
    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'join' && typeof data.keyword === 'string') {
          joined = data.keyword;
          if (!sessions.has(joined)) sessions.set(joined, new Set());
          sessions.get(joined).add(ws);
        }
      } catch { }
    });
    ws.on('close', () => {
      if (joined && sessions.has(joined)) {
        sessions.get(joined).delete(ws);
        if (sessions.get(joined).size === 0) sessions.delete(joined);
      }
    });
  });
  return wss;
}

function broadcastState(cleanSession) {
  if (!wss || !cleanSession.keyword) return;
  const clients = sessions.get(cleanSession.keyword);
  if (!clients) return;
  const msg = JSON.stringify({ type: 'session', session: cleanSession });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

export { createSocketServer, broadcastState };
