
// Minimal REST API router
import express from 'express';
const router = express.Router();

import { sit, ready, connect, getState } from '../service/metagame.js';
import { move, resign } from '../service/game.js';
import { getPlayerSessionFromRequest } from '../service/auth.js';
import { saveAndCleanSession } from '../service/session-util.js';

function withPlayerSession(handler) {
  return async (req, res) => {
    try {
      const resultObj = await getPlayerSessionFromRequest(req);
      if (!resultObj) return res.status(404).json({ error: 'Session or player not found' });

      const { player, session } = resultObj;
      await handler(req, res, player, session);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

// Start game endpoint: sets session.started = true if both players are ready
router.post('/sessions/start', withPlayerSession(async (req, res, player, session) => {
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (!player || (player !== 'player1' && player !== 'player2')) {
    return res.status(400).json({ error: 'Invalid player' });
  }
  if (session.started) {
    return res.status(400).json({ error: 'Game already started' });
  }
  if (!session.player1_ready || !session.player2_ready) {
    return res.status(400).json({ error: 'Both players must be ready' });
  }
  session.started = true;
  const result = await saveAndCleanSession(session, player);
  res.json(result);
}));

router.post('/sessions/sit', withPlayerSession(async (req, res, player, session) => {
  const color = req.body.color;
  if (!color) return res.status(400).json({ error: 'Missing color' });

  const result = await sit(session, player, color);

  res.json(result);
}));

router.post('/sessions/ready', withPlayerSession(async (req, res, player, session) => {
  const result = await ready(session, player);

  res.json(result);
}));


router.post('/sessions/move', withPlayerSession(async (req, res, player, session) => {
  const moveStr = req.body.move;
  if (!moveStr) return res.status(400).json({ error: 'Missing move' });

  try {
    const result = await move(session, player, moveStr);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

router.post('/sessions/resign', withPlayerSession(async (req, res, player, session) => {
  try {
    const result = await resign(session, player);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

router.post('/sessions', async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Missing keyword' });
    const result = await connect(keyword);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/sessions', withPlayerSession(async (req, res, player, session) => {
  const result = await getState(session, player);
  if (!result) {
    return res.status(400).json({ error: 'Invalid session or token' });
  }
  res.json(result);
}));

router.patch('/sessions', async (req, res) => {
  // TODO: Implement PATCH /api/sessions logic
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
