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
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      loginAttempts: true,
      lockedUntil: true,
      isActive: true,
    }
  });
  console.log('--- USERS IN NEON DB ---');
  console.log(JSON.stringify(users, null, 2));

  // Reset any locked user or login attempts
  await prisma.user.updateMany({
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      isActive: true,
    }
  });
  console.log('✅ Reset all user login attempts and unlocked accounts.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
