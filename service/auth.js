// Service for authentication and player role extraction
import { getSessionByKeyword } from './database.js';

// Utility: get player and session from keyword and token
async function getPlayerSession(keyword, token) {
  if (!keyword) throw new Error('Missing keyword');

  const session = await getSessionByKeyword(keyword);
  if (!session) {
    return { player: null, session: null };
  }

  if (!token) {
    return { player: null, session };
  }

  if (session.player1_token === token) {
    return { player: 'player1', session };
  }
  if (session.player2_token === token) {
    return { player: 'player2', session };
  }

  throw new Error('Invalid token for this session');
}

// Extracts keyword and token from request headers and returns {player, session}
async function getPlayerSessionFromRequest(req) {
  const keyword = req.header('x-session-keyword');
  const token = req.header('x-session-token');

  return await getPlayerSession(keyword, token);
}

export { getPlayerSessionFromRequest, getPlayerSession };
