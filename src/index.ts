import { groth16 } from "snarkjs";
import path from "path";
import fs from "fs";
const { buildMimcSponge } = require("circomlibjs");

interface ProofOutput {
  proof: any;
  publicSignals: string[];
  root: string;
}

export class MerkleProver {
  private mimcSponge: any;

  constructor() {
    this.initMimc();
  }

  private async initMimc() {
    if (!this.mimcSponge) {
      this.mimcSponge = await buildMimcSponge();
    }
  }

  private toField(input: string | number | bigint): bigint {
    const FIELD_SIZE = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    
    if (typeof input === 'string' && input.length === 1) {
      // Convert single character to its ASCII code
      return BigInt(input.charCodeAt(0)) % FIELD_SIZE;
    }
    
    if (typeof input === 'string' && !/^\d+$/.test(input)) {
      // For non-numeric strings, convert to ASCII codes and combine
      return BigInt(input.split('').map(c => c.charCodeAt(0)).join('')) % FIELD_SIZE;
    }
    
    return BigInt(input) % FIELD_SIZE;
  }

  private hashLeaf(leaf: string): string {
    if (!this.mimcSponge) throw new Error("MiMC not initialized");
    const input = this.toField(leaf);
    const hash = this.mimcSponge.multiHash([input], 0);
    return this.mimcSponge.F.toString(hash);
  }

  private hashPair(left: string, right: string): string {
    if (!this.mimcSponge) throw new Error("MiMC not initialized");
    const leftInput = this.toField(left);
    const rightInput = this.toField(right);
    const hash = this.mimcSponge.multiHash([leftInput, rightInput], 0);
    return this.mimcSponge.F.toString(hash);
  }

  async generateMerkleProof(leaf: string, allLeaves: string[]): Promise<ProofOutput> {
    await this.initMimc();

    const hashedLeaf = this.hashLeaf(leaf);
    let currentLevel = allLeaves.map(l => this.hashLeaf(l));

    let currentIndex = currentLevel.findIndex(l => l === hashedLeaf);
    if (currentIndex === -1) throw new Error("Leaf not found in tree");

    const pathElements: string[] = [];
    const pathIndices: number[] = [];

    while (currentLevel.length > 1) {
      const isLeft = currentIndex % 2 === 0;
      const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;
      
      const sibling = currentLevel[siblingIndex] ?? currentLevel[currentIndex];
      pathElements.push(sibling);
      pathIndices.push(isLeft ? 0 : 1);

      currentLevel = Array.from({ length: Math.ceil(currentLevel.length / 2) }, (_, i) => {
        const left = currentLevel[i * 2];
        const right = currentLevel[i * 2 + 1] ?? left;
        return this.hashPair(left, right);
      });

      currentIndex = Math.floor(currentIndex / 2);
    }

    const root = currentLevel[0];

    const input = {
      leaf: hashedLeaf,
      pathElements,
      pathIndices,
      root
    };

    const wasmPath = path.join(__dirname, 'merkleTreeProof', 'MerkleTreeProof.wasm');
    const zkeyPath = path.join(__dirname, 'merkleTreeProof', 'MerkleTreeProof_final.zkey');

    const { proof, publicSignals } = await groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    return { proof, publicSignals, root };
  }

  async verifyProof(proof: any, publicSignals: string[]): Promise<boolean> {
    const vKeyPath = path.join(__dirname, 'merkleTreeProof', 'verification_key.json');
    const vKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf-8'));
    return await groth16.verify(vKey, publicSignals, proof);
  }
}