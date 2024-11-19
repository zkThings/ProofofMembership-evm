// import { powersOfTau, zKey } from 'snarkjs';
// import path from 'path';
// import fs from 'fs';
// import { promisify } from 'util';
// import crypto from 'crypto';
// import { SetupConfig, SetupResult } from './types';
// const { getCurveFromName } = require('ffjavascript');

// const writeFileAsync = promisify(fs.writeFile);
// const readFileAsync = promisify(fs.readFile);
// const copyFileAsync = promisify(fs.copyFile);

// export class TrustedSetup {
//   private baseDir: string;
//   private potDir: string;
//   private zkeyDir: string;
//   private circuitDir: string;

//   constructor(baseDir: string) {
//     this.baseDir = baseDir;
//     this.potDir = path.join(baseDir, 'pot');
//     this.zkeyDir = path.join(baseDir, 'zkey');
//     this.circuitDir = path.join(baseDir, 'circuit');
//     this.createDirectories();
//   }

//   private createDirectories() {
//     [this.potDir, this.zkeyDir, this.circuitDir].forEach(dir => {
//       if (!fs.existsSync(dir)) {
//         fs.mkdirSync(dir, { recursive: true });
//       }
//     });
//   }

//   private async generateRandomness(): Promise<Uint8Array> {
//     return crypto.randomBytes(32);
//   }

//   async performSetup(circuitName: string, config: SetupConfig = {}): Promise<SetupResult> {
//     const {
//       powersOfTauSize = 14,
//       numIterationsExp = 10,
//       name = "Contribution"
//     } = config;

//     const r1csPath = path.join(this.circuitDir, `${circuitName}.r1cs`);
//     const wasmPath = path.join(this.circuitDir, `${circuitName}.wasm`);
//     const wasmDestPath = path.join(this.circuitDir, `${circuitName}.wasm`);
//     const ptauPath = path.join(this.potDir, `powersOfTau${powersOfTauSize}_0000.ptau`);
//     const ptauFinalPath = path.join(this.potDir, `powersOfTau${powersOfTauSize}_0001.ptau`);
//     const zkeyInitPath = path.join(this.zkeyDir, `${circuitName}_0000.zkey`);
//     const zkeyContribPath = path.join(this.zkeyDir, `${circuitName}_0001.zkey`);
//     const zkeyFinalPath = path.join(this.zkeyDir, `${circuitName}_final.zkey`);
//     const vkeyPath = path.join(this.circuitDir, "verification_key.json");
//     const verifierPath = path.join(this.circuitDir, "verifier.sol");

//     try {
//       console.log("🚀 Starting trusted setup...");
//       console.log("📦 Phase 1: Powers of Tau ceremony");
      
//       if (!fs.existsSync(ptauPath)) {
//         const curve = await getCurveFromName("bn128");
//         await powersOfTau.newAccumulator(curve, powersOfTauSize, ptauPath);
//         const entropy = await this.generateRandomness();
//         await powersOfTau.contribute(ptauPath, ptauFinalPath, name, entropy);
//       }

//       if (!fs.existsSync(r1csPath)) {
//         throw new Error(`R1CS file not found at: ${r1csPath}`);
//       }

//       console.log("📦 Phase 2: Circuit-specific setup");
//       await zKey.newZKey(r1csPath, ptauFinalPath, zkeyInitPath);

//       console.log("📦 Phase 3: Contribute to ceremony");
//       const entropy1 = await this.generateRandomness();
//       await zKey.contribute(zkeyInitPath, zkeyContribPath, name, entropy1);

//       console.log("📦 Phase 4: Apply beacon");
//       const entropy2 = await this.generateRandomness();
//       await zKey.beacon(zkeyContribPath, zkeyFinalPath, "Final Beacon", entropy2, numIterationsExp);

//       console.log("📄 Generating verification files");
//       const vKey = await zKey.exportVerificationKey(zkeyFinalPath);
//       await writeFileAsync(vkeyPath, JSON.stringify(vKey, null, 2));

//       const templatesDir = path.join(__dirname, '../templates');
//       const templates = {
//         groth16: await readFileAsync(path.join(templatesDir, 'verifier_groth16.sol.ejs'), 'utf8')
//       };

//       const solidityVerifier = await zKey.exportSolidityVerifier(zkeyFinalPath, templates);
//       await writeFileAsync(verifierPath, solidityVerifier);

//       if (fs.existsSync(wasmPath)) {
//         await copyFileAsync(wasmPath, wasmDestPath);
//       }

//       return {
//         verificationKey: vkeyPath,
//         solidityVerifier: verifierPath,
//         zkeyPath: zkeyFinalPath,
//         wasmPath: wasmDestPath
//       };
//     } catch (error) {
//       console.error("❌ Error in trusted setup:", error);
//       throw error;
//     }
//   }
// }