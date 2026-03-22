declare module 'fft-js' {
  export function fft(signal: ArrayLike<number>): Array<[number, number]>;
  export const util: {
    fftMag: (complex: Array<[number, number]>) => number[];
  };
}
