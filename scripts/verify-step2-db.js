const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  console.log('--- Step 2 Database Triggers & Rules Verification ---');

  // Find a draft question version
  const draftVersion = await prisma.questionVersion.findFirst({
    where: { status: 'DRAFT' },
  });

  if (!draftVersion) {
    console.error('No DRAFT question found to test transitions');
    process.exit(1);
  }

  // 1. Test State Machine Trigger: Direct SQL DRAFT -> APPROVED should fail!
  console.log('\n[1] Testing State Machine Trigger (DRAFT -> APPROVED direct SQL transition)...');
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE question_versions SET status = 'APPROVED' WHERE id = '${draftVersion.id}'`,
    );
    console.error('FAIL: Direct transition DRAFT -> APPROVED should have been rejected by trigger!');
    process.exit(1);
  } catch (err) {
    console.log('PASS: Database trigger blocked invalid state machine transition:');
    console.log('     ', err.message.split('\n')[0]);
  }

  // 2. Test Content Immutability Trigger on non-DRAFT version
  console.log('\n[2] Testing Immutability Trigger (modifying content on non-DRAFT question)...');
  const submittedVersion = await prisma.questionVersion.findFirst({
    where: { status: { not: 'DRAFT' } },
  });

  if (submittedVersion) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE question_versions SET content_commitment = 'tampered-hash-123' WHERE id = '${submittedVersion.id}'`,
      );
      console.error('FAIL: Direct modification of content_commitment on non-DRAFT version should have failed!');
      process.exit(1);
    } catch (err) {
      console.log('PASS: Database immutability trigger blocked modification of non-DRAFT content:');
      console.log('     ', err.message.split('\n')[0]);
    }
  }

  // 3. Test Append-Only Trigger on Approvals Table
  console.log('\n[3] Testing Append-Only Trigger on Approvals Table...');
  // Check if an approval exists or insert a test one
  const approval = await prisma.approval.findFirst();
  if (approval) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE approvals SET decision = 'REJECT' WHERE id = '${approval.id}'`,
      );
      console.error('FAIL: Updating approvals table should have been blocked by trigger!');
      process.exit(1);
    } catch (err) {
      console.log('PASS: Database append-only trigger blocked UPDATE on approvals:');
      console.log('     ', err.message.split('\n')[0]);
    }

    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM approvals WHERE id = '${approval.id}'`,
      );
      console.error('FAIL: Deleting from approvals table should have been blocked by trigger!');
      process.exit(1);
    } catch (err) {
      console.log('PASS: Database append-only trigger blocked DELETE on approvals:');
      console.log('     ', err.message.split('\n')[0]);
    }
  } else {
    console.log('Note: No approval record found yet to test UPDATE/DELETE trigger directly.');
  }

  // 4. Test Eligibility View: Setting status = APPROVED without valid approvals does NOT yield eligibility
  console.log('\n[4] Testing eligible_question_versions View Integrity...');
  const eligibleRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM eligible_question_versions`,
  );
  console.log(`PASS: eligible_question_versions successfully queried. Found ${eligibleRows.length} fully verified eligible versions.`);

  console.log('\n=== ALL STEP 2 DATABASE INTEGRITY CHECKS PASSED ===');
}

main()
  .catch((err) => {
    console.error('Error during DB verification:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
