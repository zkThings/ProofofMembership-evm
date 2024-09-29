import { groth16, Groth16Proof, zKey, powersOfTau } from 'snarkjs';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { createHash } from 'crypto';

// Promisify fs functions for better async/await handling
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

interface InputObject {
    [key: string]: unknown;
}

interface ProofResult {
    proof: Groth16Proof;
    publicSignals: string[];
}

class ZkMerkle {

    private static readonly FIELD_PRIME = BigInt(
        '21888242871839275222246405745257275088548364400416034343698204186575808495617'
    );

    /**
     * Hashes input data using SHA-256 and returns a numeric string within the field size.
     * @param data - The string data to hash.
     * @returns The numeric string representation of the hash.
     */

    private hashData(data: string): string {
        const hashHex = createHash('sha256').update(data).digest('hex');
        const hashBigInt = BigInt(`0x${hashHex}`);
        return (hashBigInt % ZkMerkle.FIELD_PRIME).toString();
    }

    /**
     * Generates a proof for the creation of a Merkle Tree.
     * @param inputObject - The input data for the Merkle Tree leaves.
     * @returns An object containing the proof and public signals.
     */

    async generateRootHash(inputObject: InputObject): Promise<ProofResult> {
        try {
            const leaves = Object.values(inputObject).map((item) =>
                this.hashData(String(item))
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
     * @param unhashedLeaf - The unhashed leaf to prove.
     * @returns An object containing the proof and public signals.
     */

    async generateProofOfLeaf(
        inputObject: InputObject,
        root: string,
        unhashedLeaf: string
    ): Promise<ProofResult> {
        try {
            const leaves = Object.values(inputObject).map((item) =>
                this.hashData(String(item))
            );

            const wasmPath = path.resolve(
                __dirname,
                'merkleTreeProof',
                'MerkleTreeProof.wasm'
            );
            const zkeyPath = path.resolve(
                __dirname,
                'merkleTreeProof',
                'MerkleTreeProof_final.zkey'
            );

            const leaf = this.hashData(unhashedLeaf);

            const { proof, publicSignals } = await groth16.fullProve(
                { leaves, root, leaf },
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
     * Verifies a proof against a verification key.
     * @param proof - The proof to verify.
     * @param publicSignals - The public signals associated with the proof.
     * @param verificationKeyPath - The path to the verification key JSON file.
     * @returns A boolean indicating whether the proof is valid.
     */

    async verifyProof(
        proof: Groth16Proof,
        publicSignals: string[],
        verificationKeyPath: string
    ): Promise<boolean> {
        try {
            const key = JSON.parse(await readFileAsync(verificationKeyPath, 'utf-8'));
            const isValid = await groth16.verify(key, publicSignals, proof);
            console.log('Proof verification result:', isValid);

            return isValid;
        } catch (error) {
            console.error('Error verifying proof:', error);
            throw error;
        }
    }

    /**
     * Exports a Solidity verifier contract for on-chain verification.
     * @param zkeyPath - The path to the .zkey file.
     * @param outputPath - The output file path for the generated Solidity contract.
     */

    async exportOnChainVerifier(zkeyPath: string, outputPath: string): Promise<void> {
        // Implementation commented out
    }

    /**
     * Generates the Powers of Tau file using snarkjs.
     * @param ptauOutputPath - The desired output path for the Powers of Tau file.
     * @param power - The power parameter (e.g., 12 for pot12_final.ptau).
     * @param entropy - Optional entropy string for randomness.
     */
    async generatePowersOfTau(ptauOutputPath: string, power: number = 12, entropy?: string): Promise<void> {
        try {
            // Step 1: Create a new accumulator
            await powersOfTau.newAccumulator('bn128', power, ptauOutputPath);

            // Step 2: Contribute to the Powers of Tau ceremony
            const tempPtauPath = ptauOutputPath.replace('.ptau', '_temp.ptau');
            await powersOfTau.contribute(
                ptauOutputPath,
                tempPtauPath,
                'First contribution',
                entropy || 'some random entropy'
            );

            // Replace the original ptau file with the contributed one
            fs.renameSync(tempPtauPath, ptauOutputPath);

            console.log('Powers of Tau ceremony completed. File generated at:', ptauOutputPath);
        } catch (error) {
            console.error('Error generating Powers of Tau file:', error);
            throw error;
        }
    }

    /**
     * Generates the .zkey file using snarkjs.
     * @param circuitR1csPath - The file path to the circuit's R1CS file.
     * @param ptauPath - The file path to the Powers of Tau file.
     * @param zkeyOutputPath - The desired output path for the generated .zkey file.
     * @param entropy - Optional entropy string for randomness.
     */
    
    async generateZKey(
        circuitR1csPath: string,
        ptauPath: string,
        zkeyOutputPath: string,
        entropy?: string
    ): Promise<void> {
        try {
            // Step 1: Generate a new zkey from the R1CS and ptau files
            await zKey.newZKey(circuitR1csPath, ptauPath, zkeyOutputPath);

            // Step 2: Contribute to the ceremony (optional but recommended)
            const zkeyTempPath = zkeyOutputPath.replace('.zkey', '_temp.zkey');
            await zKey.contribute(
                zkeyOutputPath,
                zkeyTempPath,
                'Contributor Name',
                entropy || 'some random entropy'
            );

            // Replace the original zkey with the contributed one
            fs.renameSync(zkeyTempPath, zkeyOutputPath);

            // Step 3: Export the verification key
            const vKeyPath = zkeyOutputPath.replace('.zkey', '_verification_key.json');
            await zKey.exportVerificationKey(zkeyOutputPath, vKeyPath);

            console.log('ZKey file and verification key generated.');
        } catch (error) {
            console.error('Error generating .zkey file:', error);
            throw error;
        }
    }
}

//@@@@  Example usage MAKE PROOFS AND TREES@@@@
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
        const treeVerificationKeyPath = path.resolve(__dirname, 'treeMaker', 'verification_key.json');
        const isTreeVerified = await zkMerkle.verifyProof(treeProof, treeSignals, treeVerificationKeyPath);
        if (!isTreeVerified) {
            console.error('Tree verification failed.');
            return;
        }

        // Generate proof for a specific leaf in the Merkle Tree
        const root = treeSignals[0]; // Assuming the root is the first public signal
        const { proof: leafProof, publicSignals: leafSignals } = await zkMerkle.generateProofOfLeaf(vcData, root,vcData.name);

        // Verify the leaf inclusion off-chain
        const leafVerificationKeyPath = path.resolve(__dirname, 'merkleTreeProof', 'verification_key.json');
        const isLeafVerified = await zkMerkle.verifyProof(leafProof, leafSignals, leafVerificationKeyPath);
        if (!isLeafVerified) {
            console.error('Leaf verification failed.');
            return;
        }

        console.log('All proofs verified successfully.');
    } catch (error) {
        console.error('An error occurred during the proof generation or verification process:', error);
    }
})();


// @@@ Example usage power of tau 
// (async () => {
//     const zkMerkle = new ZkMerkle();

//     // Define paths
//     const ptauPath = path.resolve(__dirname, 'pot12_final.ptau');
//     const circuitDir = path.resolve(__dirname, 'treeMaker');
//     const circuitName = 'Tree';
//     const circuitR1csPath = path.join(circuitDir, `${circuitName}.r1cs`);
//     const zkeyOutputPath = path.join(circuitDir, `${circuitName}_final.zkey`);

//     // Generate Powers of Tau file
//     await zkMerkle.generatePowersOfTau(ptauPath, 12, 'your secure entropy here');

//     // Generate .zkey file
//     await zkMerkle.generateZKey(circuitR1csPath, ptauPath, zkeyOutputPath, 'your secure entropy here');

//     // Now you have the .ptau and .zkey files needed for proof generation and verification
// })();
