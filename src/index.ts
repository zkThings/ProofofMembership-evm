import { groth16, Groth16Proof, zKey , powersOfTau } from 'snarkjs';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { createHash } from 'crypto';

// Promisify fs.readFile for better async/await handling
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

interface InputObject {
    [key: string]: any;
}

interface ProofResult {
    proof: Groth16Proof;
    publicSignals: string[];
}

class ZkMerkle {
    /**
     * Hashes input data using SHA-256 and returns a numeric string within the field size.
     * @param data - The string data to hash.
     * @returns The numeric string representation of the hash.
     */
    private hashData(data: string): string {
        const hashHex = createHash('sha256').update(data).digest('hex');
        const hashBigInt = BigInt('0x' + hashHex);
        // Ensure the hash fits within the field size of BN128 curve
        const fieldPrime = BigInt(
            '21888242871839275222246405745257275088548364400416034343698204186575808495617'
        );
        return (hashBigInt % fieldPrime).toString();
    }

    /**
     * Generates a proof for the creation of a Merkle Tree.
     * @param inputObject - The input data for the Merkle Tree leaves.
     * @returns An object containing the proof and public signals.
     */
    async generateRootHash(inputObject: InputObject): Promise<ProofResult> {
        try {
            const leaves = Object.values(inputObject).map(item =>
                this.hashData(item.toString())
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
    async generateProofOfLeaf(
        inputObject: InputObject,
        root: string,
        unhashedLeaf:string
    ): Promise<ProofResult> {
        try {
            const leaves = Object.values(inputObject).map(item =>
                this.hashData(item.toString())
            );

            const wasmPath = path.resolve(__dirname, 'merkleTreeProof', 'MerkleTreeProof.wasm');
            const zkeyPath = path.resolve(__dirname, 'merkleTreeProof', 'MerkleTreeProof_final.zkey');

            const leaf = this.hashData(unhashedLeaf) // Assuming we're proving the first leaf

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
        // try {
        //     const solidityCode = await zKey.exportSolidityVerifier(zkeyPath);
        //     await writeFileAsync(outputPath, solidityCode, 'utf-8');
        //     console.log('Verifier contract generated at:', outputPath);
        // } catch (error) {
        //     console.error('Error exporting on-chain verifier:', error);
        //     throw error;
        // }
    }
    /**
   * Performs the Powers of Tau ceremony and generates the final zkey.
   * This is a crucial step in setting up zk-SNARK parameters securely.
   * @param ptauName - Name for the Powers of Tau file.
   * @param circuitName - Name of the circuit.
   * @param entropy - Optional entropy for randomness.
   * @param numContributions - Number of contributions to the ceremony.
   */
  async performPowersOfTauCeremony(
    ptauName: string,
    circuitName: string,
    entropy?: string,
    numContributions = 10
  ): Promise<void> {
    try {
      const ptauPath = path.join(__dirname, `${ptauName}.ptau`);
      const circuitWasmPath = path.join(__dirname, `${circuitName}.wasm`);
      const circuitR1csPath = path.join(__dirname, `${circuitName}.r1cs`);
      const zkeyPath = path.join(__dirname, `${circuitName}_final.zkey`);

      // Start a new Powers of Tau ceremony
      await powersOfTau.start(12, ptauPath, console);

      // Contribute to the ceremony multiple times
      for (let i = 1; i <= numContributions; i++) {
        await powersOfTau.contribute(ptauPath, ptauPath, `Contribution ${i}`, entropy);
      }

      // Prepare for phase 2
      await powersOfTau.preparePhase2(ptauPath, ptauPath);

      // Generate the final zkey
      await zKey.newZKey(circuitR1csPath, ptauPath, zkeyPath);

      // Contribute to phase 2 of the ceremony
      const zkeyContributionPath = path.join(__dirname, `${circuitName}_contribution.zkey`);
      await zKey.contribute(zkeyPath, zkeyContributionPath, "Contributor's name", entropy);

      // Verify the final zkey
      const verificationKey = await zKey.exportVerificationKey(zkeyContributionPath);
      await writeFileAsync(
        path.join(__dirname, `${circuitName}_verification_key.json`),
        JSON.stringify(verificationKey),
        'utf8'
      );

      console.log('Powers of Tau ceremony completed and final zkey generated.');
    } catch (error) {
      console.error('Error during Powers of Tau ceremony:', error);
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
