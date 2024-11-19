import { MerkleProver } from './index';
import { TrustedSetup } from './TrustedSetup';
import path from 'path';

async function setupCircuit() {
  console.log("🔧 Starting trusted setup...");
  const setup = new TrustedSetup();
  const result = await setup.setup("MerkleTreeProof");
  console.log("✅ Setup completed. Generated files:", result);
  return result;
}

async function main() {
  const prover = new MerkleProver();
  
  try {
    // Run trusted setup first
    // await setupCircuit();

    // Test proof generation and verification
    const leaves = ["test", "b", "c", "d"];
    console.log("\n🌿 Generating proof for leaf ...");
    const { proof, publicSignals, root } = await prover.generateMerkleProof("test", leaves);
    
    console.log("\n🌳 Root:", root);
    console.log("\n🔍 Verifying proof...");
    const isValid = await prover.verifyProof(proof, publicSignals);
    
    console.log("\n✅ Proof verification:", isValid ? "SUCCESS" : "FAILED");
  } catch (error) {
    console.error("\n❌ Error:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
  }
}

main().catch(console.error);