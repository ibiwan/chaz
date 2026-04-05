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
    session.moves.split(',').map(m => m.trim()).filter(Boolean).forEach(m => {
      // Sanitize stored moves as well, just in case
      const sanitized = m.replace(/[+#]$/, '');
      chess.move(sanitized);
    });
  }

  // Check if it's the current player's turn
  const isWhite = (session.white === 'player1' && player === 'player1') || (session.white === 'player2' && player === 'player2');
  const currentTurn = chess.turn() === 'w' ? 'white' : 'black';
  console.log({ plain: chess.turn(), currentTurn });
  const isMyTurn = (isWhite && currentTurn === 'white') || (!isWhite && currentTurn === 'black');
  if (!isMyTurn) {
    throw new Error('Not your turn');
  }

  // Sanitize move string (strip trailing + or #)
  const sanitizedMove = moveStr.replace(/[+#]$/, '');
  // Validate and apply move
  const result = chess.move(sanitizedMove);
  if (!result) {
    throw new Error('Invalid move');
  }
  // Debug: print FEN and moves after move
  console.log('[MOVE]', {
    fen: chess.fen(),
    moves: session.moves ? session.moves + ',' + sanitizedMove : sanitizedMove,
    lastMove: sanitizedMove,
    inCheck: chess.inCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
  });

  // Check game state after move
  let gameStatus = null;
  if (chess.isCheckmate()) {
    // Current player made a move, so opponent is checkmated
    session.winner = player;
    session.ended = true;
    gameStatus = 'checkmate';
  } else if (chess.isStalemate()) {
    session.winner = null;
    session.ended = true;
    gameStatus = 'stalemate';
  } else if (chess.isDraw()) {
    session.winner = null;
    session.ended = true;
    gameStatus = 'draw';
  } else if (chess.inCheck()) {
    gameStatus = 'check';
  }
  session.gameStatus = gameStatus;

  // Update session moves
  session.moves = session.moves ? `${session.moves},${moveStr}` : moveStr;
  // Reset draw offer if a move is made
  if (session.draw_offered) session.draw_offered = false;
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

// Start game: set session.started = true if both players are ready
async function startGame(session, player) {
  if (!session) throw new Error('Session not found');
  if (!player || (player !== 'player1' && player !== 'player2')) throw new Error('Invalid player');
  if (session.started) throw new Error('Game already started');
  if (!session.player1_ready || !session.player2_ready) throw new Error('Both players must be ready');
  session.started = true;
  return await saveAndCleanSession(session, player);
}

export { move, resign, startGame };
