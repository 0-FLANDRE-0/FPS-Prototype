export const RETINAL_VISION=Object.freeze({classification:'ρgh 원리/IOP 관찰값: 출처; 시야 문턱/기본 자세 높이: 튜닝',bloodDensityKgM3:1060,gravityMps2:9.81,paPerMmHg:133.322387415,intraocularPressureMmHg:14.1,standingEyeAboveHeartM:.35,crouchedEyeAboveHeartM:.28,tunnelRetinalPressureMmHg:[48,20],blackoutRetinalPressureMmHg:[28,10],tunnelDelivery:[.75,.35],blackoutDelivery:[.48,.20]});
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x);};
export function retinalVision(input,{eyeHeightM,crouched=false,lying=false}={}){
 const height=Number.isFinite(eyeHeightM)?eyeHeightM:lying?0:crouched?RETINAL_VISION.crouchedEyeAboveHeartM:RETINAL_VISION.standingEyeAboveHeartM;
 const hydrostaticMmHg=RETINAL_VISION.bloodDensityKgM3*RETINAL_VISION.gravityMps2*height/RETINAL_VISION.paPerMmHg,eyeMAP=input.map-hydrostaticMmHg,retinalPressureMmHg=Math.max(0,eyeMAP-RETINAL_VISION.intraocularPressureMmHg),delivery=Math.min(input.perfusion,input.oxygen);
 const pressureTunnel=smooth(...RETINAL_VISION.tunnelRetinalPressureMmHg,retinalPressureMmHg),pressureBlackout=smooth(...RETINAL_VISION.blackoutRetinalPressureMmHg,retinalPressureMmHg),deliveryTunnel=smooth(...RETINAL_VISION.tunnelDelivery,delivery),deliveryBlackout=smooth(...RETINAL_VISION.blackoutDelivery,delivery);
 return{eyeHeightM:height,hydrostaticMmHg,eyeMAP,retinalPressureMmHg,delivery,pressureTunnel,pressureBlackout,deliveryTunnel,deliveryBlackout,tunnel:Math.max(pressureTunnel,deliveryTunnel),blackout:Math.max(pressureBlackout,deliveryBlackout)};
}
