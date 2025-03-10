import { zeroPoint } from "./Lcom"

export interface IElectronAPI {

    getSerialPorts: () => Promise<string[]>,

    testComms: (
        port:   string,
        baud:   number,
        unitId: number
    ) => Promise<boolean>,

    prepareProbe: (
        options: {zero?: 0|1, slope?: 0|1|2|3|4} = {zero: 0, slope: 3}
    ) => Promise<boolean>,

    getADC: () => number,

    confirmZeroPoint: () => Promise<void>,
    confirmSlope: () => Promise<void>,

    getPh: () => number,
}

declare global {
    interface Window {
        electronAPI: IElectronAPI
    }
}