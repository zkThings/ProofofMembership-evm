import { PowerOfTau } from '../PowerOfTau';
import path from 'path';

async function main() {
  try {
    console.log('🌟 Starting Powers of Tau Ceremony Test');
    const pot = new PowerOfTau(15);

    // Phase 1: Powers of Tau
    console.log('\n📋 Phase 1: Powers of Tau');
    await pot.initCeremony();
    
    // Simulate multiple contributors
    await pot.contributePhase1('Contributor 1');
    await pot.contributePhase1('Contributor 2');
    await pot.contributePhase1('Contributor 3');
    
    // Finalize Phase 1
    await pot.finalizeCeremony();

    // Phase 2: Circuit-Specific Setup
    console.log('\n📋 Phase 2: Circuit-Specific Setup');
    
    // Process all depths
    await pot.finalizeAllCircuits();

    // Cleanup
    await pot.cleanup();
    
    console.log('\n✅ Ceremony completed successfully!');
  } catch (error) {
    console.error('\n❌ Error during ceremony:', error);
    process.exit(1);
  }
}

main().catch(console.error);