// Service for authentication and player role extraction
import { getSessionByKeyword } from './database.js';

// Utility: get player and session from keyword and token
async function getPlayerSession(keyword, token) {
  if (!keyword) throw new Error('Missing keyword');

  const session = await getSessionByKeyword(keyword);
  if (!session) {
    console.warn('[AUTH] No session found for keyword', keyword);
    return { player: null, session: null };
  }

  if (!token) {
    console.warn('[AUTH] No token provided, observer mode');
    return { player: null, session };
  }

  if (session.player1_token === token) {
    console.info('[AUTH] Token matches player1');
    return { player: 'player1', session };
  }
  if (session.player2_token === token) {
    console.info('[AUTH] Token matches player2');
    return { player: 'player2', session };
  }

  console.warn('[AUTH] Invalid token for session', { keyword, token });
  throw new Error('Invalid token for this session');
}

// Extracts keyword and token from request headers and returns {player, session}
async function getPlayerSessionFromRequest(req) {
  const keyword = req.header('x-session-keyword');
  const token = req.header('x-session-token');

  return await getPlayerSession(keyword, token);
}

export { getPlayerSessionFromRequest, getPlayerSession };
