

//this file expecting to be in /src - so upon use move it a level higher in dir or fix the pathes

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const circomPath = "circom"; // Adjust if necessary
const snarkjsPath = "snarkjs"; // Adjust if necessary
const potFile = path.join(__dirname, "..", "pot", "pot15_final.ptau");
const circuitTemplatePath = path.join(__dirname, "..", "zk", "MerkleTreeProof.circom");
const outputDir = path.join(__dirname, "merkleTreeProof");

// Adjust depths as needed
const MIN_DEPTH = 2;
const MAX_DEPTH = 15; // You can adjust this if needed
const depths = Array.from({ length: MAX_DEPTH - MIN_DEPTH + 1 }, (_, i) => i + MIN_DEPTH);

depths.forEach((depth) => {
  try {
    const circuitName = `MerkleTreeProof_${depth}`;
    const circuitFile = path.join(outputDir, `${circuitName}.circom`);
    const r1csFile = path.join(outputDir, `${circuitName}.r1cs`);
    const wasmFile = path.join(outputDir, `${circuitName}.wasm`);
    const zkeyFile = path.join(outputDir, `${circuitName}_final.zkey`);
    const vkeyFile = path.join(outputDir, `${circuitName}_verification_key.json`);

    // Generate the circuit file with the specified depth
    const circuitCode = fs
      .readFileSync(circuitTemplatePath, "utf8")
      .replace(/DEPTH/g, depth.toString());
    fs.writeFileSync(circuitFile, circuitCode);

    // Compile the circuit
    console.log(`Compiling circuit for depth ${depth}...`);
    const includePath = path.join(__dirname, "..", "zk");
    execSync(
      `${circomPath} ${circuitFile} --r1cs --wasm -o ${outputDir} -l ${includePath}`,
      { stdio: 'inherit' }
    );

    // Perform trusted setup
    console.log(`Performing trusted setup for depth ${depth}...`);
    execSync(
      `${snarkjsPath} groth16 setup ${r1csFile} ${potFile} ${zkeyFile}`,
      { stdio: 'inherit' }
    );

    // Export verification key
    console.log(`Exporting verification key for depth ${depth}...`);
    execSync(
      `${snarkjsPath} zkey export verificationkey ${zkeyFile} ${vkeyFile}`,
      { stdio: 'inherit' }
    );

    console.log(`Circuit for depth ${depth} compiled successfully.\n`);
  } catch (error) {
    console.error(`Error processing depth ${depth}: ${error.message}`);
    // Optionally, exit the process if you want to stop on error
    // process.exit(1);
  }
});
