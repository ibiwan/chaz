import http from 'http';
import next from 'next';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  getSession,
  getSessionByKeyword,
  createSession,
  upsertSession,
  ChessSession
} from './lib/sqlite.ts';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const sessionsClients = new Map(); // sessionId -> Set<ws>
const clientMeta = new Map(); // ws -> { sessionId, ip, role }

function sendWs(ws, payload) {
  try {
    ws.send(JSON.stringify(payload));
  } catch (err) {
    console.error('WS send failure', err);
  }
}

function broadcast(sessionId, data) {
  const clients = sessionsClients.get(sessionId);
  if (!clients) return;
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      sendWs(ws, data);
    }
  }
}

function getConnectionIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

function toPlayerSlot(session, ip) {
  if (session.player1_ip === ip) return 'player1';
  if (session.player2_ip === ip) return 'player2';
  if (!session.player1_ip) return 'player1';
  if (!session.player2_ip) return 'player2';
  return null;
}

function ensureSessionForKeyword(keyword, ip) {
  let session = getSessionByKeyword(keyword);
  if (!session) {
    const emptySession = {
      id: uuidv4(),
      player1_ip: ip,
      player2_ip: null,
      keyword,
      white: 'player1',
      started: false,
      moves: ''
    };
    return createSession(emptySession);
  }

  if (!session.player2_ip && session.player1_ip !== ip) {
    session.player2_ip = ip;
    return upsertSession(session);
  }

  return session;
}

function handleCommand(ws, msg) {
  const meta = clientMeta.get(ws);
  if (!meta) {
    sendWs(ws, { type: 'error', message: 'Not joined yet' });
    return;
  }

  const session = getSession(meta.sessionId);
  if (!session) {
    sendWs(ws, { type: 'error', message: 'Session not found' });
    return;
  }

  switch (msg.type) {
    case 'sit_white': {
      const slot = toPlayerSlot(session, meta.ip);
      if (!slot) return sendWs(ws, { type: 'error', message: 'Game is full, observer only' });
      session.white = slot;
      if (slot === 'player1') session.player1_ip = meta.ip;
      if (slot === 'player2') session.player2_ip = meta.ip;
      upsertSession(session);
      return broadcast(session.id, { type: 'session', session });
    }
    case 'sit_black': {
      const slot = toPlayerSlot(session, meta.ip);
      if (!slot) return sendWs(ws, { type: 'error', message: 'Game is full, observer only' });
      session.white = slot === 'player1' ? 'player2' : 'player1';
      if (slot === 'player1') session.player1_ip = meta.ip;
      if (slot === 'player2') session.player2_ip = meta.ip;
      upsertSession(session);
      return broadcast(session.id, { type: 'session', session });
    }
    case 'ready': {
      session.started = true;
      upsertSession(session);
      return broadcast(session.id, { type: 'session', session });
    }
    case 'move': {
      const move = String(msg.move || '').trim();
      if (!move) return sendWs(ws, { type: 'error', message: 'Move text required' });
      const moves = session.moves ? `${session.moves},${move}` : move;
      session.moves = moves;
      upsertSession(session);
      return broadcast(session.id, { type: 'session', session });
    }
    default:
      sendWs(ws, { type: 'error', message: 'Unknown command' });
  }
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const ip = getConnectionIp(req);

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (err) {
        return sendWs(ws, { type: 'error', message: 'invalid json' });
      }

      if (msg.type === 'join') {
        if (!msg.keyword || typeof msg.keyword !== 'string') {
          return sendWs(ws, { type: 'error', message: 'keyword required' });
        }

        const session = ensureSessionForKeyword(msg.keyword, ip);

        let role = 'observer';
        if (session.player1_ip === ip) role = 'white';
        else if (session.player2_ip === ip) role = 'black';

        if (!sessionsClients.has(session.id)) sessionsClients.set(session.id, new Set());
        sessionsClients.get(session.id).add(ws);
        clientMeta.set(ws, { sessionId: session.id, ip, role });

        sendWs(ws, { type: 'joined', session, role });
        broadcast(session.id, { type: 'session', session });
        return;
      }

      if (!clientMeta.has(ws)) {
        return sendWs(ws, { type: 'error', message: 'must join first' });
      }

      handleCommand(ws, msg);
    });

    ws.on('close', () => {
      const meta = clientMeta.get(ws);
      if (meta) {
        const set = sessionsClients.get(meta.sessionId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) sessionsClients.delete(meta.sessionId);
        }
        clientMeta.delete(ws);
      }
    });
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`dev server running on http://localhost:${port}`);
    console.log(`ws endpoint ws://localhost:${port}/ws`);
  });
});
