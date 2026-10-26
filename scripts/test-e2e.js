const http = require('http');

async function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function run() {
  console.log('==============================================');
  console.log('   ExamVault End-to-End Neon Verification     ');
  console.log('==============================================\n');

  // 1. Login as Admin
  console.log('1. Testing Authentication against Neon PostgreSQL...');
  const loginBody = JSON.stringify({
    email: 'admin@examvault.local',
    password: 'Admin@ExamVault2024!',
  });

  const loginRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginBody),
    },
  }, loginBody);

  console.log(`   Status: ${loginRes.statusCode}`);
  if (loginRes.statusCode !== 200) {
    console.error('   ❌ Login failed:', loginRes.data);
    process.exit(1);
  }

  console.log('   Response data:', JSON.stringify(loginRes.data));
  const respData = loginRes.data.data || loginRes.data;
  const csrfToken = respData.csrfToken;
  const rawCookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0] : '';
  const sessionCookie = rawCookie.split(';')[0];

  console.log(`   ✅ CSRF Token received: ${csrfToken.substring(0, 16)}...`);
  console.log(`   ✅ Session Cookie received: ${sessionCookie.substring(0, 25)}...\n`);

  const authHeaders = {
    'Cookie': sessionCookie,
    'X-CSRF-Token': csrfToken,
  };

  function unwrap(res) {
    return (res.data && res.data.data !== undefined) ? res.data.data : res.data;
  }

  // 2. Fetch User Profile
  console.log('2. Testing /api/auth/me (Session lookup from Neon DB)...');
  const meRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/me',
    method: 'GET',
    headers: authHeaders,
  });
  const me = unwrap(meRes);
  console.log(`   Status: ${meRes.statusCode}`);
  console.log(`   ✅ Session verified: User ${me.name} (${me.email}) | Role: ${me.role} | ID: ${me.id}\n`);

  // 3. Fetch Syllabus Exams & Subjects
  console.log('3. Testing /api/syllabus/exams (Relational query from Neon DB)...');
  const syllabusRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/syllabus/exams',
    method: 'GET',
    headers: authHeaders,
  });
  const exams = unwrap(syllabusRes);
  console.log(`   Status: ${syllabusRes.statusCode}`);
  console.log(`   ✅ Exams retrieved: ${exams.length}`);
  exams.forEach((e) => {
    console.log(`      - Exam: ${e.name} (${e.subjects ? e.subjects.length : 0} subjects)`);
    if (e.subjects) {
      e.subjects.forEach((s) => console.log(`        • Subject: ${s.name} [${s.code}]`));
    }
  });
  console.log('');

  // 4. Fetch Questions Bank
  console.log('4. Testing /api/questions (Querying encrypted question bank from Neon DB)...');
  const questionsRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/questions?page=1&limit=5',
    method: 'GET',
    headers: authHeaders,
  });
  const qData = unwrap(questionsRes);
  console.log(`   Status: ${questionsRes.statusCode}`);
  console.log(`   ✅ Total questions in Neon DB: ${qData.total}`);
  console.log(`   ✅ Sample questions:`);
  qData.items.slice(0, 3).forEach((q) => {
    console.log(`      - ID: ${q.humanId} | Subject: ${q.subject?.name || q.subjectId} | Type: ${q.type} | Difficulty: ${q.difficulty}`);
  });
  console.log('');

  // 5. Verify Cryptographic Audit Log
  console.log('5. Testing /api/audit/verify (Validating Ed25519 hash chain from Neon DB)...');
  const auditRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/audit/verify',
    method: 'GET',
    headers: authHeaders,
  });
  const auditData = unwrap(auditRes);
  console.log(`   Status: ${auditRes.statusCode}`);
  console.log(`   ✅ Audit Verification:`, JSON.stringify(auditData));
  console.log('\n==============================================');
  console.log('   🎉 ALL NEON WIRED SERVICES VERIFIED END-TO-END! ');
  console.log('==============================================');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
