#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { ExamVaultVerifier, AuditDataset } from './verifier';

function parseArgs(args: string[]): {
  exportPath?: string;
  isJson: boolean;
  help: boolean;
} {
  let exportPath: string | undefined;
  let isJson = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--export' || arg === '-e') {
      exportPath = args[++i];
    } else if (arg === '--json' || arg === '-j') {
      isJson = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    }
  }

  return { exportPath, isJson, help };
}

function printUsage(): void {
  console.log(`
ExamVault Independent Verifier CLI (examvault-verify)
======================================================
Usage:
  examvault-verify --export <path-to-json-export> [options]

Options:
  -e, --export <path>   Path to exported JSON audit dataset (offline mode)
  -j, --json            Output machine-readable JSON report
  -h, --help            Show this help message

Exit Codes:
  0 - All cryptographic and consensus checks PASSED (Clean)
  1 - Integrity violation or tampering detected (Failed)
`);
}

async function main(): Promise<void> {
  const { exportPath, isJson, help } = parseArgs(process.argv.slice(2));

  if (help) {
    printUsage();
    process.exit(0);
  }

  if (!exportPath) {
    console.error('Error: Missing required option --export <path>');
    printUsage();
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), exportPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${resolvedPath}`);
    process.exit(1);
  }

  let dataset: AuditDataset;
  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    dataset = JSON.parse(content);
  } catch (err: any) {
    console.error(`Error reading dataset: ${err.message}`);
    process.exit(1);
  }

  const verifier = new ExamVaultVerifier();
  const report = verifier.verify(dataset);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n======================================================');
    console.log('       ExamVault Independent Audit Verification Report');
    console.log('======================================================');
    console.log(`Checked At : ${report.checkedAt}`);
    console.log(`Status     : ${report.overallValid ? '✅ VERIFIED CLEAN' : '❌ TAMPERING DETECTED'}\n`);

    console.log('Cryptographic & Consensus Integrity Checks:');
    console.log('------------------------------------------------------');
    for (const check of report.checks) {
      const badge = check.passed ? '[PASS]' : '[FAIL]';
      console.log(`${badge} ${check.checkName.padEnd(30)} [${check.design}]`);
      console.log(`       ${check.message}`);
    }

    if (!report.overallValid && report.firstInconsistency) {
      console.log('\n======================================================');
      console.log('⚠️  FIRST DETECTED INCONSISTENCY:');
      console.log(`- Check Name : ${report.firstInconsistency.checkName}`);
      console.log(`- Detected By: ${report.firstInconsistency.design}`);
      console.log(`- Target ID  : ${report.firstInconsistency.entityId}`);
      console.log(`- Reason     : ${report.firstInconsistency.reason}`);
      console.log(`- Expected   : ${report.firstInconsistency.expected}`);
      console.log(`- Actual     : ${report.firstInconsistency.actual}`);
      console.log('======================================================\n');
    } else {
      console.log('\n🎉 No discrepancies found. Both Design A and Design B logs are intact.\n');
    }
  }

  process.exit(report.overallValid ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal verifier error:', err);
  process.exit(1);
});
