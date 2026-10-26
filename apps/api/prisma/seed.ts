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

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

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
  console.log(`  ✅ Admin: ${admin.email}`);

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

  const reviewer = await prisma.user.upsert({
    where: { email: 'reviewer@examvault.local' },
    update: {},
    create: {
      email: 'reviewer@examvault.local',
      name: 'Dr. Ananya Patel',
      passwordHash: examinerHash,
      role: 'REVIEWER',
      mustSetupMfa: true,
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

  console.log(`  ✅ Users: ${examiner1.name}, ${examiner2.name}, ${reviewer.name}, ${auditor.name}`);

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

  // Physics topics
  const phyTopics = ['Mechanics', 'Electrostatics', 'Optics', 'Waves', 'Thermodynamics', 'Gravitation', 'Electromagnetic Induction', 'Modern Physics'];
  const phyTopicRecords: Record<string, string> = {};
  for (const t of phyTopics) {
    const topic = await prisma.topic.upsert({
      where: { id: crypto.createHash('md5').update(`PHY-${t}`).digest('hex').slice(0, 8).padEnd(36, '0').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5') },
      update: {},
      create: {
        id: crypto.createHash('md5').update(`PHY-${t}`).digest('hex').slice(0, 8).padEnd(36, '0').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5'),
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
    const topic = await prisma.topic.upsert({
      where: { id: crypto.createHash('md5').update(`CHE-${t}`).digest('hex').slice(0, 8).padEnd(36, '0').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5') },
      update: {},
      create: {
        id: crypto.createHash('md5').update(`CHE-${t}`).digest('hex').slice(0, 8).padEnd(36, '0').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5'),
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
    const topic = await prisma.topic.upsert({
      where: { id: crypto.createHash('md5').update(`MAT-${t}`).digest('hex').slice(0, 8).padEnd(36, '0').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5') },
      update: {},
      create: {
        id: crypto.createHash('md5').update(`MAT-${t}`).digest('hex').slice(0, 8).padEnd(36, '0').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5'),
        subjectId: matSubject.id,
        name: t,
      },
    });
    matTopicRecords[t] = topic.id;
  }

  console.log(`  ✅ Syllabus: ${phyTopics.length + cheTopics.length + matTopics.length} topics`);

  // ── 4. Create 200+ synthetic questions ──
  const allPhyQuestions = [...physicsQuestions, ...generateMore(physicsQuestions, phyTopics, 55)];
  const allCheQuestions = [...chemistryQuestions, ...generateMore(chemistryQuestions, cheTopics, 55)];
  const allMatQuestions = [...mathQuestions, ...generateMore(mathQuestions, matTopics, 55)];

  const allQuestions = [
    ...allPhyQuestions.map(q => ({ ...q, subject: phySubject, topicRecords: phyTopicRecords })),
    ...allCheQuestions.map(q => ({ ...q, subject: cheSubject, topicRecords: cheTopicRecords })),
    ...allMatQuestions.map(q => ({ ...q, subject: matSubject, topicRecords: matTopicRecords })),
  ];

  console.log(`  📝 Creating ${allQuestions.length} questions...`);

  let questionCount = 0;
  for (const q of allQuestions) {
    const authorId = questionCount % 2 === 0 ? examiner1.id : examiner2.id;
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
      language: (q as any).language || 'EN',
    };

    const answerKey = { type: 'MCQ_SINGLE', correct: q.correct };

    const canonicalContent = JSON.stringify(content);
    const commitment = computeCommitment(canonicalContent);
    const contentWithSalt = { ...content, _commitmentSalt: commitment.salt };

    const associatedData = `${question.id}:1`;
    const contentEnvelope = encrypt(JSON.stringify(contentWithSalt), associatedData, masterKey);
    const answerEnvelope = encrypt(JSON.stringify(answerKey), associatedData, masterKey);

    // Determine status (mix of DRAFT and SUBMITTED)
    const status = questionCount % 3 === 0 ? 'SUBMITTED' : 'DRAFT';

    await prisma.questionVersion.create({
      data: {
        questionId: question.id,
        versionNo: 1,
        status: status as any,
        authorId,
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
      },
    });

    questionCount++;
    if (questionCount % 50 === 0) {
      console.log(`    ... ${questionCount} questions created`);
    }
  }

  // Audit log for seed
  await auditLog({
    actorId: admin.id,
    action: 'USER_CREATE',
    targetType: 'user',
    targetId: admin.id,
    metadata: { role: 'ADMIN', email: admin.email, seeded: true },
  });

  console.log(`  ✅ Created ${questionCount} questions (encrypted at rest)`);
  console.log('');
  console.log('🎉 Seed complete!');
  console.log('');
  console.log('Credentials:');
  console.log(`  Admin:     ${adminEmail} / ${adminPassword}`);
  console.log(`  Examiner1: examiner1@examvault.local / Examiner@2024!pass`);
  console.log(`  Examiner2: examiner2@examvault.local / Examiner@2024!pass`);
  console.log(`  Reviewer:  reviewer@examvault.local / Examiner@2024!pass`);
  console.log(`  Auditor:   auditor@examvault.local / Examiner@2024!pass`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
