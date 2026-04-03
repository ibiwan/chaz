"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  // WebSocket real-time session updates
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!keyword || !token) return;
    let ws: WebSocket | null = null;
    let closed = false;

    function connect() {
      ws = new window.WebSocket(`ws://${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'join', keyword, token }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'session' && msg.session) {
            setSession(msg.session);
          } else if (msg.type === 'joined' && msg.session) {
            setSession(msg.session);
            setRole(msg.role);
          }
        } catch (err) {
          setError('WebSocket message error: ' + String(err));
        }
      };

      ws.onerror = (err) => {
        setError('WebSocket error');
      };

      ws.onclose = () => {
        if (!closed) {
          setTimeout(connect, 1000); // reconnect
        }
      };
    }

    connect();

    return () => {
      closed = true;
      ws?.close();
    };
  }, [keyword, token]);

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

  const sendAction = (action: string, move?: string) => {
    if (!keyword || !token) {
      setError('keyword/token required');
      return;
    }
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('WebSocket not connected');
      return;
    }
    const msg: any = { type: action, keyword, token };
    if (move) msg.move = move;
    ws.send(JSON.stringify(msg));
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
