# @zkthings/proof-membership-evm

Zero-Knowledge Merkle Trees implementation using circom circuits and snarkjs, designed for EVM chains.

> 🚀 Part of the zkSDK ecosystem - Simplified ZK development

⚠️ **Early Stage Project**: This package is under active development. APIs may change as we improve the implementation.

🔗 **Need Mina Integration?** Check out our Mina Protocol implementation at [zkSDK.io](https://zksdk.io)

## Features

- 🌳 ZK Merkle Tree with native EVM integration
- 🌲 Fast off-chain proof generation
- 🎋 On-chain verification
- 🌴 Custom trusted setup support
- 📦 Built on circom & snarkjs

## Installation

```bash
bun add @zkthings/proof-membership-evm
# or
npm install @zkthings/proof-membership-evm
```

## Quick Start

```typescript
import { ZkMerkleTree } from '@zkthings/proof-membership-evm'

// Create a new ZK Merkle Tree
const zkMerkle = new ZkMerkleTree();

// Add data and generate proof
const values = [‘Dragon Tree’, ‘Olive’ , ‘Linden’]

const { proof, publicSignals } = await zkMerkle.generateMerkleProof(
  values,
  'Olive'
);

// Verify off-chain (for testing)
const isValidOffChain = await zkMerkle.verifyProofOffChain(proof, publicSignals);

// Export and deploy verifier contract
const verifierContract = await zkMerkle.exportVerifierContract();
```

## Production Usage

### Trusted Setup

```typescript
import { PowerOfTau } from '@zkthings/proof-membership-evm'

// Initialize ceremony
const ceremony = new PowerOfTau(15);  // For trees up to depth 15
const ptauFile = await ceremony.initCeremony();

// Generate production parameters
await ceremony.finalizeCeremony();
await ceremony.finalizeCircuit('MerkleTreeProof');
```

### Production Deployment
```typescript
// Use custom ceremony output
const zkMerkle = new ZkMerkleTree({
  baseDir: './production-zkconfig',
});

// Deploy verifier contract
const verifierContract = await zkMerkle.exportVerifierContract();
```

## Architecture

```
📦 @zkthings/proof-membership-evm
├── core/             # Core Merkle Tree implementation
├── circuits/         # Circom circuit definitions
├── contracts/        # Solidity verifier contracts
└── ceremony/         # Trusted setup utilities
```

## Best Practices

### Local Development
```typescript
// Fast local testing
const zkMerkle = new ZkMerkleTree();
const isValid = await zkMerkle.verifyProofOffChain(proof, publicSignals);
```

### Production Setup
```typescript
// Secure production configuration
const zkMerkle = new ZkMerkleTree({
  baseDir: './production-zkconfig',
});
```

## Security Considerations

1. **Trusted Setup**
   - Multiple participants required
   - Secure randomness for contributions
   - Verify ceremony completion

2. **Contract Deployment**
   - Audit generated verifier
   - Test thoroughly on testnet
   - Monitor gas costs


## Contributing

PRs welcome! Check our [Contributing Guide](CONTRIBUTING.md).

## Support

- [Documentation](https://zksdk.io)
- [GitHub Issues](https://github.com/zkthings/proofmembership-evm/issues)

## License

MIT © [zkThings](https://github.com/zkthings)
