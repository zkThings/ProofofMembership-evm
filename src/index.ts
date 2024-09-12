import { groth16, Groth16Proof, zKey } from 'snarkjs';
import path from 'path';
import fs from 'fs';

interface ZkOptions {}

interface InputObject {
    [key: string]: any;
}

interface ProofResult {
    proof: Groth16Proof;
    publicSignals: string[];
}

class ZkMerkle {
    private readonly TREE_DIR = 'treeMaker';
    private readonly PROOF_DIR = 'merekleTreeProof';

    // Helper function to convert a string to a numeric hash
    private nameToNumber(data: string): number {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = hash * 31 + data.charCodeAt(i);
        }
        return hash;
    }

    // Helper function to read JSON files
    private readJsonFile(filePath: string): any {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }

    // Generate proof based on input data and paths to wasm/zkey files
    private async generateGroth16Proof(input: any, wasmPath: string, zkeyPath: string): Promise<ProofResult> {
        const { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zkeyPath);
        return { proof, publicSignals };
    }

    // Main function to generate Merkle tree creation proof
    async generateRootHash(inputObject: InputObject): Promise<ProofResult> {
        const leaves = Object.values(inputObject).map(item =>
            typeof item === 'string' ? this.nameToNumber(item).toString() : item
        );

        const wasmPath = path.resolve(__dirname, this.TREE_DIR, 'Tree.wasm');
        const zkeyPath = path.resolve(__dirname, this.TREE_DIR, 'Tree_final.zkey');

        return this.generateGroth16Proof({ leaves }, wasmPath, zkeyPath);
    }

    // Generate proof for verifying a specific leaf in the Merkle tree
    async generateProofOfLeaf(inputObject: InputObject, root: string, leaf: string): Promise<ProofResult> {
        const leaves = Object.values(inputObject).map(item =>
            typeof item === 'string' ? this.nameToNumber(item).toString() : item
        );

        const wasmPath = path.resolve(__dirname, this.PROOF_DIR, 'MerkleTreeProof.wasm');
        const zkeyPath = path.resolve(__dirname, this.PROOF_DIR, 'MerkleTreeProof_final.zkey');

        const input = { leaves, root, leaf };
        return this.generateGroth16Proof(input, wasmPath, zkeyPath);
    }

    // Verify the proof off-chain
    async verifyProof(proof: Groth16Proof, publicSignals: string[], verificationKeyPath: string): Promise<boolean> {
        const key = this.readJsonFile(verificationKeyPath);
        return groth16.verify(key, publicSignals, proof);
    }

    // Verify the Merkle tree creation proof off-chain
    async verifyTreeCreation(proof: Groth16Proof, publicSignals: string[]): Promise<boolean> {
        const verificationFile = path.resolve(__dirname, this.TREE_DIR, 'verification_key.json');
        const isValid = await this.verifyProof(proof, publicSignals, verificationFile);
        console.log('Tree creation verified:', isValid);
        return isValid;
    }

    // Export Solidity verifier for on-chain use
    async exportOnChainVerifier(): Promise<void> {
        const zkeyPath = path.resolve(__dirname, this.TREE_DIR, 'Tree_final.zkey');
        const templatePath = path.resolve(__dirname, this.TREE_DIR, 'verifier_groth16.sol.ejs');
        const groth16Template = fs.readFileSync(templatePath, 'utf-8');

        const solidity = await zKey.exportSolidityVerifier(zkeyPath, { groth16: groth16Template }, console);
        fs.writeFileSync('TreeVerifier.sol', solidity, 'utf-8');
        console.log('Verifier contract generated.');
    }
}

// Example usage
const zksdk = new ZkMerkle();

const vcData = {
    name: 'John Doe',
    age: '30',
    country: '392',
    test: '1',
};

async function main() {
    try {
        // 1. Generate proof for Merkle Tree creation
        const { proof: treeProof, publicSignals: treeSignals } = await zksdk.generateRootHash(vcData);

        // 2. Verify Merkle Tree creation proof off-chain
        const isTreeVerified = await zksdk.verifyTreeCreation(treeProof, treeSignals);
        if (!isTreeVerified) {
            console.error('Tree verification failed.');
            return;
        }

        // 3. Generate proof for a specific leaf in the Merkle Tree
        const root = treeSignals[0]; // Assuming the root is the first public signal
        const { proof: leafProof, publicSignals: leafSignals } = await zksdk.generateProofOfLeaf(vcData, root, '50828');
console.log(leafSignals,leafProof);

        // (Optional) Verify the leaf proof off-chain if needed
        // const isLeafVerified = await zkObject.verifyProof(leafProof, leafSignals, 'path/to/leaf_verification_key.json');
        // console.log('Leaf proof verification:', isLeafVerified);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

main();
