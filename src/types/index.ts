// Project-specific interfaces
export interface SetupConfig {
    powersOfTauSize?: number;
    numIterationsExp?: number;
    name?: string;
}

export interface SetupResult {
    verificationKey: string;
    solidityVerifier: string;
    zkeyPath: string;
    wasmPath: string;
}

export interface ProofResult {
    proof: any;
    publicSignals: string[];
    root: string;
}

export interface Groth16Proof {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
}