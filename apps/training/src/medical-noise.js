const smooth=x=>x*x*(3-2*x);
export function noiseKnot(i,seed){const x=Math.sin(i*127.1+seed*311.7)*43758.5453123;return(x-Math.floor(x))*2-1;}
export function medicalNoise(time,period,seed){const t=time/period,i=Math.floor(t),f=smooth(t-i);return noiseKnot(i,seed)*(1-f)+noiseKnot(i+1,seed)*f;}
// Three coherent octaves, variance-normalized to the old single-octave signal.
// Frequencies, weights and gain are presentation tuning, not clinical values.
export function medicalFractal(time,period,seed){return(medicalNoise(time,period,seed)+.42*medicalNoise(time,period/2,seed+19)+.18*medicalNoise(time,period/4,seed+41))/Math.hypot(1,.42,.18);}
