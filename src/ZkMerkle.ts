import { groth16, Groth16Proof, zKey, powersOfTau } from 'snarkjs';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { createHash } from 'crypto';

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

interface InputObject {
    [key: string]: unknown;
}

interface ProofResult {
    proof: Groth16Proof;
    publicSignals: string[];
}

export default class ZkMerkle {
    private static readonly FIELD_PRIME = BigInt(
        '21888242871839275222246405745257275088548364400416034343698204186575808495617'
    );

    private hashData(data: string): string {
        const hashHex = createHash('sha256').update(data).digest('hex');
        const hashBigInt = BigInt(`0x${hashHex}`);
        return (hashBigInt % ZkMerkle.FIELD_PRIME).toString();
    }

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

    async exportOnChainVerifier(zkeyPath: string, outputPath: string): Promise<void> {
        // Implementation commented out for brevity
    }
}