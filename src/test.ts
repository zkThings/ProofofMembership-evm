import { MerkleProver } from './index';
import path from 'path';

async function main() {
  const prover = new MerkleProver();

  try {
    // Define your leaves
    const leaves = ['a', 'b', 'c', 'd', 'e'];

    // The leaf you want to prove
    const leafToProve = '3';

    console.log('\n🌿 Generating proof for leaf:', leafToProve);
    const { proof, publicSignals, root } = await prover.generateMerkleProof(leafToProve, leaves);

    console.log('\n🌳 Merkle Root:', root);
    console.log('\n🧾 Proof:', proof);
    console.log('\n📢 Public Signals:', publicSignals);

    // Calculate the depth
    const depth = Math.ceil(Math.log2(leaves.length));

    console.log('\n🔍 Verifying proof...');
    const isValid = await prover.verifyProof(proof, publicSignals, depth);

    console.log(`\n✅ Proof verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  }
}

main().catch(console.error);
