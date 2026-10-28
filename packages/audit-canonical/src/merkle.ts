import * as crypto from 'crypto';

/**
 * RFC 6962: Merkle Tree Hash implementation
 * Leaf hash prefix: 0x00
 * Internal node hash prefix: 0x01
 */

const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);

export interface MerkleInclusionProof {
  leafIndex: number;
  treeSize: number;
  leafHash: string;
  auditPath: Array<{
    direction: 'left' | 'right';
    hash: string;
  }>;
}

export function hashLeaf(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return crypto.createHash('sha256').update(LEAF_PREFIX).update(buf).digest('hex');
}

export function hashInternalNode(leftHex: string, rightHex: string): string {
  const leftBuf = Buffer.from(leftHex, 'hex');
  const rightBuf = Buffer.from(rightHex, 'hex');
  return crypto.createHash('sha256').update(NODE_PREFIX).update(leftBuf).update(rightBuf).digest('hex');
}

export class MerkleTree {
  private leaves: string[] = [];
  private layers: string[][] = [];

  constructor(leafData: Array<string | Buffer>) {
    this.leaves = leafData.map((d) => hashLeaf(d));
    this.buildTree();
  }

  private buildTree(): void {
    if (this.leaves.length === 0) {
      this.layers = [['0'.repeat(64)]];
      return;
    }

    this.layers = [this.leaves];
    let currentLayer = this.leaves;

    while (currentLayer.length > 1) {
      const nextLayer: string[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        if (i + 1 < currentLayer.length) {
          nextLayer.push(hashInternalNode(currentLayer[i], currentLayer[i + 1]));
        } else {
          // Odd element promoted to next layer
          nextLayer.push(currentLayer[i]);
        }
      }
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  public getRoot(): string {
    if (this.layers.length === 0 || this.layers[this.layers.length - 1].length === 0) {
      return '0'.repeat(64);
    }
    return this.layers[this.layers.length - 1][0];
  }

  public getTreeSize(): number {
    return this.leaves.length;
  }

  public getProof(leafIndex: number): MerkleInclusionProof {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(`Leaf index ${leafIndex} out of bounds for tree size ${this.leaves.length}`);
    }

    const auditPath: Array<{ direction: 'left' | 'right'; hash: string }> = [];
    let idx = leafIndex;

    for (let layerIdx = 0; layerIdx < this.layers.length - 1; layerIdx++) {
      const layer = this.layers[layerIdx];
      const isRightChild = idx % 2 === 1;
      const siblingIdx = isRightChild ? idx - 1 : idx + 1;

      if (siblingIdx < layer.length) {
        auditPath.push({
          direction: isRightChild ? 'left' : 'right',
          hash: layer[siblingIdx],
        });
      }

      idx = Math.floor(idx / 2);
    }

    return {
      leafIndex,
      treeSize: this.leaves.length,
      leafHash: this.leaves[leafIndex],
      auditPath,
    };
  }

  public static verifyInclusionProof(proof: MerkleInclusionProof, expectedRoot: string): boolean {
    let currentHash = proof.leafHash;

    for (const step of proof.auditPath) {
      if (step.direction === 'left') {
        currentHash = hashInternalNode(step.hash, currentHash);
      } else {
        currentHash = hashInternalNode(currentHash, step.hash);
      }
    }

    return currentHash.toLowerCase() === expectedRoot.toLowerCase();
  }
}
