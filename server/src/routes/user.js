const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/user/profile - Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        currentStreak: user.currentStreak,
        highestStreak: user.highestStreak,
        totalWins: user.totalWins,
        totalLosses: user.totalLosses,
        totalDraws: user.totalDraws,
        favoriteLanguage: user.favoriteLanguage,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
      },
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/user/profile - Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { username, avatar, bio, favoriteLanguage } = req.body;
    const data = {};

    if (username) {
      if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Username must be 3-20 alphanumeric characters' });
      }
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      data.username = username;
    }

    if (avatar !== undefined) data.avatar = avatar;
    if (bio !== undefined) data.bio = bio.substring(0, 160);
    if (favoriteLanguage !== undefined) data.favoriteLanguage = favoriteLanguage;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        favoriteLanguage: user.favoriteLanguage,
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/stats/:userId - Get user stats
router.get('/stats/:userId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const totalMatches = user.totalWins + user.totalLosses + user.totalDraws;
    const winRate = totalMatches > 0 ? Math.round((user.totalWins / totalMatches) * 100) : 0;

    res.json({
      stats: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        currentStreak: user.currentStreak,
        highestStreak: user.highestStreak,
        totalWins: user.totalWins,
        totalLosses: user.totalLosses,
        totalDraws: user.totalDraws,
        totalMatches,
        winRate,
        favoriteLanguage: user.favoriteLanguage,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
      },
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/match-history/:userId - Get recent matches
router.get('/match-history/:userId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where: {
          OR: [
            { player1Id: req.params.userId },
            { player2Id: req.params.userId },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          player1: { select: { username: true, avatar: true } },
          player2: { select: { username: true, avatar: true } },
        },
      }),
      prisma.match.count({
        where: {
          OR: [
            { player1Id: req.params.userId },
            { player2Id: req.params.userId },
          ],
        },
      }),
    ]);

    res.json({
      matches: matches.map(m => ({
        id: m.id,
        opponent: m.player1Id === req.params.userId
          ? { username: m.player2.username, avatar: m.player2.avatar }
          : { username: m.player1.username, avatar: m.player1.avatar },
        result: m.winnerId === req.params.userId ? 'win' : m.winnerId ? 'loss' : 'draw',
        reason: m.reason,
        questionTitle: m.questionTitle,
        questionDiff: m.questionDiff,
        language: m.language,
        isMockMatch: m.isMockMatch,
        createdAt: m.createdAt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Match history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
