/**
 * @global React (from CDN)
 * @global Chess (from CDN)
 * @global ChessBoard (from ./ChessBoard.jsx)
 * Expects Chess, React, and ChessBoard to be available in the browser global scope.
 */

const { useEffect, useMemo, useRef, useState } = React;

function renderBoardFromMoves(moves) {
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


function HomePage() {
  const [keyword, setKeyword] = useState(() => localStorage.getItem('keyword') || '');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [seat, setSeat] = useState(() => localStorage.getItem('seat'));
  const [role, setRole] = useState('');
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle');

  const wsRef = useRef(null);

  // Merge local token/seat into session for display and API calls
  function mergeSession(s) {
    if (!s) return s;
    let merged = { ...s };
    if (seat && seat === 'player1') merged.player1_token = token;
    if (seat && seat === 'player2') merged.player2_token = token;
    if (seat) merged.your_seat = seat;
    return merged;
  }

  useEffect(() => {
    if (!keyword || !token) return;
    let ws = null;
    let closed = false;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new window.WebSocket(`${protocol}://${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws && ws.send(JSON.stringify({ type: 'join', keyword, token }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'session' && msg.session) {
            setSession(mergeSession(msg.session));
          } else if (msg.type === 'joined' && msg.session) {
            setSession(mergeSession(msg.session));
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
          setTimeout(connect, 1000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      ws && ws.close();
    };
  }, [keyword, token, seat]);

  const board = useMemo(() => (session && session.started ? renderBoardFromMoves(session.moves) : []), [session]);

  const joinGame = async () => {
    setError(null);
    if (!keyword.trim()) {
      setError('keyword required');
      return;
    }

    // If joining a different game, clear seat and token
    const prevKeyword = localStorage.getItem('keyword');
    if (prevKeyword && prevKeyword !== keyword) {
      localStorage.removeItem('token');
      localStorage.removeItem('seat');
      setToken(null);
      setSeat(null);
    }

    setStatus('joining');
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword }),
    });
    if (res.ok) {
      const data = await res.json();
      const tok = data[`${data.your_seat}_token`];
      setToken(tok);
      setSeat(data.your_seat);
      localStorage.setItem('token', tok);
      localStorage.setItem('seat', data.your_seat);
      localStorage.setItem('keyword', keyword);
      setSession(mergeSession(data));
    } else {
      setError('Failed to join game');
      setStatus('idle');
    }
  };

  // sendAction: handles move, ready, resign, sit
  const sendAction = async (action, payload) => {
    setError(null);
    let url = '';
    let body = {};
    if (!token) return;
    // Always include keyword from localStorage
    const keyword = localStorage.getItem('keyword') || '';
    const headers = {
      'Content-Type': 'application/json',
      'x-session-keyword': keyword,
      'x-session-token': token,
    };
    switch (action) {
      case 'move':
        url = '/api/sessions/move';
        body = { move: payload, token };
        break;
      case 'ready':
        url = '/api/sessions/ready';
        body = { token };
        break;
      case 'resign':
        url = '/api/sessions/resign';
        body = { token };
        break;
      case 'sit':
        url = '/api/sessions/sit';
        body = { color: payload, token };
        break;
      case 'start':
        url = '/api/sessions/start';
        body = { token };
        break;
      default:
        return;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        // Update token/seat if present in response
        if (data.your_seat && data[`${data.your_seat}_token`]) {
          setToken(data[`${data.your_seat}_token`]);
          setSeat(data.your_seat);
          localStorage.setItem('token', data[`${data.your_seat}_token`]);
          localStorage.setItem('seat', data.your_seat);
        }
        setSession(mergeSession(data));
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Action failed');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  // Handles form submit for join
  const handleSubmit = (e) => {
    e.preventDefault();
    joinGame();
  };

  return (
    <div>
      <h1>Chess Game</h1>
      {!session ? (
        <form onSubmit={handleSubmit}>
          <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Game keyword" />
          <button type="submit" disabled={status === 'joining'}>Join Game</button>
          {error && <div style={{ color: 'red' }}>{error}</div>}
        </form>
      ) : (
        <div>
          <ChessBoard board={board} session={session} role={role} sendAction={sendAction} />
        </div>
      )}
    </div>
  );
}

window.HomePage = HomePage;
