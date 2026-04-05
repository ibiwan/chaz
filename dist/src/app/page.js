"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = HomePage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const chess_js_1 = require("chess.js");
const ChessBoard_1 = require("./ChessBoard");
function renderBoardFromMoves(moves) {
    const chess = new chess_js_1.Chess();
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
    const [keyword, setKeyword] = (0, react_1.useState)('');
    const [token, setToken] = (0, react_1.useState)(null);
    const [role, setRole] = (0, react_1.useState)('');
    const [session, setSession] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)(null);
    const [status, setStatus] = (0, react_1.useState)('idle');
    // WebSocket real-time session updates
    const wsRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (!keyword || !token)
            return;
        let ws = null;
        let closed = false;
        function connect() {
            const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
            ws = new window.WebSocket(`${protocol}://${window.location.host}/ws`);
            wsRef.current = ws;
            ws.onopen = () => {
                ws === null || ws === void 0 ? void 0 : ws.send(JSON.stringify({ type: 'join', keyword, token }));
            };
            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'session' && msg.session) {
                        setSession(msg.session);
                    }
                    else if (msg.type === 'joined' && msg.session) {
                        setSession(msg.session);
                        setRole(msg.role);
                    }
                }
                catch (err) {
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
            ws === null || ws === void 0 ? void 0 : ws.close();
        };
    }, [keyword, token]);
    const board = (0, react_1.useMemo)(() => (session && session.started ? renderBoardFromMoves(session.moves) : []), [session]);
    const joinGame = async () => {
        var _a;
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
        setToken((_a = data.token) !== null && _a !== void 0 ? _a : null);
        setSession(data.session);
        setStatus('joined');
    };
    const sendAction = (action, move) => {
        if (!keyword || !token) {
            setError('keyword/token required');
            return;
        }
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            setError('WebSocket not connected');
            return;
        }
        const msg = { type: action, keyword, token };
        if (move)
            msg.move = move;
        ws.send(JSON.stringify(msg));
    };
    return ((0, jsx_runtime_1.jsxs)("main", { style: { fontFamily: 'system-ui, sans-serif', padding: 24 }, children: [(0, jsx_runtime_1.jsx)("h1", { children: "Chaz Chess SPA (REST + keyword token auth)" }), (0, jsx_runtime_1.jsxs)("p", { children: ["Status: ", status] }), (0, jsx_runtime_1.jsxs)("form", { onSubmit: (e) => {
                    e.preventDefault();
                    joinGame();
                }, style: { marginBottom: 16 }, children: [(0, jsx_runtime_1.jsx)("input", { value: keyword, onChange: (e) => setKeyword(e.target.value), placeholder: 'room keyword' }), (0, jsx_runtime_1.jsx)("button", { type: 'submit', children: "Join" })] }), error && (0, jsx_runtime_1.jsxs)("div", { style: { color: 'red' }, children: ["Error: ", error] }), session ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("p", { children: ["Keyword: ", session.keyword] }), (0, jsx_runtime_1.jsxs)("p", { children: ["Role: ", role] }), session.started ? null : (0, jsx_runtime_1.jsxs)("p", { children: ["Session ID: ", session.id] }), session.started ? null : (0, jsx_runtime_1.jsxs)("p", { children: ["Token: ", token !== null && token !== void 0 ? token : '(observer)'] }), (0, jsx_runtime_1.jsxs)("p", { children: ["White: ", session.white] }), session.started ? null : (0, jsx_runtime_1.jsxs)("p", { children: ["Started: ", String(session.started)] }), (0, jsx_runtime_1.jsxs)("p", { children: ["Moves: ", session.moves || '(none)'] }), !session.started && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("p", { children: ["Player1 ready: ", session.player1_ready ? '✅' : '❌'] }), (0, jsx_runtime_1.jsxs)("p", { children: ["Player2 ready: ", session.player2_ready ? '✅' : '❌'] })] })), !session.started ? ((0, jsx_runtime_1.jsx)("p", { children: "Waiting for both players to be ready to start." })) : ((0, jsx_runtime_1.jsx)("p", { children: "Game started. Board is active." })), session.started && ((0, jsx_runtime_1.jsx)(ChessBoard_1.ChessBoard, { board: board, session: session, role: role, sendAction: sendAction })), !session.started && ((0, jsx_runtime_1.jsxs)("div", { style: { marginTop: 16 }, children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => sendAction('sit_white'), children: "Sit at White" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => sendAction('sit_black'), children: "Sit at Black" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => sendAction('ready'), children: "Ready" })] })), session.started && role !== 'observer' && ((0, jsx_runtime_1.jsx)("div", { style: { marginTop: 16 }, children: (0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                const next = window.prompt('Enter move (e.g. e4)');
                                if (!(next === null || next === void 0 ? void 0 : next.trim()))
                                    return;
                                sendAction('move', next.trim());
                            }, children: "Move" }) }))] })) : ((0, jsx_runtime_1.jsx)("p", { children: "Enter a keyword and join; viewer can also fetch session state by keyword (no token needed)." }))] }));
}
