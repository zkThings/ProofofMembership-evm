import { groth16, Groth16Proof, zKey } from 'snarkjs';
import path from 'path';
import fs from 'fs';

interface ZkOptions { }

interface InputObject {
    [key: string]: any;
}

interface ProofResult {
    proof: Groth16Proof;
    publicSignals: string[];
}

class ZkMerkle {
    // Convert names to numbers for hashing
    private nameToNumber(data: string): number {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = hash * 31 + data.charCodeAt(i);
        }
        return hash;
    }

    // Generate a proof for the creation of a Merkle Tree
    async generateRootHash(inputObject: InputObject): Promise<ProofResult> {
        const leaves = Object.values(inputObject).map(item =>
            typeof item === 'string' ? this.nameToNumber(item).toString() : item
        );

        const wasmPath = path.resolve(__dirname, 'treeMaker', 'Tree.wasm');
        const zkeyPath = path.resolve(__dirname, 'treeMaker', 'Tree_final.zkey');

        const { proof, publicSignals } = await groth16.fullProve(
            { leaves },
            wasmPath,
            zkeyPath
        );

        console.log(publicSignals);
        return { proof, publicSignals };
    }

    // Generate proof for checking if a specific leaf is part of the Merkle tree
    async generateProofOfLeaf(inputObject: InputObject, root: string): Promise<ProofResult> {
        const leaves = Object.values(inputObject).map(item =>
            typeof item === 'string' ? this.nameToNumber(item).toString() : item
        );

        const wasmPath = path.resolve(__dirname, 'merkleTreeProof', 'MerkleTreeProof.wasm');
        const zkeyPath = path.resolve(__dirname, 'merkleTreeProof', 'MerkleTreeProof_final.zkey');

        const { proof, publicSignals } = await groth16.fullProve(
            { leaves, root, leaf: leaves[0] },
            wasmPath,
            zkeyPath
        );

        console.log('Public Signals:', publicSignals);

        const verificationFile = path.resolve(__dirname, 'merkleTreeProof', 'verification_key.json');
        const key = JSON.parse(fs.readFileSync(verificationFile, 'utf-8'));


        const verificationResult = await groth16.verify(key, publicSignals, proof);
        console.log('Verification Result:', verificationResult);

        return { proof, publicSignals };
    }

    // Verify the Merkle Tree creation proof off-chain
    async verifyTreeCreation(proof: Groth16Proof, publicSignals: string[]): Promise<boolean> {
        const verificationFile = path.resolve(__dirname, 'treeMaker', 'verification_key.json');
        const key = JSON.parse(fs.readFileSync(verificationFile, 'utf-8'));

        const isValid = await groth16.verify(key, publicSignals, proof);
        console.log('Tree creation verified:', isValid);

        return isValid;
    }

    // Verify the Merkle Tree creation proof off-chain
    async verifyLeaf(proof: Groth16Proof, publicSignals: string[]): Promise<boolean> {
        const verificationFile = path.resolve(__dirname, 'merkleTreeProof', 'verification_key.json');
        const key = JSON.parse(fs.readFileSync(verificationFile, 'utf-8'));

        const isValid = await groth16.verify(key, publicSignals, proof);
        console.log('Tree creation verified:', isValid);

        return isValid;
    }

    // Export Solidity verifier for on-chain use
    async exportOnChainVerifier(): Promise<void> {
        const zkeyPath = path.resolve(__dirname, 'treeMaker', 'Tree_final.zkey');
        const templatePath = path.resolve(__dirname, 'treeMaker', 'verifier_groth16.sol.ejs');

        const groth16Template = fs.readFileSync(templatePath, 'utf-8');
        const templates = { groth16: groth16Template };

        const solidity = await zKey.exportSolidityVerifier(zkeyPath, templates, console);
        fs.writeFileSync('TreeVerifier.sol', solidity, 'utf-8');
        console.log('Verifier contract generated.');
    }
}

// Example usage
const zkMerkle = new ZkMerkle();

const vcData = {
    name: 'John Doe',
    age: '30',
    country: '392',
    test: '1',
};

async function main() {
    // 1. Generate proof for the tree creation
    const { proof: treeProof, publicSignals: treeSignals } = await zkMerkle.generateRootHash(vcData);

    // 2. Verify the Merkle Tree creation off-chain
    // const isTreeVerified = await zkMerkle.verifyTreeCreation(treeProof, treeSignals);
    // if (!isTreeVerified) {
    //     console.log('Tree verification failed.');
    //     return;
    // }

    // 3. Generate proof for a specific leaf in the Merkle Tree
    const root = treeSignals[0]; // Assuming the root is the first public signal

    const { proof: leafProof, publicSignals: leafSignals } = await zkMerkle.generateProofOfLeaf(vcData, root);
    
    // const proofLeaf = await  zkMerkle.verifyLeaf(leafProof,leafSignals)

    // console.log(proofLeaf);
    
}

main();
