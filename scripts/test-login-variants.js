const http = require('http');

async function testLogin(email, password) {
  const body = JSON.stringify({ email, password });
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', (err) => resolve({ status: 'ERR', error: err.message }));
    req.write(body);
    req.end();
  });
}

async function main() {
  const tests = [
    { email: 'admin@examvault.local', pass: 'Admin@ExamVault2024!' },
    { email: 'admin@examvault.local', pass: 'Admin123!@#$' },
    { email: 'examiner1@examvault.local', pass: 'Examiner@2024!pass' },
    { email: 'examiner1@examvault.local', pass: 'Examiner123!@#$' },
    { email: 'auditor@examvault.local', pass: 'Examiner@2024!pass' },
    { email: 'auditor@examvault.local', pass: 'Auditor123!@#$' },
  ];

  for (const t of tests) {
    const res = await testLogin(t.email, t.pass);
    console.log(`Login ${t.email} with '${t.pass}': Status ${res.status} ${res.status === 200 ? '✅ SUCCESS' : '❌ FAIL'}`);
  }
}

main();
