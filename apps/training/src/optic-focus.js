import {lensParameters} from './lens.js';
import {VUDU_OPTICS,opticalField} from './optic-optics.js';
import {ACOG_RENDER_PROFILE} from './optic-specs.js';
import {ACOG} from './optic-data.js';
const lerp=(a,b,t)=>(1-t)*a+t*b;
// Perceived focus is authored tuning. 0 focus/1x/no optic preserves the old camera.
export function opticFocus(settings,ads,aspect,definition,magnification){
 const m=definition?Math.min(6,Math.max(1,definition.fixedMag??magnification??1)):1;
 const focus=ads*settings.scopeFocus/100*Math.log(m)/Math.log(6),field=(definition?.id===ACOG.id?ACOG_RENDER_PROFILE.field:opticalField)(m),tangent=field.apparentTan/VUDU_OPTICS.focusFill,degrees=180/Math.PI;
 const original=settings.lensStrength>0?lensParameters(aspect,settings.lensStrength,settings.lensFov,ads):null;
 const lens=original&&focus>0?lensParameters(aspect,settings.lensStrength*(1-focus),lerp(settings.lensFov*(1-.2*ads),2*Math.atan(tangent*aspect)*degrees,focus)/(1-.2*ads),ads):original;
 const before=original?original.verticalFov:lerp(settings.fov,settings.fov-14,ads),verticalFov=lens?lens.verticalFov:lerp(before,2*Math.atan(tangent)*degrees,focus);
 return {lens,verticalFov,lookScale:Math.tan(verticalFov/degrees/2)/Math.tan(before/degrees/2),focus,magnification:m};
}
