declare module 'snarkjs' {
    export const powersOfTau: {
      newAccumulator: (curve: any, power: number, ptauFilename: string) => Promise<void>;
      contribute: (oldPtauFilename: string, newPtauFilename: string, name: string, entropy: Uint8Array) => Promise<void>;
      verify: (ptauFilename: string) => Promise<boolean>;
      preparePhase2: (oldPtauFilename: string, newPtauFilename: string) => Promise<void>;
    };
    export const zKey: {
      newZKey: (r1csFilename: string, ptauFilename: string, zkeyFilename: string) => Promise<void>;
      contribute: (oldZkeyFilename: string, newZkeyFilename: string, name: string, entropy: Uint8Array) => Promise<void>;
      verifyFromInit: (r1csFilename: string, ptauFilename: string, zkeyFilename: string) => Promise<boolean>;
      beacon: (oldZkeyFilename: string, newZkeyFilename: string, name: string, beaconHash: Uint8Array, numIterationsExp: number) => Promise<void>;
      exportVerificationKey: (zkeyFilename: string) => Promise<any>;
    };
  }
  
  declare module 'ffjavascript' {
    export function buildBn128(): Promise<any>;
  }