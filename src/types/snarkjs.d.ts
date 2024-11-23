declare module 'snarkjs' {
    export const groth16: {
        fullProve: (input: any, wasmFile: string, zkeyFileName: string) => Promise<{
            proof: any;
            publicSignals: string[];
        }>;
        verify: (vkey: any, publicSignals: string[], proof: any) => Promise<boolean>;
    };

    export const powersOfTau: {
        newAccumulator: (curve: any, power: number, ptauFilename: string) => Promise<void>;
        contribute: (oldPtauFilename: string, newPtauFilename: string, name: string, entropy: string) => Promise<void>;
        verify: (ptauFilename: string) => Promise<boolean>;
        preparePhase2: (oldPtauFilename: string, newPtauFilename: string) => Promise<void>;
    };

    export const zKey: {
        newZKey: (r1csFilename: string, ptauFilename: string, zkeyFilename: string) => Promise<void>;
        contribute: (oldZkeyFilename: string, newZkeyFilename: string, name: string, entropy: string) => Promise<void>;
        verifyFromInit: (r1csFilename: string, ptauFilename: string, zkeyFilename: string) => Promise<boolean>;
        beacon: (oldZkeyFilename: string, newZkeyFilename: string, name: string, beaconHash: string, numIterationsExp: number) => Promise<void>;
        exportVerificationKey: (zkeyFilename: string) => Promise<any>;
        exportSolidityVerifier: (zkeyPath: string, templates?: any) => Promise<string>;
    };
}