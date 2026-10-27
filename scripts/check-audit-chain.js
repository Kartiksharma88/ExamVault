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
  console.log(`Found ${events.length} audit events in Neon DB.`);
  events.forEach((ev, idx) => {
    console.log(`[${idx}] ${ev.timestamp.toISOString()} | Action: ${ev.action} | ID: ${ev.id} | prevHash: ${ev.prevHash.substring(0, 16)}... | entryHash: ${ev.entryHash.substring(0, 16)}...`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
