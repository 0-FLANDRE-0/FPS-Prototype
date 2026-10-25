// Official Vudu FFP endpoints; interpolation/pupil/axial shadow are explicit tuning.
export const VUDU_OPTICS = Object.freeze({
 fieldWidthM:Object.freeze([31.2,5.09]),fieldDistanceM:91.44,
 magnification:Object.freeze([1,6]),eyeReliefM:Object.freeze([[.083,.100],[.082,.100]]),
 objectiveDiameterM:.024,ocularRadiusM:.0196604183,
 ocular:Object.freeze([0,.04033210855889871,0]),objective:Object.freeze([0,.04033210855889871,-.24894691887253503]),
 adsEyeReliefM:.090,zoomTravelSeconds:.4,zoomLaw:"log",focusFill:.62,focusLaw:"ln(m)/ln(6), tuning",eyePupilRadiusM:.0015,
 axialFadeM:.018,transmission:.92,vignette:.14,distortion:Object.freeze([.035,-.015]),chroma:.005,edgeBlur:.006,glare:2,opticalLookTuning:"vignette/distortion/chroma/edgeBlur/glare/glow are game tuning, not EOTECH data",
 targetCaps:Object.freeze({low:384,balanced:768,high:1024}),
 source:'https://www.eotechinc.com/products/eotech-vudu-1-6x24-ffp',checked:'2026-10-11',
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function opticalField(magnification){
 const m=clamp(magnification,1,6),t=(m-1)/5,[w1,w6]=VUDU_OPTICS.fieldWidthM,d=VUDU_OPTICS.fieldDistanceM;
 // Interpolate the tangent of apparent field; matches both official true-FOV
 // endpoints while keeping central angular magnification exactly m.
 const apparentTan=(w1+(6*w6-w1)*t)/(2*d),trueTan=apparentTan/m;
 return {magnification:m,trueTan,apparentTan,trueFovRad:2*Math.atan(trueTan),apparentFovRad:2*Math.atan(apparentTan),exitPupilDiameterM:VUDU_OPTICS.objectiveDiameterM/m,eyeReliefM:[.083-.001*t,.100]};
}
function circleOverlap(a,b,d){
 if(d>=a+b)return 0;if(d<=Math.abs(a-b))return Math.PI*Math.min(a,b)**2;
 const aa=clamp((d*d+a*a-b*b)/(2*d*a),-1,1),bb=clamp((d*d+b*b-a*a)/(2*d*b),-1,1);
 return a*a*Math.acos(aa)+b*b*Math.acos(bb)-.5*Math.sqrt(Math.max(0,(-d+a+b)*(d+a-b)*(d-a+b)*(d+a+b)));
}
export function genericEyeBox(spec,eye,magnification){
 const field=spec.field(magnification),[near,far]=field.eyeReliefM,axial=eye[2],lateral=Math.hypot(eye[0],eye[1]);
 const outside=Math.max(near-axial,axial-far,0),axialAperture=clamp(1-outside/spec.axialFadeM,0,1),pupil=spec.eyePupilRadiusM,exitRadius=field.exitPupilDiameterM/2;
 const coverage=axialAperture>0?circleOverlap(pupil*axialAperture,exitRadius,lateral)/(Math.PI*pupil*pupil):0;
 return {axialM:axial,lateralM:lateral,axialAperture,coverage,exitPupilDiameterM:field.exitPupilDiameterM,visible:axial>.01&&coverage>.001};
}
export const opticEyeBox=(eye,magnification)=>genericEyeBox({...VUDU_OPTICS,field:opticalField},eye,magnification);
export function stepOpticMagnification(item,axis,dt){
 if(!item)return 1;
 item.magnification=clamp((item.magnification??1)*Math.exp(clamp(axis||0,-1,1)*Math.log(6)*dt/VUDU_OPTICS.zoomTravelSeconds),1,6);
 return item.magnification;
}
