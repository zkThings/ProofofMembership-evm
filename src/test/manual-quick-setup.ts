//this file expecting to be in /src - so upon use move it a level higher in dir or fix the pathes


import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Constants
const CIRCUITS = ["MerkleTreeProof"];
const POT_SIZE = 12; // 2^12 constraints
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Directory paths
const CIRCUITS_DIR = path.join(PROJECT_ROOT, 'zk');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');
const ZKEYS_DIR = path.join(PROJECT_ROOT, 'zkeys');
const POT_DIR = path.join(PROJECT_ROOT, 'pot');

// Ensure directory exists
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Execute command with proper error handling
function execCommand(command: string, errorMessage: string) {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Error: ${errorMessage}`);
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  try {
    console.log('Starting circuit compilation and setup process...\n');

    // Create necessary directories
    [BUILD_DIR, ZKEYS_DIR, POT_DIR].forEach(ensureDir);

    // Start new Powers of Tau ceremony
    console.log('1. Starting new Powers of Tau ceremony...');
    execCommand(
      `snarkjs powersoftau new bn128 ${POT_SIZE} ${path.join(POT_DIR, 'pot_0.ptau')} -v`,
      'Failed to start Powers of Tau ceremony'
    );

    // First contribution
    console.log('\n2. Adding first contribution...');
    execCommand(
      `snarkjs powersoftau contribute ${path.join(POT_DIR, 'pot_0.ptau')} ${path.join(POT_DIR, 'pot_1.ptau')} --name="First contribution" -v -e="random text"`,
      'Failed to add first contribution'
    );

    // Second contribution
    console.log('\n3. Adding second contribution...');
    execCommand(
      `snarkjs powersoftau contribute ${path.join(POT_DIR, 'pot_1.ptau')} ${path.join(POT_DIR, 'pot_2.ptau')} --name="Second contribution" -v -e="some other random text"`,
      'Failed to add second contribution'
    );

    // Apply random beacon
    console.log('\n4. Applying random beacon...');
    execCommand(
      `snarkjs powersoftau beacon ${path.join(POT_DIR, 'pot_2.ptau')} ${path.join(POT_DIR, 'pot_beacon.ptau')} 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"`,
      'Failed to apply random beacon'
    );

    // Prepare phase 2
    console.log('\n5. Preparing phase 2...');
    execCommand(
      `snarkjs powersoftau prepare phase2 ${path.join(POT_DIR, 'pot_beacon.ptau')} ${path.join(POT_DIR, 'pot_final.ptau')} -v`,
      'Failed to prepare phase 2'
    );

    // Verify the POT file
    console.log('\n6. Verifying POT file...');
    execCommand(
      `snarkjs powersoftau verify ${path.join(POT_DIR, 'pot_final.ptau')}`,
      'Failed to verify POT file'
    );

    // Process each circuit
    for (const circuit of CIRCUITS) {
      console.log(`\n7. Processing ${circuit} circuit...`);
      
      // Compile circuit
      console.log(`\n7.1. Compiling ${circuit}...`);
      execCommand(
        `circom ${path.join(CIRCUITS_DIR, `${circuit}.circom`)} --r1cs --wasm --sym -o ${BUILD_DIR}`,
        `Failed to compile ${circuit} circuit`
      );

      // Generate zkey
      console.log(`\n7.2. Generating zkey for ${circuit}...`);
      execCommand(
        `snarkjs groth16 setup ${path.join(BUILD_DIR, `${circuit}.r1cs`)} ${path.join(POT_DIR, 'pot_final.ptau')} ${path.join(ZKEYS_DIR, `${circuit}_0.zkey`)}`,
        `Failed to generate initial zkey for ${circuit}`
      );

      // Contribute to phase 2 ceremony
      console.log(`\n7.3. Contributing to phase 2 ceremony for ${circuit}...`);
      execCommand(
        `snarkjs zkey contribute ${path.join(ZKEYS_DIR, `${circuit}_0.zkey`)} ${path.join(ZKEYS_DIR, `${circuit}_final.zkey`)} --name="1st Phase2 contribution" -e="more random text"`,
        `Failed to contribute to phase 2 for ${circuit}`
      );

      // Verify final zkey
      console.log(`\n7.4. Verifying final zkey for ${circuit}...`);
      execCommand(
        `snarkjs zkey verify ${path.join(BUILD_DIR, `${circuit}.r1cs`)} ${path.join(POT_DIR, 'pot_final.ptau')} ${path.join(ZKEYS_DIR, `${circuit}_final.zkey`)}`,
        `Failed to verify final zkey for ${circuit}`
      );

      // Export verification key
      console.log(`\n7.5. Exporting verification key for ${circuit}...`);
      execCommand(
        `snarkjs zkey export verificationkey ${path.join(ZKEYS_DIR, `${circuit}_final.zkey`)} ${path.join(BUILD_DIR, `${circuit}_verification_key.json`)}`,
        `Failed to export verification key for ${circuit}`
      );

      // Move WASM file to correct location
      const circuitDir = circuit === 'Tree' ? 'treeMaker' : 'merkleTreeProof';
      const targetDir = path.join(PROJECT_ROOT, 'src', circuitDir);
      
      ensureDir(targetDir);
      
      // Copy necessary files to target directory
      fs.copyFileSync(
        path.join(BUILD_DIR, `${circuit}_js/${circuit}.wasm`),
        path.join(targetDir, `${circuit}.wasm`)
      );
      fs.copyFileSync(
        path.join(ZKEYS_DIR, `${circuit}_final.zkey`),
        path.join(targetDir, `${circuit}_final.zkey`)
      );
      fs.copyFileSync(
        path.join(BUILD_DIR, `${circuit}_verification_key.json`),
        path.join(targetDir, 'verification_key.json')
      );
    }

    console.log('\n✅ Setup completed successfully!');
    console.log('\nGenerated files are in their respective directories:');
    console.log(`- Build files: ${BUILD_DIR}`);
    console.log(`- ZKeys: ${ZKEYS_DIR}`);
    console.log(`- Powers of Tau: ${POT_DIR}`);
    console.log('\nCircuit files have been moved to src/treeMaker and src/merkleTreeProof');

  } catch (error) {
    console.error('\n❌ Error during setup:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});