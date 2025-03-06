/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/latest/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.scss';
import * as bootstrap from 'bootstrap';

console.log('👋 This message is being logged by "renderer.js", included via webpack');

const serialPort   = document.getElementById('serialPort') as HTMLSelectElement;
const baudSel      = document.getElementById('baudRate') as HTMLSelectElement;
const mobusIdInput = document.getElementById('modbusId') as HTMLInputElement;
const carouselDiv  = document.getElementById('calibrationCarousel') as HTMLDivElement;
const carousel     = new bootstrap.Carousel(carouselDiv, {wrap: false});
const testCommsBtn = document.getElementById('testCommsBtn') as HTMLButtonElement;
const refreshPorts = document.getElementById('refreshPorts') as HTMLElement;
const successToast = bootstrap.Toast.getOrCreateInstance('#successToast', {delay: 4000});
const failToast    = bootstrap.Toast.getOrCreateInstance('#failToast', {delay: 4000});
const commFailToast= bootstrap.Toast.getOrCreateInstance('#commsFailToast', {delay: 4000});
const neutralVal    = document.getElementById('neutralValue');
const basicVal      = document.getElementById('basicValue');
const timerBtn      = document.getElementById('timerBtn') as HTMLElement;
const timeTxtSpan   = document.getElementById('timeRemaining') as HTMLDivElement;

const STEP_PREPARE = 0;
const STEP_CONNECT = 1;
const STEP_NEUTRAL = 2;
const STEP_BASIC   = 3;
const STEP_DONE    = 4;

let targetTime:     number;
let timerId:        number;
let neutralTimerId: number;
let basicTimerId:   number;

// initialize any popovers
const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
[...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));

function startTimer() {
    if (null != timerId) {
        clearInterval(timerId);
    }
    timerBtn.classList.remove('play-icon');
    timerBtn.classList.add('stop-icon');
    targetTime = Date.now() + 10 * 60 * 1000;
    window.setTimeout(() => {
        console.log(`starting timer`);
        timerId = window.setInterval(() => {
            let timeTxt = '00:00'
            const diff = targetTime - Date.now();
            if (diff > 0) {
                let mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                let secs = Math.floor((diff % (1000 * 60)) / 1000);

                timeTxt = mins.toFixed().padStart(2, '0') + ':' + secs.toFixed().padStart(2, '0');
            } else {
                // TODO; beep
            }

            timeTxtSpan.innerText = timeTxt;

        }, 1000);
    }, 250);
}

function stopTimer() {
    if (null != timerId) {
        console.log(`stopping timer`);
        clearInterval(timerId);
    }
    timerBtn.classList.remove('stop-icon');
    timerBtn.classList.add('play-icon');
    timeTxtSpan.innerText = '10:00';
}

timerBtn.onclick = (e: MouseEvent) => {
    if (timerBtn.classList.contains('play-icon')) {
        startTimer();
    } else {
        stopTimer();
    }
}

async function updateNeutralAdcValue() {
    try {
        const adc = await window.electronAPI.getADC();
        neutralVal.innerText = adc.toFixed();
    } catch (err) {
        commFailToast.show();
    }
}

async function updateBasicAdcValue() {
    try {
        const adc = await window.electronAPI.getADC();
        neutralVal.innerText = adc.toFixed();
    } catch (err) {
        commFailToast.show();
    }
}

// Take certain actions when switching between slides
carouselDiv.addEventListener('slide.bs.carousel', (async (event: bootstrap.Carousel.Event) => {
    const from = event.from;
    const to   = event.to;
    console.log(`from ${from} to ${to}`);

    if (from === STEP_PREPARE) {
        stopTimer();
    }

    if (to === STEP_NEUTRAL) {
        // starting calibration, write the start and slope values (pH 7 & pH 10) to the probe
        console.log(`preparing probe`);
        if (!await window.electronAPI.prepareProbe()) {
            commFailToast.show();
        }

        console.log(`starting neutral ADC reads`);
        neutralTimerId = window.setInterval(updateNeutralAdcValue, 5000);
    }

    if (from === STEP_NEUTRAL) {
        if (null != neutralTimerId) {
            console.log(`cancelling neutral ACD reads`);
            window.clearInterval(neutralTimerId);
        }
    }

    if (to === STEP_BASIC) {

        if (from == STEP_NEUTRAL) {
            console.log(`confirming zero point`);
            try {await window.electronAPI.confirmZeroPoint();} catch(err) {
                commFailToast.show();
            }
        }

        console.log(`starting basic ADC reads`);
        basicTimerId = window.setInterval(updateBasicAdcValue, 5000);
    }

    if (from === STEP_BASIC) {
        if (null != basicTimerId) {
            console.log(`cancelling basic ACD reads`);
            window.clearInterval(basicTimerId);
        }
    }

    if (to === STEP_DONE) {
        console.log(`confirming slope`);
        try {await window.electronAPI.confirmSlope();} catch(err) {
            commFailToast.show();
        }
    }
}) as unknown as EventListener);

// load the known usb ports.
setTimeout(reloadSerialPorts);

refreshPorts.onclick = (e: MouseEvent) => reloadSerialPorts();

async function reloadSerialPorts(): Promise<void> {
    const serialPorts: string[] = await window.electronAPI.getSerialPorts();
    const defaultPort = serialPorts.find(p => p.startsWith('/dev/tty.usbserial') || p.startsWith('/dev/ttySC')) ?? '/dev/ttySC0';

    if (serialPorts?.length) {
        while(serialPort.length) {
            serialPort.remove(serialPort.length -1);
        }
    }

    serialPorts?.forEach(p => serialPort.add(new Option(p, p, false, p === defaultPort)))
}

testCommsBtn.onclick = async (e: MouseEvent) => {
    testCommsBtn.disabled = true;
    try {
        console.log('sending',serialPort.value, baudSel.value, mobusIdInput.value)
        if (await window.electronAPI.testComms(
                serialPort.value,
                parseInt(baudSel.value),
                parseInt(mobusIdInput.value))
        ) {
            successToast.show();
        } else {
            failToast.show();
        }
    } catch (err) {
        console.error(err);
        failToast.show();
    } finally {
        testCommsBtn.disabled = false;
    }
}
