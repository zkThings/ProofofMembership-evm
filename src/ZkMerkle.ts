import { groth16, zKey } from 'snarkjs';
import path from 'path';
import fs from 'fs';
const { buildMimcSponge } = require('circomlibjs');

interface ZkConfig {
  baseDir?: string;
  circuits?: {
    wasmDir?: string;
    zkeyDir?: string;
    verificationDir?: string;
  };
  templatesDir?: string;
  maxDepth?: number;
}

interface ProofOutput {
  proof: any;
  publicSignals: string[];
  root: string;
}

export class ZkMerkle {
  private mimcSponge: any;
  private readonly MAX_SUPPORTED_DEPTH: number;
  private readonly CONFIG_DIRS: {
    wasm: string;
    zkey: string;
    verification: string;
    templates: string;
  };

  constructor(config?: ZkConfig | string) {
    // If config is a string, treat it as a path to zkConfig directory
    if (typeof config === 'string') {
      const zkConfigPath = path.resolve(process.cwd(), config);
      const circuitsDir = path.join(zkConfigPath, 'circuits');
      
      this.MAX_SUPPORTED_DEPTH = 15;
      this.CONFIG_DIRS = {
        wasm: path.join(circuitsDir, 'wasm'),
        zkey: path.join(circuitsDir, 'zkey'),
        verification: path.join(circuitsDir, 'verification'),
        templates: path.join(zkConfigPath, 'templates')
      };
    } else {
      // Original config object behavior
      const projectRoot = path.resolve(__dirname, '..');
      const baseDir = config?.baseDir ?? path.join(projectRoot, 'zkConfig');
      const circuitsDir = path.join(baseDir, 'circuits');
      
      this.MAX_SUPPORTED_DEPTH = config?.maxDepth ?? 15;
      this.CONFIG_DIRS = {
        wasm: config?.circuits?.wasmDir ?? path.join(circuitsDir, 'wasm'),
        zkey: config?.circuits?.zkeyDir ?? path.join(circuitsDir, 'zkey'),
        verification: config?.circuits?.verificationDir ?? path.join(circuitsDir, 'verification'),
        templates: config?.templatesDir ?? path.join(baseDir, 'templates')
      };
    }

    this.validateDirectories();
    this.initMimc();
  }

  private validateDirectories() {
    Object.entries(this.CONFIG_DIRS).forEach(([key, dir]) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
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

  private getCircuitPath(depth: number, type: 'wasm' | 'zkey' | 'verification'): string {
    const circuitName = `MerkleTreeProof_${depth}`;
    const dirMap = {
      wasm: path.join(this.CONFIG_DIRS.wasm, `${circuitName}.wasm`),
      zkey: path.join(this.CONFIG_DIRS.zkey, `${circuitName}_final.zkey`),
      verification: path.join(this.CONFIG_DIRS.verification, `${circuitName}_verification_key.json`)
    };
    return dirMap[type];
  }

  public async generateMerkleProof(leaf: string, allLeaves: string[]): Promise<ProofOutput> {
    await this.initMimc();

    const treeSize = allLeaves.length;
    const depth = Math.ceil(Math.log2(treeSize));

    const paddedSize = 2 ** depth;
    const paddedLeaves = allLeaves.slice();
    while (paddedLeaves.length < paddedSize) {
      paddedLeaves.push('0');
    }

    const hashedLeaf = this.hashLeaf(leaf);
    let currentLevel = paddedLeaves.map((l) => this.hashLeaf(l));

    let currentIndex = currentLevel.findIndex((l) => l === hashedLeaf);
    if (currentIndex === -1) throw new Error('Leaf not found in tree');

    const pathElements: string[] = [];
    const pathIndices: number[] = [];

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

    const wasmPath = this.getCircuitPath(depth, 'wasm');
    const zkeyPath = this.getCircuitPath(depth, 'zkey');

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
    const vKeyPath = this.getCircuitPath(depth, 'verification');
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

    const zkeyPath = this.getCircuitPath(depth, 'zkey');
    if (!fs.existsSync(zkeyPath)) {
      throw new Error(`ZKey file for depth ${depth} not found at ${zkeyPath}`);
    }

    const templatePath = path.join(this.CONFIG_DIRS.templates, 'verifier_groth16.sol.ejs');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found at ${templatePath}`);
    }

    const template = fs.readFileSync(templatePath, 'utf8');
    const solidityVerifier = await zKey.exportSolidityVerifier(zkeyPath, { groth16: template });
    return solidityVerifier;
  }
}