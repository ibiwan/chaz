"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import type { Session } from './types';

type ChessBoardProps = {
  board: any[][];
  session: Session;
  role: string;
  sendAction: (action: string, move?: string) => void;
};

function renderBoardFromMoves(moves: string) {
  const chess = new Chess();
  if (moves.trim()) {
    moves
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
      .forEach((move) => {
        const result = chess.move(move);
        if (!result) {
          console.warn('Invalid move, ignoring:', move);
        }
      });
  }
  return chess.board();
}

export default function HomePage() {
  const [keyword, setKeyword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!keyword) return;
    const timer = setInterval(() => {
      fetch(`/api/sessions?keyword=${encodeURIComponent(keyword)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) setSession(data);
        })
        .catch((err) => setError(String(err)));
    }, 2000);

    return () => clearInterval(timer);
  }, [keyword]);

  const board = useMemo(() => (session && session.started ? renderBoardFromMoves(session.moves) : []), [session]);

  const joinGame = async () => {
    setError(null);
    if (!keyword.trim()) {
      setError('keyword required');
      return;
    }

    setStatus('joining');
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: keyword.trim() })
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'join failed');
      setStatus('idle');
      return;
    }

    setRole(data.role);
    setToken(data.token ?? null);
    setSession(data.session);
    setStatus('joined');
  };

  const sendAction = async (action: string, move?: string) => {
    if (!keyword || !token) {
      setError('keyword/token required');
      return;
    }
    const body: any = { keyword, token, action };
    if (move) body.move = move;

    const res = await fetch('/api/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'action failed');
      return;
    }

    setSession(data.session);
  };

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Chaz Chess SPA (REST + keyword token auth)</h1>
      <p>Status: {status}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          joinGame();
        }}
        style={{ marginBottom: 16 }}
      >
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder='room keyword'
        />
        <button type='submit'>Join</button>
      </form>

      {error && <div style={{ color: 'red' }}>Error: {error}</div>}

      {session ? (
        <div>
          <p>Keyword: {session.keyword}</p>
          <p>Role: {role}</p>
          {session.started ? null : <p>Session ID: {session.id}</p>}
          {session.started ? null : <p>Token: {token ?? '(observer)'}</p>}
          <p>White: {session.white}</p>
          {session.started ? null : <p>Started: {String(session.started)}</p>}
          <p>Moves: {session.moves || '(none)'}</p>
          {!session.started && (
            <>
              <p>Player1 ready: {session.player1_ready ? '✅' : '❌'}</p>
              <p>Player2 ready: {session.player2_ready ? '✅' : '❌'}</p>
            </>
          )}

          {!session.started ? (
            <p>Waiting for both players to be ready to start.</p>
          ) : (
            <p>Game started. Board is active.</p>
          )}

          {session.started && (
            <ChessBoard
              board={board}
              session={session}
              role={role}
              sendAction={sendAction}
            />
          )}

          {!session.started && (
            <div style={{ marginTop: 16 }}>
              <button onClick={() => sendAction('sit_white')}>Sit at White</button>
              <button onClick={() => sendAction('sit_black')}>Sit at Black</button>
              <button onClick={() => sendAction('ready')}>Ready</button>
            </div>
          )}

          {session.started && role !== 'observer' && (
            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => {
                  const next = window.prompt('Enter move (e.g. e4)');
                  if (!next?.trim()) return;
                  sendAction('move', next.trim());
                }}
              >
                Move
              </button>
            </div>
          )}
        </div>
      ) : (
        <p>Enter a keyword and join; viewer can also fetch session state by keyword (no token needed).</p>
      )}
    </main>
  );
}
