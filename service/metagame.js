// Offer a draw
async function offerDraw(session, player) {
  if (!session) throw new Error('Session not found');
  if (!player || (player !== 'player1' && player !== 'player2')) throw new Error('Invalid player');
  if (!session.started || isGameOver(session)) throw new Error('Game not in progress');
  if (session.draw_offered) throw new Error('Draw already offered');
  session.draw_offered = player;
  return await saveAndCleanSession(session, player);
}

// Accept a draw
async function acceptDraw(session, player) {
  if (!session) throw new Error('Session not found');
  if (!player || (player !== 'player1' && player !== 'player2')) throw new Error('Invalid player');
  if (!session.started || isGameOver(session)) throw new Error('Game not in progress');
  if (!session.draw_offered) throw new Error('No draw has been offered');
  if (session.draw_offered === player) throw new Error('Cannot accept your own draw offer');
  session.winner = null;
  session.gameStatus = 'draw';
  session.draw_offered = false;
  return await saveAndCleanSession(session, player);
}
import { getSessionByKeyword, createSession, upsertSession } from './database.js';
import { saveAndCleanSession } from './session-util.js';
import { isGameOver } from './game.js';
import { v4 as uuidv4 } from 'uuid';

async function sit(session, player, color) {
  if (!session) throw new Error('Session not found');
  if (!player || (player !== 'player1' && player !== 'player2')) throw new Error('Invalid player');
  if (session.started) throw new Error('Game already started; cannot change color');

  // Compute what session.white should be if the change is made
  let intendedWhite = session.white;
  if (color === 'white') {
    intendedWhite = player;
  } else if (color === 'black') {
    intendedWhite = player === 'player1' ? 'player2' : 'player1';
  } else {
    throw new Error('Invalid color value');
  }

  // If already at requested color, no effect
  if (session.white === intendedWhite) {
    const { id, player1_token, player2_token, ...rest } = session;
    return rest;
  }

  // Change color, reset readiness
  session.white = intendedWhite;
  session.player1_ready = false;
  session.player2_ready = false;
  console.log("sitting", { player, color, intendedWhite });
  return await saveAndCleanSession(session, player);
}

// ready: sets player ready status if possible
async function ready(session, player) {
  if (!session) throw new Error('Session not found');
  if (!player || (player !== 'player1' && player !== 'player2')) throw new Error('Invalid player');
  if (session.started) throw new Error('Game already started');

  if ((player === 'player1' && session.player1_ready) || (player === 'player2' && session.player2_ready)) {
    const { id, player1_token, player2_token, ...rest } = session;
    return rest;
  }
  if (player === 'player1') session.player1_ready = true;
  if (player === 'player2') session.player2_ready = true;

  console.log("ready", { player })
  return await saveAndCleanSession(session, player);
}

// getState: returns session by player/session, omitting tokens and id
async function getState(session, player) {
  if (!session) return null;
  console.log("getting", { player });
  return await saveAndCleanSession(session, player);
}

async function connect(keyword) {
  const session = await getSessionByKeyword(keyword);

  let player = 'observer';

  if (!session) {
    // If keyword not found, create and return new session
    return await create(keyword);
  }

  // If session does not have player2 yet, assign caller as player2
  if (!session.player2_token) {
    player = 'player2';
    const player2_token = uuidv4();
    session.player2_token = player2_token;
    const updated = await upsertSession(session);
    if (!updated) return null;
  }

  console.log("connecting", { player, keyword });
  // If both player slots are full, caller is observer
  return await saveAndCleanSession(session, player);
}

// private
async function create(keyword) {
  const player1_token = uuidv4();
  const now = new Date().toISOString();
  const session = {
    id: uuidv4(),
    player1_token,
    player2_token: null,
    keyword,
    white: 'player1',
    started: false,
    player1_ready: false,
    player2_ready: false,
    moves: '',
    created_at: now,
    updated_at: now
  };
  const created = await createSession(session);
  if (!created) return null;

  console.log("creating", { player: 'player1', keyword });
  return await saveAndCleanSession(created, 'player1');
}

export { sit, ready, connect, getState, offerDraw, acceptDraw };
