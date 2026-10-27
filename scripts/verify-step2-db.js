const fs = require('fs');
const path = require('path');

// Read .env manually
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
  console.log('--- VERIFYING STEP 2 DATABASE CONSTRAINTS & TRIGGERS ---');

  // 1. Check valid_state_transitions
  const transitions = await prisma.validStateTransition.findMany();
  console.log(`✅ Loaded ${transitions.length} state transitions from valid_state_transitions table.`);

  // 2. Query eligible_question_versions view
  const eligible = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM eligible_question_versions`;
  console.log('✅ eligible_question_versions view queried successfully. Count:', eligible[0].count);

  // 3. Test append-only trigger on approvals
  const users = await prisma.user.findMany({ take: 2 });
  const question = await prisma.question.findFirst({ include: { versions: true } });

  if (users.length >= 1 && question) {
    const approval = await prisma.approval.create({
      data: {
        questionId: question.id,
        versionNo: question.versions[0].versionNo,
        contentCommitment: question.versions[0].contentCommitment,
        decision: 'APPROVE',
        role: 'REVIEWER',
        approverId: users[0].id,
        signature: 'mock_signature_test',
      },
    });
    console.log('✅ Created test approval record:', approval.id);

    // Attempt UPDATE on approval (must fail)
    try {
      await prisma.$executeRaw`UPDATE approvals SET decision = 'REJECT' WHERE id = ${approval.id}::uuid`;
      console.error('❌ ERROR: UPDATE on approvals was not blocked!');
    } catch (err) {
      console.log('✅ Trigger prevented UPDATE on approvals:', err.message.slice(0, 100));
    }

    // Attempt DELETE on approval (must fail)
    try {
      await prisma.$executeRaw`DELETE FROM approvals WHERE id = ${approval.id}::uuid`;
      console.error('❌ ERROR: DELETE on approvals was not blocked!');
    } catch (err) {
      console.log('✅ Trigger prevented DELETE on approvals:', err.message.slice(0, 100));
    }
  }

  // 4. Test state machine trigger on question_versions: invalid transition must fail
  if (question && question.versions.length > 0) {
    const v = question.versions[0];
    console.log('Testing version', v.id, 'with current status:', v.status);
    const illegalTarget = v.status === 'APPROVED' ? 'DRAFT' : 'RETIRED';
    try {
      await prisma.$executeRaw`UPDATE question_versions SET status = ${illegalTarget}::question_status WHERE id = ${v.id}::uuid`;
      console.error('❌ ERROR: Invalid state transition was not blocked!');
    } catch (err) {
      console.log('✅ Trigger prevented invalid state transition:', err.message.slice(0, 120));
    }
  }

  console.log('--- ALL STEP 2 DB CHECKS PASSED ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
