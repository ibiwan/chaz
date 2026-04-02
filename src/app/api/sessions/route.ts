import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createSession, getSession, getSessionByKeyword, upsertSession } from '../../../lib/sqlite';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const keyword = request.nextUrl.searchParams.get('keyword');

  if (id) {
    const session = getSession(id);
    if (!session) {
      return NextResponse.json({ error: 'session not found' }, { status: 404 });
    }
    return NextResponse.json(session);
  }

  if (keyword) {
    const session = getSessionByKeyword(keyword);
    if (!session) {
      return NextResponse.json({ error: 'session not found' }, { status: 404 });
    }
    return NextResponse.json(session);
  }

  return NextResponse.json({ error: 'id or keyword is required' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const keyword = String(body.keyword || '').trim();

  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
  }

  let session = getSessionByKeyword(keyword);

  if (!session) {
    const token = uuidv4();
    const created = createSession({
      id: uuidv4(),
      player1_token: token,
      player2_token: null,
      keyword,
      white: 'player1',
      started: false,
      player1_ready: false,
      player2_ready: false,
      moves: ''
    });
    return NextResponse.json({ role: 'player1', token, session: created }, { status: 201 });
  }

  if (!session.player1_token) {
    const token = uuidv4();
    session.player1_token = token;
    session = upsertSession(session);
    return NextResponse.json({ role: 'player1', token, session });
  }

  if (!session.player2_token) {
    const token = uuidv4();
    session.player2_token = token;
    session = upsertSession(session);
    return NextResponse.json({ role: 'player2', token, session });
  }

  return NextResponse.json({ role: 'observer', session });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();

  const keyword = String(body.keyword || '').trim();
  const token = String(body.token || '').trim();
  const action = String(body.action || '').trim();
  const move = body.move ? String(body.move).trim() : '';

  if (!keyword || !token || !action) {
    return NextResponse.json({ error: 'keyword, token, and action are required' }, { status: 400 });
  }

  const session = getSessionByKeyword(keyword);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  const isPlayer1 = session.player1_token === token;
  const isPlayer2 = session.player2_token === token;

  if (!isPlayer1 && !isPlayer2) {
    return NextResponse.json({ error: 'invalid token' }, { status: 403 });
  }

  switch (action) {
    case 'sit_white': {
      if (session.started) {
        return NextResponse.json({ error: 'game already started; color change not allowed' }, { status: 400 });
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
        return NextResponse.json({ error: 'game already started; color change not allowed' }, { status: 400 });
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
        return NextResponse.json({ error: 'game already started' }, { status: 400 });
      }
      // Only allow ready if both player tokens are present
      if (!session.player1_token || !session.player2_token) {
        return NextResponse.json({ error: 'both players must be present before ready' }, { status: 400 });
      }
      // Always reload the latest session state before updating ready flags
      const latest = getSessionByKeyword(keyword);
      if (!latest) {
        return NextResponse.json({ error: 'session not found' }, { status: 404 });
      }
      session.player1_ready = latest.player1_ready;
      session.player2_ready = latest.player2_ready;
      if (isPlayer1) session.player1_ready = true;
      if (isPlayer2) session.player2_ready = true;
      if (session.player1_ready && session.player2_ready) {
        session.started = true;
      }
      break;
    }
    case 'move': {
      if (!session.started) {
        return NextResponse.json({ error: 'game has not started yet' }, { status: 400 });
      }
      if (!move) {
        return NextResponse.json({ error: 'move is required for move action' }, { status: 400 });
      }
      session.moves = session.moves ? `${session.moves},${move}` : move;
      break;
    }
    default:
      return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }

  const updated = upsertSession(session);
  return NextResponse.json({ session: updated });
}
