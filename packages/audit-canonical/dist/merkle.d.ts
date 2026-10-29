export interface MerkleInclusionProof {
    leafIndex: number;
    treeSize: number;
    leafHash: string;
    auditPath: Array<{
        direction: 'left' | 'right';
        hash: string;
    }>;
}
export declare function hashLeaf(data: Buffer | string): string;
export declare function hashInternalNode(leftHex: string, rightHex: string): string;
export declare class MerkleTree {
    private leaves;
    private layers;
    constructor(leafData: Array<string | Buffer>);
    private buildTree;
    getRoot(): string;
    getTreeSize(): number;
    getProof(leafIndex: number): MerkleInclusionProof;
    static verifyInclusionProof(proof: MerkleInclusionProof, expectedRoot: string): boolean;
}
//# sourceMappingURL=merkle.d.ts.map