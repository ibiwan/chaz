import dotenv from 'dotenv';
dotenv.config();
import pgPromise from 'pg-promise';

const pgp = pgPromise({
  error(err, e) {
    console.error('[DB] pool error:', err.message, e?.cn ? `(host: ${e.cn.host})` : '');
  },
});

const db = pgp(process.env.DATABASE_URL);

// Retryable PG error codes: connection reset/refused/timeout, server shutdown
const RETRYABLE = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', '57P01', '08006', '08001', '08003', '08004']);

function isRetryable(err) {
  return RETRYABLE.has(err.code) || /terminating connection|connection reset/i.test(err.message || '');
}

async function withReadRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 100 * 2 ** i));
    }
  }
}

// Converts a DB row to a JS session object
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
    winner: row.winner,
    gameStatus: row.gameStatus,
    draw_offered: row.draw_offered === true || row.draw_offered === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getSessionByKeyword(keyword) {
  const row = await withReadRetry(() =>
    db.oneOrNone('SELECT * FROM sessions WHERE keyword = $1 LIMIT 1', [keyword])
  );
  return row ? rowToSession(row) : null;
}

export async function getSessionByToken(token) {
  const row = await withReadRetry(() =>
    db.oneOrNone('SELECT * FROM sessions WHERE player1_token = $1 OR player2_token = $1 LIMIT 1', [token])
  );
  return row ? rowToSession(row) : null;
}

export async function createSession(session) {
  const row = await db.oneOrNone(
    `INSERT INTO sessions (id, player1_token, player2_token, keyword, white, started, player1_ready, player2_ready, moves, winner, gameStatus, draw_offered)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      session.moves || '',
      session.winner || null,
      session.gameStatus || null,
      session.draw_offered ? 1 : 0,
    ]
  );
  return row ? rowToSession(row) : null;
}

export async function getSession(id) {
  const row = await withReadRetry(() =>
    db.oneOrNone('SELECT * FROM sessions WHERE id = $1', [id])
  );
  return row ? rowToSession(row) : null;
}

export async function upsertSession(session) {
  const row = await db.oneOrNone(
    `UPDATE sessions SET
        player1_token = $2,
        player2_token = $3,
        keyword = $4,
        white = $5,
        started = $6,
        player1_ready = $7,
        player2_ready = $8,
        moves = $9,
        winner = $10,
        gameStatus = $11,
        draw_offered = $12,
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
      session.moves || '',
      session.winner || null,
      session.gameStatus || null,
      session.draw_offered ? 1 : 0,
    ]
  );
  return row ? rowToSession(row) : null;
}
