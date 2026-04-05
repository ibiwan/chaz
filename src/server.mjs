import http from 'http';
import next from 'next';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function rowToSession(row) {
  return {
    id: row.id,
    player1_token: row.player1_token,
    player2_token: row.player2_token,
    keyword: row.keyword,
    white: row.white,
    started: Boolean(row.started),
    player1_ready: Boolean(row.player1_ready),
    player2_ready: Boolean(row.player2_ready),
    moves: row.moves,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function getSession(id) {
  const { rows } = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return rowToSession(rows[0]);
}

async function getSessionByKeyword(keyword) {
  const { rows } = await pool.query('SELECT * FROM sessions WHERE keyword = $1 LIMIT 1', [keyword]);
  if (rows.length === 0) return null;
  return rowToSession(rows[0]);
}

async function createSession(session) {
  const { rows } = await pool.query(
    `INSERT INTO sessions (id, player1_token, player2_token, keyword, white, started, player1_ready, player2_ready, moves)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      session.id,
      session.player1_token || null,
      session.player2_token || null,
      session.keyword,
      session.white,
      session.started ? 1 : 0,
      session.player1_ready ? 1 : 0,
      session.player2_ready ? 1 : 0,
      session.moves || ''
    ]
  );
  if (rows.length === 0) return null;
  return rowToSession(rows[0]);
}

async function upsertSession(session) {
  const { rows } = await pool.query(
    `UPDATE sessions SET
      player1_token = $2,
      player2_token = $3,
      keyword = $4,
      white = $5,
      started = $6,
      player1_ready = $7,
      player2_ready = $8,
      moves = $9,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [
      session.id,
      session.player1_token || null,
      session.player2_token || null,
      session.keyword,
      session.white,
      session.started ? 1 : 0,
      session.player1_ready ? 1 : 0,
      session.player2_ready ? 1 : 0,
      session.moves || ''
    ]
  );
  if (rows.length === 0) return null;
  return rowToSession(rows[0]);
}

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

function toPlayerSlot(session, token) {
  if (session.player1_token === token) return 'player1';
  if (session.player2_token === token) return 'player2';
  if (!session.player1_token) return 'player1';
  if (!session.player2_token) return 'player2';
  return null;
}

async function ensureSessionForKeyword(keyword, token) {
  let session = await getSessionByKeyword(keyword);
  if (!session) {
    const emptySession = {
      id: uuidv4(),
      player1_token: token,
      player2_token: null,
      keyword,
      white: 'player1',
      started: false,
      player1_ready: false,
      player2_ready: false,
      moves: ''
    };
    return await createSession(emptySession);
  }

  if (!session.player2_token && session.player1_token !== token) {
    session.player2_token = token;
    return await upsertSession(session);
  }

  return session;
}

async function handleCommand(ws, msg) {
  const meta = clientMeta.get(ws);
  if (!meta) {
    sendWs(ws, { type: 'error', message: 'Not joined yet' });
    return;
  }

  const session = await getSession(meta.sessionId);
  if (!session) {
    sendWs(ws, { type: 'error', message: 'Session not found' });
    return;
  }

  switch (msg.type) {
    case 'sit_white': {
      const slot = toPlayerSlot(session, meta.token);
      if (!slot) return sendWs(ws, { type: 'error', message: 'Game is full, observer only' });
      session.white = slot;
      await upsertSession(session);
      return broadcast(session.id, { type: 'session', session });
    }
    case 'sit_black': {
      const slot = toPlayerSlot(session, meta.token);
      if (!slot) return sendWs(ws, { type: 'error', message: 'Game is full, observer only' });
      session.white = slot === 'player1' ? 'player2' : 'player1';
      await upsertSession(session);
      return broadcast(session.id, { type: 'session', session });
    }
    case 'ready': {
      session.started = true;
      await upsertSession(session);
      return broadcast(session.id, { type: 'session', session });
    }
    case 'move': {
      const move = String(msg.move || '').trim();
      if (!move) return sendWs(ws, { type: 'error', message: 'Move text required' });
      const moves = session.moves ? `${session.moves},${move}` : move;
      session.moves = moves;
      await upsertSession(session);
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
    ws.on('message', async (raw) => {
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
        if (!msg.token || typeof msg.token !== 'string') {
          return sendWs(ws, { type: 'error', message: 'token required' });
        }

        const session = await ensureSessionForKeyword(msg.keyword, msg.token);

        let role = 'observer';
        if (session.player1_token === msg.token) role = 'white';
        else if (session.player2_token === msg.token) role = 'black';

        if (!sessionsClients.has(session.id)) sessionsClients.set(session.id, new Set());
        sessionsClients.get(session.id).add(ws);
        clientMeta.set(ws, { sessionId: session.id, token: msg.token, role });

        sendWs(ws, { type: 'joined', session, role });
        broadcast(session.id, { type: 'session', session });
        return;
      }

      if (!clientMeta.has(ws)) {
        return sendWs(ws, { type: 'error', message: 'must join first' });
      }

      await handleCommand(ws, msg);
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
