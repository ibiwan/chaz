// Accessors for the sessions table using pg client
import dotenv from 'dotenv';
dotenv.config();
import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});
if (!client._connected) client.connect();

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
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getSessionByKeyword(keyword) {
  const { rows } = await client.query('SELECT * FROM sessions WHERE keyword = $1 LIMIT 1', [keyword]);
  if (rows.length === 0) return null;
  return rowToSession(rows[0]);
}

export async function getSessionByToken(token) {
  const { rows } = await client.query('SELECT * FROM sessions WHERE player1_token = $1 OR player2_token = $1 LIMIT 1', [token]);
  if (rows.length === 0) return null;
  return rowToSession(rows[0]);
}

export async function createSession(session) {
  const { rows } = await client.query(
    `INSERT INTO sessions (id, player1_token, player2_token, keyword, white, started, player1_ready, player2_ready, moves, winner, gameStatus)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      session.gameStatus || null
    ]
  );
  if (rows.length === 0) return null;
  return rowToSession(rows[0]);
}

export async function getSession(id) {
  const { rows } = await client.query('SELECT * FROM sessions WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return rowToSession(rows[0]);
}

export async function upsertSession(session) {
  const { rows } = await client.query(
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
      session.gameStatus || null
    ]
  );
  if (rows.length === 0) return null;
  return rowToSession(rows[0]);
}
