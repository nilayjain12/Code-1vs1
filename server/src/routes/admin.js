const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ─── Admin-only middleware ───────────────────────────────
async function isAdmin(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    console.error('Admin check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// All admin routes require auth + admin role
router.use(authMiddleware, isAdmin);

// ─── LIST ALL QUESTIONS ──────────────────────────────────
router.get('/questions', async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        difficulty: true,
        timeLimitSeconds: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.json({ questions });
  } catch (err) {
    console.error('Admin list questions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET SINGLE QUESTION ─────────────────────────────────
router.get('/questions/:id', async (req, res) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
    });
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json({ question });
  } catch (err) {
    console.error('Admin get question error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── CREATE QUESTION ─────────────────────────────────────
router.post('/questions', async (req, res) => {
  try {
    const {
      slug, title, category, difficulty, timeLimitSeconds,
      description, prompt, languages, testCases, topics,
    } = req.body;

    if (!slug || !title || !category || !difficulty || !description || !prompt) {
      return res.status(400).json({ error: 'Missing required fields: slug, title, category, difficulty, description, prompt' });
    }
    if (!languages || !testCases) {
      return res.status(400).json({ error: 'Missing required fields: languages, testCases' });
    }

    const question = await prisma.question.create({
      data: {
        slug,
        title,
        category,
        difficulty,
        timeLimitSeconds: timeLimitSeconds || 120,
        description,
        prompt,
        languages,
        testCases,
        topics: topics || [],
      },
    });

    res.status(201).json({ question });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: `Question with slug "${req.body.slug}" already exists` });
    }
    console.error('Admin create question error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── UPDATE QUESTION ─────────────────────────────────────
router.put('/questions/:id', async (req, res) => {
  try {
    const {
      slug, title, category, difficulty, timeLimitSeconds,
      description, prompt, languages, testCases, topics, isActive,
    } = req.body;

    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: {
        ...(slug !== undefined && { slug }),
        ...(title !== undefined && { title }),
        ...(category !== undefined && { category }),
        ...(difficulty !== undefined && { difficulty }),
        ...(timeLimitSeconds !== undefined && { timeLimitSeconds }),
        ...(description !== undefined && { description }),
        ...(prompt !== undefined && { prompt }),
        ...(languages !== undefined && { languages }),
        ...(testCases !== undefined && { testCases }),
        ...(topics !== undefined && { topics }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ question });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Question not found' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: `Question with slug "${req.body.slug}" already exists` });
    }
    console.error('Admin update question error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE QUESTION ─────────────────────────────────────
router.delete('/questions/:id', async (req, res) => {
  try {
    await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Question deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Question not found' });
    }
    console.error('Admin delete question error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
