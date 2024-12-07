import { ZkMerkle } from '../ZkMerkle';

async function main() {
  const prover = new ZkMerkle();

  try {
    const leaves = ['a', 'b', 'c', 'd', 'e'];
    const leafToProve = 'a';

    console.log('\n🌿 Generating proof for leaf:', leafToProve);
    const { proof, publicSignals, root } = await prover.generateMerkleProof(leafToProve, leaves);

    console.log('\n🌳 Merkle Root:', root);
    console.log('\n🧾 Proof:', JSON.stringify(proof, null, 2));
    console.log('\n📢 Public Signals:', publicSignals);

    const depth = Math.ceil(Math.log2(leaves.length));

    console.log('\n🔍 Verifying proof...');
    const isValid = await prover.verifyProof(proof, publicSignals, depth);

    console.log(`\n✅ Proof verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);
    
    // Add explicit exit
    process.exit(isValid ? 0 : 1);  // Exit with 0 if successful, 1 if failed
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});