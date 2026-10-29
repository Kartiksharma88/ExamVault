"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerkleTree = void 0;
exports.hashLeaf = hashLeaf;
exports.hashInternalNode = hashInternalNode;
const crypto = __importStar(require("crypto"));
/**
 * RFC 6962: Merkle Tree Hash implementation
 * Leaf hash prefix: 0x00
 * Internal node hash prefix: 0x01
 */
const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);
function hashLeaf(data) {
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    return crypto.createHash('sha256').update(LEAF_PREFIX).update(buf).digest('hex');
}
function hashInternalNode(leftHex, rightHex) {
    const leftBuf = Buffer.from(leftHex, 'hex');
    const rightBuf = Buffer.from(rightHex, 'hex');
    return crypto.createHash('sha256').update(NODE_PREFIX).update(leftBuf).update(rightBuf).digest('hex');
}
class MerkleTree {
    leaves = [];
    layers = [];
    constructor(leafData) {
        this.leaves = leafData.map((d) => hashLeaf(d));
        this.buildTree();
    }
    buildTree() {
        if (this.leaves.length === 0) {
            this.layers = [['0'.repeat(64)]];
            return;
        }
        this.layers = [this.leaves];
        let currentLayer = this.leaves;
        while (currentLayer.length > 1) {
            const nextLayer = [];
            for (let i = 0; i < currentLayer.length; i += 2) {
                if (i + 1 < currentLayer.length) {
                    nextLayer.push(hashInternalNode(currentLayer[i], currentLayer[i + 1]));
                }
                else {
                    // Odd element promoted to next layer
                    nextLayer.push(currentLayer[i]);
                }
            }
            this.layers.push(nextLayer);
            currentLayer = nextLayer;
        }
    }
    getRoot() {
        if (this.layers.length === 0 || this.layers[this.layers.length - 1].length === 0) {
            return '0'.repeat(64);
        }
        return this.layers[this.layers.length - 1][0];
    }
    getTreeSize() {
        return this.leaves.length;
    }
    getProof(leafIndex) {
        if (leafIndex < 0 || leafIndex >= this.leaves.length) {
            throw new Error(`Leaf index ${leafIndex} out of bounds for tree size ${this.leaves.length}`);
        }
        const auditPath = [];
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
    static verifyInclusionProof(proof, expectedRoot) {
        let currentHash = proof.leafHash;
        for (const step of proof.auditPath) {
            if (step.direction === 'left') {
                currentHash = hashInternalNode(step.hash, currentHash);
            }
            else {
                currentHash = hashInternalNode(currentHash, step.hash);
            }
        }
        return currentHash.toLowerCase() === expectedRoot.toLowerCase();
    }
}
exports.MerkleTree = MerkleTree;
//# sourceMappingURL=merkle.js.map