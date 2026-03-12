const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/cheat/report-tab-switch
router.post('/report-tab-switch', authMiddleware, async (req, res) => {
  try {
    const { matchId, timestamp } = req.body;
    await prisma.antiCheatLog.create({
      data: {
        userId: req.user.id,
        matchId: null,
        violationType: 'tab-switch',
        details: JSON.stringify({ timestamp, roomId: matchId }),
        severity: 'warning',
      },
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { antiCheatViolations: { increment: 1 } },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Anti-cheat report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cheat/report-copy-attempt
router.post('/report-copy-attempt', authMiddleware, async (req, res) => {
  try {
    const { matchId, timestamp } = req.body;
    await prisma.antiCheatLog.create({
      data: {
        userId: req.user.id,
        matchId: null,
        violationType: 'copy-paste',
        details: JSON.stringify({ timestamp, roomId: matchId }),
        severity: 'warning',
      },
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { antiCheatViolations: { increment: 1 } },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Anti-cheat report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
