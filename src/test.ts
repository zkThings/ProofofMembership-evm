import { MerkleProver } from './index';
import path from 'path';

async function main() {
  const baseDir = path.resolve(__dirname, '../zk');
  const prover = new MerkleProver();
  
  try {
    console.log("🔧 Setting up circuit...");

    // const setup = await prover.setupCircuit("MerkleTreeProof", {
    //   powersOfTauSize: 14,
    //   numIterationsExp: 12,
    //   name: "Test Setup"
    // });
    
    // console.log("\n✅ Setup completed. Generated files:");
    // console.log(setup);

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