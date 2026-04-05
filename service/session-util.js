// Helper to upsert and clean session object
import { upsertSession } from './database.js';
import { broadcastState } from './notify.js';

export async function saveAndCleanSession(session, player) {
  const updated = await upsertSession(session);
  if (!updated) {
    throw new Error('Failed to update session');
  }

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
  return { ...rest, ...extra, your_seat: player };
}
