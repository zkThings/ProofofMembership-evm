# @zksdk/zk-merkle

Zero-Knowledge Merkle Trees with support for custom trusted setups.

> ⚠️ **Note**: This is an early stage project. API may change as we improve it.

## What is this?

This package helps you work with Merkle Trees that have zero-knowledge capabilities:
- Prove membership without revealing the path or location
- Generate and verify zero-knowledge proofs
- Create and manage your own trusted setup
- Export Solidity verifier contracts

## Installation

```bash
bun add zkmerkle

or 

npm i zkmerkle

```

## Basic Usage

```typescript
import { ZkMerkle } from 'zkmerkle';

// Create a new ZK Merkle Tree
const zkMerkle = new ZkMerkle();

// Add some data to your tree
const myData = ['apple', 'banana', 'orange', 'grape', 'mango'];

// Calculate tree depth
const depth = Math.ceil(Math.log2(myData.length));

// Generate a proof
const { proof, publicSignals, root } = await zkMerkle.generateMerkleProof('apple', myData);

console.log('Merkle Root:', root);
console.log('Proof:', JSON.stringify(proof, null, 2));
console.log('Public Signals:', publicSignals);

// Verify the proof
const isValid = await zkMerkle.verifyProof(proof, publicSignals, depth);
console.log(`Proof verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);
```

## Understanding Trusted Setup

### What is a Trusted Setup?

A trusted setup is a crucial security process that creates the cryptographic parameters needed for zero-knowledge proofs. It requires multiple participants to ensure no single party has access to the complete setup information.

### The Setup Process

The setup happens in two phases:
1. Phase 1 (Powers of Tau): General setup that can be reused
2. Phase 2: Circuit-specific setup for Merkle Tree operations

### Running a Setup Ceremony

#### Coordinator Role
```typescript
import { PowerOfTau } from '@zksdk/zk-merkle';

async function coordinatorSetup() {
  const ceremony = new PowerOfTau(15);  // For trees up to depth 15
  
  // 1. Initialize ceremony
  const ptauFile = await ceremony.initCeremony();
  
  // 2. Share ptauFile with first participant
  // Coordinator must send the file to Participant 1
  
  // 3. After receiving final contribution
  await ceremony.finalizeCeremony();
  
  // 4. Set up Merkle Tree circuit
  await ceremony.initPhase2('MerkleTreeProof');
  await ceremony.finalizeCircuit('MerkleTreeProof');
}
```

#### Participant Role
```typescript
async function participantContribution(ptauFile: string, participantNumber: number) {
  const ceremony = new PowerOfTau(15);
  
  // 1. Import the previous contribution
  await ceremony.importContribution(ptauFile);
  
  // 2. Add contribution
  const newPtau = await ceremony.contributePhase1(`Participant ${participantNumber}`);
  
  // 3. Send newPtau to next participant or back to coordinator
  // Participant must manually send the file to the next person
}
```

### File Exchange Process

1. Coordinator → Participant 1:
   - Sends initial `pot15_0000.ptau`

2. Participant 1 → Participant 2:
   - Contributes and sends `pot15_0001.ptau`

3. Participant 2 → Participant 3:
   - Contributes and sends `pot15_0002.ptau`

4. Final Participant → Coordinator:
   - Sends final contribution
   - Coordinator finalizes ceremony

## Directory Structure

```
📁 zkConfig/                # Configuration directory
├── 📁 ceremony/           
│   └── 📁 pot/           # Trusted setup files
├── 📁 circuits/          
│   ├── 📁 wasm/          # Circuit files
│   ├── 📁 zkey/          # Proving keys
│   └── 📁 verification/  # Verification keys
└── 📁 templates/         # Smart contract templates
```

## Usage Options

### 1. Testing Environment (Pre-built Setup)
```typescript
// Uses included test setup
const zkMerkle = new ZkMerkle();
```

### 2. Production Environment (Custom Setup)
```typescript
// Use your ceremony output
const zkMerkle = new ZkMerkle('./production-zkconfig');
```

### 3. Custom Configuration
```typescript
const zkMerkle = new ZkMerkle({
  baseDir: './my-setup',
  maxDepth: 20,
  circuits: {
    wasmDir: './my-circuits',
    zkeyDir: './my-keys',
    verificationDir: './my-verifiers'
  }
});
```

## Important Notes

1. **Testing vs Production**
   - Testing: Use built-in setup
   - Production: Create custom setup with multiple participants

2. **Tree Depth**
   - Default maximum: 15 (32,768 items)
   - Configurable through custom setup

3. **Security Considerations**
   - Multiple participants improve security
   - Each participant must keep their randomness secret
   - Coordinator should verify contributions

## Support

- [Documentation](https://docs.zksdk.io)
- [GitHub Issues](https://github.com/zkthings/zksdk/issues)

## License

MIT © [zkSDK Team](https://github.com/zksdk)
