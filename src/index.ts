import { groth16 ,zKey} from 'snarkjs';
import path from 'path';
import fs from 'fs';
const { buildMimcSponge } = require('circomlibjs');

interface ProofOutput {
  proof: any;
  publicSignals: string[];
  root: string;
}

export class MerkleProver {
  private mimcSponge: any;
  private MAX_SUPPORTED_DEPTH = 15;
  private wasmDir = path.join(__dirname, 'merkleTreeProof');

  constructor() {
    this.initMimc();
  }

  private async initMimc() {
    if (!this.mimcSponge) {
      this.mimcSponge = await buildMimcSponge();
    }
  }

  private toField(input: string | number | bigint): bigint {
    const FIELD_SIZE = BigInt(
      '21888242871839275222246405745257275088548364400416034343698204186575808495617'
    );

    if (typeof input === 'string' && input.length === 1) {
      return BigInt(input.charCodeAt(0)) % FIELD_SIZE;
    }

    if (typeof input === 'string' && !/^\d+$/.test(input)) {
      return BigInt(input.split('').map((c) => c.charCodeAt(0)).join('')) % FIELD_SIZE;
    }

    return BigInt(input) % FIELD_SIZE;
  }

  private hashLeaf(leaf: string): string {
    if (!this.mimcSponge) throw new Error('MiMC not initialized');
    const input = this.toField(leaf);
    const hash = this.mimcSponge.multiHash([input], 0);
    return this.mimcSponge.F.toString(hash);
  }

  private hashPair(left: string, right: string): string {
    if (!this.mimcSponge) throw new Error('MiMC not initialized');
    const leftInput = this.toField(left);
    const rightInput = this.toField(right);
    const hash = this.mimcSponge.multiHash([leftInput, rightInput], 0);
    return this.mimcSponge.F.toString(hash);
  }

  public async generateMerkleProof(leaf: string, allLeaves: string[]): Promise<ProofOutput> {
    await this.initMimc();

    // Calculate depth
    const treeSize = allLeaves.length;
    const depth = Math.ceil(Math.log2(treeSize));

    // Pad leaves
    const paddedSize = 2 ** depth;
    const paddedLeaves = allLeaves.slice();
    while (paddedLeaves.length < paddedSize) {
      paddedLeaves.push('0'); // Adjust padding as needed
    }

    const hashedLeaf = this.hashLeaf(leaf);
    let currentLevel = paddedLeaves.map((l) => this.hashLeaf(l));

    let currentIndex = currentLevel.findIndex((l) => l === hashedLeaf);
    if (currentIndex === -1) throw new Error('Leaf not found in tree');

    const pathElements: string[] = [];
    const pathIndices: number[] = [];

    // Generate Merkle path
    for (let level = 0; level < depth; level++) {
      const isLeftNode = currentIndex % 2 === 0;
      const siblingIndex = isLeftNode ? currentIndex + 1 : currentIndex - 1;

      const sibling = currentLevel[siblingIndex];
      pathElements.push(sibling);
      pathIndices.push(isLeftNode ? 0 : 1);

      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1];
        nextLevel.push(this.hashPair(left, right));
      }

      currentLevel = nextLevel;
      currentIndex = Math.floor(currentIndex / 2);
    }

    const root = currentLevel[0];

    const input = {
      leaf: hashedLeaf,
      pathElements,
      pathIndices,
      root,
    };

    // Select circuit files
    const circuitName = `MerkleTreeProof_${depth}`;
    const wasmPath = path.join(
      __dirname,
      'merkleTreeProof',
      `${circuitName}_js`,
      `${circuitName}.wasm`
    );
    const zkeyPath = path.join(__dirname, 'merkleTreeProof', `${circuitName}_final.zkey`);

    // Check if files exist
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`WASM file for depth ${depth} not found at ${wasmPath}`);
    }
    if (!fs.existsSync(zkeyPath)) {
      throw new Error(`ZKey file for depth ${depth} not found at ${zkeyPath}`);
    }

    const { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zkeyPath);

    return { proof, publicSignals, root };
  }

  

  public async verifyProof(proof: any, publicSignals: string[], depth: number): Promise<boolean> {
    const vKeyPath = path.join(
      __dirname,
      'merkleTreeProof',
      `MerkleTreeProof_${depth}_verification_key.json`
    );
    if (!fs.existsSync(vKeyPath)) {
      throw new Error(`Verification key for depth ${depth} not found at ${vKeyPath}`);
    }
    const vKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf-8'));
    return await groth16.verify(vKey, publicSignals, proof);
  }

  public async exportVerifierContract(depth: number): Promise<string> {
    if (depth > this.MAX_SUPPORTED_DEPTH) {
      throw new Error(`Depth ${depth} exceeds maximum supported depth of ${this.MAX_SUPPORTED_DEPTH}`);
    }
  
    const circuitName = `MerkleTreeProof_${depth}`;
    const zkeyPath = path.join(__dirname, 'merkleTreeProof', `${circuitName}_final.zkey`);
  
    if (!fs.existsSync(zkeyPath)) {
      throw new Error(`ZKey file for depth ${depth} not found at ${zkeyPath}`);
    }
  
    const templates = {
      groth16: fs.readFileSync(
        path.join(__dirname, '..', 'templates', 'verifier_groth16.sol.ejs'),
        'utf8'
      )
    };
  
    const solidityVerifier = await zKey.exportSolidityVerifier(zkeyPath, templates);
    return solidityVerifier;
  }
}
