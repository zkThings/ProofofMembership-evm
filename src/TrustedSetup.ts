import { powersOfTau, zKey } from 'snarkjs';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
const { getCurveFromName } = require('ffjavascript');

export interface SetupResult {
  verificationKey: string;
  solidityVerifier: string;
  zkeyPath: string;
  wasmPath: string;
}

export class TrustedSetup {
  private readonly POWER_OF_TAU = 15;
  private readonly PROJECT_ROOT: string;
  private readonly BUILD_DIR: string;
  private readonly TEMP_DIR: string;
  private readonly OUTPUT_DIR: string;

  constructor() {
    this.PROJECT_ROOT = path.resolve(__dirname, '..');
    this.BUILD_DIR = path.join(this.PROJECT_ROOT, 'build');
    this.TEMP_DIR = path.join(this.PROJECT_ROOT, 'temp');
    this.OUTPUT_DIR = path.join(__dirname, 'merkleTreeProof');

    [this.BUILD_DIR, this.TEMP_DIR, this.OUTPUT_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private generateRandomness(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private logFileInfo(filePath: string, description: string) {
    console.log(`${description} path:`, filePath);
    if (fs.existsSync(filePath)) {
      console.log(`${description} exists:`, true);
      console.log(`${description} size:`, fs.statSync(filePath).size, 'bytes');
    } else {
      console.log(`${description} does not exist`);
    }
  }

  private cleanup() {
    [this.BUILD_DIR, this.TEMP_DIR].forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  async setup(circuitName: string): Promise<SetupResult> {
    try {
      console.log("🚀 Starting trusted setup...");

      const ptauPath = path.join(this.TEMP_DIR, `pot${this.POWER_OF_TAU}.ptau`);
      const ptauContribPath = path.join(this.TEMP_DIR, `pot${this.POWER_OF_TAU}_contrib.ptau`);
      const ptauBeaconPath = path.join(this.TEMP_DIR, `pot${this.POWER_OF_TAU}_beacon.ptau`);
      const ptauFinalPath = path.join(this.TEMP_DIR, `pot${this.POWER_OF_TAU}_final.ptau`);
      const r1csPath = path.join(this.OUTPUT_DIR, `${circuitName}.r1cs`);
      const wasmPath = path.join(this.OUTPUT_DIR, `${circuitName}.wasm`);
      const zkeyInitPath = path.join(this.TEMP_DIR, `${circuitName}_0000.zkey`);
      const zkeyContribPath = path.join(this.TEMP_DIR, `${circuitName}_0001.zkey`);
      const zkeyPath = path.join(this.OUTPUT_DIR, `${circuitName}_final.zkey`);
      const vkeyPath = path.join(this.OUTPUT_DIR, 'verification_key.json');
      const verifierPath = path.join(this.OUTPUT_DIR, 'verifier.sol');

      this.logFileInfo(r1csPath, 'R1CS file');
      this.logFileInfo(wasmPath, 'WASM file');

      if (!fs.existsSync(r1csPath)) {
        throw new Error(`R1CS file not found at: ${r1csPath}`);
      }
      if (!fs.existsSync(wasmPath)) {
        throw new Error(`WASM file not found at: ${wasmPath}`);
      }

      console.log("📦 Phase 1: Powers of Tau ceremony");
      const curve = await getCurveFromName("bn128");
      await powersOfTau.newAccumulator(curve, this.POWER_OF_TAU, ptauPath);
      await powersOfTau.contribute(ptauPath, ptauContribPath, "First Contribution", this.generateRandomness());
      await powersOfTau.beacon(ptauContribPath, ptauBeaconPath, "Beacon", this.generateRandomness(), 10);
      await powersOfTau.preparePhase2(ptauBeaconPath, ptauFinalPath);
      
      execSync(`snarkjs powersoftau verify ${ptauFinalPath}`, { stdio: 'inherit' });
      this.logFileInfo(ptauFinalPath, 'Final PTAU file');

      console.log("📦 Phase 2: Circuit-specific setup");
      await zKey.newZKey(r1csPath, ptauFinalPath, zkeyInitPath);
      this.logFileInfo(zkeyInitPath, 'Initial zkey file');

      console.log("📦 Phase 3: Contributing to ceremony");
      await zKey.contribute(zkeyInitPath, zkeyContribPath, "First Contribution", this.generateRandomness());
      this.logFileInfo(zkeyContribPath, 'Contributed zkey file');

      console.log("📦 Phase 4: Generating final zkey");
      await zKey.beacon(zkeyContribPath, zkeyPath, "Final Beacon", this.generateRandomness(), 10);
      this.logFileInfo(zkeyPath, 'Final zkey file');

      console.log("🔍 Verifying final zkey");
      execSync(`snarkjs zkey verify ${r1csPath} ${ptauFinalPath} ${zkeyPath}`, { stdio: 'inherit' });

      console.log("📄 Generating verification files");
      const vKey = await zKey.exportVerificationKey(zkeyPath);
      fs.writeFileSync(vkeyPath, JSON.stringify(vKey, null, 2));

      const templates = {
        groth16: fs.readFileSync(
          path.join(this.PROJECT_ROOT, 'templates', 'verifier_groth16.sol.ejs'),
          'utf8'
        )
      };
      const solidityVerifier = await zKey.exportSolidityVerifier(zkeyPath, templates);
      fs.writeFileSync(verifierPath, solidityVerifier);

      this.cleanup();

      return {
        verificationKey: vkeyPath,
        solidityVerifier: verifierPath,
        zkeyPath: zkeyPath,
        wasmPath: wasmPath
      };
    } catch (error) {
      console.error("❌ Error in trusted setup:", error);
      throw error;
    }
  }
}