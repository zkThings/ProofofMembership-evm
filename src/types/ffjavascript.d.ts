declare module 'ffjavascript' {
    export function buildBn128(): Promise<any>;
    export function getCurveFromName(name: string): Promise<any>;
}