import { powersOfTau, zKey } from 'snarkjs';
import { buildBn128 } from 'ffjavascript';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';

const ptauOutputPath = path.join(__dirname, 'powersOfTau12.ptau');
const ptauFinalPath = path.join(__dirname, 'powersOfTau12_final.ptau');
const power = 12;
const circuitName = 'merkleTreeProof';
const circuitWasmPath = path.join(__dirname, `${circuitName}.wasm`);
const circuitR1csPath = path.join(__dirname, 'merkleTreeProof', `${circuitName}.r1cs`);
const finalZkeyPath = path.join(__dirname, `${circuitName}_final.zkey`);

async function generateRandomness(): Promise<Uint8Array> {
  return crypto.randomBytes(32);
}

async function logFileInfo(filePath: string, description: string) {
  console.log(`${description} path:`, filePath);
  if (fs.existsSync(filePath)) {
    console.log(`${description} exists:`, true);
    console.log(`${description} size:`, fs.statSync(filePath).size, 'bytes');
  } else {
    console.log(`${description} does not exist`);
  }
}

async function generatePowersOfTau() {
  try {
    console.log('Starting Powers of Tau ceremony...');

    // Delete existing output files
    const filesToDelete = [ptauOutputPath, ptauFinalPath, path.join(__dirname, 'circuit_0000.zkey'), path.join(__dirname, 'circuit_0001.zkey'), finalZkeyPath];
    for (const file of filesToDelete) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`Deleted existing file: ${file}`);
      }
    }

    await logFileInfo(circuitR1csPath, 'R1CS file');
    await logFileInfo(circuitWasmPath, 'WASM file');

    console.log('Generating Powers of Tau...');
    const curve = await buildBn128();
    await powersOfTau.newAccumulator(curve, power, ptauOutputPath);
    console.log('Powers of Tau generated successfully.');

    await logFileInfo(ptauOutputPath, 'PTAU file');

    console.log('Contributing to the ceremony...');
    const contributionEntropy = await generateRandomness();
    await powersOfTau.contribute(ptauOutputPath, ptauOutputPath, 'Contributor 1', contributionEntropy);
    console.log('Contribution added successfully.');

    await logFileInfo(ptauOutputPath, 'Updated PTAU file');

    console.log('Preparing phase 2...');
    await powersOfTau.preparePhase2(ptauOutputPath, ptauFinalPath);
    console.log('Phase 2 preparation completed.');

    await logFileInfo(ptauFinalPath, 'Final PTAU file');

    console.log('Creating phase 2...');
    const initialZkeyPath = path.join(__dirname, 'circuit_0000.zkey');
    try {
      console.log('Inputs for newZKey:');
      console.log('circuitR1csPath:', circuitR1csPath);
      console.log('ptauFinalPath:', ptauFinalPath);
      console.log('initialZkeyPath:', initialZkeyPath);

      await zKey.newZKey(circuitR1csPath, ptauFinalPath, initialZkeyPath);
      console.log('Phase 2 ceremony initialized.');

      await logFileInfo(initialZkeyPath, 'Initial zkey file');
    } catch (error) {
      console.error('Error creating initial zkey:', error);
      throw error;
    }

    console.log('Contributing to phase 2...');
    const phase2Entropy = await generateRandomness();
    const contributedZkeyPath = path.join(__dirname, 'circuit_0001.zkey');
    await zKey.contribute(initialZkeyPath, contributedZkeyPath, 'Contributor 1', phase2Entropy);
    console.log('Contribution to phase 2 added successfully.');

    await logFileInfo(contributedZkeyPath, 'Contributed zkey file');

    console.log('Generating final zkey...');
    const beaconEntropy = await generateRandomness();
    const tempFinalZkeyPath = path.join(__dirname, 'temp_final.zkey');
    try {
      await zKey.beacon(contributedZkeyPath, tempFinalZkeyPath, 'Final Beacon', beaconEntropy, 10);
      console.log('Beacon process completed.');

      if (fs.existsSync(tempFinalZkeyPath)) {
        fs.renameSync(tempFinalZkeyPath, finalZkeyPath);
        console.log('Final zkey file renamed successfully.');
      } else {
        throw new Error(`Temporary final zkey file was not created: ${tempFinalZkeyPath}`);
      }
    } catch (error) {
      console.error('Error during beacon process:', error);
      
      // Fallback to using contribute instead of beacon
      console.log('Attempting to use contribute as a fallback...');
      try {
        await zKey.contribute(contributedZkeyPath, finalZkeyPath, 'Final Contribution', beaconEntropy);
        console.log('Final contribution process completed.');
      } catch (contributeError) {
        console.error('Error during final contribution process:', contributeError);
        throw contributeError;
      }
    }

    await logFileInfo(finalZkeyPath, 'Final zkey file');

    if (!fs.existsSync(finalZkeyPath)) {
      throw new Error(`Final zkey file was not created: ${finalZkeyPath}`);
    }

    console.log('Exporting verification key...');
    const vKey = await zKey.exportVerificationKey(finalZkeyPath);
    console.log('Verification key exported successfully.');

    // Save vKey to a file
    const vKeyPath = path.join(__dirname, `${circuitName}_verification_key.json`);
    fs.writeFileSync(vKeyPath, JSON.stringify(vKey, null, 2));
    console.log('Verification key saved to:', vKeyPath);

  } catch (error) {
    console.error('An error occurred:', error);
  }
}

generatePowersOfTau();