# @zksdk/merkle

Part of the zkSDK ecosystem - A unified toolkit for Zero Knowledge development.

## About zkSDK

zkSDK is an open-source initiative aimed at simplifying Zero Knowledge development through a collection of unified, developer-friendly tools. This package (@zksdk/merkle) provides Merkle tree functionality with ZK proofs integration.

## Installation

```bash
bun add @zksdk/merkle

or 

npm install @zksdk/merkle

```

## Quick Start

```typescript
import { ZkMerkle } from '@zksdk/merkle';

async function main() {
  const zkMerkle = new ZkMerkle();

  // Define your leaves
  const leaves = ['a', 'b', 'c', 'd', 'e'];
  const leafToProve = 'a';

  // Generate proof
  const { proof, publicSignals, root } = await zkMerkle.generateMerkleProof(leafToProve, leaves);
  
  // Verify proof
  const depth = Math.ceil(Math.log2(leaves.length));
  const isValid = await zkMerkle.verifyProof(proof, publicSignals, depth);
}
```

## Related zkSDK Packages

TBA 

## Contributing

zkSDK is an open-source initiative. We welcome contributions! Visit our [GitHub repository](https://github.com/zksdk/merkle) to get started.

## Documentation

For full documentation and examples, visit [docs.zksdk.org](https://docs.zksdk.org)

## License

MIT
```

This setup:
1. Places the package under the @zksdk organization
2. Positions it as part of a larger ecosystem
3. Maintains simple, clear documentation
4. Suggests a unified toolkit approach
5. Emphasizes the open-source nature

The installation would now be:
```bash
bun add @zksdk/merkle
```

And imports would be:
```typescript
import { ZkMerkle } from '@zksdk/merkle';
```
