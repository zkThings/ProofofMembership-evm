import { groth16, Groth16Proof, zKey } from 'snarkjs';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

// Promisify fs.readFile for better async/await handling
const readFileAsync = promisify(fs.readFile);

interface InputObject {
    [key: string]: any;
}

interface ProofResult {
    proof: Groth16Proof;
    publicSignals: string[];
}

class ZkMerkle {
    /**
     * Converts a string to a numerical hash using a simple hashing algorithm.
     * @param data - The string data to convert.
     * @returns The numerical hash of the input data
     * TO DO : ADD A BETTER HASHING FUNCTION.
     */
    private nameToNumber(data: string): number {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = (hash * 31 + data.charCodeAt(i)) >>> 0; // Use unsigned right shift for 32-bit integer
        }
        return hash;
    }

    /**
     * Generates a proof for the creation of a Merkle Tree.
     * @param inputObject - The input data for the Merkle Tree leaves.
     * @returns An object containing the proof and public signals.
     */
    async generateRootHash(inputObject: InputObject): Promise<ProofResult> {
        try {
            const leaves = Object.values(inputObject).map(item =>
                typeof item === 'string' ? this.nameToNumber(item).toString() : item.toString()
            );

            const wasmPath = path.resolve(__dirname, 'treeMaker', 'Tree.wasm');
            const zkeyPath = path.resolve(__dirname, 'treeMaker', 'Tree_final.zkey');

            const { proof, publicSignals } = await groth16.fullProve(
                { leaves },
                wasmPath,
                zkeyPath
            );

            return { proof, publicSignals };
        } catch (error) {
            console.error('Error generating root hash proof:', error);
            throw error;
        }
    }

    /**
     * Generates a proof for checking if a specific leaf is part of the Merkle Tree.
     * @param inputObject - The input data for the Merkle Tree leaves.
     * @param root - The root hash of the Merkle Tree.
     * @returns An object containing the proof and public signals.
     */
    async generateProofOfLeaf(inputObject: InputObject, root: string): Promise<ProofResult> {
        try {
            const leaves = Object.values(inputObject).map(item =>
                typeof item === 'string' ? this.nameToNumber(item).toString() : item.toString()
            );

            const wasmPath = path.resolve(__dirname, 'merkleTreeProof', 'MerkleTreeProof.wasm');
            const zkeyPath = path.resolve(__dirname, 'merkleTreeProof', 'MerkleTreeProof_final.zkey');

            const { proof, publicSignals } = await groth16.fullProve(
                { leaves, root, leaf: leaves[0] },
                wasmPath,
                zkeyPath
            );

            return { proof, publicSignals };
        } catch (error) {
            console.error('Error generating leaf proof:', error);
            throw error;
        }
    }

    /**
     * Verifies a Merkle Tree creation proof off-chain.
     * @param proof - The proof to verify.
     * @param publicSignals - The public signals associated with the proof.
     * @returns A boolean indicating whether the proof is valid.
     */
    async verifyTreeCreation(proof: Groth16Proof, publicSignals: string[]): Promise<boolean> {
        try {
            const verificationFile = path.resolve(__dirname, 'treeMaker', 'verification_key.json');
            const key = JSON.parse(await readFileAsync(verificationFile, 'utf-8'));

            const isValid = await groth16.verify(key, publicSignals, proof);
            console.log('Tree creation verified:', isValid);

            return isValid;
        } catch (error) {
            console.error('Error verifying tree creation proof:', error);
            throw error;
        }
    }

    /**
     * Verifies a leaf inclusion proof off-chain.
     * @param proof - The proof to verify.
     * @param publicSignals - The public signals associated with the proof.
     * @returns A boolean indicating whether the proof is valid.
     */
    async verifyLeaf(proof: Groth16Proof, publicSignals: string[]): Promise<boolean> {
        try {
            const verificationFile = path.resolve(__dirname, 'merkleTreeProof', 'verification_key.json');
            const key = JSON.parse(await readFileAsync(verificationFile, 'utf-8'));

            const isValid = await groth16.verify(key, publicSignals, proof);
            console.log('Leaf inclusion verified:', isValid);

            return isValid;
        } catch (error) {
            console.error('Error verifying leaf proof:', error);
            throw error;
        }
    }

    /**
     * Exports a Solidity verifier contract for on-chain verification.
     * @returns A promise that resolves when the verifier contract is generated.
     */
    async exportOnChainVerifier(): Promise<void> {
        try {
            const zkeyPath = path.resolve(__dirname, 'treeMaker', 'Tree_final.zkey');
            const templatePath = path.resolve(__dirname, 'treeMaker', 'verifier_groth16.sol.ejs');

            const groth16Template = await readFileAsync(templatePath, 'utf-8');
            const templates = { groth16: groth16Template };

            const solidity = await zKey.exportSolidityVerifier(zkeyPath, templates, console);
            fs.writeFileSync('TreeVerifier.sol', solidity, 'utf-8');
            console.log('Verifier contract generated.');
        } catch (error) {
            console.error('Error exporting on-chain verifier:', error);
            throw error;
        }
    }
}

// Example usage
(async () => {
    const zkMerkle = new ZkMerkle();

    const vcData = {
        name: 'John Doe',
        age: '30',
        country: '392',
        test: '1',
    };

    try {
        // Generate proof for the tree creation
        const { proof: treeProof, publicSignals: treeSignals } = await zkMerkle.generateRootHash(vcData);

        // Verify the Merkle Tree creation off-chain
        const isTreeVerified = await zkMerkle.verifyTreeCreation(treeProof, treeSignals);
        if (!isTreeVerified) {
            console.error('Tree verification failed.');
            return;
        }

        // Generate proof for a specific leaf in the Merkle Tree
        const root = treeSignals[0]; // Assuming the root is the first public signal
        const { proof: leafProof, publicSignals: leafSignals } = await zkMerkle.generateProofOfLeaf(vcData, root);

        // Verify the leaf inclusion off-chain
        const isLeafVerified = await zkMerkle.verifyLeaf(leafProof, leafSignals);
        if (!isLeafVerified) {
            console.error('Leaf verification failed.');
            return;
        }

        console.log('All proofs verified successfully.');
    } catch (error) {
        console.error('An error occurred during the proof generation or verification process:', error);
    }
})();
