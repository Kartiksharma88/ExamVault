const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  const events = await prisma.auditEvent.findMany({
    orderBy: { timestamp: 'asc' },
  });

  const GENESIS_HASH = '0'.repeat(64);
  let prevHash = GENESIS_HASH;
  let hashMismatches = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const canonicalEvent = JSON.stringify({
      timestamp: event.timestamp.toISOString(),
      actorId: event.actorId || null,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId || null,
      metadata: event.metadata || null,
    });

    const expectedHash = crypto
      .createHash('sha256')
      .update(prevHash)
      .update(canonicalEvent)
      .digest('hex');

    if (event.entryHash !== expectedHash) {
      console.log(`❌ Hash mismatch at index ${i}: expected ${expectedHash}, got ${event.entryHash}`);
      hashMismatches++;
    }

    prevHash = event.entryHash;
  }

  if (hashMismatches === 0) {
    console.log(`✅ ALL ${events.length} SHA-256 HASH CHAIN ENTRIES ARE 100% MATHEMATICALLY VALID AND INTACT!`);
  } else {
    console.log(`❌ Found ${hashMismatches} hash mismatches.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
