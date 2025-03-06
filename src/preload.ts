// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
    getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
    testComms:(ports: string, baud: number, unitId: number) => ipcRenderer.invoke('test-comms', ports, baud, unitId),
    prepareProbe:(options: {zero?: 0|1, slope?: 0|1|2|3|4} = {zero: 0, slope: 3}) => ipcRenderer.invoke('prepare-probe', options),
    getADC: () => ipcRenderer.invoke('get-ADC'),
    confirmZeroPoint: () => ipcRenderer.invoke('confirm-zero'),
    confirmSlope: () => ipcRenderer.invoke('confirm-slope')
})