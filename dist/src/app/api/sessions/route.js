"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.PATCH = PATCH;
const server_1 = require("next/server");
const uuid_1 = require("uuid");
const sessions_1 = require("../../../../lib/sessions");
async function GET(request) {
    const id = request.nextUrl.searchParams.get('id');
    const keyword = request.nextUrl.searchParams.get('keyword');
    if (id) {
        const session = await (0, sessions_1.getSession)(id);
        if (!session) {
            return server_1.NextResponse.json({ error: 'session not found' }, { status: 404 });
        }
        return server_1.NextResponse.json(session);
    }
    if (keyword) {
        const session = await (0, sessions_1.getSessionByKeyword)(keyword);
        if (!session) {
            return server_1.NextResponse.json({ error: 'session not found' }, { status: 404 });
        }
        return server_1.NextResponse.json(session);
    }
    return server_1.NextResponse.json({ error: 'id or keyword is required' }, { status: 400 });
}
async function POST(request) {
    const body = await request.json();
    const keyword = String(body.keyword || '').trim();
    if (!keyword) {
        return server_1.NextResponse.json({ error: 'keyword is required' }, { status: 400 });
    }
    let session = await (0, sessions_1.getSessionByKeyword)(keyword);
    if (!session) {
        const token = (0, uuid_1.v4)();
        const created = await (0, sessions_1.createSession)({
            id: (0, uuid_1.v4)(),
            player1_token: token,
            player2_token: null,
            keyword,
            white: 'player1',
            started: false,
            player1_ready: false,
            player2_ready: false,
            moves: ''
        });
        return server_1.NextResponse.json({ role: 'player1', token, session: created }, { status: 201 });
    }
    if (!session.player1_token) {
        const token = (0, uuid_1.v4)();
        session.player1_token = token;
        session = await (0, sessions_1.upsertSession)(session);
        return server_1.NextResponse.json({ role: 'player1', token, session });
    }
    if (!session.player2_token) {
        const token = (0, uuid_1.v4)();
        session.player2_token = token;
        session = await (0, sessions_1.upsertSession)(session);
        return server_1.NextResponse.json({ role: 'player2', token, session });
    }
    return server_1.NextResponse.json({ role: 'observer', session });
}
async function PATCH(request) {
    const body = await request.json();
    const keyword = String(body.keyword || '').trim();
    const token = String(body.token || '').trim();
    const action = String(body.action || '').trim();
    const move = body.move ? String(body.move).trim() : '';
    if (!keyword || !token || !action) {
        return server_1.NextResponse.json({ error: 'keyword, token, and action are required' }, { status: 400 });
    }
    const session = await (0, sessions_1.getSessionByKeyword)(keyword);
    if (!session) {
        return server_1.NextResponse.json({ error: 'session not found' }, { status: 404 });
    }
    const isPlayer1 = session.player1_token === token;
    const isPlayer2 = session.player2_token === token;
    if (!isPlayer1 && !isPlayer2) {
        return server_1.NextResponse.json({ error: 'invalid token' }, { status: 403 });
    }
    switch (action) {
        case 'sit_white': {
            if (session.started) {
                return server_1.NextResponse.json({ error: 'game already started; color change not allowed' }, { status: 400 });
            }
            const newWhite = isPlayer1 ? 'player1' : 'player2';
            if (session.white !== newWhite) {
                session.white = newWhite;
                session.player1_ready = false;
                session.player2_ready = false;
            }
            break;
        }
        case 'sit_black': {
            if (session.started) {
                return server_1.NextResponse.json({ error: 'game already started; color change not allowed' }, { status: 400 });
            }
            const newWhite = isPlayer1 ? 'player2' : 'player1';
            if (session.white !== newWhite) {
                session.white = newWhite;
                session.player1_ready = false;
                session.player2_ready = false;
            }
            break;
        }
        case 'ready': {
            if (session.started) {
                return server_1.NextResponse.json({ error: 'game already started' }, { status: 400 });
            }
            // Only allow ready if both player tokens are present
            if (!session.player1_token || !session.player2_token) {
                return server_1.NextResponse.json({ error: 'both players must be present before ready' }, { status: 400 });
            }
            // Always reload the latest session state before updating ready flags
            const latest = await (0, sessions_1.getSessionByKeyword)(keyword);
            if (!latest) {
                return server_1.NextResponse.json({ error: 'session not found' }, { status: 404 });
            }
            session.player1_ready = latest.player1_ready;
            session.player2_ready = latest.player2_ready;
            if (isPlayer1)
                session.player1_ready = true;
            if (isPlayer2)
                session.player2_ready = true;
            if (session.player1_ready && session.player2_ready) {
                session.started = true;
            }
            break;
        }
        case 'move': {
            if (!session.started) {
                return server_1.NextResponse.json({ error: 'game has not started yet' }, { status: 400 });
            }
            if (!move) {
                return server_1.NextResponse.json({ error: 'move is required for move action' }, { status: 400 });
            }
            session.moves = session.moves ? `${session.moves},${move}` : move;
            break;
        }
        default:
            return server_1.NextResponse.json({ error: 'invalid action' }, { status: 400 });
    }
    const updated = await (0, sessions_1.upsertSession)(session);
    return server_1.NextResponse.json({ session: updated });
}
