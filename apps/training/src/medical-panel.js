import{drugSnapshot}from'./medical-care-drugs.js';
import {MEDICAL_S3_VALUES} from './medical-s3-effects.js';
import {MedicalFeedback} from './medical-feedback.js';
const partLabel={head:'머리',neck:'목',chest:'흉부',abdomen:'복부',leftArm:'왼팔',rightArm:'오른팔',leftLeg:'왼다리',rightLeg:'오른다리'};
const structureLabel={intact:'—',unusable:'사용 불능',comminuted:'분쇄',amputated:'절단',head_structure_destroyed:'머리 구조 파괴',neck_hp_depleted:'목 HP 소진',torso_destroyed:'몸통 구조 파괴',abdomen_destroyed:'복부 파괴 · 지속 통증'};
function node(tag,text){const e=document.createElement(tag);e.textContent=text;return e;}
export function renderMedicalPanel(bridge,container,{showInternals=false}={}){
  const m=bridge.actor.medical;
  container.replaceChildren(node('p',`혈액 ${m.bloodMl.toFixed(0)} / ${m.bloodMax} ml · 의식 ${m.consciousness.toFixed(1)} / 100`),
    node('p',`${bridge.actor.combatState} · lifeStatus ${m.lifeStatus.toFixed(1)} · ${m.statusTags.join(' · ')}`));
  container.append(node('p',`HR ${m.heartRate.toFixed(0)} · BP ${m.systolicBP.toFixed(0)}/${m.diastolicBP.toFixed(0)} · pain ${m.pain.toFixed(1)} · shock ${m.shock.toFixed(1)}`));
  if(bridge.medicalModel==='v2')container.append(node('p',`cardiacArrest ${m.cardiacArrest} · arrest ${m.arrestElapsedS.toFixed(1)}s · arrestReason ${m.arrestReason||'—'} · downReason ${m.downReason||'—'} · deathReason ${m.deathReason||'—'}`),node('p',`painFloor ${m.painFloor.toFixed(1)} · acutePain ${m.acutePain.toFixed(1)} · perceivedPain ${m.stressResponse.perceivedPain.toFixed(1)}`));
  const feedback=bridge.feedback?.snapshot()||new MedicalFeedback().step(0,bridge.time,m),d=feedback,debug=node('section','');debug.dataset.medicalFeedback='d1';
  debug.append(node('h3','통증·각성·시야 · D1'),node('p',`느끼는 통증 ${d.perceivedPain.toFixed(1)} · 단계 ${d.painStage} · 가림 ${(d.painMasking*100).toFixed(1)}% · 아드레날린 ${d.adrenaline.toFixed(3)} · 공황 ${d.panic.toFixed(3)} · 탈진 ${d.crash.toFixed(3)}`),node('p',`시야 ${d.vision.stage} · MAP ${d.map.toFixed(1)} · 청각 배제 ${d.auditoryExclusionDb.toFixed(2)}dB · 기립성 ${d.orthostaticRemainingS.toFixed(1)}s`));
  debug.append(node('p',Object.entries(d.parts).map(([k,p])=>`${partLabel[k]} ${p.pain.toFixed(1)}(${p.stage}단계)`).join(' · ')),node('p','흔들림 원인(rad): '+Object.entries(d.amplitudes).map(([k,v])=>`${k} ${v.toFixed(5)}`).join(' · ')),node('p',`배율 aim ${d.aimMul.toFixed(3)} · 이동 ${d.moveRate.toFixed(3)} · 장전 ${d.reloadRate.toFixed(3)} · 무기/조준 ${d.handlingRate.toFixed(3)} · 자세 ${d.stanceRate.toFixed(3)} · 달리기 ${d.sprintAllowed?'가능':'제한'}`));
  debug.append(node('p',`누적 혈액 손실 ${(d.bloodLoss*100).toFixed(1)}% · 흑백화·주변 어둠은 남은 혈액량 기준`),node('p',`터널 ${d.vision.tunnelDriver} · 암전 ${d.vision.blackoutDriver} · 눈–심장 ${(d.vision.retina.eyeHeightM*100).toFixed(1)}cm · 눈 MAP ${d.vision.retina.eyeMAP.toFixed(1)} · 눈꺼풀 ${d.vision.eyelids?.stageName||'open'}${d.vision.eyelids?.rapidDecline?' / 급성 하강':''}`),node('p',`조준 유지 ${(d.aimHold.alignment*100).toFixed(1)}% · 유지력 ${(d.aimHold.strength*100).toFixed(1)}% · 이탈 ${(d.aimHold.lapse*100).toFixed(1)}%`));
  if(bridge.targetId!=='P01')debug.append(node('p',`AI 환산: 반응 ${d.ai.reactionS.map(v=>v.toFixed(3)).join('–')}s · 최소 오차 ${d.ai.aimFloorDeg.toFixed(3)}° · 수렴 ${d.ai.aimConvergencePerS.toFixed(3)}/s · 사격 간격 ${d.ai.shotIntervalS.map(v=>v.toFixed(3)).join('–')}s · 걷기 ${d.ai.walkSpeedMps.toFixed(3)}m/s · 시야각 ${d.ai.visionFovDeg.toFixed(1)}° · 거리 ${Number.isFinite(d.ai.visionDistanceM)?d.ai.visionDistanceM.toFixed(1):'∞'}m`));
  const drugs=drugSnapshot(m);if(drugs)debug.append(node('h3','약물 · M4b'),node('p',`진통 ${drugs.analgesia.toFixed(2)} · 졸림 ${drugs.drowsy.toFixed(2)} · 호흡 억제 ${drugs.respiration.toFixed(3)} · 쇼크 배율 ${drugs.shockMultiplier.toFixed(2)}`),node('p',drugs.curves.map(c=>`${c.kind}: ${c.level.toFixed(4)} · ${c.ageS.toFixed(0)}s`).join(' / ')));
  container.append(debug);
  if(m.brainInjury)container.append(node('p',`뇌 손상 · ${m.brainInjury.kind==='brainstem'?'뇌간':'대뇌'} · 의식 소실 · ${m.brainInjury.structures.join(', ')}`));
  if(m.heartInjury)container.append(node('p',`심장 손상 · 펌프 기능 ${(m.heartInjury.pumpFunction*100).toFixed(1)}% · MAP ${m.hemodynamics.map.toFixed(1)}`));
  if(bridge.activity){const a=bridge.activity.snapshot();container.append(node('p',`D2 · 뇌진탕 ${(a.concussion.severity*100).toFixed(1)}% · 팔 ${(a.arm*100).toFixed(0)}/${(a.armMax*100).toFixed(0)} · 다리 ${(a.leg*100).toFixed(0)}/${(a.legMax*100).toFixed(0)} · 운동 ${(a.intensity*100).toFixed(0)}% · 운동 심박 +${a.hrApplied.toFixed(1)} bpm`));}
  if(m.structuralTrauma)container.append(node('p',`부위 HP는 구조 내구도입니다. 팔다리 HP 0은 기능 상실, 머리 HP 0은 구조 파괴 기록이며 생사는 뇌·뇌간 판정으로 결정합니다.`),node('p',`concussionRisk ${(m.concussionRisk||0).toFixed(3)} · D2 증상 입력 · 의식 소실/비틀거림 추가 없음`));
  if(m.bodyHpRuleId===MEDICAL_S3_VALUES.bodyHpRuleId)container.append(node('p','S3b · 5.56·5.45 몸 HP 피해는 유효 손상량 × 공통 C입니다. 다른 구경의 몸 피해는 미보정(v40 식)입니다.'));
  const table=document.createElement('table'),head=document.createElement('tr');
  for(const label of ['부위','HP','구조 상태','기능'])head.append(node('th',label));table.append(head);
  for(const [key,p]of Object.entries(m.bodyParts)){const row=document.createElement('tr');
    for(const value of [partLabel[key],`${p.hp.toFixed(1)}/${p.maxHp}`,p.structuralState?`${structureLabel[p.structuralState]||p.structuralState}${p.irreversibleWithoutTreatment?' · 치료 없이 회복 불가':''}`:m.partDestruction[key].state,`${(p.functionRatio*100).toFixed(0)}%`])row.append(node('td',value));table.append(row);}
  if(showInternals&&m.bleedingModel){const detail=node('section','');renderBleedingDebugB1(m,detail);container.append(detail);}
  container.append(table,node('h3',`피격 기록 · ${bridge.events.filter(e=>e.skinContact).length}건`));
  if(!bridge.events.length)container.append(node('p','아직 피격 기록이 없습니다.'));
  for(const e of bridge.events.slice(-24).reverse()){
    const card=node('article','');card.className='medical-event';
    card.append(node('strong',`${e.time.toFixed(2)}초 · #${e.shotId}/${e.order} · ${partLabel[e.address.bodyPart]}`),node('p',e.address.fullAddress));
    if(e.skinContact){card.append(node('p',`${e.depth} · 진입 ${e.entryVelocityMps.toFixed(0)} m/s · 체내 ${e.energyDepositedJ.toFixed(0)} J`),
      node('p',`경로 ${(e.pathLengthM*100).toFixed(1)} cm · 출구 ${e.exitWound?'있음':'없음'} · 출혈 ${e.bleedGrade||'none'}`));
      if(e.woundChannel?.ruleId==='wound-channel-s2'){
        const c=e.woundChannel;card.append(node('p',`S2 · 체내 ${c.stopped?'정지':'관통'} · 출구 ${(c.exitVelocityMps||0).toFixed(1)} m/s · m ${(c.damageMultiplier||0).toFixed(3)}${e.bodyHpDamage?' (표시·기록용)':''} · 뼈 에너지 ${(c.boneEnergyLostJ||0).toFixed(1)} J`));
        if(e.bodyHpDamage){const hp=e.bodyHpDamage;card.append(node('p',`S3 HP 피해 ${hp.damage.toFixed(3)} · 유효 손상 ${hp.effectiveVolumeCm3.toFixed(3)} cm³ × C ${hp.coefficientHpPerCm3.toFixed(6)} HP/cm³`));}
        else if(m.bodyHpRuleId===MEDICAL_S3_VALUES.bodyHpRuleId)card.append(node('p','몸 HP 피해: 미보정(v40 식 또는 명시적 legacy 경로)'));
      }
      if(e.bleedSourceIds?.length)card.append(node('p','출혈원: '+e.bleedSourceIds.join(', ')));
      if(e.vesselContusions?.length)card.append(node('p','공동 혈관 타박: '+e.vesselContusions.map(c=>c.vessel).join(', ')));
      if(e.skippedAfterDeath)card.append(node('p','dead · 원본 의료 함수가 추가 상처 생성을 중단했습니다.'));
    }else if(e.ricochet)card.append(node('p',`헬멧 도탄 · ${e.ricochet.label} · 피부 미접촉 · 둔상 반응`),
      node('p',`입사각 ${e.ricochet.incidenceDeg.toFixed(0)}° · 탄의 에너지 손실 ${e.ricochet.energyDepositedJ.toFixed(0)} J`));
    else card.append(node('p','피부 미접촉 · 방호구 저지 · 원본 둔상 반응'));
    container.append(card);
  }
  container.append(node('p','훈련 초기화 시 의료 기록도 초기화됩니다. 장비·의료 화면에서는 시간이 흐릅니다. 일시정지 메뉴와 쓰러진 뒤 기록은 멈춘 상태입니다.'));
}

export function renderBleedingDebugB1(m,container){
  container.replaceChildren();if(m.bleedingModel){
    const model=m.bleedingModel,debug=node('section','');debug.dataset.bleedDebug='b1';debug.append(node('h3','출혈원 · B1'),node('p',`출혈 ${model.totalFlowMlPerS.toFixed(2)} ml/s · 현재 심박출량 상한 ${model.cardiacOutputMlPerS.toFixed(2)} ml/s · 비례 배율 ${model.globalScale.toFixed(3)}`));
    debug.append(node('p',`누적 출혈 ${(m.bloodLossMl||0).toFixed(1)} ml`));
    for(const s of m.bleedSources)debug.append(node('p',`${s.vesselName} · ${s.vesselKind} · ${s.injuryType} · ${s.partKey} · ${s.flowMlPerS.toFixed(2)} ml/s · 누적 ${s.cumulativeMl.toFixed(1)} ml`));
    debug.append(node('p',`혈관 타박 ${m.vesselContusions.length}건 · 생리 효과 없음`));container.append(debug);
  }
}
