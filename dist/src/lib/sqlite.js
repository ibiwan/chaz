"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionByKeyword = getSessionByKeyword;
exports.getSessionByToken = getSessionByToken;
exports.createSession = createSession;
exports.getSession = getSession;
exports.upsertSession = upsertSession;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const dbPath = process.env.SQLITE_FILE || './chess.sqlite';
const db = new better_sqlite3_1.default(dbPath);
// Ensure storage schema exists.
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    player1_token TEXT,
    player2_token TEXT,
    keyword TEXT NOT NULL UNIQUE,
    white TEXT NOT NULL,
    started INTEGER NOT NULL,
    player1_ready INTEGER NOT NULL,
    player2_ready INTEGER NOT NULL,
    moves TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
const existingCols = db
    .prepare("PRAGMA table_info(sessions)")
    .all()
    .map((c) => c.name);
if (!existingCols.includes('player1_ready')) {
    db.exec('ALTER TABLE sessions ADD COLUMN player1_ready INTEGER NOT NULL DEFAULT 0;');
}
if (!existingCols.includes('player2_ready')) {
    db.exec('ALTER TABLE sessions ADD COLUMN player2_ready INTEGER NOT NULL DEFAULT 0;');
}
const insertSession = db.prepare(`
  INSERT INTO sessions (id, player1_token, player2_token, keyword, white, started, player1_ready, player2_ready, moves)
  VALUES (@id, @player1_token, @player2_token, @keyword, @white, @started, @player1_ready, @player2_ready, @moves)
`);
const selectSession = db.prepare('SELECT * FROM sessions WHERE id = ?');
const selectByKeyword = db.prepare('SELECT * FROM sessions WHERE keyword = ? LIMIT 1');
const updateSession = db.prepare(`
  UPDATE sessions
  SET player1_token = @player1_token,
      player2_token = @player2_token,
      keyword = @keyword,
      white = @white,
      started = @started,
      player1_ready = @player1_ready,
      player2_ready = @player2_ready,
      moves = @moves,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
`);
function getSessionByKeyword(keyword) {
    const row = selectByKeyword.get(keyword);
    if (!row)
        return null;
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
function getSessionByToken(token) {
    const row = db
        .prepare('SELECT * FROM sessions WHERE player1_token = ? OR player2_token = ? LIMIT 1')
        .get(token, token);
    if (!row)
        return null;
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
function createSession(session) {
    insertSession.run({
        id: session.id,
        player1_token: session.player1_token || null,
        player2_token: session.player2_token || null,
        keyword: session.keyword,
        white: session.white,
        started: session.started ? 1 : 0,
        player1_ready: session.player1_ready ? 1 : 0,
        player2_ready: session.player2_ready ? 1 : 0,
        moves: session.moves || ''
    });
    return getSession(session.id);
}
function getSession(id) {
    const row = selectSession.get(id);
    if (!row)
        return null;
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
function upsertSession(session) {
    updateSession.run({
        id: session.id,
        player1_token: session.player1_token || null,
        player2_token: session.player2_token || null,
        keyword: session.keyword,
        white: session.white,
        started: session.started ? 1 : 0,
        player1_ready: session.player1_ready ? 1 : 0,
        player2_ready: session.player2_ready ? 1 : 0,
        moves: session.moves || ''
    });
    return getSession(session.id);
}
