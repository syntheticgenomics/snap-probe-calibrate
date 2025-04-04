import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import ModbusRTU from 'modbus-serial';
import { baudRates, calSol, zeroPoint } from './Lcom';
import { scheduler } from 'node:timers/promises';
import { ReadRegisterResult } from 'modbus-serial/ModbusRTU';
// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const comms = {
    port: null as string,
    baud: 19200,
    unitId: 104
}

const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    ipcMain.handle('get-serial-ports', getSerialPorts);
    ipcMain.handle('test-comms', testComms);
    ipcMain.handle('prepare-probe', prepareProbe);
    ipcMain.handle('get-ADC', getADC);
    ipcMain.handle('confirm-zero',  confirmZeroPoint);
    ipcMain.handle('confirm-slope', confirmSlope);
    ipcMain.handle('get-pH', getPh);
    createWindow();
});


app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

async function getSerialPorts(): Promise<string[]> {
    // return ['a','/dev/tty.usbserial5', 'b']
    console.log('getting serial ports')
    const serialPorts = (await ModbusRTU.getPorts())
        .filter(pi => !!pi?.path)
        .map(pi => pi.path);
    if (null == comms.port) {
        comms.port = serialPorts.find(p => 
            p.startsWith('COM') ||
            p.startsWith('/dev/tty.usbserial') ||
            p.startsWith('/dev/ttySC'))
    }
    return serialPorts;
}

async function testComms(
    event: IpcMainInvokeEvent,
    port:   string,
    baud:   number,
    unitId: number
): Promise<boolean> {
    console.debug({port, baud, unitId})
    let client: ModbusRTU;
    try {
        client = new ModbusRTU();
        await client.connectRTUBuffered(port, {
            baudRate: baud,
            parity: 'none'
        });
        client.setTimeout(500);
        client.setID(unitId);

        let result = await client.readHoldingRegisters(0x0019, 1);
        let foundId = result.buffer.readUint16BE(0);
            result = await client.readHoldingRegisters(0x001A, 1);
        let foundBaud = baudRates[result.buffer.readUint16BE(0)];

        console.debug(`found unitId ${foundId}, baud ${foundBaud}`);

        const success =  unitId === foundId && baud === foundBaud;

        if (success) {
            comms.port   = port;
            comms.baud   = baud;
            comms.unitId = unitId;
        }

        return success;

    } catch (err) {
        console.error('testing comms', err);
    } finally {
        try {client?.close()} catch (ignore) {}
    }
    return false;
}

async function prepareProbe(
    event: IpcMainInvokeEvent,
    options: {zero?: 0|1, slope?: 0|1|2|3|4} = {zero: 0, slope: 3}
): Promise<boolean> {

    const zero  = options?.zero  ?? 0;
    const slope = options?.slope ?? 3;
    let client: ModbusRTU;

    try {
        let ztxt = zeroPoint[zero];
        let stxt = calSol[slope];

        if (null == ztxt || null == stxt) {
            throw new Error(`bad zero point (${zero} or slope (${slope}))`);
        }

        client = new ModbusRTU();
        await client.connectRTUBuffered(comms.port, {
            baudRate: comms.baud,
            parity: 'none'
        });
        client.setTimeout(500);
        client.setID(comms.unitId);

        console.log(`writing calibration values ${zero} and ${slope}`);

        await client.writeRegister(0x36, zero);
        await scheduler.wait(100);
        await client.writeRegister(0x38, slope);

        console.log('reading the values back');
        await scheduler.wait(100);
        let z = (await client.readHoldingRegisters(0x36, 1)).buffer.readUInt16BE();
        await scheduler.wait(100);
        let s = (await client.readHoldingRegisters(0x38, 1)).buffer.readUInt16BE();
        console.log(`Success prepping probe with zero point ${zeroPoint[z]} and slope ${calSol[s]}`);

        return true;

    } catch (err) {
        console.error('prepping probe', err);
    } finally {
        try {client?.close()} catch (ignore) {}
    }

    console.log(`Failure prepping probe`);

    return false;
}

async function getADC(): Promise<number> {

    let client: ModbusRTU;
    try {
        client = new ModbusRTU();
        await client.connectRTUBuffered(comms.port, {
            baudRate: comms.baud,
            parity: 'none'
        });
        client.setTimeout(500);
        client.setID(comms.unitId);

        let result = await client.readHoldingRegisters(0x0066, 1);
        let adc    = result.buffer.readUint16BE(0);

        console.log(`read ADC ${adc}`);
        return adc;

    } catch (err) {
        console.error(err);
        throw err;
    } finally {
        try {client?.close()} catch (ignore) {}
    }
}

async function getPh(): Promise<number> {

    let client: ModbusRTU;
    try {
        client = new ModbusRTU();
        await client.connectRTUBuffered(comms.port, {
            baudRate: comms.baud,
            parity: 'none'
        });
        client.setTimeout(500);
        client.setID(comms.unitId);

        let result = await client.readHoldingRegisters(0x0001, 2);
        let pH     = toFloat(result, 0);

        console.log(`read pH ${pH}`);
        return pH;

    } catch (err) {
        console.error(err);
        throw err;
    } finally {
        try {client?.close()} catch (ignore) {}
    }
}

async function confirmZeroPoint(): Promise<void> {
    await confirmADC(0x3E);
    console.log('confirmed zero point');
}

async function confirmSlope(): Promise<void> {
    await confirmADC(0x3F);
    console.log('confirmed slope');
}

async function confirmADC(address: 0x3E | 0x3F): Promise<void> {

    let client: ModbusRTU;
    try {
        client = new ModbusRTU();
        await client.connectRTUBuffered(comms.port, {
            baudRate: comms.baud,
            parity: 'none'
        });
        client.setTimeout(500);
        client.setID(comms.unitId);

        await client.writeRegister(address, 0xFF);

    } catch (err) {
        console.error(err);
        throw err;
    } finally {
        try {client?.close()} catch (ignore) {}
    }
}

function toFloat(result: ReadRegisterResult, offset: number=0):number {
    if (result.buffer.length < offset+4) {
        throw new RangeError(`can't read 4 bytes from offset ${offset} of buffer with length ${result.buffer.length}`)
    }
    const buff = Buffer.alloc(4);
    buff.writeUInt16BE(result.buffer.readUint16BE(offset+2), 0);
    buff.writeUInt16BE(result.buffer.readUint16BE(offset),   2);

    return buff.readFloatBE(0);
}