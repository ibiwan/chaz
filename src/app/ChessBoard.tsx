import React, { useState, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { Session } from './types';

const pieceSymbols: Record<string, string> = {
  p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚',
  P: '♙', R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔'
};

type ChessBoardProps = {
  board: any[][];
  session: Session;
  role: string;
  sendAction: (action: string, move?: string) => void;
};

export function ChessBoard({ board, session, role, sendAction }: ChessBoardProps) {
  const [selected, setSelected] = useState<{ row: number, col: number } | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const chess = useMemo(() => {
    const c = new Chess();
    if (session.moves.trim()) {
      session.moves.split(',').map((m) => m.trim()).filter(Boolean).forEach((move) => c.move(move));
    }
    return c;
  }, [session.moves]);

  // Determine if it's the current player's turn
  const isWhite = (session.white === 'player1' && role === 'player1') || (session.white === 'player2' && role === 'player2');
  const currentTurn = chess.turn() === 'w' ? 'white' : 'black';
  const isMyTurn = (isWhite && currentTurn === 'white') || (!isWhite && currentTurn === 'black');

  function toAlgebraic(row: number, col: number) {
    return String.fromCharCode(97 + col) + (8 - row);
  }

  function handleSquareClick(row: number, col: number) {
    if (!isMyTurn) return; // Ignore clicks if not current player's turn
    const sq = toAlgebraic(row, col) as import('chess.js').Square;
    const piece = chess.get(sq);
    if (!selected) {
      if (!piece) return;
      if ((isWhite && piece.color !== 'w') || (!isWhite && piece.color !== 'b')) return;
      setSelected({ row, col });
      const moves = chess.moves({ square: sq, verbose: true }) as any[];
      setValidMoves(moves.map((m) => m.to));
      return;
    }

    const moves = chess.moves({ square: sq, verbose: true }) as any[];
    if (selected.row === row && selected.col === col) {
      setSelected(null);
      setValidMoves([]);
      return;
    }
    const dest = toAlgebraic(row, col);
    if (validMoves.includes(dest)) {
      // End turn immediately after move is submitted
      setSelected(null);
      setValidMoves([]);

      const moves = chess.moves({ square: toAlgebraic(selected.row, selected.col) as import('chess.js').Square, verbose: true }) as any[];
      const moveObj = moves.find((m) => m.to === dest);
      if (moveObj) {
        sendAction('move', moveObj.san);
      }
      return;
    }
    if (piece) {
      if ((isWhite && piece.color === 'w') || (!isWhite && piece.color === 'b')) {
        setSelected({ row, col });
        const moves = chess.moves({ square: sq, verbose: true }) as any[];
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
              color: pieceColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              textShadow,
              border: isSelected ? '2px solid #ff0' : isValid ? '2px solid #0f0' : undefined,
              // Remove cursor here to avoid flicker
            }}
            onClick={() => handleSquareClick(row, col)}
          >
            {square
              ? pieceSymbols[square.type === 'p' ? (square.color === 'w' ? 'P' : 'p') : square.type]
              : ''}
          </div>
        );
      })}
    </div>
  );
}
