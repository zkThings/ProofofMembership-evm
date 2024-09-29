import { ZkMerkle, InputObject } from './index';
import path from 'path';

async function main() {
    const zkMerkle = ZkMerkle.getInstance();

    const vcData: InputObject = {
        name: 'John Doe',
        age: 30,
        country: '392',
        test: '1',
    };

    try {
        // Generate proof for the tree creation
        const { proof: treeProof, publicSignals: treeSignals } = await zkMerkle.generateRootHash(vcData);

        // Verify the Merkle Tree creation off-chain
        const treeVerificationKeyPath = path.resolve(__dirname, '../treeMaker', 'verification_key.json');
        const isTreeVerified = await zkMerkle.verifyProof(treeProof, treeSignals, treeVerificationKeyPath);
        if (!isTreeVerified) {
            console.error('Tree verification failed.');
            return;
        }

        // Generate proof for a specific leaf in the Merkle Tree
        const root = treeSignals[0]; // Assuming the root is the first public signal
        const { proof: leafProof, publicSignals: leafSignals } = await zkMerkle.generateProofOfLeaf(vcData, root);

        // Verify the leaf inclusion off-chain
        const leafVerificationKeyPath = path.resolve(__dirname, '../merkleTreeProof', 'verification_key.json');
        const isLeafVerified = await zkMerkle.verifyProof(leafProof, leafSignals, leafVerificationKeyPath);
        if (!isLeafVerified) {
            console.error('Leaf verification failed.');
            return;
        }

        console.log('All proofs verified successfully.');

        // Export on-chain verifier (optional)
        // const zkeyPath = path.resolve(__dirname, '../treeMaker', 'Tree_final.zkey');
        // const templatePath = path.resolve(__dirname, '../treeMaker', 'verifier_groth16.sol.ejs');
        // const outputPath = path.resolve(__dirname, '../TreeVerifier.sol');
        // await zkMerkle.exportOnChainVerifier(zkeyPath, templatePath, outputPath);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

main().catch(console.error);
