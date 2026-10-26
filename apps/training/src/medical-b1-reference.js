import{updateBleedingB1,ensureBleedingB1}from'./medical-b1.js';
import{preFlow}from'./medical-hemostasis.js';
import{copyLimbRoutingState}from'./medical-routing.js';
import{REFERENCE_CIRCULATION,hasReferenceFlow,freezeReferenceFlow}from'./medical-reference-flow.js';
// Evaluate the existing B1 engine at dt=0 in an isolated reference circulation.
// No live pressure, exercise, blood availability, CAT or treatment is copied.
export function captureReferenceFlows(unit){
 const live=unit.medical,newWounds=live.wounds.filter(w=>!hasReferenceFlow(w));if(!newWounds.length)return;
 const wounds=live.wounds.map(w=>{if(w.b1Registered)return{id:w.id,partKey:w.partKey,b1Registered:true,bleedingProfile:{...w.bleedingProfile}};const copy=structuredClone(w);delete copy.care;return copy;});
 const medical={wounds,bleedSources:structuredClone(live.bleedSources||[]),bodyParts:Object.fromEntries(Object.keys(live.bodyParts).map(k=>[k,{}])),bloodMl:live.bloodMax||5000,bloodMax:live.bloodMax||5000,hemodynamics:{map:REFERENCE_CIRCULATION.mapMmHg,cardiacOutputMul:1},cardiacArrest:false,isDead:false};
 ensureBleedingB1(medical);
 copyLimbRoutingState(live,medical);
 updateBleedingB1({medical,isMoving:false,beingDragged:false},0);
 for(const w of newWounds)freezeReferenceFlow(w,preFlow(medical,w));
}
