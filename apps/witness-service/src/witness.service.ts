import * as crypto from 'crypto';

export interface CheckpointSubmission {
  rootHash: string;
  rangeStart: number;
  rangeEnd: number;
  eventCount: number;
  treeSize: number;
  authorSignature: string;
  timestamp: string;
}

export interface WitnessReceipt {
  status: 'ACCEPTED';
  checkpointId: string;
  rootHash: string;
  rangeStart: number;
  rangeEnd: number;
  witnessTimestamp: string;
  witnessSignature: string;
  witnessPublicKey: string;
}

export interface WitnessAlert {
  alertId: string;
  timestamp: string;
  alertType: 'CONFLICTING_CHECKPOINT_DETECTED' | 'NON_MONOTONIC_TREE_SIZE';
  description: string;
  storedCheckpoint: any;
  conflictingSubmission: any;
}

export class WitnessService {
  private keyPair: { privateKey: crypto.KeyObject; publicKey: crypto.KeyObject };
  private checkpoints: Array<CheckpointSubmission & { witnessSignature: string; witnessTimestamp: string }> = [];
  private alerts: WitnessAlert[] = [];

  constructor() {
    // Generate or load isolated Ed25519 key pair for Auditor Witness
    this.keyPair = crypto.generateKeyPairSync('ed25519');
  }

  public getPublicKeyDer(): string {
    return this.keyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  }

  /**
   * Evaluates an incoming signed checkpoint, detects forks/rewrites, and countersigns
   */
  public receiveCheckpoint(submission: CheckpointSubmission): WitnessReceipt {
    if (!/^[0-9a-f]{64}$/i.test(submission.rootHash)) {
      throw new Error('rootHash must be a valid 64-character lowercase hex string');
    }

    if (submission.treeSize < 0 || submission.rangeEnd < submission.rangeStart) {
      throw new Error('Invalid range or tree size in checkpoint submission');
    }

    // Check for conflicting checkpoint over the same range (Fork / Rewrite Attack Detection)
    const existing = this.checkpoints.find(
      (c) => c.rangeStart === submission.rangeStart && c.rangeEnd === submission.rangeEnd,
    );

    if (existing) {
      if (existing.rootHash.toLowerCase() === submission.rootHash.toLowerCase()) {
        // Idempotent retry: return existing witness receipt
        return {
          status: 'ACCEPTED',
          checkpointId: `chk-${existing.rangeStart}-${existing.rangeEnd}`,
          rootHash: existing.rootHash,
          rangeStart: existing.rangeStart,
          rangeEnd: existing.rangeEnd,
          witnessTimestamp: existing.witnessTimestamp,
          witnessSignature: existing.witnessSignature,
          witnessPublicKey: this.getPublicKeyDer(),
        };
      }

      // Conflict Detected! Someone modified past history and re-signed with legitimate key!
      const alert: WitnessAlert = {
        alertId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        alertType: 'CONFLICTING_CHECKPOINT_DETECTED',
        description: `CRITICAL INTEGRITY ALERT: Fork or history rewrite detected for range ${submission.rangeStart}..${submission.rangeEnd}. Stored root: ${existing.rootHash}, submitted root: ${submission.rootHash}`,
        storedCheckpoint: existing,
        conflictingSubmission: submission,
      };
      this.alerts.push(alert);
      throw new Error(alert.description);
    }

    // Monotonicity verification
    if (this.checkpoints.length > 0) {
      const last = this.checkpoints[this.checkpoints.length - 1];
      if (submission.treeSize < last.treeSize || submission.rangeStart < last.rangeEnd) {
        const alert: WitnessAlert = {
          alertId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          alertType: 'NON_MONOTONIC_TREE_SIZE',
          description: `ALERT: Submitted checkpoint tree size (${submission.treeSize}) decreased relative to last witness checkpoint (${last.treeSize})`,
          storedCheckpoint: last,
          conflictingSubmission: submission,
        };
        this.alerts.push(alert);
        throw new Error(alert.description);
      }
    }

    // Countersign checkpoint: rootHash | treeSize | witnessTimestamp
    const witnessTimestamp = new Date().toISOString();
    const payloadToSign = Buffer.from(
      `${submission.rootHash.toLowerCase()}|${submission.treeSize}|${witnessTimestamp}`,
      'utf-8',
    );
    const signature = crypto.sign(null, payloadToSign, this.keyPair.privateKey).toString('base64');

    const record = {
      ...submission,
      witnessSignature: signature,
      witnessTimestamp,
    };
    this.checkpoints.push(record);

    return {
      status: 'ACCEPTED',
      checkpointId: `chk-${submission.rangeStart}-${submission.rangeEnd}`,
      rootHash: submission.rootHash,
      rangeStart: submission.rangeStart,
      rangeEnd: submission.rangeEnd,
      witnessTimestamp,
      witnessSignature: signature,
      witnessPublicKey: this.getPublicKeyDer(),
    };
  }

  public getCheckpoints() {
    return this.checkpoints;
  }

  public getLatestCheckpoint() {
    return this.checkpoints.length > 0 ? this.checkpoints[this.checkpoints.length - 1] : null;
  }

  public getAlerts() {
    return this.alerts;
  }

  public clear(): void {
    this.checkpoints = [];
    this.alerts = [];
  }
}
