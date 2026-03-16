/**
 * Sync Script: Populates the TestCase table from the legacy testCases JSON column.
 * This ensures existing questions work with the new separate table logic.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Syncing TestCase table with legacy JSON data...');

  const questions = await prisma.question.findMany({
    include: { testCaseRows: true }
  });

  let migratedCount = 0;
  let skippedCount = 0;

  for (const question of questions) {
    // Only migrate if the TestCase table is empty but the legacy JSON has data
    if (question.testCaseRows.length === 0 && Array.isArray(question.testCases) && question.testCases.length > 0) {
      console.log(`📦 Migrating ${question.testCases.length} test cases for: ${question.title}`);
      
      const testCaseData = question.testCases.map((tc, idx) => ({
        questionId: question.id,
        input: tc.input || [],
        expected: tc.expected || '',
        visible: tc.visible ?? true,
        description: tc.description || '',
        exampleNum: tc.exampleNum || (idx < 2 ? idx + 1 : null),
        orderIndex: idx,
      }));

      await prisma.testCase.createMany({
        data: testCaseData
      });
      
      migratedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`\n✅ Sync complete!`);
  console.log(`📈 Migrated: ${migratedCount} questions`);
  console.log(`⏩ Skipped: ${skippedCount} questions (already synced or no data)`);
}

main()
  .catch(e => {
    console.error('❌ Sync failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
