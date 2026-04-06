
/**
 * @global Chess (from CDN)
 * @global React (from CDN)
 * Expects Chess and React to be available in the browser global scope.
 */
const { useState, useMemo } = React;

const pieceSymbols = {
  p: '\u265f', r: '\u265c', n: '\u265e', b: '\u265d', q: '\u265b', k: '\u265a',
  P: '\u2659', R: '\u2656', N: '\u2658', B: '\u2657', Q: '\u2655', K: '\u2654'
};

// Props are not typed in JS
function ChessBoard({ board, session, role, sendAction }) {
  // Debug logging
  console.debug('ChessBoard props:', { board, session, role });
  const [selected, setSelected] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  // Defensive: ensure session and session.moves exist
  const chess = useMemo(() => {
    const c = new Chess();
    if (session && session.moves && typeof session.moves === 'string' && session.moves.trim()) {
      session.moves.split(',').map((m) => m.trim()).filter(Boolean).forEach((move) => c.move(move));
    }
    return c;
  }, [session && session.moves]);


  // Helper to mask tokens
  function maskToken(token) {
    if (!token) return '';
    return '•'.repeat(8);
  }

  // Game state display
  const stateDisplay = (
    <div style={{ marginBottom: 12, fontFamily: 'monospace', fontSize: 14 }}>
      <div><b>Keyword:</b> {session.keyword}</div>
      <div><b>White:</b> {session.white}</div>
      <div><b>Started:</b> {String(session.started)}</div>
      <div><b>Player 1 Token:</b> {maskToken(session.player1_token)}</div>
      <div><b>Player 2 Token:</b> {maskToken(session.player2_token)}</div>
      <div><b>Your Seat:</b> {session.your_seat || ''}</div>
      <div><b>Winner:</b> {session.winner || ''}</div>
      <div><b>Game Status:</b> {session.gameStatus || ''}</div>
      <div><b>Moves:</b> {session.moves || ''}</div>
      <div><b>Created:</b> {session.created_at}</div>
      <div><b>Updated:</b> {session.updated_at}</div>
    </div>
  );

  // Action buttons
  const showSit = !session.started && (session.your_seat === 'observer');
  const showReady = !session.started && (session.your_seat === 'player1' || session.your_seat === 'player2');
  const showStart = !session.started && session.player1_ready && session.player2_ready && (session.your_seat === 'player1' || session.your_seat === 'player2');
  const showResign = session.started && (session.your_seat === 'player1' || session.your_seat === 'player2');

  const sitButtons = (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => sendAction('sit', 'white')}>Sit as White</button>
      <button onClick={() => sendAction('sit', 'black')}>Sit as Black</button>
    </div>
  );
  const readyButton = (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => sendAction('ready')}>Ready</button>
    </div>
  );
  const startButton = (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => sendAction('start')}>Start Game</button>
    </div>
  );
  const gameButtons = (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => sendAction('resign')}>Resign</button>
      <button onClick={() => sendAction('offer-draw')} style={{ marginLeft: 4 }}>Offer Draw</button>
      {session.draw_offered && session.draw_offered !== session.your_seat && <button onClick={() => sendAction('accept-draw')} style={{ marginLeft: 4 }}>Accept Draw</button>}
    </div>
  );

  // Use session.your_seat for robust seat detection
  const seat = session.your_seat;
  const isWhite = (session.white === 'player1' && seat === 'player1') || (session.white === 'player2' && seat === 'player2');
  const currentTurn = chess.turn() === 'w' ? 'white' : 'black';
  const isMyTurn = (seat === 'player1' || seat === 'player2') && ((isWhite && currentTurn === 'white') || (!isWhite && currentTurn === 'black'));

console.log({currentTurn, isMyTurn})

  // UI rendering
  const inCheck = chess.inCheck();
  return (
    <div>
      {stateDisplay}
      {/* Show 'Your turn' indicator if it's the player's turn */}
      {session.started && isMyTurn && (
        <div style={{ color: '#228B22', fontWeight: 'bold', marginBottom: 8, fontSize: 18 }}>Your turn</div>
      )}
      {/* Show 'Check!' indicator if in check */}
      {session.started && inCheck && (
        <div style={{ color: '#d32f2f', fontWeight: 'bold', marginBottom: 8, fontSize: 18 }}>Check!</div>
      )}
      {!session.started && (
        <>
          {showSit && sitButtons}
          {showReady && readyButton}
          {showStart && startButton}
        </>
      )}
      {session.started && Array.isArray(board) && board.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'row', marginTop: 12 }}>
          {/* Row labels (left) */}
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 2 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} style={{ height: 32, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 16 }}>
                {8 - i}
              </div>
            ))}
          </div>
          {/* Board grid */}
          <div style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(8, 32px)', gap: 2, cursor: 'pointer' }}>
            {board.flat().map((square, idx) => {
              const row = Math.floor(idx / 8);
              const col = idx % 8;
              const isLight = ((row + col) % 2) === 0;
              const bg = isLight ? '#f0d9b5' : '#b58863';
              const sq = toAlgebraic(row, col);
              const isSelected = selected && selected.row === row && selected.col === col;
              const isValid = validMoves.includes(sq);
              const highlight = isSelected ? '#ff0' : isValid ? '#0f0' : bg;
              const pieceColor = square ? (square.color === 'w' ? '#ffffff' : '#000000') : undefined;
              const textShadow = square ? (square.color === 'w' ? '0 0 8px #000' : '0 0 8px #fff') : undefined;
              return (
                <div
                  key={idx}
                  style={{
                    width: 32,
                    height: 32,
                    background: highlight,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    color: pieceColor,
                    textShadow,
                    border: isSelected ? '2px solid #ff0' : isValid ? '2px solid #0f0' : '1px solid #888',
                  }}
                  onClick={() => handleSquareClick(row, col)}
                >
                  {square ? pieceSymbols[square.type === square.type.toUpperCase() ? square.type : square.type.toLowerCase()] : ''}
                </div>
              );
            })}
            {/* Bottom column labels */}
            {Array.from({ length: 8 }, (_, i) => (
              <div key={'col-label-' + i} style={{ gridColumn: i + 1, gridRow: 9, height: 16, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 16 }}>
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {/* Action buttons below the board */}
      {showResign && gameButtons}
    </div>
  );



  function toAlgebraic(row, col) {
    return String.fromCharCode(97 + col) + (8 - row);
  }

  function handleSquareClick(row, col) {
    if (!isMyTurn) return;
    const sq = toAlgebraic(row, col);
    const piece = chess.get(sq);
    if (!selected) {
      if (!piece) return;
      if ((isWhite && piece.color !== 'w') || (!isWhite && piece.color !== 'b')) return;
      setSelected({ row, col });
      const moves = chess.moves({ square: sq, verbose: true });
      setValidMoves(moves.map((m) => m.to));
      return;
    }

    const moves = chess.moves({ square: sq, verbose: true });
    if (selected.row === row && selected.col === col) {
      setSelected(null);
      setValidMoves([]);
      return;
    }
    const dest = toAlgebraic(row, col);
    if (validMoves.includes(dest)) {
      setSelected(null);
      setValidMoves([]);
      const moves = chess.moves({ square: toAlgebraic(selected.row, selected.col), verbose: true });
      const moveObj = moves.find((m) => m.to === dest);
      if (moveObj) {
        sendAction('move', moveObj.san);
      }
      return;
    }
    if (piece) {
      if ((isWhite && piece.color === 'w') || (!isWhite && piece.color === 'b')) {
        setSelected({ row, col });
        const moves = chess.moves({ square: sq, verbose: true });
        setValidMoves(moves.map((m) => m.to));
        return;
      }
    }
    setSelected(null);
    setValidMoves([]);
  }

  return (
    <div style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(8, 32px)', gap: 2, marginTop: 12, cursor: 'pointer' }}>
      {board.flat().map((square, idx) => {
        const row = Math.floor(idx / 8);
        const col = idx % 8;
        const isLight = ((row + col) % 2) === 0;
        const bg = isLight ? '#f0d9b5' : '#b58863';
        const sq = toAlgebraic(row, col);
        const isSelected = selected && selected.row === row && selected.col === col;
        const isValid = validMoves.includes(sq);
        const highlight = isSelected ? '#ff0' : isValid ? '#0f0' : bg;
        const pieceColor = square ? (square.color === 'w' ? '#ffffff' : '#000000') : undefined;
        const textShadow = square ? (square.color === 'w' ? '0 0 8px #000' : '0 0 8px #fff') : undefined;
        return (
          <div
            key={idx}
            style={{
              width: 32,
              height: 32,
              background: highlight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              color: pieceColor,
              textShadow,
              border: isSelected ? '2px solid #ff0' : isValid ? '2px solid #0f0' : '1px solid #888',
            }}
            onClick={() => handleSquareClick(row, col)}
          >
            {square ? pieceSymbols[square.type === square.type.toUpperCase() ? square.type : square.type.toLowerCase()] : ''}
          </div>
        );
      })}
    </div>
  );
}

window.ChessBoard = ChessBoard;
