import {VUDU_OPTICS,opticalField,opticEyeBox,genericEyeBox} from './optic-optics.js';
import {sr3Fragment} from './optic-reticle.js';
import {acogReticleFragment} from './optic-acog-reticle.js';
export const VUDU_RENDER_PROFILE=Object.freeze({...VUDU_OPTICS,field:opticalField,eyeBox:opticEyeBox,reticle:sr3Fragment,glassName:'Glass_low_Glass_0',reticleName:'SR3 dimensioned inner BDC; outer speed ring deferred'});
const k=Math.tan(3.5*Math.PI/180);
const field=()=>({magnification:4,trueTan:k,apparentTan:4*k,trueFovRad:2*Math.atan(k),apparentFovRad:2*Math.atan(4*k),exitPupilDiameterM:.00813,eyeReliefM:[.0381,.0381]});
// Official TA31 7deg FOV, 8.13mm exit pupil and 38.1mm eye relief.
// 11.5mm ocular radius is model-derived. Axial fade, lens look and drawn proportions are tuning.
export const ACOG_RENDER_PROFILE=Object.freeze({...VUDU_OPTICS,fixedMag:4,ocularRadiusM:.0115,adsEyeReliefM:.0381,axialFadeM:.012,objectiveDiameterM:.032,distortion:Object.freeze([-.01,-.01]),chroma:.004,vignette:.18,reticle:acogReticleFragment,glassName:null,
 reticleName:'Trijicon 4x32 .223 Chevron BDC (TA31), official MOA dimension sheet, chevron tip zero 100 m',source:'https://www.trijicon.com/uploads/product-uploads/product-downloads/223_Chevron_Reticle_Dimensions4x32.pdf',
 tuning:'post/bar line 0.4 MOA, numeral size/position and illumination split read from sheet proportions; eyebox fade 12 mm game tuning',field,eyeBox:(eye,m)=>genericEyeBox(ACOG_RENDER_PROFILE,eye,m)});
