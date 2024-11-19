import { groth16 } from "snarkjs";
import path from "path";
import fs from "fs";
const { buildMimcSponge } = require("circomlibjs");

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
    return BigInt(input) % FIELD_SIZE;
  }

  private hashLeaf(leaf: string): string {
    if (!this.mimcSponge) throw new Error("MiMC not initialized");
    const input = this.toField(leaf);
    const hash = this.mimcSponge.multiHash([input], 0, 1);
    return this.mimcSponge.F.toString(hash[0]);
  }

  private hashPair(left: string, right: string): string {
    if (!this.mimcSponge) throw new Error("MiMC not initialized");
    const leftInput = this.toField(left);
    const rightInput = this.toField(right);
    const hash = this.mimcSponge.multiHash([leftInput, rightInput], 0, 1);
    return this.mimcSponge.F.toString(hash[0]);
  }

  async generateMerkleProof(leaf: string, allLeaves: string[]) {
    await this.initMimc();

    console.log("Initial values:", { leaf, allLeaves });

    const hashedLeaf = this.hashLeaf(leaf);
    let currentLevel = allLeaves.map(l => this.hashLeaf(l));

    console.log("Hashed values:", { hashedLeaf, currentLevel });

    const leafIndex = currentLevel.indexOf(hashedLeaf);
    if (leafIndex === -1) throw new Error("Leaf not found");

    const pathElements = [];
    const pathIndices = [];
    let currentIndex = leafIndex;

    while (currentLevel.length > 1) {
      const isLeft = currentIndex % 2 === 0;
      const pairIndex = isLeft ? currentIndex + 1 : currentIndex - 1;

      if (pairIndex < currentLevel.length) {
        pathElements.push(currentLevel[pairIndex]);
      } else {
        pathElements.push(currentLevel[currentIndex]);
      }
      
      pathIndices.push(isLeft ? 0 : 1);

      currentLevel = Array.from({ length: Math.ceil(currentLevel.length / 2) }, (_, i) => {
        const left = currentLevel[i * 2];
        const right = currentLevel[i * 2 + 1] ?? left;
        return this.hashPair(left, right);
      });

      currentIndex = Math.floor(currentIndex / 2);
    }

    const root = currentLevel[0];

    console.log("Merkle tree data:", {
      hashedLeaf,
      pathElements,
      pathIndices,
      root
    });

    const input = {
      leaf: hashedLeaf,
      pathElements,
      pathIndices,
      root
    };

    const wasmPath = path.resolve(__dirname, '../zk/MerkleTreeProof_js/MerkleTreeProof.wasm');
    const zkeyPath = path.resolve(__dirname, '../zk/MerkleProof_0000.zkey');

    const { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zkeyPath);
    return { proof, publicSignals, root };
  }

  async verifyProof(proof: any, publicSignals: any): Promise<boolean> {
    const vKeyPath = path.resolve(__dirname, '../zk/verification_key.json');
    const vKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf-8'));
    return await groth16.verify(vKey, publicSignals, proof);
  }
}