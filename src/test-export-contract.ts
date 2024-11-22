import { MerkleProver } from './index';
import fs from 'fs';
import path from 'path';

async function testVerifierExport() {
  try {
    const prover = new MerkleProver();
    
    // Test with depth 10
    const verifierCode = await prover.exportVerifierContract(10);
    
    // Save the verifier contract to a file
    const outputPath = path.join(__dirname, '..', 'contracts', 'MerkleVerifier.sol');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, verifierCode);
    
    console.log('✅ Verifier contract generated successfully');
    console.log(`📁 Contract saved to: ${outputPath}`);
    
    // Verify the contract content
    const contractExists = fs.existsSync(outputPath);
    const contractSize = fs.statSync(outputPath).size;
    console.log(`📊 Contract file size: ${contractSize} bytes`);
    console.log(`🔍 Contract contains verify() function: ${verifierCode.includes('function verify')}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testVerifierExport().catch(console.error);