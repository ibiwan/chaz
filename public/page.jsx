// Utility to get all known games from localStorage
// Format: { keyword: { token, seat } }
function getKnownGames() {
  try {
    const games = JSON.parse(localStorage.getItem('chess_games') || '{}');
    // Migrate old format (bare string token) to { token, seat }
    const migrated = {};
    for (const [k, v] of Object.entries(games)) {
      migrated[k] = typeof v === 'string' ? { token: v, seat: null } : v;
    }
    return migrated;
  } catch {
    return {};
  }
}
function setKnownGames(games) {
  localStorage.setItem('chess_games', JSON.stringify(games));
}

// Get keyword from URL param
function getKeywordFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('keyword') || '';
}

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
  // Use URL param for keyword if present
  const urlKeyword = getKeywordFromUrl();
  const games = getKnownGames();
  const [keyword, setKeyword] = useState(() => urlKeyword || '');
  const [token, setToken] = useState(() => (urlKeyword && games[urlKeyword]?.token) || '');
  const [seat, setSeat] = useState(() => (urlKeyword && games[urlKeyword]?.seat) || null);
  const [role, setRole] = useState('');
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle');

  const wsRef = useRef(null);

  // Merge local token/seat into session for display and API calls.
  // WebSocket broadcasts omit tokens and your_seat, so we rehydrate them from state.
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
        ws.send(JSON.stringify({ type: 'join', keyword, token }));
        // Fetch current game state to restore session after any reconnect.
        // Also recovers seat when localStorage was migrated from old format.
        fetch('/api/sessions', {
          headers: {
            'x-session-keyword': keyword,
            'x-session-token': token,
          },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data) return;
            if (data.your_seat && data.your_seat !== seat) {
              const serverToken = data[`${data.your_seat}_token`] || token;
              setSeat(data.your_seat);
              if (serverToken !== token) setToken(serverToken);
              const g = getKnownGames();
              g[keyword] = { token: serverToken, seat: data.your_seat };
              setKnownGames(g);
            }
            setSession(data);
          })
          .catch(() => {});
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

      ws.onerror = () => {
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
      // Store token and seat together, keyed by keyword
      const g = getKnownGames();
      g[keyword] = { token: tok, seat: data.your_seat };
      setKnownGames(g);
      // Update URL param for this tab
      const params = new URLSearchParams(window.location.search);
      params.set('keyword', keyword);
      window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
      setSession(mergeSession(data));
    } else {
      setError('Failed to join game');
      setStatus('idle');
    }
  };

  // sendAction: handles move, ready, resign, sit, start
  const sendAction = async (action, payload) => {
    setError(null);
    let url = '';
    let body = {};
    if (!token) return;
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
      case 'offer-draw':
        url = '/api/sessions/offer-draw';
        body = { token };
        break;
      case 'accept-draw':
        url = '/api/sessions/accept-draw';
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
        if (data.your_seat && data[`${data.your_seat}_token`]) {
          const newToken = data[`${data.your_seat}_token`];
          const newSeat = data.your_seat;
          setToken(newToken);
          setSeat(newSeat);
          const g = getKnownGames();
          g[keyword] = { token: newToken, seat: newSeat };
          setKnownGames(g);
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

  // List of known games for quick rejoin
  const knownGameList = Object.entries(getKnownGames());

  return (
    <div>
      <h1>Chess Game</h1>
      {!session ? (
        <form onSubmit={handleSubmit}>
          <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Game keyword" />
          <button type="submit" disabled={status === 'joining'}>Join Game</button>
          {knownGameList.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <b>Known Games:</b>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {knownGameList.map(([k, v]) => (
                  <li key={k}>
                    <button type="button" style={{ margin: 2 }} onClick={() => {
                      setKeyword(k);
                      setToken(v.token);
                      setSeat(v.seat);
                      // Update URL param for this tab
                      const params = new URLSearchParams(window.location.search);
                      params.set('keyword', k);
                      window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
                    }}>{k}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
