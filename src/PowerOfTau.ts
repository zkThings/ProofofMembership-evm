import { powersOfTau, zKey } from 'snarkjs';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getCurveFromName } from 'ffjavascript';

export class PowerOfTau {
  private readonly POWER_OF_TAU: number;
  private readonly MERKLE_DIR: string;
  private readonly CEREMONY_DIR: string;
  private readonly CURVE = 'bn128';

  constructor(power: number = 15) {
    this.POWER_OF_TAU = power;
    this.MERKLE_DIR = path.join(__dirname, 'merkleTreeProof');
    this.CEREMONY_DIR = path.join(this.MERKLE_DIR, 'ceremony');

    // Create necessary directories
    [this.MERKLE_DIR, this.CEREMONY_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private generateRandomness(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private logFileInfo(filePath: string, description: string) {
    console.log(`\n${description} Path: ${filePath}`);
    if (fs.existsSync(filePath)) {
      console.log(`${description} exists: ✅`);
      console.log(`${description} size: ${fs.statSync(filePath).size} bytes`);
    } else {
      console.log(`${description} does not exist: ❌`);
    }
  }

  private getLastPtauFile(): string {
    const files = fs.readdirSync(this.CEREMONY_DIR)
      .filter(file => file.startsWith(`pot${this.POWER_OF_TAU}_`) && file.endsWith('.ptau'))
      .sort();

    if (files.length === 0) {
      throw new Error('No PTAU files found. Initialize the ceremony first.');
    }

    return path.join(this.CEREMONY_DIR, files[files.length - 1]);
  }

  private getContributionNumber(filePath: string): number {
    const fileName = path.basename(filePath);
    const match = fileName.match(/_(\d{4})\.ptau$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  public async initCeremony(): Promise<string> {
    const ptauPath = path.join(this.CEREMONY_DIR, `pot${this.POWER_OF_TAU}_0000.ptau`);

    if (fs.existsSync(ptauPath)) {
      console.log('Ceremony already initialized.');
      this.logFileInfo(ptauPath, 'Initial PTAU file');
      return ptauPath;
    }

    console.log('🚀 Initializing new Powers of Tau ceremony...');
    const curve = await getCurveFromName(this.CURVE);
    await powersOfTau.newAccumulator(curve, this.POWER_OF_TAU, ptauPath);
    
    this.logFileInfo(ptauPath, 'Initial PTAU file');
    return ptauPath;
  }

  public async contributePhase1(name: string = 'Phase1 Contribution'): Promise<string> {
    const lastPtau = this.getLastPtauFile();
    const contribNumber = this.getContributionNumber(lastPtau) + 1;
    const newPtau = path.join(
      this.CEREMONY_DIR,
      `pot${this.POWER_OF_TAU}_${contribNumber.toString().padStart(4, '0')}.ptau`
    );

    console.log(`\n📥 Making Phase 1 contribution #${contribNumber} (${name})...`);
    await powersOfTau.contribute(lastPtau, newPtau, name, this.generateRandomness());
    
    this.logFileInfo(newPtau, 'Contributed PTAU file');
    return newPtau;
  }

  public exportPtau(exportDir: string): string {
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const lastPtau = this.getLastPtauFile();
    const destPath = path.join(exportDir, path.basename(lastPtau));
    fs.copyFileSync(lastPtau, destPath);
    
    console.log(`\nExported PTAU file to: ${destPath}`);
    return destPath;
  }

  public async importContribution(contribPath: string): Promise<void> {
    if (!fs.existsSync(contribPath)) {
      throw new Error(`Contributed PTAU file not found at: ${contribPath}`);
    }

    const contribFileName = path.basename(contribPath);
    const newPtau = path.join(this.CEREMONY_DIR, contribFileName);
    fs.copyFileSync(contribPath, newPtau);

    console.log('\n🔍 Verifying imported contribution...');
    await powersOfTau.verify(newPtau);
    
    this.logFileInfo(newPtau, 'Imported PTAU file');
  }

  public async finalizeCeremony(): Promise<string> {
    const lastPtau = this.getLastPtauFile();
    const finalPtau = path.join(this.CEREMONY_DIR, `pot${this.POWER_OF_TAU}_final.ptau`);

    console.log('\n🏁 Finalizing Phase 1...');
    await powersOfTau.preparePhase2(lastPtau, finalPtau);
    
    this.logFileInfo(finalPtau, 'Final PTAU file');
    return finalPtau;
  }

  public async initPhase2(circuitName: string): Promise<void> {
    const finalPtau = path.join(this.CEREMONY_DIR, `pot${this.POWER_OF_TAU}_final.ptau`);
    const r1csPath = path.join(this.MERKLE_DIR, `${circuitName}.r1cs`);
    const zkeyPath = path.join(this.MERKLE_DIR, `${circuitName}_0000.zkey`);

    if (!fs.existsSync(r1csPath)) {
      throw new Error(`R1CS file not found at: ${r1csPath}`);
    }

    console.log(`\n🚀 Initializing Phase 2 for ${circuitName}...`);
    await zKey.newZKey(r1csPath, finalPtau, zkeyPath);
    
    this.logFileInfo(zkeyPath, 'Initial zkey file');
  }

  public async contributePhase2(circuitName: string, name: string = 'Phase2 Contribution'): Promise<void> {
    const currentZkey = path.join(this.MERKLE_DIR, `${circuitName}_0000.zkey`);
    const newZkey = path.join(this.MERKLE_DIR, `${circuitName}_final.zkey`);

    console.log(`\n📥 Making Phase 2 contribution for ${circuitName}...`);
    await zKey.contribute(currentZkey, newZkey, name, this.generateRandomness());
    
    this.logFileInfo(newZkey, 'Contributed zkey file');
  }

  public async finalizeCircuit(circuitName: string): Promise<void> {
    const zkeyPath = path.join(this.MERKLE_DIR, `${circuitName}_final.zkey`);
    const wasmDir = path.join(this.MERKLE_DIR, `${circuitName}_js`);
    const wasmPath = path.join(wasmDir, `${circuitName}.wasm`);
    const vkeyPath = path.join(this.MERKLE_DIR, `${circuitName}_verification_key.json`);

    // Create wasm directory
    if (!fs.existsSync(wasmDir)) {
      fs.mkdirSync(wasmDir, { recursive: true });
    }

    // Copy wasm file to correct location
    const sourceWasm = path.join(this.MERKLE_DIR, `${circuitName}.wasm`);
    if (fs.existsSync(sourceWasm)) {
      fs.copyFileSync(sourceWasm, wasmPath);
    }

    // Export verification key
    console.log('\n📤 Exporting verification key...');
    const vKey = await zKey.exportVerificationKey(zkeyPath);
    fs.writeFileSync(vkeyPath, JSON.stringify(vKey, null, 2));

    this.logFileInfo(zkeyPath, 'Final zkey file');
    this.logFileInfo(wasmPath, 'WASM file');
    this.logFileInfo(vkeyPath, 'Verification key file');
  }

  public async cleanup(): Promise<void> {
    // Remove temporary files but keep final artifacts
    const files = fs.readdirSync(this.CEREMONY_DIR);
    for (const file of files) {
      if (!file.includes('final')) {
        fs.unlinkSync(path.join(this.CEREMONY_DIR, file));
      }
    }
    console.log('\n🧹 Cleaned up temporary ceremony files');
  }
}