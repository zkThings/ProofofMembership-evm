import { groth16, Groth16Proof, zKey } from 'snarkjs';
import path from 'path';
import fs from 'fs';

// Placeholder for ZkOptions
interface ZkOptions { }

interface InputObject {
    [key: string]: any;
}

interface ProofResult {
    proof: Groth16Proof;
    publicSignals: string[];
}

class ZkObject {
    // Convert names to numbers for hashing
    nameToNumber(data: string) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = hash * 31 + data.charCodeAt(i);
        }
        return hash;
    }

    // Generate a proof for the creation of a Merkle Tree
    async generateProof(inputObject: InputObject): Promise<ProofResult> {
        const parseInputObject = Object.values(inputObject).map(item =>
            typeof item == 'string' ? this.nameToNumber(item).toString() : item
        );
        const wasmPath = path.resolve(__dirname, 'treeMaker', 'Tree.wasm');
        const zkeyPath = path.resolve(__dirname, 'treeMaker', 'Tree_final.zkey');

        // Generate proof for creating Merkle Tree
        const { proof, publicSignals } = await groth16.fullProve(
            { leaves: parseInputObject },
            wasmPath,
            zkeyPath
        );
        console.log(publicSignals);

        return { proof, publicSignals };
    }

    // Generate proof for checking if a specific leaf is part of the Merkle tree
    async generateProofOfLeaf(inputObject: InputObject, root: string): Promise<ProofResult> {
        const parseInputObject = Object.values(inputObject).map(item =>
            typeof item == 'string' ? this.nameToNumber(item).toString() : item
        );

        const wasmPath = path.resolve(__dirname, 'merekleTreeProof', 'MerkleTreeProof.wasm');
        const zkeyPath = path.resolve(__dirname, 'merekleTreeProof', 'MerkleTreeProof_final.zkey');

        // Generate proof for a specific leaf in the tree
        const { proof, publicSignals } = await groth16.fullProve(
            { leaves: parseInputObject, root: root, leaf: '50828' },
            wasmPath,
            zkeyPath
        );

        console.log('PUB SUP',publicSignals);

        const verificationFile = path.resolve(__dirname, 'merekleTreeProof', 'verification_key.json');
        const key = JSON.parse(fs.readFileSync(verificationFile, 'utf-8'));

        const res = await groth16.verify(key, publicSignals, proof);

        console.log("verificaiton!!", res);

        return { proof, publicSignals };
    }

    // Verify the Merkle Tree creation proof off-chain
    async verifyTreeCreation(proof: Groth16Proof, publicSignals: string[]): Promise<boolean> {
        const verificationFile = path.resolve(__dirname, 'treeMaker', 'verification_key.json');
        const key = JSON.parse(fs.readFileSync(verificationFile, 'utf-8'));
        const res = await groth16.verify(key, publicSignals, proof);
        console.log('Tree creation verified:', res);
        return res;
    }

    // Export Solidity verifier for on-chain use
    async exportOnChainVerifier(): Promise<void> {
        const zkeyPath = path.resolve(__dirname, 'treeMaker', 'Tree_final.zkey');
        const templatePath = path.resolve(__dirname, 'treeMaker', 'verifier_groth16.sol.ejs');

        const groth16Template = fs.readFileSync(templatePath, 'utf-8');
        const templates = {
            groth16: groth16Template,
        };

        const solidity = await zKey.exportSolidityVerifier(zkeyPath, templates, console);
        fs.writeFileSync('TreeVerifier.sol', solidity, 'utf-8');
        console.log('Verifier contract generated.');
    }
}

// Example usage
const zkObject = new ZkObject();

const vcData = {
    name: 'John Doe',
    age: '30',
    country: '392',
    test: '1',
};

async function main() {
    // 1. Generate proof for the tree creation
    const { proof: treeProof, publicSignals: treeSignals } = await zkObject.generateProof(vcData);

    // 2. Verify the Merkle Tree creation off-chain
    // const isTreeVerified = await zkObject.verifyTreeCreation(treeProof, treeSignals);
    // if (!isTreeVerified) {
    //     console.log('Tree verification failed.');
    //     return;
    // }

    // 3. Generate proof for a specific leaf in the Merkle Tree
    const root = treeSignals[0]; // Assuming the root is the first public signal
    const { proof: leafProof, publicSignals: leafSignals } = await zkObject.generateProofOfLeaf(vcData, root);


}

main();
