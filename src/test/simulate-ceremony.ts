import { PowerOfTau } from '../PowerOfTau';
import path from 'path';
import fs from 'fs';

async function simulateCeremony() {
  try {
    console.log('🚀 Starting Trusted Setup Ceremony Simulation\n');
    
    // Coordinator setup
    console.log('👤 Coordinator: Setting up ceremony');
    const coordinator = new PowerOfTau();
    const ceremonyDir = path.join(__dirname, '..', 'temp', 'ceremony');
    fs.mkdirSync(ceremonyDir, { recursive: true });
    
    // Initialize ceremony
    console.log('\n📦 Phase 1: Powers of Tau');
    const initialPtau = await coordinator.initCeremony();
    
    // Contributor 1 - Phase 1
    console.log('\n👤 Contributor 1 (Phase 1)');
    const contributor1Dir = path.join(ceremonyDir, 'contributor1');
    fs.mkdirSync(contributor1Dir, { recursive: true });
    
    // Coordinator exports for Contributor 1
    const contrib1File = coordinator.exportPtau(contributor1Dir);
    console.log(`Coordinator exported PTAU to: ${contrib1File}`);
    
    // Contributor 1 makes contribution
    const contributor1 = new PowerOfTau();
    await contributor1.importContribution(contrib1File);
    await contributor1.contributePhase1('Contributor 1');
    const contrib1Result = contributor1.exportPtau(ceremonyDir);
    
    // Coordinator processes Contributor 1's contribution
    await coordinator.importContribution(contrib1Result);
    
    // Contributor 2 - Phase 1
    console.log('\n👤 Contributor 2 (Phase 1)');
    const contributor2Dir = path.join(ceremonyDir, 'contributor2');
    fs.mkdirSync(contributor2Dir, { recursive: true });
    
    // Coordinator exports for Contributor 2
    const contrib2File = coordinator.exportPtau(contributor2Dir);
    console.log(`Coordinator exported PTAU to: ${contrib2File}`);
    
    // Contributor 2 makes contribution
    const contributor2 = new PowerOfTau();
    await contributor2.importContribution(contrib2File);
    await contributor2.contributePhase1('Contributor 2');
    const contrib2Result = contributor2.exportPtau(ceremonyDir);
    
    // Coordinator processes Contributor 2's contribution
    await coordinator.importContribution(contrib2Result);
    
    // Finalize Phase 1
    console.log('\n🏁 Coordinator: Finalizing Phase 1');
    const finalPtau = await coordinator.finalizeCeremony();
    
    // Phase 2: Circuit-Specific Setup
    console.log('\n📦 Phase 2: Circuit-Specific Setup');
    const depths = [5, 10, 15];
    
    for (const depth of depths) {
      console.log(`\n🔄 Setting up circuit for depth ${depth}`);
      const circuitName = `MerkleTreeProof_${depth}`;
      
      // Initialize Phase 2
      await coordinator.initPhase2(circuitName);
      
      // Contributor 1 - Phase 2
      console.log('\n👤 Contributor 1 (Phase 2)');
      await coordinator.contributePhase2(circuitName, 'Contributor 1 - Phase 2');
      
      // Contributor 2 - Phase 2
      console.log('\n👤 Contributor 2 (Phase 2)');
      await coordinator.contributePhase2(circuitName, 'Contributor 2 - Phase 2');
      
      // Finalize circuit
      console.log(`\n🏁 Finalizing circuit ${circuitName}`);
      await coordinator.finalizeCircuit(circuitName);
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up temporary files');
    await coordinator.cleanup();
    
    console.log('\n✅ Ceremony completed successfully!');
    console.log('\nGenerated files can be found in:');
    console.log(`- merkleTreeProof/`);
    
  } catch (error) {
    console.error('\n❌ Ceremony failed:', error);
    process.exit(1);
  }
}

// Run the ceremony simulation
simulateCeremony().catch(console.error);