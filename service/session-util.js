// Helper to upsert and clean session object
import { upsertSession } from './database.js';
import { broadcastState } from './notify.js';

import { Chess } from 'chess.js';

export async function saveAndCleanSession(session, player) {
  const updated = await upsertSession(session);
  if (!updated) {
    throw new Error('Failed to update session');
  }

  console.log('saveAndCleanSession', { session, player })
  const { id, player1_token, player2_token, ...rest } = updated;
  // Remove any tokens/your_seat from broadcasted state
  const publicSession = { ...rest };
  delete publicSession.your_seat;
  delete publicSession.player1_token;
  delete publicSession.player2_token;
  broadcastState(publicSession);
  let extra = {};
  if (player === 'player1') {
    extra.player1_token = player1_token;
  } else if (player === 'player2') {
    extra.player2_token = player2_token;
  }

  // Add FEN (PEN) to the state response
  let fen = null;
  try {
    const chess = new Chess();
    if (rest.moves && typeof rest.moves === 'string' && rest.moves.trim()) {
      rest.moves.split(',').map(m => m.trim()).filter(Boolean).forEach(m => {
        const sanitized = m.replace(/[+#]$/, '');
        chess.move(sanitized);
      });
    }
    fen = chess.fen();
  } catch (e) {
    fen = null;
  }

  return { ...rest, ...extra, your_seat: player, fen };
}
