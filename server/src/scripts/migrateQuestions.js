/**
 * Migration script: Transfer questions from questions.js into PostgreSQL
 * Run once: node src/scripts/migrateQuestions.js
 */
const { PrismaClient } = require('@prisma/client');
const questions = require('../data/questions');

const prisma = new PrismaClient();

async function main() {
  console.log(`📦 Migrating ${questions.length} questions to database...`);

  for (const q of questions) {
    const slug = q.id; // e.g. 'easy-sum'
    const existing = await prisma.question.findUnique({ where: { slug } });
    if (existing) {
      console.log(`  ⏭️  Skipping "${q.title}" (already exists)`);
      continue;
    }

    await prisma.question.create({
      data: {
        slug,
        title: q.title,
        category: q.category,
        difficulty: q.difficulty,
        timeLimitSeconds: q.timeLimitSeconds,
        description: q.description,
        prompt: q.prompt,
        languages: q.languages,
        testCases: q.testCases,
        topics: q.topics || [],
      },
    });
    console.log(`  ✅ Migrated: "${q.title}"`);
  }

  // Set admin user
  const adminEmail = 'aiappsontheside@gmail.com';
  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (adminUser) {
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'admin' },
    });
    console.log(`\n👑 Set ${adminUser.username} (${adminEmail}) as admin`);
  } else {
    console.log(`\n⚠️  Admin user ${adminEmail} not found. Register first, then re-run.`);
  }

  console.log('\n🎉 Migration complete!');
}

main()
  .catch(e => { console.error('Migration failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
