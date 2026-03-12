const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/leaderboard
router.get('/', async (req, res) => {
  try {
    const sort = req.query.sort || 'streak';
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    let orderBy;
    switch (sort) {
      case 'winrate':
        orderBy = [{ totalWins: 'desc' }];
        break;
      case 'wins':
        orderBy = [{ totalWins: 'desc' }];
        break;
      case 'recent':
        orderBy = [{ lastActive: 'desc' }];
        break;
      case 'streak':
      default:
        orderBy = [{ currentStreak: 'desc' }, { totalWins: 'desc' }];
        break;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { isBanned: false },
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          avatar: true,
          currentStreak: true,
          highestStreak: true,
          totalWins: true,
          totalLosses: true,
          totalDraws: true,
          lastActive: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where: { isBanned: false } }),
    ]);

    const leaderboard = users.map((u, i) => {
      const totalMatches = u.totalWins + u.totalLosses + u.totalDraws;
      return {
        rank: skip + i + 1,
        id: u.id,
        username: u.username,
        avatar: u.avatar,
        currentStreak: u.currentStreak,
        highestStreak: u.highestStreak,
        totalWins: u.totalWins,
        winRate: totalMatches > 0 ? Math.round((u.totalWins / totalMatches) * 100) : 0,
        totalMatches,
        lastActive: u.lastActive,
      };
    });

    res.json({
      users: leaderboard,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboard/user-rank/:userId
router.get('/user-rank/:userId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Count users with a higher streak (or same streak but more wins, or same both but older account)
    const usersAbove = await prisma.user.count({
      where: {
        isBanned: false,
        id: { not: user.id },
        OR: [
          { currentStreak: { gt: user.currentStreak } },
          {
            currentStreak: user.currentStreak,
            totalWins: { gt: user.totalWins },
          },
          {
            currentStreak: user.currentStreak,
            totalWins: user.totalWins,
            createdAt: { lt: user.createdAt },
          },
        ],
      },
    });

    const totalUsers = await prisma.user.count({ where: { isBanned: false } });
    const rank = usersAbove + 1;
    const totalMatches = user.totalWins + user.totalLosses + user.totalDraws;

    res.json({
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        currentStreak: user.currentStreak,
        highestStreak: user.highestStreak,
        totalWins: user.totalWins,
        winRate: totalMatches > 0 ? Math.round((user.totalWins / totalMatches) * 100) : 0,
      },
      rank,
      percentile: totalUsers > 0 ? Math.round(((totalUsers - rank) / totalUsers) * 100) : 0,
    });
  } catch (err) {
    console.error('User rank error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboard/global-stats
router.get('/global-stats', async (req, res) => {
  try {
    const [totalUsers, totalMatches] = await Promise.all([
      prisma.user.count({ where: { isBanned: false } }),
      prisma.match.count(),
    ]);

    res.json({ totalUsers, totalMatches });
  } catch (err) {
    console.error('Global stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
