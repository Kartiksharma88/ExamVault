/**
 * ExamVault Seed Script
 * 
 * Creates:
 * 1. Admin user from environment variables
 * 2. Sample examiners and auditor
 * 3. Exam with 3 subjects (Physics, Chemistry, Mathematics)
 * 4. Topics and subtopics for each subject
 * 5. 200+ synthetic questions with encrypted content
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { generateCustodianKeyPair } from '@examvault/shared';

function loadEnv() {
  const envPaths = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/api/.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}
loadEnv();

const prisma = new PrismaClient();

// ── Crypto helpers (replicate envelope encryption for seeding) ──
function getMasterKey(): Buffer {
  const hex = process.env.MASTER_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  return Buffer.from(hex, 'hex');
}

function getKeyId(): string {
  return process.env.MASTER_KEY_ID || 'local-dev-key-001';
}

function wrapKey(dataKey: Buffer, masterKey: Buffer): Buffer {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, nonce);
  const encrypted = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, tag, encrypted]);
}

function encrypt(plaintext: string, associatedData: string, masterKey: Buffer) {
  const dataKey = crypto.randomBytes(32);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, nonce);
  cipher.setAAD(Buffer.from(associatedData, 'utf-8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const wrappedKey = wrapKey(dataKey, masterKey);
  dataKey.fill(0);
  return { ciphertext, nonce, tag, wrappedKey };
}

function computeCommitment(canonicalJson: string): { commitment: string; salt: string } {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256');
  hash.update(salt);
  hash.update(canonicalJson);
  return { commitment: hash.digest('hex'), salt };
}

function generateWrappedSigningKey(masterKey: Buffer) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const privateKeyDer = privateKey.export({ type: 'pkcs8', format: 'der' });
  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyB64 = publicKeyDer.toString('base64');
  const wrappedKey = wrapKey(privateKeyDer, masterKey);
  return { publicKeyB64, wrappedKey, privateKey };
}

function signApprovalPayload(
  approvalId: string,
  questionId: string,
  versionNo: number,
  contentCommitment: string,
  decision: string,
  role: string,
  approverId: string,
  reviewRound: number,
  policyVersion: number,
  timestamp: Date,
  privateKey: crypto.KeyObject,
): string {
  const payload = [
    approvalId,
    questionId,
    versionNo,
    contentCommitment,
    decision,
    role,
    approverId,
    reviewRound,
    policyVersion,
    timestamp.toISOString(),
  ].join('|');
  const sig = crypto.sign(null, Buffer.from(payload, 'utf-8'), privateKey);
  return sig.toString('base64');
}

// ── Signing helpers ──
let signingKey: crypto.KeyObject;
let verifyKey: crypto.KeyObject;
function initSigningKeys() {
  const privateKeyB64 = process.env.AUDIT_SIGNING_PRIVATE_KEY;
  if (privateKeyB64 && privateKeyB64 !== 'replace-with-base64-ed25519-private-key') {
    const privateKeyDer = Buffer.from(privateKeyB64, 'base64');
    signingKey = crypto.createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' });
    verifyKey = crypto.createPublicKey(signingKey);
  } else {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    signingKey = privateKey;
    verifyKey = publicKey;
  }
}

function sign(data: Buffer): Buffer {
  return Buffer.from(crypto.sign(null, data, signingKey));
}

let lastAuditHash = '0'.repeat(64);
async function auditLog(entry: { actorId?: string; action: string; targetType: string; targetId?: string; metadata?: any }) {
  const timestamp = new Date();
  const canonicalEvent = JSON.stringify({
    timestamp: timestamp.toISOString(),
    actorId: entry.actorId || null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId || null,
    metadata: entry.metadata || null,
  });
  const entryHash = crypto.createHash('sha256').update(lastAuditHash).update(canonicalEvent).digest('hex');
  const signature = sign(Buffer.from(entryHash, 'hex'));
  await prisma.auditEvent.create({
    data: {
      timestamp,
      actorId: entry.actorId || null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId || null,
      metadata: entry.metadata,
      prevHash: lastAuditHash,
      entryHash,
      signature: signature.toString('base64'),
    },
  });
  lastAuditHash = entryHash;
}

// ── Synthetic question data ──
const physicsQuestions = [
  { stem: 'A body of mass 5 kg is moving with a velocity of $10 \\, \\text{m/s}$. What is its kinetic energy?', options: ['250 J', '500 J', '100 J', '50 J'], correct: 'A', difficulty: 0.2, level: 'APPLY', topic: 'Mechanics' },
  { stem: 'The SI unit of electric charge is:', options: ['Ampere', 'Coulomb', 'Volt', 'Ohm'], correct: 'B', difficulty: 0.1, level: 'REMEMBER', topic: 'Electrostatics' },
  { stem: 'A convex lens has a focal length of 20 cm. An object is placed 30 cm from the lens. Where is the image formed?', options: ['60 cm', '40 cm', '20 cm', '15 cm'], correct: 'A', difficulty: 0.4, level: 'APPLY', topic: 'Optics' },
  { stem: 'What is the frequency of a wave with wavelength $\\lambda = 0.5 \\, \\text{m}$ and speed $v = 340 \\, \\text{m/s}$?', options: ['680 Hz', '170 Hz', '340 Hz', '85 Hz'], correct: 'A', difficulty: 0.3, level: 'APPLY', topic: 'Waves' },
  { stem: 'According to Newton\'s third law, action and reaction forces:', options: ['Act on the same body', 'Act on different bodies', 'Are unequal', 'Act in the same direction'], correct: 'B', difficulty: 0.15, level: 'UNDERSTAND', topic: 'Mechanics' },
  { stem: 'The work done by a force $F = 10 \\, \\text{N}$ in moving an object by $d = 5 \\, \\text{m}$ along the direction of force is:', options: ['50 J', '2 J', '15 J', '100 J'], correct: 'A', difficulty: 0.15, level: 'APPLY', topic: 'Mechanics' },
  { stem: 'Which of the following is a vector quantity?', options: ['Speed', 'Mass', 'Displacement', 'Temperature'], correct: 'C', difficulty: 0.1, level: 'REMEMBER', topic: 'Mechanics' },
  { stem: 'The total energy of a satellite in orbit is:', options: ['Positive', 'Zero', 'Negative', 'Infinite'], correct: 'C', difficulty: 0.5, level: 'UNDERSTAND', topic: 'Gravitation' },
  { stem: 'Faraday\'s law of electromagnetic induction relates to:', options: ['Electric field and charge', 'Magnetic flux and EMF', 'Current and resistance', 'Power and voltage'], correct: 'B', difficulty: 0.35, level: 'REMEMBER', topic: 'Electromagnetic Induction' },
  { stem: 'The dimensional formula of Planck\'s constant is:', options: ['$[ML^2T^{-1}]$', '$[MLT^{-2}]$', '$[ML^2T^{-2}]$', '$[M^{-1}L^2T]$'], correct: 'A', difficulty: 0.6, level: 'ANALYZE', topic: 'Modern Physics' },
  // Hindi (Devanagari) question
  { stem: 'एक वस्तु का द्रव्यमान 2 kg है और उस पर 10 N का बल लगाया जाता है। त्वरण ज्ञात कीजिए।', options: ['5 m/s²', '20 m/s²', '10 m/s²', '2 m/s²'], correct: 'A', difficulty: 0.2, level: 'APPLY', topic: 'Mechanics', language: 'HI' },
  { stem: 'The coefficient of restitution for a perfectly elastic collision is:', options: ['0', '1', '0.5', 'Infinity'], correct: 'B', difficulty: 0.3, level: 'REMEMBER', topic: 'Mechanics' },
  { stem: 'A transformer has 100 primary turns and 500 secondary turns. If the input voltage is 220V, the output voltage is:', options: ['1100 V', '44 V', '220 V', '550 V'], correct: 'A', difficulty: 0.4, level: 'APPLY', topic: 'Electromagnetic Induction' },
  { stem: 'The de Broglie wavelength of a particle with momentum $p$ is given by $\\lambda = $', options: ['$h/p$', '$p/h$', '$hp$', '$h^2/p$'], correct: 'A', difficulty: 0.35, level: 'REMEMBER', topic: 'Modern Physics' },
  { stem: 'In a Young\'s double slit experiment, the fringe width is proportional to:', options: ['Slit separation', 'Wavelength', 'Distance of screen only', 'Intensity'], correct: 'B', difficulty: 0.45, level: 'UNDERSTAND', topic: 'Optics' },
];

const chemistryQuestions = [
  { stem: 'What is the atomic number of Carbon?', options: ['4', '6', '8', '12'], correct: 'B', difficulty: 0.05, level: 'REMEMBER', topic: 'Atomic Structure' },
  { stem: 'Which of the following is a noble gas?', options: ['Nitrogen', 'Oxygen', 'Argon', 'Hydrogen'], correct: 'C', difficulty: 0.1, level: 'REMEMBER', topic: 'Periodic Table' },
  { stem: 'The pH of a neutral solution at 25°C is:', options: ['0', '7', '14', '1'], correct: 'B', difficulty: 0.1, level: 'REMEMBER', topic: 'Chemical Equilibrium' },
  { stem: 'In the reaction $2H_2 + O_2 \\rightarrow 2H_2O$, the mole ratio of hydrogen to oxygen is:', options: ['1:1', '2:1', '1:2', '2:2'], correct: 'B', difficulty: 0.2, level: 'UNDERSTAND', topic: 'Stoichiometry' },
  { stem: 'Which type of bond is formed between Na and Cl in NaCl?', options: ['Covalent', 'Ionic', 'Metallic', 'Hydrogen'], correct: 'B', difficulty: 0.15, level: 'REMEMBER', topic: 'Chemical Bonding' },
  { stem: 'The IUPAC name of $CH_3CHO$ is:', options: ['Methanol', 'Ethanal', 'Propanal', 'Acetone'], correct: 'B', difficulty: 0.3, level: 'REMEMBER', topic: 'Organic Chemistry' },
  { stem: 'Le Chatelier\'s principle states that a system in equilibrium will shift to:', options: ['Increase entropy', 'Counteract any change', 'Increase temperature', 'Decrease pressure'], correct: 'B', difficulty: 0.35, level: 'UNDERSTAND', topic: 'Chemical Equilibrium' },
  { stem: 'The hybridization of carbon in methane ($CH_4$) is:', options: ['$sp$', '$sp^2$', '$sp^3$', '$sp^3d$'], correct: 'C', difficulty: 0.25, level: 'REMEMBER', topic: 'Chemical Bonding' },
  { stem: 'Which quantum number determines the shape of an orbital?', options: ['Principal ($n$)', 'Azimuthal ($l$)', 'Magnetic ($m_l$)', 'Spin ($m_s$)'], correct: 'B', difficulty: 0.3, level: 'UNDERSTAND', topic: 'Atomic Structure' },
  { stem: 'Oxidation state of Mn in $KMnO_4$ is:', options: ['+2', '+4', '+7', '+5'], correct: 'C', difficulty: 0.35, level: 'APPLY', topic: 'Redox Reactions' },
  { stem: 'The catalyst used in Haber\'s process is:', options: ['Platinum', 'Vanadium pentoxide', 'Iron', 'Nickel'], correct: 'C', difficulty: 0.25, level: 'REMEMBER', topic: 'Chemical Kinetics' },
  { stem: 'Benzene is an example of a/an:', options: ['Aliphatic compound', 'Aromatic compound', 'Alkane', 'Alkene'], correct: 'B', difficulty: 0.15, level: 'REMEMBER', topic: 'Organic Chemistry' },
  { stem: 'What is the molarity of a solution containing 4 g of NaOH in 500 mL?', options: ['0.1 M', '0.2 M', '0.5 M', '1.0 M'], correct: 'B', difficulty: 0.4, level: 'APPLY', topic: 'Solutions' },
  { stem: 'Which law states that the total pressure of a gas mixture equals the sum of partial pressures?', options: ['Boyle\'s Law', 'Dalton\'s Law', 'Henry\'s Law', 'Raoult\'s Law'], correct: 'B', difficulty: 0.2, level: 'REMEMBER', topic: 'States of Matter' },
  { stem: 'एक गैस का आण्विक भार 44 g/mol है। यह गैस कौन सी हो सकती है?', options: ['$O_2$', '$N_2$', '$CO_2$', '$H_2O$'], correct: 'C', difficulty: 0.2, level: 'APPLY', topic: 'Stoichiometry', language: 'HI' },
];

const mathQuestions = [
  { stem: 'What is the derivative of $\\sin(x)$?', options: ['$\\cos(x)$', '$-\\cos(x)$', '$\\tan(x)$', '$-\\sin(x)$'], correct: 'A', difficulty: 0.1, level: 'REMEMBER', topic: 'Differential Calculus' },
  { stem: 'The value of $\\int_0^{\\pi} \\sin(x) \\, dx$ is:', options: ['0', '1', '2', '$\\pi$'], correct: 'C', difficulty: 0.3, level: 'APPLY', topic: 'Integral Calculus' },
  { stem: 'If $A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$, then $\\det(A) =$', options: ['-2', '2', '-4', '10'], correct: 'A', difficulty: 0.25, level: 'APPLY', topic: 'Matrices' },
  { stem: 'The number of permutations of 5 objects taken 3 at a time is:', options: ['10', '60', '15', '120'], correct: 'B', difficulty: 0.25, level: 'APPLY', topic: 'Combinatorics' },
  { stem: 'The general solution of $\\frac{dy}{dx} = y$ is:', options: ['$y = Ce^x$', '$y = Ce^{-x}$', '$y = Cx$', '$y = C\\ln(x)$'], correct: 'A', difficulty: 0.35, level: 'UNDERSTAND', topic: 'Differential Equations' },
  { stem: 'The sum of the first $n$ natural numbers is:', options: ['$n(n+1)$', '$\\frac{n(n+1)}{2}$', '$n^2$', '$\\frac{n(n-1)}{2}$'], correct: 'B', difficulty: 0.15, level: 'REMEMBER', topic: 'Sequences and Series' },
  { stem: 'The eccentricity of a parabola is:', options: ['0', '1', 'Less than 1', 'Greater than 1'], correct: 'B', difficulty: 0.3, level: 'REMEMBER', topic: 'Conic Sections' },
  { stem: 'If $\\vec{a} = 2\\hat{i} + 3\\hat{j}$ and $\\vec{b} = \\hat{i} - \\hat{j}$, then $\\vec{a} \\cdot \\vec{b} =$', options: ['-1', '5', '1', '-5'], correct: 'A', difficulty: 0.25, level: 'APPLY', topic: 'Vectors' },
  { stem: 'The probability of getting at least one head in 3 tosses of a fair coin is:', options: ['$\\frac{1}{8}$', '$\\frac{3}{8}$', '$\\frac{7}{8}$', '$\\frac{1}{2}$'], correct: 'C', difficulty: 0.3, level: 'APPLY', topic: 'Probability' },
  { stem: '$\\lim_{x \\to 0} \\frac{\\sin x}{x} =$', options: ['0', '1', '$\\infty$', 'Does not exist'], correct: 'B', difficulty: 0.2, level: 'REMEMBER', topic: 'Limits' },
  { stem: 'The rank of a $3 \\times 3$ identity matrix is:', options: ['0', '1', '2', '3'], correct: 'D', difficulty: 0.15, level: 'REMEMBER', topic: 'Matrices' },
  { stem: 'If $z = 3 + 4i$, then $|z| =$', options: ['5', '7', '25', '1'], correct: 'A', difficulty: 0.2, level: 'APPLY', topic: 'Complex Numbers' },
  { stem: 'The equation $x^2 + y^2 = 25$ represents a:', options: ['Parabola', 'Ellipse', 'Circle', 'Hyperbola'], correct: 'C', difficulty: 0.1, level: 'REMEMBER', topic: 'Conic Sections' },
  { stem: '$\\frac{d}{dx}[x^n] = $', options: ['$nx^n$', '$nx^{n-1}$', '$x^{n+1}/(n+1)$', '$(n-1)x^n$'], correct: 'B', difficulty: 0.1, level: 'REMEMBER', topic: 'Differential Calculus' },
  { stem: 'यदि $f(x) = x^3 - 3x + 2$ तो $f\'(1) = $', options: ['0', '2', '3', '-1'], correct: 'A', difficulty: 0.3, level: 'APPLY', topic: 'Differential Calculus', language: 'HI' },
];

// Generate more questions by combining templates
function generateMore(base: typeof physicsQuestions, subjectTopics: string[], count: number) {
  const difficulties = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const levels = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'] as const;
  const extra = [];
  for (let i = 0; i < count; i++) {
    const baseQ = base[i % base.length];
    const topic = subjectTopics[i % subjectTopics.length];
    const diff = difficulties[i % difficulties.length];
    const level = levels[i % levels.length];
    extra.push({
      stem: `[Generated #${i + 1}] ${baseQ.stem}`,
      options: baseQ.options,
      correct: baseQ.correct,
      difficulty: diff,
      level,
      topic,
      language: i % 7 === 0 ? 'HI' : 'EN',
    });
  }
  return extra;
}

async function main() {
  console.log('🌱 Seeding ExamVault database...');
  initSigningKeys();
  const masterKey = getMasterKey();
  const keyId = getKeyId();

  // ── 1. Create Admin ──
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@examvault.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@ExamVault2024!';
  const adminHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'System Administrator',
      passwordHash: adminHash,
      role: 'ADMIN',
      mustSetupMfa: true,
    },
  });
  const admin2 = await prisma.user.upsert({
    where: { email: 'admin2@examvault.local' },
    update: {},
    create: {
      email: 'admin2@examvault.local',
      name: 'Secondary Administrator (Policy Approver)',
      passwordHash: adminHash,
      role: 'ADMIN',
      mustSetupMfa: true,
    },
  });
  const admin3 = await prisma.user.upsert({
    where: { email: 'admin3@examvault.local' },
    update: {},
    create: {
      email: 'admin3@examvault.local',
      name: 'Tertiary Administrator (Audit Admin)',
      passwordHash: adminHash,
      role: 'ADMIN',
      mustSetupMfa: true,
    },
  });

  // Generate wrapped signing keys for all three admins for two-admin approvals
  for (const adm of [admin, admin2, admin3]) {
    const sigKey = generateWrappedSigningKey(masterKey);
    await prisma.userSigningKey.upsert({
      where: { userId: adm.id },
      update: {},
      create: {
        userId: adm.id,
        publicKey: sigKey.publicKeyB64,
        wrappedPrivateKey: sigKey.wrappedKey,
        keyId,
      },
    });
  }

  console.log(`  ✅ Admins: ${admin.email}, ${admin2.email}, ${admin3.email}`);

  // ── 2. Create sample users ──
  const examinerHash = await argon2.hash('Examiner@2024!pass', {
    type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4,
  });

  const examiner1 = await prisma.user.upsert({
    where: { email: 'examiner1@examvault.local' },
    update: {},
    create: {
      email: 'examiner1@examvault.local',
      name: 'Dr. Priya Sharma',
      passwordHash: examinerHash,
      role: 'EXAMINER',
      mustSetupMfa: true,
    },
  });

  const examiner2 = await prisma.user.upsert({
    where: { email: 'examiner2@examvault.local' },
    update: {},
    create: {
      email: 'examiner2@examvault.local',
      name: 'Prof. Rajesh Kumar',
      passwordHash: examinerHash,
      role: 'EXAMINER',
      mustSetupMfa: true,
    },
  });

  const examiner3 = await prisma.user.upsert({
    where: { email: 'examiner3@examvault.local' },
    update: {},
    create: {
      email: 'examiner3@examvault.local',
      name: 'Dr. Sneha Rao',
      passwordHash: examinerHash,
      role: 'EXAMINER',
      mustSetupMfa: true,
    },
  });

  // Moderators
  const moderator1 = await prisma.user.upsert({
    where: { email: 'moderator1@examvault.local' },
    update: {},
    create: {
      email: 'moderator1@examvault.local',
      name: 'Dr. Arvind Swaminathan (Lead Moderator)',
      passwordHash: examinerHash,
      role: 'MODERATOR',
      mustSetupMfa: true,
    },
  });

  const moderator2 = await prisma.user.upsert({
    where: { email: 'moderator2@examvault.local' },
    update: {},
    create: {
      email: 'moderator2@examvault.local',
      name: 'Prof. Meenakshi Sundaram (Moderator)',
      passwordHash: examinerHash,
      role: 'MODERATOR',
      mustSetupMfa: true,
    },
  });

  // 6 Reviewers
  const reviewerData = [
    { email: 'reviewer1@examvault.local', name: 'Dr. Ananya Patel', subjects: ['PHY', 'CHE'] },
    { email: 'reviewer2@examvault.local', name: 'Prof. Amit Verma', subjects: ['PHY', 'MAT'] },
    { email: 'reviewer3@examvault.local', name: 'Dr. Kavita Nair', subjects: ['CHE'] },
    { email: 'reviewer4@examvault.local', name: 'Dr. Rahul Mehra', subjects: ['MAT'] },
    { email: 'reviewer5@examvault.local', name: 'Dr. Suresh Joshi', subjects: ['PHY'] },
    { email: 'reviewer6@examvault.local', name: 'Dr. Deepa Sundaram', subjects: ['CHE', 'MAT'] },
  ];

  const reviewers: any[] = [];
  const reviewerPrivateKeys: Record<string, crypto.KeyObject> = {};

  for (const r of reviewerData) {
    const user = await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: {
        email: r.email,
        name: r.name,
        passwordHash: examinerHash,
        role: 'REVIEWER',
        mustSetupMfa: true,
      },
    });
    reviewers.push(user);

    // Create signing key
    const sigKey = generateWrappedSigningKey(masterKey);
    reviewerPrivateKeys[user.id] = sigKey.privateKey;
    await prisma.userSigningKey.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        publicKey: sigKey.publicKeyB64,
        wrappedPrivateKey: sigKey.wrappedKey,
        keyId,
      },
    });
  }

  // Also ensure legacy reviewer@examvault.local exists
  const legacyReviewer = await prisma.user.upsert({
    where: { email: 'reviewer@examvault.local' },
    update: {},
    create: {
      email: 'reviewer@examvault.local',
      name: 'Dr. Ananya Patel (Default)',
      passwordHash: examinerHash,
      role: 'REVIEWER',
      mustSetupMfa: true,
    },
  });

  // Signing keys for moderators
  const mod1Sig = generateWrappedSigningKey(masterKey);
  const mod2Sig = generateWrappedSigningKey(masterKey);
  const mod1PrivateKey = mod1Sig.privateKey;
  const mod2PrivateKey = mod2Sig.privateKey;

  await prisma.userSigningKey.upsert({
    where: { userId: moderator1.id },
    update: {},
    create: {
      userId: moderator1.id,
      publicKey: mod1Sig.publicKeyB64,
      wrappedPrivateKey: mod1Sig.wrappedKey,
      keyId,
    },
  });
  await prisma.userSigningKey.upsert({
    where: { userId: moderator2.id },
    update: {},
    create: {
      userId: moderator2.id,
      publicKey: mod2Sig.publicKeyB64,
      wrappedPrivateKey: mod2Sig.wrappedKey,
      keyId,
    },
  });

  const auditor = await prisma.user.upsert({
    where: { email: 'auditor@examvault.local' },
    update: {},
    create: {
      email: 'auditor@examvault.local',
      name: 'Mr. Vikram Singh',
      passwordHash: examinerHash,
      role: 'AUDITOR',
      mustSetupMfa: true,
    },
  });

  // ── Step 4 & 5: 7 Custodians with enrolled X25519 public keys ──
  const custodians: any[] = [];
  const custodianKeys: any[] = [];
  for (let i = 1; i <= 7; i++) {
    const cUser = await prisma.user.upsert({
      where: { email: `custodian${i}@examvault.local` },
      update: {},
      create: {
        email: `custodian${i}@examvault.local`,
        name: `Exam Custodian ${i}`,
        passwordHash: examinerHash,
        role: 'CUSTODIAN',
        mustSetupMfa: true,
      },
    });
    custodians.push(cUser);
    const kp = await generateCustodianKeyPair();
    custodianKeys.push(kp);
  }

  // Default approved custodian group (k=3, n=5)
  const defaultGroup = await prisma.custodianGroup.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Primary Examination Custodian Board',
      n: 5,
      k: 3,
      isActive: true,
      members: {
        create: custodians.slice(0, 5).map((c, idx) => ({
          custodianId: c.id,
          publicKey: custodianKeys[idx].publicKeyHex,
          fingerprint: custodianKeys[idx].fingerprint,
          enrolledAt: new Date(),
        })),
      },
    },
  });

  console.log(`  ✅ Users: 3 Admins, 3 Examiners, 2 Moderators, 6 Reviewers, 1 Auditor, 7 Custodians`);
  console.log(`  ✅ Custodian Group: ${defaultGroup.name} (k=3, n=5)`);

  // ── 3. Create Exam and Syllabus ──
  const exam = await prisma.exam.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'JEE Advanced 2025',
      description: 'Joint Entrance Examination Advanced — Engineering entrance exam',
    },
  });

  // Subjects
  const phySubject = await prisma.subject.upsert({
    where: { examId_code: { examId: exam.id, code: 'PHY' } },
    update: {},
    create: { examId: exam.id, name: 'Physics', code: 'PHY', nextSeq: 1 },
  });
  const cheSubject = await prisma.subject.upsert({
    where: { examId_code: { examId: exam.id, code: 'CHE' } },
    update: {},
    create: { examId: exam.id, name: 'Chemistry', code: 'CHE', nextSeq: 1 },
  });
  const matSubject = await prisma.subject.upsert({
    where: { examId_code: { examId: exam.id, code: 'MAT' } },
    update: {},
    create: { examId: exam.id, name: 'Mathematics', code: 'MAT', nextSeq: 1 },
  });

  function deterministicUuid(str: string): string {
    const hex = crypto.createHash('md5').update(str).digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  // Physics topics
  const phyTopics = ['Mechanics', 'Electrostatics', 'Optics', 'Waves', 'Thermodynamics', 'Gravitation', 'Electromagnetic Induction', 'Modern Physics'];
  const phyTopicRecords: Record<string, string> = {};
  for (const t of phyTopics) {
    const topicId = deterministicUuid(`PHY-${t}`);
    const topic = await prisma.topic.upsert({
      where: { id: topicId },
      update: {},
      create: {
        id: topicId,
        subjectId: phySubject.id,
        name: t,
      },
    });
    phyTopicRecords[t] = topic.id;
  }

  // Chemistry topics
  const cheTopics = ['Atomic Structure', 'Periodic Table', 'Chemical Bonding', 'Stoichiometry', 'Chemical Equilibrium', 'Organic Chemistry', 'Redox Reactions', 'Chemical Kinetics', 'Solutions', 'States of Matter'];
  const cheTopicRecords: Record<string, string> = {};
  for (const t of cheTopics) {
    const topicId = deterministicUuid(`CHE-${t}`);
    const topic = await prisma.topic.upsert({
      where: { id: topicId },
      update: {},
      create: {
        id: topicId,
        subjectId: cheSubject.id,
        name: t,
      },
    });
    cheTopicRecords[t] = topic.id;
  }

  // Math topics
  const matTopics = ['Differential Calculus', 'Integral Calculus', 'Matrices', 'Combinatorics', 'Differential Equations', 'Sequences and Series', 'Conic Sections', 'Vectors', 'Probability', 'Limits', 'Complex Numbers'];
  const matTopicRecords: Record<string, string> = {};
  for (const t of matTopics) {
    const topicId = deterministicUuid(`MAT-${t}`);
    const topic = await prisma.topic.upsert({
      where: { id: topicId },
      update: {},
      create: {
        id: topicId,
        subjectId: matSubject.id,
        name: t,
      },
    });
    matTopicRecords[t] = topic.id;
  }

  console.log(`  ✅ Syllabus: ${phyTopics.length + cheTopics.length + matTopics.length} topics`);

  // ── 3.1 Examiner & Reviewer Subject Expertise ──
  const subjectMap: Record<string, string> = {
    PHY: phySubject.id,
    CHE: cheSubject.id,
    MAT: matSubject.id,
  };

  // Examiner expertise
  const examinerExpertise = [
    { user: examiner1, codes: ['PHY'] },
    { user: examiner2, codes: ['MAT'] },
    { user: examiner3, codes: ['CHE'] },
  ];
  for (const exp of examinerExpertise) {
    for (const code of exp.codes) {
      await prisma.userSubjectExpertise.upsert({
        where: { userId_subjectId: { userId: exp.user.id, subjectId: subjectMap[code] } },
        update: {},
        create: {
          userId: exp.user.id,
          subjectId: subjectMap[code],
        },
      });
    }
  }

  // Reviewer expertise
  for (let i = 0; i < reviewerData.length; i++) {
    const r = reviewerData[i];
    const user = reviewers[i];
    for (const sCode of r.subjects) {
      await prisma.userSubjectExpertise.upsert({
        where: { userId_subjectId: { userId: user.id, subjectId: subjectMap[sCode] } },
        update: {},
        create: {
          userId: user.id,
          subjectId: subjectMap[sCode],
        },
      });
    }
  }

  // Legacy reviewer PHY
  await prisma.userSubjectExpertise.upsert({
    where: { userId_subjectId: { userId: legacyReviewer.id, subjectId: phySubject.id } },
    update: {},
    create: {
      userId: legacyReviewer.id,
      subjectId: phySubject.id,
    },
  });

  // ── 3.2 Sample Conflict Declarations ──
  function encryptConflict(text: string, userId: string, mKey: Buffer) {
    const dataKey = crypto.randomBytes(32);
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, nonce);
    cipher.setAAD(Buffer.from(userId, 'utf-8'));
    const ciphertext = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const wrappedKey = wrapKey(dataKey, mKey);
    const conflictHash = crypto.createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
    return { ciphertext, nonce, tag, wrappedKey, conflictHash };
  }

  const c1 = encryptConflict('Allen Career Institute, Kota', examiner1.id, masterKey);
  await prisma.conflictDeclaration.upsert({
    where: { id: deterministicUuid('conflict-1') },
    update: {},
    create: {
      id: deterministicUuid('conflict-1'),
      userId: examiner1.id,
      conflictType: 'COACHING_CENTRE',
      encryptedDescription: c1.ciphertext,
      descriptionNonce: c1.nonce,
      descriptionTag: c1.tag,
      wrappedKey: c1.wrappedKey,
      keyId,
      conflictHash: c1.conflictHash,
    },
  });

  const c2 = encryptConflict(`Conflicted with reviewer Dr. Kavita Nair (${reviewers[2].id})`, examiner1.id, masterKey);
  await prisma.conflictDeclaration.upsert({
    where: { id: deterministicUuid('conflict-2') },
    update: {},
    create: {
      id: deterministicUuid('conflict-2'),
      userId: examiner1.id,
      conflictType: 'PERSON',
      encryptedDescription: c2.ciphertext,
      descriptionNonce: c2.nonce,
      descriptionTag: c2.tag,
      wrappedKey: c2.wrappedKey,
      keyId,
      conflictHash: c2.conflictHash,
    },
  });

  // ── 3.3 Approval Policies (Active, dual-admin approved) ──
  const globalPolicy = await prisma.approvalPolicy.upsert({
    where: { id: deterministicUuid('policy-global-v1') },
    update: {},
    create: {
      id: deterministicUuid('policy-global-v1'),
      examId: exam.id,
      version: 1,
      requiredReviewers: 2,
      requireBlindSolve: true,
      requireModerator: true,
      requireLanguageReview: true,
      maxReviewDays: 7,
      exactMatchThreshold: 1.0,
      highSimilarityThreshold: 0.85,
      mediumSimilarityThreshold: 0.60,
      proposedById: admin.id,
      approvedById: admin2.id,
      isActive: true,
    },
  });

  const phyPolicy = await prisma.approvalPolicy.upsert({
    where: { id: deterministicUuid('policy-phy-v1') },
    update: {},
    create: {
      id: deterministicUuid('policy-phy-v1'),
      examId: exam.id,
      subjectId: phySubject.id,
      version: 1,
      requiredReviewers: 2,
      requireBlindSolve: true,
      requireModerator: true,
      requireLanguageReview: true,
      maxReviewDays: 7,
      exactMatchThreshold: 1.0,
      highSimilarityThreshold: 0.85,
      mediumSimilarityThreshold: 0.60,
      proposedById: admin.id,
      approvedById: admin2.id,
      isActive: true,
    },
  });
  console.log(`  ✅ Approval Policies configured (Dual-admin approved)`);

  // ── 3.4 Past Papers and Public Corpus ──
  const pastPaperSource = await prisma.corpusSource.upsert({
    where: { id: deterministicUuid('corpus-past-papers') },
    update: {},
    create: {
      id: deterministicUuid('corpus-past-papers'),
      name: 'JEE Advanced Past Papers (2018-2023)',
      type: 'PAST_PAPER',
      licenseNote: 'Public examination archives for research and screening benchmark',
      importedById: admin.id,
    },
  });

  await prisma.corpusDocument.upsert({
    where: { id: deterministicUuid('doc-jee-2022-p1') },
    update: {},
    create: {
      id: deterministicUuid('doc-jee-2022-p1'),
      sourceId: pastPaperSource.id,
      title: 'JEE Advanced 2022 Paper 1 - Physics Q4',
      identifier: 'JEE-2022-P1-Q04',
      plaintextContent: 'A body of mass 5 kg is moving with a velocity of 10 m/s. What is its kinetic energy? Options: 250 J, 500 J, 100 J, 50 J. Answer: 250 J.',
      normalizedContent: 'body mass 5 kg moving velocity 10 m s kinetic energy options 250 j 500 j 100 j 50 j answer 250 j',
    },
  });
  console.log(`  ✅ Corpus & Past Papers loaded`);

  // ── 4. Create 200+ synthetic questions ──
  const allPhyQuestions = [...physicsQuestions, ...generateMore(physicsQuestions, phyTopics, 55)];
  const allCheQuestions = [...chemistryQuestions, ...generateMore(chemistryQuestions, cheTopics, 55)];
  const allMatQuestions = [...mathQuestions, ...generateMore(mathQuestions, matTopics, 55)];

  const allQuestions = [
    ...allPhyQuestions.map(q => ({ ...q, subject: phySubject, topicRecords: phyTopicRecords })),
    ...allCheQuestions.map(q => ({ ...q, subject: cheSubject, topicRecords: cheTopicRecords })),
    ...allMatQuestions.map(q => ({ ...q, subject: matSubject, topicRecords: matTopicRecords })),
  ];

  console.log(`  📝 Creating ${allQuestions.length} questions across Step 2 workflow states...`);

  let questionCount = 0;
  for (const q of allQuestions) {
    const authorId = questionCount % 3 === 0 ? examiner1.id : questionCount % 3 === 1 ? examiner2.id : examiner3.id;
    const subject = q.subject;
    const topicId = q.topicRecords[q.topic] || Object.values(q.topicRecords)[0];

    // Generate human-readable ID
    const updatedSubject = await prisma.subject.update({
      where: { id: subject.id },
      data: { nextSeq: { increment: 1 } },
    });
    const seqNo = updatedSubject.nextSeq - 1;
    const humanId = `EV-${subject.code}-${String(seqNo).padStart(6, '0')}`;

    // Create question record
    const question = await prisma.question.create({
      data: {
        humanId,
        authorId,
        subjectId: subject.id,
        topicId,
        type: 'MCQ_SINGLE',
        difficulty: q.difficulty,
        cognitiveLevel: q.level as any,
        marks: 4,
        negativeMarks: 1,
        estimatedTime: 120,
        language: ((q as any).language || 'EN') as any,
        currentVersion: 1,
      },
    });

    // Build content and encrypt
    const content = {
      type: 'MCQ_SINGLE',
      stem: q.stem,
      options: q.options.map((text: string, idx: number) => ({
        label: String.fromCharCode(65 + idx),
        text,
      })),
      solution: `Step-by-step verified solution for ${q.stem}`,
      language: (q as any).language || 'EN',
    };

    const answerKey = { type: 'MCQ_SINGLE', correct: q.correct };

    const canonicalContent = JSON.stringify(content);
    const commitment = computeCommitment(canonicalContent);
    const contentWithSalt = { ...content, _commitmentSalt: commitment.salt };

    const associatedData = `${question.id}:1`;
    const contentEnvelope = encrypt(JSON.stringify(contentWithSalt), associatedData, masterKey);
    const answerEnvelope = encrypt(JSON.stringify(answerKey), associatedData, masterKey);

    // Explicit state allocation for first 10 questions to guarantee representation of each Step 2 state
    let status = 'DRAFT';
    if (questionCount === 0) status = 'DRAFT';
    else if (questionCount === 1) status = 'SUBMITTED';
    else if (questionCount === 2) status = 'SCREENING';
    else if (questionCount === 3) status = 'DUPLICATE_FLAGGED';
    else if (questionCount === 4) status = 'READY_FOR_REVIEW';
    else if (questionCount === 5) status = 'UNDER_REVIEW';
    else if (questionCount === 6) status = 'CHANGES_REQUESTED';
    else if (questionCount === 7) status = 'MODERATION';
    else if (questionCount === 8) status = 'APPROVED';
    else if (questionCount === 9) status = 'RETIRED';
    else {
      // General distribution
      const mod = questionCount % 5;
      status = mod === 0 ? 'DRAFT' : mod === 1 ? 'SUBMITTED' : mod === 2 ? 'READY_FOR_REVIEW' : mod === 3 ? 'UNDER_REVIEW' : 'APPROVED';
    }

    const finalDiff = Math.min(100, Math.max(1, Math.round(q.difficulty * 100)));
    const finalTime = Math.round(q.difficulty * 120 + 60);

    const version = await prisma.questionVersion.create({
      data: {
        questionId: question.id,
        versionNo: 1,
        status: status as any,
        authorId,
        finalDifficulty: status === 'APPROVED' ? finalDiff : null,
        finalTimeSeconds: status === 'APPROVED' ? finalTime : null,
        encryptedContent: contentEnvelope.ciphertext,
        contentNonce: contentEnvelope.nonce,
        contentTag: contentEnvelope.tag,
        encryptedContentKey: contentEnvelope.wrappedKey,
        encryptedAnswer: answerEnvelope.ciphertext,
        answerNonce: answerEnvelope.nonce,
        answerTag: answerEnvelope.tag,
        encryptedAnswerKey: answerEnvelope.wrappedKey,
        contentCommitment: commitment.commitment,
        keyId,
        policyVersion: 1,
        retirementReason: status === 'RETIRED' ? 'SUPERSEDED' : null,
        supersededAt: status === 'RETIRED' ? new Date() : null,
      },
    });

    // ── Supporting workflow entities for the demo states ──
    if (status === 'DUPLICATE_FLAGGED') {
      const report = await prisma.originalityReport.create({
        data: {
          questionVersionId: version.id,
          riskLevel: 'HIGH',
          highestScore: 0.94,
          checkedAt: new Date(),
          serviceVersion: '1.0.0',
        },
      });
      await prisma.originalityMatch.create({
        data: {
          reportId: report.id,
          sourceType: 'PAST_PAPER',
          sourceReference: 'JEE-2022-P1-Q04 (JEE Advanced 2022 Paper 1)',
          overallScore: 0.94,
          minhashScore: 0.91,
          tfidfScore: 0.96,
          exactHashMatch: false,
          sourceTextSnippet: 'A body of mass 5 kg is moving with a velocity of 10 m/s...',
        },
      });
    } else if (status === 'READY_FOR_REVIEW') {
      await prisma.originalityReport.create({
        data: {
          questionVersionId: version.id,
          riskLevel: 'NONE',
          highestScore: 0.12,
          checkedAt: new Date(),
          serviceVersion: '1.0.0',
        },
      });
    } else if (status === 'UNDER_REVIEW') {
      const round = await prisma.reviewRound.create({
        data: {
          questionVersionId: version.id,
          roundNumber: 1,
          policyVersion: 1,
          status: 'ACTIVE',
        },
      });
      await prisma.reviewAssignment.create({
        data: {
          roundId: round.id,
          questionVersionId: version.id,
          reviewerId: reviewers[0].id,
          dueDate: new Date(Date.now() + 7 * 86400000),
          eligibleCount: 4,
          selectionSeed: crypto.randomBytes(16).toString('hex'),
          status: 'IN_PROGRESS',
        },
      });
      await prisma.reviewAssignment.create({
        data: {
          roundId: round.id,
          questionVersionId: version.id,
          reviewerId: reviewers[1].id,
          dueDate: new Date(Date.now() + 7 * 86400000),
          eligibleCount: 4,
          selectionSeed: crypto.randomBytes(16).toString('hex'),
          status: 'PENDING',
        },
      });
    } else if (status === 'MODERATION') {
      const round = await prisma.reviewRound.create({
        data: {
          questionVersionId: version.id,
          roundNumber: 1,
          policyVersion: 1,
          status: 'COMPLETED',
        },
      });
      // Review 1
      const a1 = await prisma.reviewAssignment.create({
        data: {
          roundId: round.id,
          questionVersionId: version.id,
          reviewerId: reviewers[0].id,
          dueDate: new Date(Date.now() + 7 * 86400000),
          eligibleCount: 4,
          selectionSeed: crypto.randomBytes(16).toString('hex'),
          status: 'COMPLETED',
        },
      });
      await prisma.review.create({
        data: {
          assignmentId: a1.id,
          questionVersionId: version.id,
          reviewerId: reviewers[0].id,
          phase: 'EVALUATE',
          contentCommitment: commitment.commitment,
          decision: 'APPROVE',
          difficultyRating: 0.35,
          blindAnswerMatchesKey: true,
          checklist: { accuracy: true, clarity: true, distractors: true, syllabus: true },
        },
      });
      // Review 2
      const a2 = await prisma.reviewAssignment.create({
        data: {
          roundId: round.id,
          questionVersionId: version.id,
          reviewerId: reviewers[1].id,
          dueDate: new Date(Date.now() + 7 * 86400000),
          eligibleCount: 4,
          selectionSeed: crypto.randomBytes(16).toString('hex'),
          status: 'COMPLETED',
        },
      });
      await prisma.review.create({
        data: {
          assignmentId: a2.id,
          questionVersionId: version.id,
          reviewerId: reviewers[1].id,
          phase: 'EVALUATE',
          contentCommitment: commitment.commitment,
          decision: 'APPROVE',
          difficultyRating: 0.40,
          blindAnswerMatchesKey: true,
          checklist: { accuracy: true, clarity: true, distractors: true, syllabus: true },
        },
      });
    } else if (status === 'APPROVED') {
      const round = await prisma.reviewRound.create({
        data: {
          questionVersionId: version.id,
          roundNumber: 1,
          policyVersion: 1,
          status: 'COMPLETED',
        },
      });
      // Approvals signed by Reviewer 1, Reviewer 2, and Moderator 1
      const rev1AppId = deterministicUuid(`app-rev1-${version.id}`);
      const rev1Sig = signApprovalPayload(
        rev1AppId,
        question.id,
        1,
        commitment.commitment,
        'APPROVE',
        'REVIEWER',
        reviewers[0].id,
        1,
        1,
        new Date(),
        reviewerPrivateKeys[reviewers[0].id],
      );
      await prisma.approval.create({
        data: {
          id: rev1AppId,
          questionId: question.id,
          versionNo: 1,
          contentCommitment: commitment.commitment,
          decision: 'APPROVE',
          role: 'REVIEWER',
          approverId: reviewers[0].id,
          reviewRound: 1,
          policyVersion: 1,
          signature: rev1Sig,
        },
      });

      const rev2AppId = deterministicUuid(`app-rev2-${version.id}`);
      const rev2Sig = signApprovalPayload(
        rev2AppId,
        question.id,
        1,
        commitment.commitment,
        'APPROVE',
        'REVIEWER',
        reviewers[1].id,
        1,
        1,
        new Date(),
        reviewerPrivateKeys[reviewers[1].id],
      );
      await prisma.approval.create({
        data: {
          id: rev2AppId,
          questionId: question.id,
          versionNo: 1,
          contentCommitment: commitment.commitment,
          decision: 'APPROVE',
          role: 'REVIEWER',
          approverId: reviewers[1].id,
          reviewRound: 1,
          policyVersion: 1,
          signature: rev2Sig,
        },
      });

      const modAppId = deterministicUuid(`app-mod-${version.id}`);
      const modSig = signApprovalPayload(
        modAppId,
        question.id,
        1,
        commitment.commitment,
        'APPROVE',
        'MODERATOR',
        moderator1.id,
        1,
        1,
        new Date(),
        mod1PrivateKey,
      );
      await prisma.approval.create({
        data: {
          id: modAppId,
          questionId: question.id,
          versionNo: 1,
          contentCommitment: commitment.commitment,
          decision: 'APPROVE',
          role: 'MODERATOR',
          approverId: moderator1.id,
          reviewRound: 1,
          policyVersion: 1,
          signature: modSig,
        },
      });
    }

    questionCount++;
    if (questionCount % 50 === 0) {
      console.log(`    ... ${questionCount} questions created`);
    }
  }

  // ── Step 4: Approved Blueprint for JEE Advanced 2025 ──
  const blueprintData = {
    examId: exam.id,
    name: 'JEE Advanced Standard Blueprint',
    durationSeconds: 10800,
    totalQuestions: 6,
    totalMarks: 24,
    sections: [
      {
        code: 'PHY',
        name: 'Physics',
        subjectId: phySubject.id,
        allowedQuestionTypes: ['MCQ_SINGLE'],
        count: 2,
        totalMarks: 8,
        negativeMarksAllowed: true,
        topicQuotas: [
          { topicId: phyTopicRecords['Mechanics'], min: 0, max: 2 },
        ],
        difficultyBins: {
          EASY: { min: 0, max: 2 },
          MEDIUM: { min: 0, max: 2 },
          HARD: { min: 0, max: 2 },
        },
        allowedMarksValues: [4],
      },
      {
        code: 'CHE',
        name: 'Chemistry',
        subjectId: cheSubject.id,
        allowedQuestionTypes: ['MCQ_SINGLE'],
        count: 2,
        totalMarks: 8,
        negativeMarksAllowed: true,
        topicQuotas: [
          { topicId: cheTopicRecords['Stoichiometry'], min: 0, max: 2 },
        ],
        difficultyBins: {
          EASY: { min: 0, max: 2 },
          MEDIUM: { min: 0, max: 2 },
          HARD: { min: 0, max: 2 },
        },
        allowedMarksValues: [4],
      },
      {
        code: 'MAT',
        name: 'Mathematics',
        subjectId: matSubject.id,
        allowedQuestionTypes: ['MCQ_SINGLE'],
        count: 2,
        totalMarks: 8,
        negativeMarksAllowed: true,
        topicQuotas: [
          { topicId: matTopicRecords['Differential Calculus'], min: 0, max: 2 },
        ],
        difficultyBins: {
          EASY: { min: 0, max: 2 },
          MEDIUM: { min: 0, max: 2 },
          HARD: { min: 0, max: 2 },
        },
        allowedMarksValues: [4],
      },
    ],
    difficulty: {
      targetMean: 50,
      meanTolerance: 25,
    },
    time: {
      minRatio: 0.05,
      maxRatio: 1.0,
    },
    exposure: {
      maxTotalUses: 5,
      cooldownPapers: 1,
      overlap: {
        recentPapersM: 3,
        maxSharedQuestionsPerPaper: 2,
      },
    },
    sets: {
      count: 2,
    },
    solver: {
      timeLimitSeconds: 30,
      requireOptimal: false,
      minPoolMultiplier: 1.5,
    },
    csv: {
      bom: true,
      formulaGuard: true,
      profileDefault: 'OFFLINE_QUESTION_PAPER',
    },
  };

  const canonicalBp = JSON.stringify(blueprintData);
  const bpVersionHash = crypto.createHash('sha256').update(canonicalBp).digest('hex');

  const seededBlueprint = await prisma.examBlueprint.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      examId: exam.id,
      name: 'JEE Advanced Standard Blueprint',
      description: 'Standard 6-question blueprint across Physics, Chemistry, and Mathematics',
      createdById: admin.id,
      versions: {
        create: {
          versionNo: 1,
          content: blueprintData as any,
          versionHash: bpVersionHash,
          isApproved: true,
          proposerId: admin.id,
          approverId: admin2.id,
          approvedAt: new Date(),
          approvalSignature: 'SIG_APPROVED_SEED_BLUEPRINT_V1',
        },
      },
    },
  });
  console.log(`  ✅ Exam Blueprint: ${seededBlueprint.name} (Approved Version 1)`);

  // Audit log for seed
  await auditLog({
    actorId: admin.id,
    action: 'USER_CREATE',
    targetType: 'user',
    targetId: admin.id,
    metadata: { role: 'ADMIN', email: admin.email, seeded: true, step2Seeded: true },
  });

  console.log(`  ✅ Created ${questionCount} questions (encrypted at rest)`);
  console.log('');
  console.log('🎉 Seed complete! All Step 2 roles, policies, and workflows populated.');
  console.log('');
  console.log('Credentials:');
  console.log(`  Admin 1 (Proposer):   ${adminEmail} / ${adminPassword}`);
  console.log(`  Admin 2 (Approver):   admin2@examvault.local / ${adminPassword}`);
  console.log(`  Admin 3 (Audit Admin): admin3@examvault.local / ${adminPassword}`);
  console.log(`  Examiner 1:           examiner1@examvault.local / Examiner@2024!pass`);
  console.log(`  Examiner 2:           examiner2@examvault.local / Examiner@2024!pass`);
  console.log(`  Examiner 3:           examiner3@examvault.local / Examiner@2024!pass`);
  console.log(`  Moderator 1 (Lead):   moderator1@examvault.local / Examiner@2024!pass`);
  console.log(`  Moderator 2:          moderator2@examvault.local / Examiner@2024!pass`);
  console.log(`  Reviewers 1-6:        reviewer1@examvault.local .. reviewer6@examvault.local / Examiner@2024!pass`);
  console.log(`  Custodians 1-7:       custodian1@examvault.local .. custodian7@examvault.local / Examiner@2024!pass`);
  console.log(`  Auditor:              auditor@examvault.local / Examiner@2024!pass`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
