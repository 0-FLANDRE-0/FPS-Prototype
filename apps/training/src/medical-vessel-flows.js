// Resting flow measurements retain their study population/site. Mapping to the
// fitted game segments and free-outflow multiplier are explicitly game tuning.
export const VESSEL_FLOW_POLICY=Object.freeze({ruleId:'vessel-flow-mo3',freeOutflowMultiplier:6,referenceOutputMlMin:5250,
 classification:'출처 정상 혈류 / 매핑·추정·k=6 튜닝; 인체 완전손상 사망 시간에 검증된 배율 아님',
 sources:{femoral:{mlMin:284,doi:'10.1016/S0301-5629(98)00103-3',pages:'1079–1086',locator:'Abstract; common femoral284±21, popliteal72±5; healthy40subjects'},popliteal:{mlMin:72,doi:'10.1016/S0301-5629(98)00103-3',pages:'1079–1086',locator:'Abstract'},carotid:{mlMin:465,doi:'10.1002/jmri.1880040110',pages:'37–42',locator:'Abstract; common carotid465±52'},subclavian:{mlMin:192.9,doi:'10.1152/japplphysiol.00710.2001',pages:'685–691',locator:'Table3; control/right subclavian; exact table page not verified'},brachial:{mlMin:28,doi:'10.1113/jphysiol.2003.059717',pages:'1001–1011',locator:'Abstract; baseline25/30/29 before three infusions;28 arithmetic mean, mapping estimate'},subclavianVein:{mlMin:275,doi:'10.1001/archsurg.138.9.996',pages:'996–1000',locator:'flow table, supine baseline275(SEM50); exact table page not verified'}},
 kEvidence:{doi:'10.3390/diagnostics13040732',locator:'Case3; femoral gunshot16:45, death registered17:05; not a controlled free-flow calibration',status:'Public case chronology only; no verified k or controlled complete-transection survival range. k6 is unsupported game tuning; retained300s arrest-to-death delay prevents clinical death-time fitting.'}});
export function vesselFlowSpec(h){
 const raw=h.id||'',id=raw.replace(/^(left|right)-/,'').replace(/-proximal$/,''),vein=h.vesselKind==='vein',p=VESSEL_FLOW_POLICY,diameterMm=(h.diameterM||.004)*1000;let mlMin,classification,source;
 if(id==='carotid'){mlMin=p.sources.carotid.mlMin;source='carotid';classification='출처 측정값; game common-carotid mapping';}
 else if(id==='subclavian'){mlMin=p.sources.subclavian.mlMin;source='subclavian';classification='출처 측정값; population/site mapping tuning';}
 else if(id==='subclavian-vein'){mlMin=p.sources.subclavianVein.mlMin;source='subclavianVein';classification='출처 측정값; posture/site mapping tuning';}
 else if(id==='brachial'){mlMin=p.sources.brachial.mlMin;source='brachial';classification='튜닝 추정: sourced forearm baseline arithmetic mean; fitted brachial segment';}
 else if(id==='femoral'){mlMin=p.sources.femoral.mlMin;source='femoral';classification='출처 common-femoral resting measurement';}
 else if(id==='popliteal'||id==='popliteal-vein'){mlMin=p.sources.popliteal.mlMin;source='popliteal';classification=vein?'튜닝 추정: paired artery resting flow':'출처 popliteal resting measurement; proximal/distal same-vessel cap';}
 else if(id==='jugular'){mlMin=p.sources.carotid.mlMin;source='carotid';classification='튜닝 추정: paired carotid territory return, not a jugular measurement';}
 else if(id==='femoral-vein'){mlMin=p.sources.femoral.mlMin;source='femoral';classification='튜닝 추정: paired femoral territory return';}
 else if(id==='brachial-vein'){mlMin=p.sources.brachial.mlMin;source='brachial';classification='튜닝 추정: paired brachial flow';}
 else if(/axillary/.test(id)){mlMin=p.sources.subclavian.mlMin*(diameterMm/10)**2;source='subclavian';classification='튜닝 추정: fitted diameter² vs10mm subclavian reference';}
 else if(/radial|ulnar/.test(id)){mlMin=p.sources.brachial.mlMin*(diameterMm/6)**2;source='brachial';classification='튜닝 추정: fitted diameter² vs6mm brachial reference';}
 else if(/iliac/.test(id)){mlMin=p.sources.femoral.mlMin*(diameterMm/8)**2;source='femoral';classification='튜닝 추정: fitted diameter² vs8mm common-femoral reference';}
 else if(/aorta/.test(id)){mlMin=p.referenceOutputMlMin;source='S1';classification='원본 S1 resting cardiac output; central aortic segment';}
 else if(/vena-cava/.test(id)){mlMin=p.referenceOutputMlMin*(id.startsWith('abdominal')?.65:1);source='S1';classification='튜닝 추정: fitted central return; abdominal65%CO / thoracic merged return100%CO';}
 else if(id==='hepatic-vein-trunk'||id==='portal-vein'){mlMin=p.referenceOutputMlMin*(id==='portal-vein'?.20:.25);source='B1c';classification='원본 B1c territory fractions, not new patient-specific measurements';}
 else{mlMin=Math.min(p.referenceOutputMlMin,p.sources.femoral.mlMin*(diameterMm/8)**2);source='femoral';classification='튜닝 추정: unverified vessel, fitted diameter² vs8mm femoral reference';}
 return{normalFlowMlMin:mlMin,multiplier:p.freeOutflowMultiplier,capMlPerS:mlMin/60*p.freeOutflowMultiplier,source,classification,canonicalId:raw.replace(/-proximal$/,'')};
}
