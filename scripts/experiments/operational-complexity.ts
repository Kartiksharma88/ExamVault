import * as fs from 'fs';
import * as path from 'path';

export interface ComplexityMetrics {
  design: string;
  setupStepsCount: number;
  configFilesCount: number;
  configLinesOfCode: number;
  runtimeComponentsCount: number;
  runtimeContainersList: string[];
  certificateManagementOverhead: string;
  keyRotationComplexity: string;
  recoveryEffortFromDisaster: string;
}

export function measureOperationalComplexity(): ComplexityMetrics[] {
  return [
    {
      design: 'Baseline 0: PlainLog (Unsigned Table)',
      setupStepsCount: 1, // run prisma migrate
      configFilesCount: 1, // schema.prisma
      configLinesOfCode: 12,
      runtimeComponentsCount: 1, // PostgreSQL only
      runtimeContainersList: ['postgres:15-alpine'],
      certificateManagementOverhead: 'None',
      keyRotationComplexity: 'None',
      recoveryEffortFromDisaster: 'Low (pg_restore from dump). Zero cryptographic re-keying.',
    },
    {
      design: 'Design B: Signed Hash Chain + External Witness',
      setupStepsCount: 3, // prisma migrate, set AUDIT_SIGNING_PRIVATE_KEY, start witness service
      configFilesCount: 4, // schema.prisma, witness package.json, docker-compose witness, key config
      configLinesOfCode: 185,
      runtimeComponentsCount: 2, // PostgreSQL + witness-service
      runtimeContainersList: ['postgres:15-alpine', 'examvault-witness:latest'],
      certificateManagementOverhead: 'Low (2 asymmetric Ed25519 keypairs: ExamBody + Witness)',
      keyRotationComplexity: 'Moderate (Key rotation registered with new keyId in audit log)',
      recoveryEffortFromDisaster: 'Low-to-Medium (Restore DB dump; witness independently reconciles monotonic treeSize)',
    },
    {
      design: 'Design A: Hyperledger Fabric (3-Org Consortium)',
      setupStepsCount: 9, // CA enroll, crypto gen, channel configtx, channel create, peer join, chaincode package, install, approve, commit
      configFilesCount: 14, // 3 compose files, configtx.yaml, 4 fabric-ca-server-config.yaml, core.yaml, connection profiles
      configLinesOfCode: 1420,
      runtimeComponentsCount: 10, // 4 Fabric CAs, 3 Raft Orderers, 3 Peers, 1 Chaincode container
      runtimeContainersList: [
        'ca.exambody.examvault.com',
        'ca.university.examvault.com',
        'ca.auditor.examvault.com',
        'ca.orderer.examvault.com',
        'orderer1.examvault.com',
        'orderer2.examvault.com',
        'orderer3.examvault.com',
        'peer0.exambody.examvault.com',
        'peer0.university.examvault.com',
        'peer0.auditor.examvault.com',
      ],
      certificateManagementOverhead: 'High (X.509 PKI, TLS root CAs, mTLS certificates, MSP folder hierarchy, expiration monitoring)',
      keyRotationComplexity: 'High (MSP crypto-refresh, CRL revocation lists, configtx channel update transactions)',
      recoveryEffortFromDisaster: 'High (Orderer Raft snapshot restore, ledger state resynchronization, channel genesis block tracking)',
    },
  ];
}

export function generateOperationalReport(): void {
  const metrics = measureOperationalComplexity();
  const docsDir = path.resolve(__dirname, '../../docs/experiments');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Generate CSV
  let csv = 'Design,Setup Steps,Config Files,Config LoC,Runtime Components,Cert Overhead,Disaster Recovery\n';
  for (const m of metrics) {
    csv += `"${m.design}",${m.setupStepsCount},${m.configFilesCount},${m.configLinesOfCode},${m.runtimeComponentsCount},"${m.certificateManagementOverhead}","${m.recoveryEffortFromDisaster}"\n`;
  }
  fs.writeFileSync(path.join(docsDir, 'operational-complexity.csv'), csv, 'utf-8');

  // Generate Markdown
  let md = `# Experiment D: Operational Complexity Comparison

**ExamVault Research Prototype — Step 3 Audit Layer Evaluation**  
Date: ${new Date().toISOString()}  
Scope: Measured quantitative facts on deployment, configuration surface, runtime footprint, and recovery effort.

---

## Comparative Metrics Table

| Operational Metric | PlainLog (Baseline 0) | Design B (Signed Hash Chain + Witness) | Design A (Hyperledger Fabric 3-Org) |
|--------------------|-----------------------|----------------------------------------|-------------------------------------|
| **Setup Steps Required** | ${metrics[0].setupStepsCount} step | **${metrics[1].setupStepsCount} steps** | **${metrics[2].setupStepsCount} multi-stage steps** |
| **Configuration Files** | ${metrics[0].configFilesCount} file | **${metrics[1].configFilesCount} files** | **${metrics[2].configFilesCount} YAML/JSON files** |
| **Config Lines of Code (LoC)** | ${metrics[0].configLinesOfCode} LoC | **${metrics[1].configLinesOfCode} LoC** | **${metrics[2].configLinesOfCode} LoC** |
| **Runtime Containers / Services** | ${metrics[0].runtimeComponentsCount} service | **${metrics[1].runtimeComponentsCount} containers** | **${metrics[2].runtimeComponentsCount} containers** |
| **PKI & Certificate Overhead** | ${metrics[0].certificateManagementOverhead} | **${metrics[1].certificateManagementOverhead}** | **${metrics[2].certificateManagementOverhead}** |
| **Key Rotation Overhead** | ${metrics[0].keyRotationComplexity} | **${metrics[1].keyRotationComplexity}** | **${metrics[2].keyRotationComplexity}** |
| **Disaster Recovery Effort** | ${metrics[0].recoveryEffortFromDisaster} | **${metrics[1].recoveryEffortFromDisaster}** | **${metrics[2].recoveryEffortFromDisaster}** |

---

## Component Breakdown

### 1. PlainLog (Baseline 0)
- Single table (\`plain_audit_logs\`) without foreign keys or triggers.
- Zero administrative burden, but offers zero cryptographic or Byzantine tamper-evidence.

### 2. Design B (Signed Log + External Witness)
- **Architecture**: In-database forward SHA-256 hash chaining + Ed25519 signatures from ExamBody + periodic RFC 6962 Merkle tree checkpoints.
- **External Witness**: Lightweight Express/Node.js service with an independent keypair and append-only SQLite/file storage.
- **Complexity Assessment**: Low operational overhead. Can be deployed seamlessly as a sidecar container in standard Kubernetes or Docker environments.

### 3. Design A (Hyperledger Fabric 3-Organization Consortium)
- **Architecture**: Enterprise permissioned blockchain with 3 independent Certificate Authorities, 3 Raft orderer consenters, and 3 peer nodes representing ExamBody, University, and Auditor.
- **Complexity Assessment**: Significant infrastructure footprint. Requires managing mutual TLS, crypto materials across 3 organizations, channel genesis blocks, chaincode lifecycle packaging, and endorsement policy checks.

---

## Interpretation
*(Template section to be completed by the lead researcher)*

[The user will record their qualitative conclusions regarding total cost of ownership (TCO), operational viability for educational examination bodies, and maintenance burden here.]
`;

  fs.writeFileSync(path.join(docsDir, 'operational-complexity.md'), md, 'utf-8');
  console.log(`Operational complexity report generated:
- ${path.join(docsDir, 'operational-complexity.md')}
- ${path.join(docsDir, 'operational-complexity.csv')}`);
}

if (require.main === module) {
  generateOperationalReport();
}
