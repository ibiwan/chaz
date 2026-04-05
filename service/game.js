import { saveAndCleanSession } from './session-util.js';

import { Chess } from 'chess.js';

// move: validate and apply a move using chess.js
async function move(session, player, moveStr) {
  if (!session) {
    throw new Error('Session not found');
  }
  if (!player) {
    throw new Error('Player not specified');
  }
  if (!moveStr) {
    throw new Error('Move not specified');
  }
  if (!session.started) {
    throw new Error('Game not started');
  }

  // Reconstruct game state
  const chess = new Chess();
  if (session.moves && session.moves.trim()) {
    session.moves.split(',').map(m => m.trim()).filter(Boolean).forEach(m => chess.move(m));
  }

  // Check if it's the current player's turn
  const isWhite = (session.white === 'player1' && player === 'player1') || (session.white === 'player2' && player === 'player2');
  const currentTurn = chess.turn() === 'w' ? 'white' : 'black';
  const isMyTurn = (isWhite && currentTurn === 'white') || (!isWhite && currentTurn === 'black');
  if (!isMyTurn) {
    throw new Error('Not your turn');
  }

  // Validate and apply move
  const result = chess.move(moveStr);
  if (!result) {
    throw new Error('Invalid move');
  }

  // Check game state after move
  let gameStatus = null;
  if (chess.in_checkmate()) {
    // Current player made a move, so opponent is checkmated
    session.winner = player;
    session.ended = true;
    gameStatus = 'checkmate';
  } else if (chess.in_stalemate()) {
    session.winner = null;
    session.ended = true;
    gameStatus = 'stalemate';
  } else if (chess.in_draw()) {
    session.winner = null;
    session.ended = true;
    gameStatus = 'draw';
  } else if (chess.in_check()) {
    gameStatus = 'check';
  }
  session.gameStatus = gameStatus;

  // Update session moves
  session.moves = session.moves ? `${session.moves},${moveStr}` : moveStr;
  return await saveAndCleanSession(session, player);
}

// Placeholder for resign logic
async function resign(session, player) {
  if (!session) {
    throw new Error('Session not found');
  }
  if (!player || (player !== 'player1' && player !== 'player2')) {
    throw new Error('Player not specified or invalid');
  }
  if (!session.started) {
    throw new Error('Game not started');
  }
  if (session.winner) {
    throw new Error('Game already ended');
  }

  // Set winner to the other player
  const winner = player === 'player1' ? 'player2' : 'player1';
  session.winner = winner;
  session.ended = true;
  session.gameStatus = 'resigned';

  return await saveAndCleanSession(session, player);
}

export { move, resign };
