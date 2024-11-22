// src/PowerOfTau.ts

import { powersOfTau, zKey } from 'snarkjs';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { getCurveFromName } from 'ffjavascript';

export interface SetupResult {
  verificationKey: string;
  solidityVerifier: string;
  zkeyPath: string;
  wasmPath: string;
}

export class PowerOfTau {
  private readonly POWER_OF_TAU: number;
  private readonly POT_DIR: string;
  private readonly CURVE = 'bn128';

  constructor(power: number = 15) {
    this.POWER_OF_TAU = power;
    this.POT_DIR = path.join(__dirname, '..', 'pot');

    if (!fs.existsSync(this.POT_DIR)) {
      fs.mkdirSync(this.POT_DIR, { recursive: true });
      console.log(`Created directory for Powers of Tau: ${this.POT_DIR}`);
    }
  }

  /**
   * Generates cryptographic randomness.
   */
  private generateRandomness(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Logs information about a file.
   * @param filePath - Path to the file.
   * @param description - Description of the file.
   */
  private logFileInfo(filePath: string, description: string) {
    console.log(`\n${description} Path: ${filePath}`);
    if (fs.existsSync(filePath)) {
      console.log(`${description} exists: ✅`);
      console.log(`${description} size: ${fs.statSync(filePath).size} bytes`);
    } else {
      console.log(`${description} does not exist: ❌`);
    }
  }

  /**
   * Initializes a new Powers of Tau ceremony (Phase 1).
   * Creates the initial .ptau file.
   */
  public async initCeremony(): Promise<string> {
    const ptauPath = path.join(this.POT_DIR, `pot${this.POWER_OF_TAU}_0000.ptau`);

    if (fs.existsSync(ptauPath)) {
      console.log('Ceremony already initialized.');
      this.logFileInfo(ptauPath, 'Initial PTAU file');
      return ptauPath;
    }

    console.log('🚀 Initializing new Powers of Tau ceremony...');
    const curve = await getCurveFromName(this.CURVE);
    await powersOfTau.newAccumulator(curve, this.POWER_OF_TAU, ptauPath);
    console.log('✅ Ceremony initialized.');
    this.logFileInfo(ptauPath, 'Initial PTAU file');

    return ptauPath;
  }

  /**
   * Makes a contribution to Phase 1 of the ceremony.
   * @param name - Contributor's name or identifier.
   */
  public async contributePhase1(name: string = 'Phase1 Contribution'): Promise<string> {
    const lastPtau = this.getLastPtauFile();
    const contribNumber = this.getContributionNumber(lastPtau) + 1;
    const newPtau = path.join(
      this.POT_DIR,
      `pot${this.POWER_OF_TAU}_${contribNumber.toString().padStart(4, '0')}.ptau`
    );

    console.log(`\n📥 Making Phase 1 contribution #${contribNumber} (${name})...`);
    await powersOfTau.contribute(
      lastPtau,
      newPtau,
      name,
      this.generateRandomness()
    );
    console.log(`✅ Phase 1 contribution #${contribNumber} completed.`);
    this.logFileInfo(newPtau, 'Contributed PTAU file');

    return newPtau;
  }

  /**
   * Exports the current PTAU file for contributors.
   * @param exportDir - Directory where the PTAU file will be exported.
   */
  public exportPtau(exportDir: string): string {
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    const lastPtau = this.getLastPtauFile();
    const destPath = path.join(exportDir, path.basename(lastPtau));
    fs.copyFileSync(lastPtau, destPath);
    console.log(`\nExported current PTAU file to: ${destPath}`);
    return destPath;
  }

  /**
   * Imports a contributor's PTAU file back into the ceremony.
   * @param contribPath - Path to the contributed PTAU file.
   */
  public async importContribution(contribPath: string): Promise<void> {
    if (!fs.existsSync(contribPath)) {
      throw new Error(`Contributed PTAU file not found at: ${contribPath}`);
    }

    const contribFileName = path.basename(contribPath);
    const newPtau = path.join(this.POT_DIR, contribFileName);

    fs.copyFileSync(contribPath, newPtau);
    console.log(`\n📥 Imported contribution: ${newPtau}`);
    this.logFileInfo(newPtau, 'Imported PTAU file');

    // Verify the ceremony after importing the contribution
    console.log('\n🔍 Verifying the ceremony after importing the contribution...');
    try {
      await powersOfTau.verify(newPtau);
      console.log('✅ Ceremony verification successful.');
    } catch (error) {
      console.error('❌ Ceremony verification failed:', error);
      throw error;
    }
  }

  /**
   * Finalizes Phase 1 of the ceremony.
   * Prepares the final .ptau file for Phase 2 (Circuit-Specific Setup).
   */
  public async finalizeCeremony(): Promise<string> {
    const lastPtau = this.getLastPtauFile();
    const finalPtau = path.join(this.POT_DIR, `pot${this.POWER_OF_TAU}_final.ptau`);

    if (fs.existsSync(finalPtau)) {
      console.log('🏁 Phase 1 already finalized.');
      this.logFileInfo(finalPtau, 'Final PTAU file');
      return finalPtau;
    }

    console.log('\n🏁 Finalizing Phase 1 of the ceremony...');
    await powersOfTau.preparePhase2(lastPtau, finalPtau);
    console.log('✅ Phase 1 finalized.');
    this.logFileInfo(finalPtau, 'Final PTAU file');

    return finalPtau;
  }

  /**
   * Performs Phase 2 (Circuit-Specific Setup) for a given circuit.
   * @param circuitName - Name of the circuit (e.g., 'MerkleTreeProof_2').
   */
  public async setupCircuit(circuitName: string): Promise<SetupResult> {
    const circuitDir = path.join(__dirname, 'merkleTreeProof');
    const r1csPath = path.join(circuitDir, `${circuitName}.r1cs`);
    const wasmPath = path.join(circuitDir, `${circuitName}.wasm`);
    const finalPtauPath = path.join(this.POT_DIR, `pot${this.POWER_OF_TAU}_final.ptau`);
    const zkeyInitPath = path.join(this.POT_DIR, `${circuitName}_0000.zkey`);
    const zkeyContribPath = path.join(this.POT_DIR, `${circuitName}_0001.zkey`);
    const zkeyFinalPath = path.join(circuitDir, `${circuitName}_final.zkey`);
    const vkeyPath = path.join(circuitDir, `${circuitName}_verification_key.json`);
    const verifierPath = path.join(circuitDir, `verifier_${circuitName}.sol`);

    this.logFileInfo(r1csPath, 'R1CS file');
    this.logFileInfo(wasmPath, 'WASM file');

    if (!fs.existsSync(r1csPath)) {
      throw new Error(`R1CS file not found at: ${r1csPath}`);
    }
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`WASM file not found at: ${wasmPath}`);
    }
    if (!fs.existsSync(finalPtauPath)) {
      throw new Error(`Final PTAU file not found at: ${finalPtauPath}. Please finalize Phase 1 first.`);
    }

    console.log(`\n🔧 Starting Phase 2 setup for circuit: ${circuitName}`);

    // Phase 2: Generate initial zkey
    console.log('📦 Phase 2: Circuit-specific setup');
    await zKey.newZKey(r1csPath, finalPtauPath, zkeyInitPath);
    this.logFileInfo(zkeyInitPath, 'Initial zkey file');

    // Phase 2: Make a contribution to zkey
    console.log('📦 Phase 2: Contributing to zkey');
    await zKey.contribute(zkeyInitPath, zkeyContribPath, `${circuitName} Contribution`, this.generateRandomness());
    this.logFileInfo(zkeyContribPath, 'Contributed zkey file');

    // Phase 2: Finalize zkey
    console.log('📦 Phase 2: Finalizing zkey');
    await zKey.beacon(zkeyContribPath, zkeyFinalPath, `${circuitName} Final Beacon`, this.generateRandomness(), 10);
    this.logFileInfo(zkeyFinalPath, 'Final zkey file');

    // Verify zkey
    console.log('🔍 Verifying final zkey');
    try {
      execSync(`snarkjs zkey verify ${r1csPath} ${finalPtauPath} ${zkeyFinalPath}`, { stdio: 'inherit' });
      console.log('✅ Final zkey verified successfully.');
    } catch (error) {
      console.error('❌ Final zkey verification failed:', error);
      throw error;
    }

    // Generate verification key and Solidity verifier
    console.log('📄 Generating verification key and Solidity verifier');
    const vKey = await zKey.exportVerificationKey(zkeyFinalPath);
    fs.writeFileSync(vkeyPath, JSON.stringify(vKey, null, 2));

    const verifierCode = await zKey.exportSolidityVerifier(zkeyFinalPath);
    fs.writeFileSync(verifierPath, verifierCode);
    console.log('✅ Verification key and Solidity verifier generated.');

    return {
      verificationKey: vkeyPath,
      solidityVerifier: verifierPath,
      zkeyPath: zkeyFinalPath,
      wasmPath: wasmPath,
    };
  }

  /**
   * Makes a contribution to Phase 2 of the ceremony for a specific circuit.
   * @param circuitName - Name of the circuit.
   * @param name - Contributor's name or identifier.
   */
  public async contributePhase2(circuitName: string, name: string = 'Phase2 Contribution'): Promise<string> {
    const circuitDir = path.join(__dirname, 'merkleTreeProof');
    const zkeyFinalPath = path.join(circuitDir, `${circuitName}_final.zkey`);
    const zkeyContribPath = path.join(this.POT_DIR, `${circuitName}_0002.zkey`);

    if (!fs.existsSync(zkeyFinalPath)) {
      throw new Error(`Final zkey file not found at: ${zkeyFinalPath}. Please setup the circuit first.`);
    }

    console.log(`\n📥 Making Phase 2 contribution for ${circuitName} (${name})...`);
    await zKey.contribute(
      zkeyFinalPath,
      zkeyContribPath,
      name,
      this.generateRandomness()
    );
    console.log(`✅ Phase 2 contribution for ${circuitName} completed.`);
    this.logFileInfo(zkeyContribPath, 'Phase 2 Contributed zkey file');

    return zkeyContribPath;
  }

  /**
   * Finalizes the setup for a specific circuit after Phase 2 contributions.
   * @param circuitName - Name of the circuit.
   */
  public async finalizeCircuitSetup(circuitName: string): Promise<void> {
    const circuitDir = path.join(__dirname, 'merkleTreeProof');
    const zkeyFinalPath = path.join(circuitDir, `${circuitName}_final.zkey`);

    console.log(`\n🏁 Finalizing Phase 2 setup for circuit: ${circuitName}...`);
    // Any additional finalization steps can be added here
    console.log(`✅ Phase 2 setup for ${circuitName} finalized.`);
  }

  /**
   * Helper: Get the latest PTAU file in Phase 1.
   */
  private getLastPtauFile(): string {
    const files = fs
      .readdirSync(this.POT_DIR)
      .filter(
        (file) =>
          file.startsWith(`pot${this.POWER_OF_TAU}_`) && file.endsWith('.ptau')
      )
      .sort();

    if (files.length === 0) {
      throw new Error('No PTAU files found. Initialize the ceremony first.');
    }

    return path.join(this.POT_DIR, files[files.length - 1]);
  }

  /**
   * Helper: Extract contribution number from filename.
   * @param filePath - Path to the PTAU file.
   */
  private getContributionNumber(filePath: string): number {
    const fileName = path.basename(filePath);
    const match = fileName.match(/_(\d{4})\.ptau$/);
    if (!match) {
      throw new Error(`Invalid PTAU file name format: ${fileName}`);
    }
    return parseInt(match[1], 10);
  }
}
