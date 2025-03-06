

export const baudRates = [2400, 4800, 9600, 19200, 38400] as const;
// baud code is the index. e.g. 19200 -> 3

export const measureMode = ['pH', 'ORP'] as const;
export const zeroPoint   = ['7.00', '6.86'] as const;
export const calSol      = ['1.68', '4.01', '9.18', '10.1', '12.45'] as const;
