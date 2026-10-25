// 2A-3.5: AAR 사후강평 오버레이 UI
// =============================================================
function _aarTeamKor(t){ return (t==='friend'||t==='friendly')?'아군':(t==='enemy'||t==='hostile')?'적':'?'; }
function _aarUnitName(id){ if(id==null) return '—'; const u=UNITS.find(x=>x.id===id); if(!u) return 'Unit '+id; return `${_aarTeamKor(u.team)} ${u.callsign||u.name||u.id}`; }
function _aarUnitStatus(u){ if(u.isDead) return ['전사','aar-dead']; if(u.isDowned&&!u.conscious) return ['의식불명','aar-down']; if(u.isDowned) return ['전투불능','aar-down']; return ['생존','aar-ok']; }
function _aarAmmoName(id){ const a=AMMO_PRESETS[id]; return a?(a.name||id):(id||'—'); }
function _aarWeaponName(id){ const w=WEAPONS[id]; return w?(w.shortName||w.name||id):(id||'—'); }

function showAarOverlay() {
  let el = document.getElementById('aarOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aarOverlay';
    document.body.appendChild(el);
  }
  GAME._aarUI = { tab:'summary', unitId:null, view:'front', markerSel:null, logFilter:'all', damageMapOn:false };
  // 기본 선택 유닛 — 첫 아군
  const firstFriend = UNITS.find(u=>u.team==='friend');
  GAME._aarUI.unitId = firstFriend ? firstFriend.id : (UNITS[0]?UNITS[0].id:null);
  el.classList.add('on');
  renderAarOverlay();
}
// SIDE-AAR-ARMOR-DAMAGE-MAP §4: 국부손상 MAP on/off (view 전환·유닛 선택에도 유지)
function aarToggleDamageMap() {
  if (!GAME._aarUI) return;
  GAME._aarUI.damageMapOn = !GAME._aarUI.damageMapOn;
  renderAarOverlay();
}
function closeAarOverlay() {
  const el = document.getElementById('aarOverlay');
  if (el) el.classList.remove('on');
}
function aarSelectTab(t){ if(!GAME._aarUI) return; GAME._aarUI.tab=t; renderAarOverlay(); }
function aarSelectUnit(id){ if(!GAME._aarUI) return; GAME._aarUI.unitId=id; GAME._aarUI.markerSel=null; renderAarOverlay(); }
function aarSetView(v){ if(!GAME._aarUI) return; GAME._aarUI.view=v; GAME._aarUI.markerSel=null; renderAarOverlay(); }
function aarSelMarker(eid){ if(!GAME._aarUI) return; GAME._aarUI.markerSel=eid; renderAarOverlay(); }
function aarSetLogFilter(f){ if(!GAME._aarUI) return; GAME._aarUI.logFilter=f; renderAarOverlay(); }
function aarConfirm() {
  closeAarOverlay();
  returnToLoadout();   // aarReset 포함
}

function renderAarOverlay() {
  const el = document.getElementById('aarOverlay');
  const br = GAME.battleReport;
  if (!el || !br) return;
  const ui = GAME._aarUI;
  const resKor = {win:'승리',lose:'패배',reset:'중단',abort:'중단'}[br.result]||br.result||'';
  const tabs = [['summary','요약'],['units','유닛'],['markers','피격 위치'],['medical','의료'],['armor','장비'],['log','로그']];
  let html = `<div class="aar-head">
    <span class="aar-title">사후강평 (AAR)</span>
    <span class="aar-result ${br.result}">${resKor}</span>
    <span class="aar-unit-stat">전투시간 ${_aarTime(br.duration)}</span>
    <span class="aar-head-spacer"></span>
    <button class="aar-btn primary" onclick="aarConfirm()">확인 / 다음 전투</button>
  </div>
  <div class="aar-tabs">${tabs.map(t=>`<div class="aar-tab ${ui.tab===t[0]?'on':''}" onclick="aarSelectTab('${t[0]}')">${t[1]}</div>`).join('')}</div>
  <div class="aar-body" id="aarBody"></div>`;
  el.innerHTML = html;
  const body = document.getElementById('aarBody');
  if (ui.tab==='summary') body.innerHTML = aarRenderSummary();
  else if (ui.tab==='units') body.innerHTML = aarRenderUnits();
  else if (ui.tab==='markers') body.innerHTML = aarRenderMarkers();
  else if (ui.tab==='medical') body.innerHTML = aarRenderMedical();
  else if (ui.tab==='armor') body.innerHTML = aarRenderArmor();
  else if (ui.tab==='log') body.innerHTML = aarRenderLog();
}

function aarRenderSummary() {
  const s = GAME.battleReport.summary || {};
  const card=(lbl,val,cls)=>`<div class="aar-card"><div class="lbl">${lbl}</div><div class="val ${cls||''}">${val}</div></div>`;
  let h = `<div class="aar-cards">
    ${card('총 발사', s.totalShots||0)}
    ${card('총 명중', s.totalHits||0)}
    ${card('명중률', (s.hitRate||0)+'%')}
    ${card('총 피격', s.totalImpacts||0)}
    ${card('관통', s.penetrations||0,'bad')}
    ${card('방호', s.stopped||0,'good')}
    ${card('도탄', s.ricochets||0,'warn')}
    ${card('비방호', s.gaps||0,'warn')}
  </div>
  <div class="aar-cards">
    ${card('아군 생존', s.friendAlive||0,'good')}
    ${card('아군 전사', s.friendDead||0,'bad')}
    ${card('아군 무력화', s.friendDown||0,'warn')}
    ${card('적 생존', s.enemyAlive||0,'warn')}
    ${card('적 전사', s.enemyDead||0,'good')}
    ${card('적 무력화', s.enemyDown||0,'good')}
  </div>`;
  h += `<div class="aar-section-title">하이라이트</div>`;
  h += `<div class="aar-kv"><span class="k">최다 사살</span><span class="v">${s.topKiller?_aarUnitName(s.topKiller.id)+' ('+s.topKiller.kills+')':'—'}</span></div>`;
  h += `<div class="aar-kv"><span class="k">최다 피격</span><span class="v">${s.topVictim&&s.topVictim.hits>0?_aarUnitName(s.topVictim.id)+' ('+s.topVictim.hits+')':'—'}</span></div>`;
  h += `<div class="aar-kv"><span class="k">최다 피격 부위</span><span class="v">${s.mostHitPart?(IA_LABELS.hitPart[s.mostHitPart]||s.mostHitPart):'—'}</span></div>`;
  h += `<div class="aar-kv"><span class="k">최다 사용 탄</span><span class="v">${s.topAmmo?_aarAmmoName(s.topAmmo):'—'}</span></div>`;
  // coverageZone 분포
  if (s.coverageZoneStats && Object.keys(s.coverageZoneStats).length) {
    h += `<div class="aar-section-title">피격 부위 (coverageZone)</div>`;
    for (const z in s.coverageZoneStats) h += `<div class="aar-kv"><span class="k">${getCoverageZoneLabel(z)}</span><span class="v">${s.coverageZoneStats[z]}</span></div>`;
  }
  // SIDE-WEAPON-PLATFORM-1A §23.6: 로드아웃 / 무기 통계
  if (typeof GAME.loadout !== 'undefined') {
    const _wpnDesc = (wId, build) => {
      const w = WEAPONS[wId]; if (!w) return '-';
      let tag = '';
      if (build) { if (build.customModified) tag = ' CUSTOM'; else if (build.presetId && WEAPON_PRESET_REGISTRY[build.presetId]) tag = ' ' + WEAPON_PRESET_REGISTRY[build.presetId].shortName; }
      return w.name + tag;
    };
    // 통계 집계 (전체 유닛 weaponState._stats)
    let swTotal = 0, mountedShots = 0, obstrInhib = 0;
    if (typeof UNITS !== 'undefined') for (const u of UNITS) {
      if (u.weaponState && u.weaponState._stats) { swTotal += u.weaponState._stats.switchCount || 0; mountedShots += u.weaponState._stats.mountedShots || 0; obstrInhib += u.weaponState._stats.obstructInhibitedShots || 0; }
    }
    h += `<div class="aar-section-title">무장 (LOADOUT)</div>`;
    for (const team of ['friend', 'enemy']) {
      const ld = GAME.loadout[team]; if (!ld) continue;
      const teamKor = team === 'friend' ? '아군' : '적군';
      h += `<div class="aar-kv"><span class="k">${teamKor} 주무기</span><span class="v">${_wpnDesc(ld.primaryWeaponId || ld.weaponId, ld.primaryBuild)}</span></div>`;
      h += `<div class="aar-kv"><span class="k">${teamKor} 보조무기</span><span class="v">${_wpnDesc(ld.secondaryWeaponId, ld.secondaryBuild)}</span></div>`;
    }
    h += `<div class="aar-kv"><span class="k">무기 전환</span><span class="v">${swTotal}회</span></div>`;
    h += `<div class="aar-kv"><span class="k">거치 사격</span><span class="v">${mountedShots}발</span></div>`;
    h += `<div class="aar-kv"><span class="k">총구 간섭 억제</span><span class="v">${obstrInhib}발</span></div>`;
  }
  return h;
}

function aarRenderUnits() {
  const br = GAME.battleReport;
  const ui = GAME._aarUI;
  // 좌: 유닛 목록 / 우: 상세
  let list = `<div class="aar-col"><div class="aar-section-title">유닛 목록</div>`;
  const ordered = UNITS.slice().sort((a,b)=> (a.team===b.team?0:(a.team==='friend'?-1:1)));
  for (const u of ordered) {
    const st = br.unitStats[u.id] || {};
    const [sLbl,sCls] = _aarUnitStatus(u);
    list += `<div class="aar-unit-row ${ui.unitId===u.id?'on':''}" onclick="aarSelectUnit(${u.id})">
      <span class="aar-unit-team ${u.team==='friend'?'friend':'enemy'}">${_aarTeamKor(u.team)}</span>
      <span class="aar-unit-name">${u.callsign||u.name||u.id}</span>
      <span class="aar-unit-stat ${sCls}">${sLbl}</span>
      <span class="aar-unit-stat">사살 ${st.kills||0} · 피격 ${st.receivedHits||0}</span>
    </div>`;
  }
  list += `</div>`;
  // 상세
  const u = UNITS.find(x=>x.id===ui.unitId);
  let detail = `<div class="aar-col">`;
  if (u) {
    const st = br.unitStats[u.id] || {};
    const init = br.unitsInitial[u.id] || {};
    const hitRate = st.shotsFired>0?Math.round(st.shotsHit/st.shotsFired*100):0;
    const [sLbl] = _aarUnitStatus(u);
    let mostPart=null,mpv=-1; for(const k in (st.hitsByPart||{})) if(st.hitsByPart[k]>mpv){mpv=st.hitsByPart[k];mostPart=k;}
    detail += `<div class="aar-section-title">${u.callsign||u.name} 상세</div>`;
    detail += `<div class="aar-kv"><span class="k">상태</span><span class="v">${sLbl}</span></div>`;
    detail += `<div class="aar-kv"><span class="k">무기 / 탄</span><span class="v">${_aarWeaponName(init.weaponId)} / ${_aarAmmoName(init.ammoId)}</span></div>`;
    detail += `<div class="aar-kv"><span class="k">발사 / 명중</span><span class="v">${st.shotsFired||0} / ${st.shotsHit||0} (${hitRate}%)</span></div>`;
    detail += `<div class="aar-kv"><span class="k">사살</span><span class="v">${st.kills||0}</span></div>`;
    detail += `<div class="aar-kv"><span class="k">받은 피격</span><span class="v">${st.receivedHits||0} (관통 ${st.receivedPenetrations||0} / 방호 ${st.receivedStopped||0} / 도탄 ${st.receivedRicochets||0})</span></div>`;
    detail += `<div class="aar-kv"><span class="k">최다 피격 부위</span><span class="v">${mostPart?(IA_LABELS.hitPart[mostPart]||mostPart):'—'}</span></div>`;
    const fm = br.finalMedical[u.id];
    if (fm) detail += `<div class="aar-kv"><span class="k">최종 상태</span><span class="v">LIFE ${fm.lifeStatus!=null?fm.lifeStatus:'—'}%${fm.bloodMl!=null?' · 혈액 '+fm.bloodMl+'ml':''}</span></div>`;
    // 2B-0-FINAL §21: 부상 요약 — 부위별 클러스터 묶음 표시
    // RESIDUAL HOTFIX 1: AAR 부상 요약은 finalMedical.wounds snapshot(종료 시점 봉인)을 무조건 우선. snapshot 없을 때만 live 사용.
    if (!(fm && fm.wounds && fm.wounds.length) && u.medical && u.medical.wounds && u.medical.wounds.length) {
      detail += `<div class="aar-section-title" style="margin-top:8px">부상 요약 (${u.medical.wounds.length})</div>`;
      const partKeys = [...new Set(u.medical.wounds.map(w => w.partKey))];
      const rowsAll = [];
      for (const pk of partKeys) {
        const rows = (typeof buildWoundDisplayRows === 'function') ? buildWoundDisplayRows(u, pk) : [];
        for (const r of rows) rowsAll.push(r);
      }
      rowsAll.sort((a, b) => b.urgencyScore - a.urgencyScore);
      for (const r of rowsAll) {
        if (r.type === 'cluster') {
          detail += `<div class="aar-kv"><span class="k">${r.representativeLocation}</span><span class="v">${r.representativeLabel} / ${r.bleedingSummary} / ${r.treatmentSummary}</span></div>`;
        } else {
          const w = r.wound; const L = w.uiLabels || {};
          const loc = (L.locationLabel || _woundPartKo(w.partKey));
          const treat = (w.treatmentState && (w.treatmentState.pressureBandaged || w.treatmentState.chestSealed)) ? (L.treatmentLabel || '처치됨') : (w._tourniquetSuppressed ? '지혈대 억제/추가처치 필요' : '미처치');
          detail += `<div class="aar-kv"><span class="k">${loc}</span><span class="v">${L.combinedLabel||''} / ${L.bleedingLabel||''} / ${L.fieldCareLabel||''} / ${treat}</span></div>`;
          // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §9: 확정 생리손상 분리 표시 (candidate와 다른 색/문구)
          // SIDE-HIT-ADDRESS-DAMAGE-ATTENUATION-1 §5: 피격주소 감쇠 체인 (감쇠 있을 때만)
          const _dap = w.damageAttenuationProfile;
          if (_dap && (_dap.damageMul < 0.999 || _dap.physiologyMul < 0.999)) {
            const _physAtten = (w.physiologicInjuries && w.physiologicInjuries.some(i => i.confirmedLevel === 'confirmed_physiologic')) ? '확정 생리손상 유지' : (_dap.physiologyMul < 0.85 ? '생리승격 감쇠' : '');
            detail += `<div class="aar-kv"><span class="k" style="color:#9fc8e0">피격주소 감쇠</span><span class="v" style="color:#bcd">피해 ${_dap.damageMul.toFixed(2)}x · 생리 ${_dap.physiologyMul.toFixed(2)}x · ${_dap.class}${_physAtten ? ' · ' + _physAtten : ''}</span></div>`;
          }
          const physLine = physiologicInjurySummaryHtml(w);
          if (physLine) detail += physLine;
          // SIDE-FRAGMENT-MASS-ENERGY-BRIDGE-1 §9: AAR 파편 에너지 (raw dump 없음)
          if (w.fragmentEnergyJ != null || w.fragmentMassG != null) {
            const _fs = ({ grenade:'수류탄', micro_explosive:'12.7mm', armor_spall:'스폴', armor_spall_steel:'강철 스폴' })[w.fragmentSource] || w.fragmentSource || '파편';
            const _spMatKo = ({ steel:'강철', ceramic:'세라믹', aramid:'아라미드', pe:'PE', aluminum:'알루미늄', titanium:'티타늄', composite:'복합재', glass:'유리' })[w.spallMaterialType] || w.spallMaterialType;
            let _fl = _fs;
            if (w.spallMaterialType) _fl += ` (${_spMatKo})`;
            if (w.fragmentTier || w.spallClass) _fl += ` / ${w.spallClass || w.fragmentTier}`;
            if (w.fragmentMassG != null) _fl += ` / ${(+w.fragmentMassG).toFixed(2)}g`;
            if (w.fragmentVelocityMps != null) _fl += ` / ${Math.round(w.fragmentVelocityMps)}m/s`;
            if (w.fragmentEnergyJ != null) _fl += ` / ${(+w.fragmentEnergyJ).toFixed(1)}J`;
            if (w.fragmentSharpness != null) _fl += ` / 예리도 ${(+w.fragmentSharpness).toFixed(2)}`;
            if (w.equivalentDamage != null) _fl += ` / 피해 ${(+w.equivalentDamage).toFixed(1)}`;
            detail += `<div class="aar-kv"><span class="k" style="color:#d0b890">파편</span><span class="v" style="color:#e0cca8">${_fl}</span></div>`;
          }
        }
      }
    } else if (fm && fm.wounds && fm.wounds.length) {
      // RESIDUAL HOTFIX 1: 봉인된 snapshot 우선 부상 요약 (전투 종료 시점 기록 — live state가 바뀌어도 유지)
      detail += `<div class="aar-section-title" style="margin-top:8px">부상 요약 (${fm.wounds.length}) · 종료 시점 기록</div>`;
      const _catKo = { thoracic_internal:'흉강 내부출혈', abdominal_internal:'복강 내부출혈', retroperitoneal_internal:'후복막 내부출혈', pelvic_internal:'골반 내부출혈', junctional_limited_control:'접합부 제한통제', external_severe:'심한 외부출혈', external_controllable:'외부출혈', airway_compromise:'기도 위협', cranial_neuro:'두개/신경' };
      for (const sw of fm.wounds) {
        const _tags = [];
        if (sw.sequenceStage) _tags.push(sw.sequenceStage);
        if (sw.recurrenceRisk != null) _tags.push('재출혈 ' + (sw.recurrenceRisk >= 0.5 ? '높음' : sw.recurrenceRisk >= 0.3 ? '중간' : '낮음'));
        if (sw.surgeryRequiredCandidate) _tags.push('수술요');
        if (sw.transfusionRequiredCandidate) _tags.push('수혈요');
        if (sw.vascularControlRequiredCandidate) _tags.push('혈관통제요');
        const _catL = sw.internalBleedingCategory ? (_catKo[sw.internalBleedingCategory] || sw.internalBleedingCategory) : (sw.bleedingClass || '');
        detail += `<div class="aar-kv"><span class="k">${sw.uiLabel || _woundPartKo(sw.partKey) || sw.partKey || '상처'}</span><span class="v">${_catL}${_tags.length ? ' / ' + _tags.join(' · ') : ''}</span></div>`;
        // 확정/강한의심 손상 (snapshot 봉인)
        if (sw.confirmedInjuries && sw.confirmedInjuries.length) {
          const _ci = sw.confirmedInjuries.map(i => (typeof _physInjuryLabelKo === 'function' ? _physInjuryLabelKo({ id:i }) : i)).join(', ');
          detail += `<div class="aar-kv"><span class="k" style="color:#d08a8a">확정 손상</span><span class="v" style="color:#e0a0a0">${_ci}</span></div>`;
        }
        if (sw.probableInjuries && sw.probableInjuries.length) {
          detail += `<div class="aar-kv"><span class="k" style="color:#c8a86a">강한 의심</span><span class="v" style="color:#d8c090">${sw.probableInjuries.slice(0,4).join(', ')}</span></div>`;
        }
        if (sw.bodyTrajectoryLabel) detail += `<div class="aar-kv"><span class="k" style="color:#9fb0bd">탄도</span><span class="v" style="color:#bcd">${sw.bodyTrajectoryLabel}</span></div>`;
      }
    }
  } else detail += `유닛을 선택하세요`;
  detail += `</div>`;
  return `<div class="aar-2col">${list}${detail}</div>`;
}

// ============================================================
// SIDE-AAR-ARMOR-DAMAGE-MAP: 국부 손상지도 helper (AAR/UI 전용 — 전투 계산 미사용)
// ============================================================
// SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §9: 확정 생리손상 라벨/요약 (candidate와 분리 표시)
const _PHYS_INJURY_KO = {
  lung_laceration:'폐 열상(확정)', lung_penetrating:'폐 관통 손상(확정)',
  liver_laceration:'간 열상(확정)', spleen_laceration:'비장 열상(확정)', kidney_laceration:'신장 손상(확정)',
  retroperitoneal_bleed_laceration:'후복막 출혈(확정)',
  femoral_artery_injury:'대퇴동맥 손상(확정)', iliac_vessel_injury:'장골혈관 손상(확정)',
  carotid_jugular_injury:'경동맥/경정맥 손상(확정)', thoracic_great_vessel_injury:'흉부 대혈관 손상(확정)',
  axillary_subclavian_injury:'액와/쇄골하 혈관 손상(확정)',
  cardiac_rhythm_risk:'심장 리듬 위험 상승',
};
function _physInjuryLabelKo(inj) {
  if (!inj) return '';
  if (_PHYS_INJURY_KO[inj.id]) return _PHYS_INJURY_KO[inj.id];
  return (inj.organ || inj.type || '생리손상');
}
function _physEffectSummaryKo(prof) {
  if (!prof) return '';
  const s = [];
  if ((prof.internalBleedBoost || 0) > 0 || (prof.externalBleedBoost || 0) > 0 || (prof.majorVesselMul || 1) > 1.05) s.push('출혈 증가');
  if ((prof.breathingDrain || 0) > 0 || (prof.oxygenDrain || 0) > 0) s.push('호흡효율 저하');
  if ((prof.rhythmRiskBoost || 0) > 0 || (prof.preArrestBoost || 0) > 0) s.push('리듬 위험 증가');
  if ((prof.pneumothoraxBoost || 0) > 0 || (prof.hemothoraxBoost || 0) > 0) s.push('흉부압박/혈흉 진행');
  return s.join(' · ');
}
function physiologicInjurySummaryHtml(w) {
  const inj = (w && w.physiologicInjuries) || [];
  if (!inj.length) return null;
  const confirmed = inj.filter(i => i.confirmedLevel === 'confirmed_physiologic');
  const riskOnly = inj.filter(i => i.confirmedLevel === 'risk_only');
  if (!confirmed.length && !riskOnly.length) return null;
  const all = confirmed.map(i => _physInjuryLabelKo(i)).concat(riskOnly.map(i => _physInjuryLabelKo(i)));
  const eff = _physEffectSummaryKo(w.physiologicEffectProfile);
  const tags = (w.physiologicTags || []).join(' ');
  return `<div class="aar-kv" style="border-left:3px solid #ff6060;padding-left:6px"><span class="k" style="color:#ff8a8a">확정 생리손상</span><span class="v" style="color:#ffd0d0">${all.join(', ')}${eff ? ' — ' + eff : ''}${tags ? ' <span style="opacity:0.6;font-size:0.85em">['+tags+']</span>' : ''}</span></div>`;
}
function sanitizeSvgId(s) { return String(s || 'x').replace(/[^a-zA-Z0-9_-]/g, '_'); }
const AAR_ARMOR_ZONE_LABELS = { center:'중앙', upper:'상부', lower:'하부', side:'측면', edge:'엣지', glass:'유리부', frame:'프레임', unknown:'불명' };
function getArmorDamageModeLabelKo(mode) {
  if (!mode) return '손상';
  if (typeof ARMOR_DAMAGE_MODE_LABEL_KO !== 'undefined' && ARMOR_DAMAGE_MODE_LABEL_KO[mode]) return ARMOR_DAMAGE_MODE_LABEL_KO[mode];
  return mode;
}
// §6: 손상지도 데이터 — finalArmor snapshot 우선, 없으면 live armorDurability
function getAarArmorSnapshotForUnit(u) {
  const br = GAME.battleReport;
  if (br && br.finalArmor && u && br.finalArmor[u.id]) return br.finalArmor[u.id];
  return (u && u.armorDurability) ? u.armorDurability : null;
}
// §8/§18: localZone 손상률(0~100) → 색상
function aarDamageColor(v) {
  v = Math.max(0, Math.min(100, v || 0));
  if (v < 10) return 'rgba(95,217,122,0.18)';
  if (v < 30) return 'rgba(150,210,90,0.28)';
  if (v < 55) return 'rgba(255,210,74,0.34)';
  if (v < 75) return 'rgba(255,154,64,0.44)';
  return 'rgba(255,80,80,0.56)';
}
function aarDamageStroke(v) {
  v = v || 0;
  if (v >= 75) return 'rgba(255,120,120,0.90)';
  if (v >= 45) return 'rgba(255,210,100,0.75)';
  return 'rgba(120,220,140,0.55)';
}
// SIDE-KORUND-FRONTSET-MAP §2.2: hardShapeSet raw slot(chest_front 등) → 실제 durability slotKey(chest_front_hard) 정규화
function normalizeAarDamageSlotKey(rawSlot, aspect, kind) {
  const s = String(rawSlot || '');
  if (!s) return `chest_${aspect}_hard`;
  if (/_hard$|_soft$/.test(s)) return s;                  // 이미 정규화됨
  if (s === 'chest_front') return 'chest_front_hard';
  if (s === 'abdomen_front') return 'abdomen_front_hard';
  if (s === 'chest_rear') return 'chest_rear_hard';
  if (s === 'abdomen_rear') return 'abdomen_rear_hard';
  if (s === 'chest_side' || s === 'abdomen_side') return 'left_side_hard';
  if (/^(chest|abdomen)_(front|rear)$/.test(s)) return s + '_hard';
  return s;
}
// §7: 현재 view에서 보이는 방어구 패널 + 매핑 slotKey 목록 (snapshot/event aggregate에 실재하는 것만)
function getAarDamageMapPanels(u, view) {
  const br = GAME.battleReport;
  const init = (br.unitsFinal && br.unitsFinal[u.id]) || (br.unitsInitial && br.unitsInitial[u.id]) || {};
  const panels = [];
  const isHead = (view === 'head');
  if (!isHead) {
    const aspect = (view === 'side') ? 'side' : (view === 'rear' ? 'rear' : 'front');
    const shape = (typeof ARMOR_COVERAGE_SHAPES !== 'undefined') ? ARMOR_COVERAGE_SHAPES[init.bodyArmorId] : null;
    const sd = shape && shape[aspect];
    if (sd) {
      if (sd.softShape) {
        const softSlots = aspect === 'side' ? ['chest_left_soft', 'chest_right_soft'] : [`chest_${aspect}_soft`, `abdomen_${aspect}_soft`];
        panels.push({ slotKeys: softSlots, points: sd.softShape.points, kind: 'soft' });
      }
      const armorPreset = (typeof BODY_ARMOR_PRESETS !== 'undefined') ? BODY_ARMOR_PRESETS[init.bodyArmorId] : null;
      const noPlates = armorPreset && armorPreset.noPlateSlots;
      const plateId = aspect === 'front' ? init.frontPlateId : (aspect === 'rear' ? init.backPlateId : init.sidePlateId);
      const plate = (!noPlates && plateId) ? PLATE_PRESETS[plateId] : null;
      let hardPts = null;
      if (sd.hardShape && sd.hardShape.fixedPlate) hardPts = sd.hardShape.points;
      else if (sd.hardShape && plate && !plate.isNone) {
        const ps = (typeof getPlateShape === 'function') ? getPlateShape(plate.id, _slotHitPart(sd.hardShape.slot)) : 'sapi';
        hardPts = plateShapeToPoints(ps, _bboxOfPoints(sd.hardShape.points), 0);
      }
      if (hardPts) {
        const hardSlots = aspect === 'front' ? ['chest_front_hard', 'abdomen_front_hard'] : aspect === 'rear' ? ['chest_rear_hard', 'abdomen_rear_hard'] : ['left_side_hard', 'right_side_hard'];
        panels.push({ slotKeys: hardSlots, points: hardPts, kind: 'hard' });
      }
      if (sd.hardShapeSet && plate && !plate.isNone) for (const hs of sd.hardShapeSet) {
        const ps = (typeof getPlateShape === 'function') ? getPlateShape(plate.id, _slotHitPart(hs.slot)) : 'sapi';
        const pts = plateShapeToPoints(ps, _bboxOfPoints(hs.points), 0);
        const nslot = normalizeAarDamageSlotKey(hs.slot, aspect, 'hard');   // §2.2 chest_front→chest_front_hard
        panels.push({ slotKeys: [nslot], points: pts, kind: 'hard', rawSlot: hs.slot || null });
      }
    }
    if ((aspect === 'front' || aspect === 'rear') && init.sidePlateId) {
      const sp = PLATE_PRESETS[init.sidePlateId];
      if (sp && !sp.isNone) {
        const sShape = (typeof getPlateShape === 'function') ? getPlateShape(sp.id, 'chest') : 'side_plate_small';
        const edges = SIDE_PLATE_EDGE_POLYGONS[(sShape === 'side_plate_large') ? 'large' : 'small'];
        if (edges && edges.length) {
          panels.push({ slotKeys: ['left_side_hard'], points: edges[0], kind: 'hard' });
          if (edges[1]) panels.push({ slotKeys: ['right_side_hard'], points: edges[1], kind: 'hard' });
        }
      }
    }
  } else {
    const hShape = (typeof HELMET_COVERAGE_SHAPES !== 'undefined') ? HELMET_COVERAGE_SHAPES[init.helmetId] : null;
    const hd = hShape && hShape['front'];
    if (hd && hd.shellShape) panels.push({ slotKeys: ['head_skull_shell', 'head_temporal_shell'], points: hd.shellShape.points, kind: 'helmet' });
    if (init.visorId && init.visorId.indexOf('no_') !== 0 && typeof ACCESSORY_SHAPES !== 'undefined') {
      if (init.visorId === 'k6_3_visor' && ACCESSORY_SHAPES.visorK63) {
        const vk = ACCESSORY_SHAPES.visorK63.front;
        if (vk) {
          if (vk.frame) panels.push({ slotKeys: ['head_face_visor'], points: vk.frame.points, kind: 'visor_frame' });
          if (vk.glass) panels.push({ slotKeys: ['head_face_visor'], points: vk.glass.points, kind: 'visor_glass' });
        }
      } else {
        const vs = ACCESSORY_SHAPES.visor && ACCESSORY_SHAPES.visor.front;
        if (vs) panels.push({ slotKeys: ['head_face_visor'], points: vs.points, kind: 'visor_glass' });
      }
    }
  }
  const snap = getAarArmorSnapshotForUnit(u);
  const eventAgg = buildAarArmorEventDamageAggregate(u.id);   // §2.3 finalArmor 누락 시 event 기반 fallback
  return panels.filter(p => p.slotKeys.some(k => (snap && snap[k]) || (eventAgg && eventAgg[k])));
}
// 여러 slot의 localZones를 max로 병합 + worst global ratio
function _aarMergeZones(snap, slotKeys) {
  const merged = {}; let worstRatio = 1, found = false;
  for (const k of slotKeys) {
    const d = snap && snap[k]; if (!d) continue;
    found = true;
    if (d.ratio != null && d.ratio < worstRatio) worstRatio = d.ratio;
    const lz = d.localZones; if (!lz) continue;
    for (const z in lz) merged[z] = Math.max(merged[z] || 0, lz[z] || 0);
  }
  return found ? { zones: merged, worstRatio } : null;
}
// §9: zone → 등고선형 blob (panel bbox 기준 배치, clipPath가 외곽 잘라냄)
function aarRenderZoneBlob(bb, zone, value, highlight) {
  if (!(value > 0)) return '';
  const c = aarDamageColor(value);
  const st = highlight ? '#ffe066' : aarDamageStroke(value);
  const sw = highlight ? 1.4 : 0.5;
  const cx = bb.x + bb.w / 2, cyMid = bb.y + bb.h / 2;
  const E = (x0, y0, rx, ry, fill) => `<ellipse cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill || c}" stroke="${st}" stroke-width="${sw}" pointer-events="none"/>`;
  switch (zone) {
    case 'center': return E(cx, cyMid, bb.w * 0.34, bb.h * 0.30, aarDamageColor(value * 0.7)) + E(cx, cyMid, bb.w * 0.20, bb.h * 0.18);
    case 'upper':  return E(cx, bb.y + bb.h * 0.20, bb.w * 0.42, bb.h * 0.16);
    case 'lower':  return E(cx, bb.y + bb.h * 0.82, bb.w * 0.42, bb.h * 0.16);
    case 'side':   return E(bb.x + bb.w * 0.14, cyMid, bb.w * 0.16, bb.h * 0.40) + E(bb.x + bb.w * 0.86, cyMid, bb.w * 0.16, bb.h * 0.40);
    case 'edge':   return `<rect x="${bb.x.toFixed(1)}" y="${bb.y.toFixed(1)}" width="${bb.w.toFixed(1)}" height="${bb.h.toFixed(1)}" fill="none" stroke="${aarDamageColor(value).replace(/[\d.]+\)$/, '0.85)')}" stroke-width="${(Math.min(bb.w, bb.h) * 0.12).toFixed(1)}" pointer-events="none"/>`;
    case 'glass':
    case 'frame':  return `<rect x="${bb.x.toFixed(1)}" y="${bb.y.toFixed(1)}" width="${bb.w.toFixed(1)}" height="${bb.h.toFixed(1)}" fill="${c}" stroke="${st}" stroke-width="${sw}" pointer-events="none"/>`;
    default: return '';
  }
}
// ============================================================
// SIDE-AAR-DAMAGE-FIELD-RETUNE: 탄착점 기반 손상장(field) V2 helper (AAR/UI 전용)
// ============================================================
// §3.3: impactLog 순회 → slotKey별 localZones 누적 (AAR 표시 fallback. 전투 데이터 미변경)
function buildAarArmorEventDamageAggregate(unitId) {
  const out = {};
  const br = GAME.battleReport;
  if (!br || !br.impactLog) return out;
  for (const ev of br.impactLog) {
    if (ev.targetId !== unitId) continue;
    const list = (ev.armorDamageInfos && ev.armorDamageInfos.length) ? ev.armorDamageInfos : (ev.armorDamageInfo ? [ev.armorDamageInfo] : []);
    for (const a of list) {
      if (!a || !a.slotKey) continue;
      let e = out[a.slotKey];
      if (!e) e = out[a.slotKey] = { material: a.material || null, localZones: { center:0, upper:0, lower:0, side:0, edge:0, glass:0, frame:0, unknown:0 }, eventLocalTotal:0, eventGlobalTotal:0, latestDamageMode:null, latestLabel:null, latestEventId:null };
      const z = a.localZone || 'unknown';
      if (e.localZones[z] == null) e.localZones[z] = 0;
      e.localZones[z] += (a.localAmount || 0);
      e.eventLocalTotal += (a.localAmount || 0);
      e.eventGlobalTotal += (a.globalAmount || 0);
      if (a.material && !e.material) e.material = a.material;
      if (a.damageMode) e.latestDamageMode = a.damageMode;
      if (a.aarLabel) e.latestLabel = a.aarLabel;
      e.latestEventId = ev.eventId;
    }
  }
  for (const k in out) for (const z in out[k].localZones) out[k].localZones[z] = +Math.min(100, out[k].localZones[z]).toFixed(2);
  return out;
}
// §4.3: deterministic noise (랜덤 아님 — band 경계 질감용)
function aarDeterministicNoise(x, y, salt) {
  const h = Math.sin(x * 12.9898 + y * 78.233 + (salt || 0) * 37.719) * 43758.5453;
  return h - Math.floor(h);
}
// §4.4 + KORUND §2.4: field 색상 — 6 band quantize (등고선 느낌), 초기 손상도 희미하게(v<2만 미표시)
function aarDamageFieldColor(v) {
  v = Math.max(0, Math.min(100, v));
  if (v < 2) return null;
  if (v < 8) return 'rgba(95,217,122,0.12)';    // 초기 steel 손상 — 매우 연한 연두
  if (v < 15) return 'rgba(120,210,110,0.20)';
  if (v < 30) return 'rgba(180,210,80,0.30)';
  if (v < 50) return 'rgba(240,205,70,0.38)';
  if (v < 70) return 'rgba(255,150,60,0.46)';
  if (v < 85) return 'rgba(255,100,70,0.52)';
  return 'rgba(255,64,64,0.58)';
}
// §4.2: panel별 damage seed (AAR marker 좌표 기반 — 실제 탄착 좌표 아님)
function buildAarDamageSeedsForPanel(u, view, panel) {
  const br = GAME.battleReport;
  if (!br || !br.hitMarkers) return [];
  const isHead = (view === 'head');
  const seeds = [];
  const slotSet = {}; panel.slotKeys.forEach(k => slotSet[k] = 1);
  const RBASE = { steel:11, titanium:11, aluminum:13, ceramic:17, glass:19, composite:15, pe:15, aramid:17, fabric:12 };
  for (const mk of br.hitMarkers) {
    if (mk.targetId !== u.id) continue;
    if (mk.view !== (isHead ? 'head' : 'torso')) continue;
    if (!isHead && mk.aspect && mk.aspect !== view) continue;
    const ev = br.impactLog.find(e => e.eventId === mk.eventId);
    if (!ev) continue;
    const list = (ev.armorDamageInfos && ev.armorDamageInfos.length) ? ev.armorDamageInfos : (ev.armorDamageInfo ? [ev.armorDamageInfo] : []);
    for (const a of list) {
      if (!a || !slotSet[a.slotKey]) continue;
      const mat = a.material || 'composite';
      let radius = RBASE[mat] || 14;
      let strength = (a.localAmount != null && a.localAmount > 0) ? a.localAmount : (a.globalAmount != null ? a.globalAmount * 2 : 1);
      const dm = a.damageMode || '';
      if (/ceramic_(radial_crack|tile_shatter|cone_fracture)/.test(dm)) radius *= 1.35;
      else if (/glass_(spiderweb|radial_crack|laminate)/.test(dm)) radius *= 1.35;
      else if (/steel_(gouge|plugged_hole|perforation)/.test(dm)) { radius *= 0.8; strength *= 1.2; }
      else if (/aramid_fiber_cut/.test(dm)) radius *= 0.8;
      else if (/aramid_weave_spread/.test(dm)) radius *= 1.25;
      else if (/(backface_bulge|delamination|panel_warp|tearing)/.test(dm)) radius *= 1.25;
      seeds.push({ x: mk.x, y: mk.y, slotKey: a.slotKey, localZone: a.localZone, material: mat, damageMode: dm, localAmount: a.localAmount || 0, globalAmount: a.globalAmount || 0, radius, strength, eventId: mk.eventId });
    }
  }
  return seeds;
}
// §4.7: event seed 없을 때 localZones → synthetic seed (대표 위치)
function buildAarSyntheticZoneSeeds(bb, zones, panel) {
  const seeds = [];
  const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
  const baseR = Math.max(7, Math.min(bb.w, bb.h) * 0.5);
  const add = (x, y, v, r) => { if (v > 0) seeds.push({ x, y, strength: v, radius: r, eventId: null }); };
  if (panel.kind === 'visor_glass' || panel.kind === 'visor_frame') {
    const zn = panel.kind === 'visor_glass' ? 'glass' : 'frame';
    add(cx, cy, (zones[zn] != null ? zones[zn] : (zones.center || 0)), baseR);
    return seeds;
  }
  add(cx, cy, zones.center || 0, baseR * 0.7);
  add(cx, bb.y + bb.h * 0.20, zones.upper || 0, baseR * 0.6);
  add(cx, bb.y + bb.h * 0.80, zones.lower || 0, baseR * 0.6);
  add(bb.x + bb.w * 0.18, cy, zones.side || 0, baseR * 0.5);
  add(bb.x + bb.w * 0.82, cy, zones.side || 0, baseR * 0.5);
  if (zones.edge > 0) {
    const ev = zones.edge;
    add(cx, bb.y + bb.h * 0.06, ev, baseR * 0.4);
    add(cx, bb.y + bb.h * 0.94, ev, baseR * 0.4);
    add(bb.x + bb.w * 0.06, cy, ev, baseR * 0.4);
    add(bb.x + bb.w * 0.94, cy, ev, baseR * 0.4);
  }
  return seeds;
}
// §4.3: (x,y) field value — seed 거리 falloff 누적 + deterministic noise (0~100)
function aarDamageFieldValueAt(x, y, seeds, panelSalt) {
  let value = 0;
  for (const s of seeds) {
    const dx = x - s.x, dy = y - s.y;
    const dd = dx * dx + dy * dy;
    const r = s.radius || 14;
    value += s.strength / (1 + dd / (r * r * 0.5));
  }
  if (value > 0) value *= 0.94 + aarDeterministicNoise(x, y, panelSalt) * 0.12;
  return Math.max(0, Math.min(100, value));
}
// §4.5: panel field 렌더 — slot clipPath 내부 cell grid (canvas/blur 금지)
function aarRenderDamageFieldPanel(u, view, panel, idx) {
  const snap = getAarArmorSnapshotForUnit(u);
  const bbox = _bboxOfPoints(panel.points);
  const bb = { x: bbox.minX, y: bbox.minY, w: bbox.w, h: bbox.h };
  const clipId = sanitizeSvgId('aarDmgClip_' + u.id + '_' + view + '_' + (panel.slotKeys[0] || idx) + '_' + idx);
  const mz = _aarMergeZones(snap, panel.slotKeys);
  let seeds = buildAarDamageSeedsForPanel(u, view, panel);
  if (!seeds.length) {
    if (mz) seeds = buildAarSyntheticZoneSeeds(bb, mz.zones, panel);
    // event seed도 zone seed도 없으면 outline만 (worstRatio)
    if (!seeds.length) {
      if (mz && mz.worstRatio != null && mz.worstRatio < 0.70) {
        const oc = mz.worstRatio < 0.40 ? 'rgba(255,90,90,0.85)' : 'rgba(255,210,100,0.8)';
        return { defs:'', body:`<polygon points="${panel.points}" fill="none" stroke="${oc}" stroke-width="0.8" pointer-events="none"/>` };
      }
      return { defs:'', body:'' };
    }
  }
  const isHead = (view === 'head');
  let cell = isHead ? 2.2 : 3.0;
  let cols = Math.ceil(bb.w / cell), rows = Math.ceil(bb.h / cell);
  while (cols * rows > 900 && cell < 6) { cell += 0.5; cols = Math.ceil(bb.w / cell); rows = Math.ceil(bb.h / cell); }   // §14 cell 상한
  let cells = '';
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const cx = bb.x + (i + 0.5) * cell, cy = bb.y + (j + 0.5) * cell;
    const col = aarDamageFieldColor(aarDamageFieldValueAt(cx, cy, seeds, idx + 1));
    if (!col) continue;   // 낮은 value cell 생략
    cells += `<rect x="${(bb.x + i * cell).toFixed(2)}" y="${(bb.y + j * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="${col}" pointer-events="none"/>`;
  }
  // §6: 선택 marker halo
  let halo = '';
  const ui = GAME._aarUI;
  if (ui && ui.markerSel != null) {
    const ss = seeds.find(s => s.eventId === ui.markerSel);
    if (ss) halo = `<ellipse cx="${ss.x.toFixed(1)}" cy="${ss.y.toFixed(1)}" rx="${(ss.radius * 0.7).toFixed(1)}" ry="${(ss.radius * 0.7).toFixed(1)}" fill="none" stroke="#ffe066" stroke-width="0.7" pointer-events="none"/>`;
  }
  // §9.1-7 경계 재표시 + worstRatio outline
  let outline = `<polygon points="${panel.points}" fill="none" stroke="rgba(180,200,220,0.4)" stroke-width="0.4" pointer-events="none"/>`;
  if (mz && mz.worstRatio != null && mz.worstRatio < 0.70) {
    const oc = mz.worstRatio < 0.40 ? 'rgba(255,90,90,0.85)' : 'rgba(255,210,100,0.8)';
    outline += `<polygon points="${panel.points}" fill="none" stroke="${oc}" stroke-width="0.8" pointer-events="none"/>`;
  }
  if (!cells && !halo) return { defs:'', body: outline };
  return { defs:`<clipPath id="${clipId}"><polygon points="${panel.points}"/></clipPath>`, body:`<g clip-path="url(#${clipId})" pointer-events="none">${cells}${halo}</g>` + outline };
}

// §5: 국부손상 overlay V2 — panel별 탄착점 기반 field renderer (clipPath 유지, marker 아래)
function aarRenderArmorDamageMapOverlay(u, view) {
  const snap = getAarArmorSnapshotForUnit(u);
  if (!snap) return '';
  const panels = getAarDamageMapPanels(u, view);
  if (!panels.length) return '';
  let defs = '', g = '';
  panels.forEach((p, idx) => {
    const r = aarRenderDamageFieldPanel(u, view, p, idx);
    defs += r.defs || '';
    g += r.body || '';
  });
  return (defs || g) ? `<defs>${defs}</defs>${g}` : '';
}
// §11: marker 상세 — 방어구 손상 정보 블록
function aarRenderArmorDamageInfoBlock(ev) {
  const list = (ev.armorDamageInfos && ev.armorDamageInfos.length) ? ev.armorDamageInfos : (ev.armorDamageInfo ? [ev.armorDamageInfo] : []);
  if (!list.length) return '';
  let h = `<div class="aar-damage-info"><div class="aar-damage-slot-title">방어구 손상</div>`;
  const layerKo = { hard:'하드', soft:'소프트', rear:'후면', helmet:'헬멧' };
  list.forEach((a, i) => {
    const zoneKo = AAR_ARMOR_ZONE_LABELS[a.localZone] || a.localZone || '—';
    const matKo = a.material || '—';
    const idxStr = list.length > 1 ? `${i + 1}) ` : '';
    h += `<div style="margin-top:3px">${idxStr}<b>${layerKo[a.layer] || a.layer || ''}</b> ${a.slotKey} / ${matKo}</div>`;
    h += `<div>· 국부 구역: <b>${zoneKo}</b></div>`;
    h += `<div>· 전체 내구도: ${a.globalAmount != null ? '-' + a.globalAmount : '—'}${a.afterRatio != null ? ' / 현재 ' + Math.round(a.afterRatio * 100) + '%' : ''}</div>`;
    h += `<div>· 국부 손상: +${a.localAmount != null ? a.localAmount : 0}</div>`;
    if (a.aarLabel || a.damageMode) h += `<div>· 손상형태: ${a.aarLabel || getArmorDamageModeLabelKo(a.damageMode)}</div>`;
    const kparts = [];
    if (a.impactEnergyJ != null) kparts_push(kparts, a.impactEnergyJ + 'J');
    if (a.impactMomentumNs != null) kparts_push(kparts, a.impactMomentumNs + 'Ns');
    if (kparts.length) h += `<div>· 충돌: ${kparts.join(' / ')}</div>`;
    const extra = [];
    if (a.spallRiskDelta > 0) extra.push('스폴+' + a.spallRiskDelta.toFixed(2));
    if (a.visibilityDamageDelta > 0) extra.push('시야손상+' + Math.round(a.visibilityDamageDelta));
    if (a.backfaceDeformationHint > 0) extra.push('후면변형 힌트 ' + a.backfaceDeformationHint.toFixed(1));
    if (a.neighborSplashAmount > 0) extra.push('주변전파 ' + a.neighborSplashAmount.toFixed(1));
    if (extra.length) h += `<div style="color:#9fb0bd">· ${extra.join(' · ')}</div>`;
    // KORUND §6.1: 현재 누적 spallRisk / coatingDamage
    const accum = [];
    if (a.spallRiskAccum > 0) accum.push('스폴 위험 ' + Math.round(a.spallRiskAccum * 100) + '%');
    if (a.coatingDamageAccum > 0) accum.push('코팅 손상 ' + Math.round(a.coatingDamageAccum));
    if (accum.length) h += `<div style="color:#c8a96b">· 누적: ${accum.join(' · ')}</div>`;
    // KORUND §6.1: 강철 스폴 얕은 파편상
    if (a.spallWoundInfo && a.spallWoundInfo.triggered) {
      const sw = a.spallWoundInfo;
      const partKo = ({ left_arm:'좌팔', right_arm:'우팔', head:'얼굴', neck:'목', chest:'흉부', abdomen:'복부' })[sw.part] || sw.part;
      const depthKo = ({ abrasion:'찰과상', superficial_fragment:'표재성 파편상', shallow_fragment:'얕은 파편상' })[sw.woundDepth] || sw.woundDepth;
      h += `<div style="color:#e08a6b">· 부가 부상: ${partKo} ${depthKo} (피해 ${sw.rawDamage})</div>`;
    }
    // SIDE-ARMOR-PENETRATION-LOCALITY §12: 관통 국부화 / global cap 표시
    if (a.penetrationLocalityRebalance) h += `<div style="color:#8fb8e0">· 관통 손상 국부화 적용 (국부 손상 중심)</div>`;
    if (a.globalCapApplied) h += `<div style="color:#8fb8e0">· 전체 내구도 손상 제한 (${a.cappedGlobalBefore}→${a.cappedGlobalAfter})</div>`;
  });
  h += `</div>`;
  return h;
}
function kparts_push(arr, v) { arr.push(v); }
// §3.4: 현재 view 방어구 국부 손상률 — finalArmor 우선, 비어있으면 event aggregate fallback, 선택 marker slot은 반드시 포함
function aarRenderArmorLocalDamageField(u, view, hlSlot) {
  const snap = getAarArmorSnapshotForUnit(u);
  const eventAgg = buildAarArmorEventDamageAggregate(u.id);
  const panels = getAarDamageMapPanels(u, view);
  const slotCandidates = []; const seen = {};
  for (const p of panels) for (const k of p.slotKeys) { if (!seen[k]) { seen[k] = 1; slotCandidates.push(k); } }
  if (hlSlot && !seen[hlSlot]) { seen[hlSlot] = 1; slotCandidates.push(hlSlot); }   // 선택 marker가 손상시킨 slot은 panel에 없어도 포함
  const rows = [];
  for (const k of slotCandidates) {
    const sd = snap && snap[k];
    let lz = null, fromEvent = false;
    if (sd && sd.localZones && Object.keys(sd.localZones).some(z => (sd.localZones[z] || 0) > 0)) lz = sd.localZones;
    else if (eventAgg[k] && Object.keys(eventAgg[k].localZones).some(z => (eventAgg[k].localZones[z] || 0) > 0)) { lz = eventAgg[k].localZones; fromEvent = true; }
    if (!lz) continue;
    const zones = Object.keys(lz).filter(z => z !== 'unknown' && (lz[z] || 0) > 0).sort((a, b) => lz[b] - lz[a]);
    const unk = lz.unknown || 0;
    if (!zones.length && unk <= 0) continue;
    rows.push({ slotKey: k, zones, lz, unk, fromEvent, total: zones.reduce((s, z) => s + lz[z], 0) + unk, hl: (hlSlot === k) });
  }
  if (!rows.length) return `<div class="aar-damage-info"><div class="aar-damage-slot-title">현재 방어구 국부 손상률</div><div class="aar-unit-stat">국부 손상 없음</div></div>`;
  rows.sort((a, b) => (b.hl ? 1e9 : b.total) - (a.hl ? 1e9 : a.total));
  let h = `<div class="aar-damage-info"><div class="aar-damage-slot-title">현재 방어구 국부 손상률</div>`;
  rows.slice(0, 3).forEach(r => {
    h += `<div style="margin-top:3px${r.hl ? ';color:#ffe066;font-weight:700' : ''}">${r.slotKey}:${r.fromEvent ? ' <span style="color:#8a949c;font-size:8px">(이벤트 기반)</span>' : ''}</div><div>`;
    for (const z of r.zones) h += `<span class="aar-damage-chip" style="background:${aarDamageColor(r.lz[z])}">${AAR_ARMOR_ZONE_LABELS[z] || z} ${Math.round(r.lz[z])}</span>`;
    if (r.unk > 0) h += `<span class="aar-damage-chip" style="background:${aarDamageColor(r.unk)};opacity:0.7;font-size:8px">불명 ${Math.round(r.unk)}</span>`;
    h += `</div>`;
  });
  h += `</div>`;
  return h;
}

function aarRenderMarkers() {
  const br = GAME.battleReport, ui = GAME._aarUI;
  const u = UNITS.find(x=>x.id===ui.unitId);
  if (!u) return '유닛을 선택하세요 (유닛 탭에서)';
  const view = ui.view||'front';
  // 유닛 선택 바
  let h = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
    <select onchange="aarSelectUnit(+this.value)" style="background:#1c2229;color:#d6dde2;border:1px solid #2a3138;border-radius:4px;padding:5px">
    ${UNITS.map(x=>`<option value="${x.id}" ${x.id===u.id?'selected':''}>${_aarTeamKor(x.team)} ${x.callsign||x.name||x.id}</option>`).join('')}
    </select>
    <div class="aar-view-tabs">
      ${['front','side','rear','head'].map(v=>`<div class="aar-view-tab ${view===v?'on':''}" onclick="aarSetView('${v}')">${({front:'정면',side:'측면',rear:'후면',head:'머리'})[v]}</div>`).join('')}
      <div class="aar-view-tab ${ui.damageMapOn?'on':''}" onclick="aarToggleDamageMap()" title="방어구 국부 손상률 오버레이">국부손상 MAP</div>
    </div>
  </div>`;
  if (ui.damageMapOn) {
    h += `<div class="aar-damage-map-note">손상지도: <span style="color:#5fd97a">초록</span> 양호 · <span style="color:#d4c460">노랑</span> 경미 · <span style="color:#ff9a40">주황</span> 중간 · <span style="color:#ff6060">빨강</span> 심각<br>※ 손상지도는 AAR 주소 기반 근사 좌표와 방어구 손상량으로 재구성한 표시입니다. 실제 탄착 좌표가 아닙니다.</div>`;
  }
  // SVG
  h += `<div style="display:flex;gap:16px;flex-wrap:wrap"><div style="flex:0 0 auto">`;
  h += aarRenderCoverageSvg(u, view);
  // 범례
  h += `<div style="margin-top:6px;font-size:9px;color:#8a949c;line-height:1.7">
    <span style="display:inline-flex;align-items:center;gap:3px"><svg width="12" height="12"><circle cx="6" cy="6" r="3" fill="#ff2a1a"/></svg>총탄</span>&nbsp;&nbsp;
    <span style="display:inline-flex;align-items:center;gap:3px"><svg width="12" height="12"><polygon points="6,2 10,6 6,10 2,6" fill="#ff2a1a"/></svg>파편</span><br>
    <span style="color:#ff2a1a">●</span> 관통(큰 점) &nbsp; <span style="color:#ff6a5a">○</span> 방호 &nbsp; <span style="color:#ffd040">●</span> 도탄 &nbsp; <span style="color:#7ad8f0">●</span> 균열
  </div>`;
  h += `</div><div style="flex:1;min-width:200px">`;
  // marker 상세
  if (ui.markerSel != null) {
    const ev = br.impactLog.find(e=>e.eventId===ui.markerSel);
    if (ev) {
      const ia = ev.impactAddress||{};
      const srcKor = {bullet:'총탄',frag:'파편',fragment:'파편',blast:'폭압',blunt:'둔격'}[ev.sourceType]||'총탄';
      const ms = ev.medicalSummaryAfter;
      const msLine = (ms && (ms.lifeStatus!=null || ms.bloodMl!=null))
        ? `<div>피격 후: LIFE ${ms.lifeStatus!=null?ms.lifeStatus:'—'}%${ms.bloodMl!=null?' · 혈액 '+ms.bloodMl+'ml':''}</div>` : '';
      // SIDE-ARMOR-2D: 결과는 event/armorHitResult/damageSummary fallback까지 확인. coverage 메타도 표시.
      const resKor = getArmorResultLabel(ia, ev) || '—';
      // SIDE-AAR-ARMOR-2C: 통합 정규화 — 인체주소/방호레이어/방호접촉부/coverage근거 분리, raw는 debug만
      const norm = (typeof normalizeImpactForAAR === 'function') ? normalizeImpactForAAR(ev) : null;
      const covLines = [];
      if (norm && norm.isCoverageAware) {
        if (norm.bodyAddressLabel) covLines.push(`<div>피격주소: ${norm.bodyAddressLabel}</div>`);
        if (norm.armorLayerLabel) covLines.push(`<div>방호 레이어: ${norm.armorLayerLabel}</div>`);
        if (norm.armorContactLabel) covLines.push(`<div>방호 접촉부: ${norm.armorContactLabel}</div>`);
        if (norm.coverageSourceLabel) covLines.push(`<div>coverage 근거: ${norm.coverageSourceLabel}</div>`);
        if (ev.durabilityOwnerId) covLines.push(`<div>내구도 소모: ${ev.durabilityOwnerId}</div>`);
        if (GAME.debugUtility && norm.debugRaw) covLines.push(`<div style="color:#667;font-size:10px">raw: ${norm.debugRaw.fullAddress||'—'} · ${norm.debugRaw.selectedLayerType||'—'} · ${norm.debugRaw.coverageSource||'—'}</div>`);
      } else {
        if (ev.impactAddressFull || ia.fullAddress) covLines.push(`<div>피격주소: ${(norm&&norm.bodyAddressLabel)||ev.impactAddressFull||ia.fullAddress}</div>`);
        const sl = ev.selectedLayerType, cs = ev.coverageSource;
        if (sl) covLines.push(`<div>방호 레이어: ${_covLayerKo(sl)}</div>`);
        if (norm && norm.armorContactLabel) covLines.push(`<div>방호 접촉부: ${norm.armorContactLabel}</div>`);
        if (ev.durabilityOwnerId) covLines.push(`<div>내구도 소모: ${ev.durabilityOwnerId}</div>`);
      }
      if (ev.backerInfo && ev.backerInfo.layerType) covLines.push(`<div>후방 레이어: ${_covLayerKo(ev.backerInfo.layerType)} backer / ${_covBackerResultKo(ev.backerInfo.backerResult)}</div>`);
      // HOTFIX 2-5: 이 피격으로 손상된 장비 슬롯 (impactLog.armorDamageInfos ↔ armorLog 연결)
      if (Array.isArray(ev.armorDamageInfos) && ev.armorDamageInfos.length) {
        const _dmgLines = ev.armorDamageInfos.map(di => {
          const _sk = di.slotKey || di.key || (di.slot && di.slot.key) || '';
          const _lz = di.localZones ? Object.keys(di.localZones).filter(z => di.localZones[z] > 0).join('/') : (di.localZone || '');
          const _mode = di.damageMode || di.mode || '';
          const _amt = (di.globalAmount != null ? di.globalAmount : di.amount);
          return `<div style="color:#c8a0a0">· ${_aarSlotKeyLabel(_sk)}${_amt != null ? ' −' + (+_amt).toFixed(1) : ''}${_lz ? ' (' + _lz + ')' : ''}${_mode ? ' · ' + _mode : ''}</div>`;
        });
        if (_dmgLines.length) covLines.push(`<div style="margin-top:2px;color:#b89">이 피격 손상 슬롯:</div>` + _dmgLines.join(''));
      }
      // SIDE-MED-2B-1A: 상처 경로 / 출혈 분류
      const btLabel = ev.bodyTrajectoryLabel || (ev.bodyTrajectory && typeof bodyTrajectorySummaryLabel === 'function' ? bodyTrajectorySummaryLabel(ev.bodyTrajectory) : null);
      if (btLabel) covLines.push(`<div style="color:#9fb0bd;margin-top:2px">${btLabel}</div>`);
      // SIDE-MED-BALLISTIC-2C-1 §16: 입구/후면 방호 요약 (raw key 없이)
      const _bt0 = ev.bodyTrajectory;
      if (_bt0 && typeof entryArmorSummaryLabel === 'function') {
        const es = entryArmorSummaryLabel(_bt0); if (es) covLines.push(`<div>입구 방호: ${es}</div>`);
        if (_bt0.rearArmorChecked) { const rs = rearArmorSummaryLabel(_bt0); if (rs) covLines.push(`<div>후면 방호: ${rs}</div>`); }
      }
      // HOTFIX-2 §7: 후속 탄도 생성/명중 표시
      const _bt = ev.bodyTrajectory;
      if (_bt) {
        if (_bt.continuationFired) covLines.push(`<div style="color:#c98">후속 탄도: ${_bt.continuationHitTarget ? '2차 표적 명중' : '생성됨(미명중)'}${_bt.continuationThreatPacket ? ' / residualPen ' + _bt.continuationThreatPacket.residualPen : ''}</div>`);
        else if (_bt.bodyThroughAndThrough && !_bt.continueRaycast) {
          const why = (_bt.rearArmorResult === 'stopped_by_rear_plate') ? '후면 플레이트 정지' : (_bt.rearArmorResult === 'stopped_by_rear_soft') ? '후면 소프트 정지' : '잔여 관통력 부족';
          covLines.push(`<div style="color:#889">후속 탄도: 없음 / ${why}</div>`);
        }
      }
      const _title = (norm && norm.primaryLabel) || ev.aarLabel || getImpactAddressLabel(ia) || '피격';
      const _selMk = br.hitMarkers.find(mk => mk.eventId === ui.markerSel);
      const _coordLine = _selMk ? `<div style="color:#ffe066;font-family:monospace">피격 좌표: (${_selMk.x.toFixed(1)}, ${_selMk.y.toFixed(1)}) · ${_selMk.view || 'torso'}${_selMk.aspect ? '/' + _selMk.aspect : ''}</div>` : '';
      h += `<div class="aar-marker-detail">
        <div><span class="aar-log-time">[${_aarTime(ev.time)}]</span> ${_aarUnitName(ev.shooterId)} → ${_aarUnitName(ev.targetId)}</div>
        <div style="font-weight:700;margin-top:4px">${_title}</div>
        ${_coordLine}
        <div>유형: ${srcKor}</div>
        <div>무기/탄: ${_aarWeaponName(ev.weaponName)} / ${_aarAmmoName(ev.ammoId)}</div>
        <div>결과: ${resKor}</div>
        ${covLines.join('')}
        ${ia.organCandidates&&ia.organCandidates.length?`<div>장기 후보: ${getOrganListLabel(ia.organCandidates.slice(0,3))}</div>`:''}
        ${msLine}
        ${aarRenderArmorDamageInfoBlock(ev)}
        <div style="color:#6b7780;margin-top:3px;font-size:9px">※ 주소 기반 근사 표시 (실제 탄착 좌표 아님)</div>
      </div>`;
    }
  } else {
    const markers = br.hitMarkers.filter(mk=>mk.targetId===u.id);
    h += `<div class="aar-unit-stat">붉은 점을 탭하면 상세가 표시됩니다.<br>이 유닛 총 피격 marker: ${markers.length}개</div>`;
  }
  // SIDE-AAR-ARMOR-DAMAGE-MAP §13: 국부손상 MAP ON 시 현재 view 국부 손상률 필드
  if (ui.damageMapOn) {
    let hlSlot = null;
    if (ui.markerSel != null) {
      const sev = br.impactLog.find(e=>e.eventId===ui.markerSel);
      const adi = sev && (sev.armorDamageInfo || (sev.armorDamageInfos && sev.armorDamageInfos[0]));
      if (adi) hlSlot = adi.slotKey;
    }
    h += aarRenderArmorLocalDamageField(u, view, hlSlot);
  }
  h += `</div></div>`;
  return h;
}

// AAR용 coverage SVG (선택 유닛의 최종 장비 + 피격 marker)
function aarRenderCoverageSvg(u, view) {
  const br = GAME.battleReport;
  // 2A-4: final snapshot 우선, 없으면 initial fallback (장구류는 전투 중 안 바뀌므로 동일하지만 규약 준수)
  const init = (br.unitsFinal && br.unitsFinal[u.id]) || br.unitsInitial[u.id] || {};
  const isHead = (view==='head');
  const vb = isHead ? '0 0 100 60' : '0 0 100 100';
  const W = isHead ? 280 : 300, H = isHead ? 168 : 300;
  let svg = `<svg viewBox="${vb}" width="${W}" height="${H}" style="background:#12161b;border:1px solid #2a3138;border-radius:6px">`;
  // === AAR 피격 위치 좌표 그리드 — 랜덤 피격 마커의 좌표를 읽어 정확한 위치 지정에 사용 ===
  //   viewBox: 전신 0 0 100 100 / 머리 0 0 100 60. 격자 10 간격, 라벨 20 간격.
  {
    const gW = 100, gH = isHead ? 60 : 100;
    let g = '<g class="aar-coord-grid" pointer-events="none">';
    for (let gx = 0; gx <= gW; gx += 10) {
      const major = (gx === 0 || gx === 50 || gx === 100);
      g += `<line x1="${gx}" y1="0" x2="${gx}" y2="${gH}" stroke="${major ? '#38434f' : '#232c34'}" stroke-width="${major ? 0.4 : 0.25}"/>`;
    }
    for (let gy = 0; gy <= gH; gy += 10) {
      const major = (gy === 0 || gy === gH || gy === Math.round(gH / 20) * 10);
      g += `<line x1="0" y1="${gy}" x2="${gW}" y2="${gy}" stroke="${major ? '#38434f' : '#232c34'}" stroke-width="${major ? 0.4 : 0.25}"/>`;
    }
    // 눈금 숫자 — 상단 x축 / 좌측 y축 (20 간격, 혼잡 방지)
    for (let gx = 0; gx <= gW; gx += 20) {
      g += `<text x="${gx === 0 ? 1 : (gx === 100 ? 99 : gx)}" y="3.2" fill="#6f7f8c" font-size="2.9" text-anchor="${gx === 0 ? 'start' : (gx === 100 ? 'end' : 'middle')}">${gx}</text>`;
    }
    for (let gy = 20; gy <= gH; gy += 20) {
      g += `<text x="1" y="${gy + 1}" fill="#6f7f8c" font-size="2.9" text-anchor="start">${gy}</text>`;
    }
    g += '</g>';
    svg += g;
  }
  // 실루엣
  if (isHead) svg += (typeof getHeadSilhouette==='function'? getHeadSilhouette('front'):'');
  else {
    const aspect = (view==='side')?'side':(view==='rear'?'rear':'front');
    svg += (typeof getTorsoSilhouette==='function'? getTorsoSilhouette(aspect):'');
    // 추가 보호구 (목/어깨/낭심) — 장착된 경우만, soft armor 아래에 먼저
    if (typeof ACCESSORY_SHAPES !== 'undefined') {
      const accCol = 'rgba(150,90,200,0.40)', accStroke = 'rgba(190,140,230,0.75)';
      const drawAcc = (type, accId) => {
        if (!accId || accId.indexOf('no_')===0) return;
        const aShape = ACCESSORY_SHAPES[type] && ACCESSORY_SHAPES[type][aspect];
        if (!aShape) return;
        if (aShape.ids) for (const sub of aShape.ids) svg += `<polygon points="${sub.points}" fill="${accCol}" stroke="${accStroke}" stroke-width="0.5"/>`;
        else if (aShape.points) svg += `<polygon points="${aShape.points}" fill="${accCol}" stroke="${accStroke}" stroke-width="0.5"/>`;
      };
      drawAcc('neck', init.neckGuardId);
      drawAcc('shoulder', init.shoulderGuardId);
      drawAcc('groin', init.groinGuardId);
    }
    // armor coverage polygon
    const shape = ARMOR_COVERAGE_SHAPES[init.bodyArmorId];
    const sd = shape && shape[aspect];
    if (sd) {
      if (sd.softShape) svg += `<polygon points="${sd.softShape.points}" fill="rgba(70,160,90,0.40)" stroke="rgba(120,200,130,0.7)" stroke-width="0.5"/>`;
      const armorPreset = BODY_ARMOR_PRESETS[init.bodyArmorId];
      const noPlates = armorPreset && armorPreset.noPlateSlots;
      const plateId = aspect==='front'?init.frontPlateId:(aspect==='rear'?init.backPlateId:init.sidePlateId);
      const plate = (!noPlates && plateId)?PLATE_PRESETS[plateId]:null;
      // 고정형 내장 플레이트
      if (sd.hardShape && sd.hardShape.fixedPlate) {
        svg += `<polygon points="${sd.hardShape.points}" fill="rgba(60,140,200,0.7)" stroke="rgba(140,200,255,0.9)" stroke-width="0.7"/>`;
      } else if (sd.hardShape && plate && !plate.isNone) {
        const ps = (typeof getPlateShape==='function')?getPlateShape(plate.id,_slotHitPart(sd.hardShape.slot)):'sapi';
        const bbox=_bboxOfPoints(sd.hardShape.points);
        svg += `<polygon points="${plateShapeToPoints(ps,bbox,0)}" fill="rgba(60,140,200,0.7)" stroke="rgba(140,200,255,0.9)" stroke-width="0.7"/>`;
      }
      if (sd.hardShapeSet && plate && !plate.isNone) for(const hs of sd.hardShapeSet){
        const ps=(typeof getPlateShape==='function')?getPlateShape(plate.id,_slotHitPart(hs.slot)):'sapi';
        const bbox=_bboxOfPoints(hs.points);
        svg += `<polygon points="${plateShapeToPoints(ps,bbox,0)}" fill="rgba(60,140,200,0.7)" stroke="rgba(140,200,255,0.9)" stroke-width="0.7"/>`;
      }
    }
    // 측면 플레이트 — 전면/후면 view에서는 좌우 옆구리 패널로 표시
    if ((aspect==='front' || aspect==='rear') && init.sidePlateId) {
      const sp = PLATE_PRESETS[init.sidePlateId];
      if (sp && !sp.isNone) {
        const sShape = (typeof getPlateShape==='function')?getPlateShape(sp.id,'chest'):'side_plate_small';
        const isLarge = (sShape==='side_plate_large');
        const edges = SIDE_PLATE_EDGE_POLYGONS[isLarge?'large':'small'];
        for (const e of edges) svg += `<polygon points="${e}" fill="rgba(60,140,200,0.65)" stroke="rgba(140,200,255,0.9)" stroke-width="0.6"/>`;
      }
    }
  }
  // 헬멧 (head view) — 쉘 + 바이저 + SLAAP
  if (isHead) {
    const hShape = HELMET_COVERAGE_SHAPES[init.helmetId];
    const hd = hShape && hShape['front'];
    if (hd && hd.shellShape) svg += `<polygon points="${hd.shellShape.points}" fill="rgba(60,140,200,0.55)" stroke="rgba(140,200,255,0.85)" stroke-width="0.6"/>`;
    // 바이저 (분홍) / SLAAP (노랑) — 장착 시
    if (typeof ACCESSORY_SHAPES !== 'undefined') {
      if (init.visorId && init.visorId.indexOf('no_')!==0) {
        const vId = init.visorId;
        if (vId === 'k6_3_visor' && ACCESSORY_SHAPES.visorK63) {
          const vk = ACCESSORY_SHAPES.visorK63.front;
          if (vk) { svg += `<polygon points="${vk.frame.points}" fill="rgba(230,200,60,0.45)" stroke="rgba(245,225,120,0.9)" stroke-width="0.5"/>`;
                    svg += `<polygon points="${vk.glass.points}" fill="rgba(220,80,200,0.42)" stroke="rgba(240,140,220,0.9)" stroke-width="0.5"/>`; }
        } else {
          const vs = ACCESSORY_SHAPES.visor && ACCESSORY_SHAPES.visor.front;
          if (vs) svg += `<polygon points="${vs.points}" fill="rgba(220,80,200,0.32)" stroke="rgba(240,140,220,0.85)" stroke-width="0.5"/>`;
        }
      }
      if (init.slaapId && init.slaapId.indexOf('no_')!==0) {
        const ss = ACCESSORY_SHAPES.slaap && ACCESSORY_SHAPES.slaap.front;
        if (ss) svg += `<polygon points="${ss.points}" fill="rgba(230,200,60,0.42)" stroke="rgba(245,225,120,0.9)" stroke-width="0.5"/>`;
      }
    }
  }
  // SIDE-AAR-ARMOR-DAMAGE-MAP §10: 국부손상 overlay — 장비 polygon 다음, marker 이전 (slot별 clipPath 내부)
  if (GAME._aarUI && GAME._aarUI.damageMapOn) {
    svg += aarRenderArmorDamageMapOverlay(u, view);
  }
  // 피격 marker
  const markers = br.hitMarkers.filter(mk=>mk.targetId===u.id && mk.view===(isHead?'head':'torso'));
  for (const mk of markers) {
    // view 필터 (torso만 aspect 구분)
    if (!isHead && mk.aspect && mk.aspect !== view && !(view==='front'&&!mk.aspect)) {
      if (mk.aspect !== view) continue;
    }
    const sel = (GAME._aarUI.markerSel===mk.eventId);
    let fill='#ff4438', r=1.8, stroke='none';
    if (mk.kind==='penetrated'){ fill='#ff2a1a'; r=2.4; }
    else if (mk.kind==='stopped'){ fill='none'; stroke='#ff6a5a'; r=1.6; }
    else if (mk.kind==='ricochet'){ fill='#ffd040'; r=1.8; }
    else if (mk.kind==='crack'){ fill='#7ad8f0'; r=1.8; }
    const sw = sel?0.8:(stroke!=='none'?0.7:0);
    const strokeC = sel?'#ffe066':(stroke!=='none'?stroke:'none');
    if (mk.source === 'frag') {
      // 파편 — 마름모(diamond)
      const rr = (sel?r+1.2:r)*1.15;
      const pts = `${mk.x},${(mk.y-rr).toFixed(1)} ${(mk.x+rr).toFixed(1)},${mk.y} ${mk.x},${(mk.y+rr).toFixed(1)} ${(mk.x-rr).toFixed(1)},${mk.y}`;
      svg += `<polygon class="aar-marker" points="${pts}" fill="${fill==='none'?'none':fill}" stroke="${strokeC}" stroke-width="${sw}" onclick="aarSelMarker(${mk.eventId})"/>`;
    } else {
      // 총탄 — 원(circle)
      svg += `<circle class="aar-marker" cx="${mk.x}" cy="${mk.y}" r="${sel?r+1.2:r}" fill="${fill==='none'?'none':fill}" stroke="${strokeC}" stroke-width="${sw}" onclick="aarSelMarker(${mk.eventId})"/>`;
    }
    // 선택된 마커 → 좌표 라벨을 인체도에 직접 표시 (사용자가 랜덤 좌표 확인용)
    if (sel) {
      const lx = mk.x > 70 ? mk.x - 1 : mk.x + 3.5;
      const anchor = mk.x > 70 ? 'end' : 'start';
      const ly = mk.y < 8 ? mk.y + 6 : mk.y - 3;
      svg += `<g pointer-events="none"><rect x="${(anchor==='end'?lx-19:lx-0.5).toFixed(1)}" y="${(ly-3.6).toFixed(1)}" width="19" height="4.6" rx="0.8" fill="rgba(10,14,18,0.82)" stroke="#ffe066" stroke-width="0.25"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#ffe066" font-size="3.2" text-anchor="${anchor}" font-family="monospace">(${mk.x.toFixed(1)}, ${mk.y.toFixed(1)})</text></g>`;
    }
  }
  svg += `</svg>`;
  return svg;
}

function aarRenderMedical() {
  const br = GAME.battleReport, ui = GAME._aarUI;
  const u = UNITS.find(x=>x.id===ui.unitId);
  if (!u) return '유닛을 선택하세요 (유닛 탭에서)';
  const fm = br.finalMedical[u.id];
  if (!fm) return '의료 정보 없음';
  let h = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
    <select onchange="aarSelectUnit(+this.value)" style="background:#1c2229;color:#d6dde2;border:1px solid #2a3138;border-radius:4px;padding:5px">
    ${UNITS.map(x=>`<option value="${x.id}" ${x.id===u.id?'selected':''}>${_aarTeamKor(x.team)} ${x.callsign||x.name||x.id}</option>`).join('')}
    </select><span class="aar-unit-stat">읽기 전용 최종 의료 상태</span></div>`;
  h += `<div class="aar-2col">`;
  // 좌: 부위별
  h += `<div class="aar-col"><div class="aar-section-title">신체 부위</div>`;
  const partKor = {head:'머리',neck:'목',chest:'흉부',abdomen:'복부',leftArm:'좌완',rightArm:'우완',leftLeg:'좌각',rightLeg:'우각'};
  for (const k in fm.bodyParts) {
    const p = fm.bodyParts[k];
    const ratio = p.maxHp>0?p.hp/p.maxHp:0;
    const col = ratio>0.6?'#5fc77f':ratio>0.3?'#e0c040':'#e05050';
    let chips='';
    if (p.externalBleedRate>0||p.internalBleedRate>0) chips+=`<span class="aar-chip bleed">출혈</span>`;
    if (p.fracture) chips+=`<span class="aar-chip frac">골절</span>`;
    if (p.tourniquetApplied) chips+=`<span class="aar-chip tq">지혈대</span>`;
    if (p.bandageApplied) chips+=`<span class="aar-chip tq">붕대</span>`;
    if (p.splinted) chips+=`<span class="aar-chip tq">부목</span>`;
    if (p.chestSealed) chips+=`<span class="aar-chip seal">흉부씰</span>`;
    h += `<div class="aar-med-part"><span style="width:42px;color:#8a949c">${partKor[k]||k}</span>
      <div class="aar-med-bar"><div style="width:${Math.round(ratio*100)}%;background:${col}"></div></div>
      <span style="width:54px;text-align:right">${p.hp}/${p.maxHp}</span>${chips}</div>`;
  }
  h += `</div>`;
  // 중앙: vitals
  h += `<div class="aar-col"><div class="aar-section-title">활력징후</div>`;
  const _num=(v)=> (typeof v==='number'&&isFinite(v)) ? v : '—';
  const vit=(k,v,u2)=>`<div class="aar-kv"><span class="k">${k}</span><span class="v">${v}${(v==='—')?'':(u2||'')}</span></div>`;
  const bloodPct = (fm.bloodMl!=null && fm.bloodMax>0) ? Math.round(fm.bloodMl/fm.bloodMax*100) : null;
  h += vit('LIFE', _num(fm.lifeStatus),'%');
  h += vit('BODY', (fm.bodyHpTotal!=null&&fm.bodyHpMax!=null)?fm.bodyHpTotal+'/'+fm.bodyHpMax:'—');
  h += vit('BLOOD', fm.bloodMl!=null?(fm.bloodMl+'ml'+(bloodPct!=null?' ('+bloodPct+'%)':'')):'—');
  h += vit('HR', _num(fm.heartRate),' bpm');
  h += vit('BP', (fm.systolicBP!=null&&fm.diastolicBP!=null)?fm.systolicBP+'/'+fm.diastolicBP:'—');
  h += vit('RESP', _num(fm.breathingEfficiency),'%');
  h += vit('PAIN', _num(fm.pain));
  h += vit('SHOCK', _num(fm.shock));
  h += vit('CONSC', _num(fm.consciousness));
  let statusLbl = fm.isDead?'사망':fm.isUnconscious?'의식불명':fm.lifeStatus<40?'위독':fm.lifeStatus<70?'중상':fm.shock>50?'쇼크 진행':fm.bloodMl<fm.bloodMax*0.7?'출혈':'안정';
  h += `<div class="aar-kv"><span class="k">종합</span><span class="v ${fm.isDead?'aar-dead':fm.lifeStatus<70?'aar-down':'aar-ok'}">${statusLbl}</span></div>`;
  // mini ECG (정지 파형)
  h += `<div class="aar-section-title">ECG</div>`;
  h += aarRenderMiniEcg(fm);
  h += `</div>`;
  // 우: 처치 + 위험
  h += `<div class="aar-col"><div class="aar-section-title">적용된 처치</div>`;
  const tr = fm.treatments||{};
  let anyTreat=false;
  if (tr.tourniquet>0){h+=`<div class="aar-kv"><span class="k">지혈대</span><span class="v">${tr.tourniquet}부위</span></div>`;anyTreat=true;}
  if (tr.bandage>0){h+=`<div class="aar-kv"><span class="k">붕대</span><span class="v">${tr.bandage}부위</span></div>`;anyTreat=true;}
  if (tr.splint>0){h+=`<div class="aar-kv"><span class="k">부목</span><span class="v">${tr.splint}부위</span></div>`;anyTreat=true;}
  if (tr.chestSeal>0){h+=`<div class="aar-kv"><span class="k">흉부씰</span><span class="v">${tr.chestSeal}부위</span></div>`;anyTreat=true;}
  if (!anyTreat) h+=`<div class="aar-unit-stat">적용된 처치 없음</div>`;
  h += `<div class="aar-section-title">남은 위험</div>`;
  const risks=[];
  if (fm.externalBleedRate>0) risks.push('외부출혈 지속');
  if (fm.internalBleedRate>0) risks.push('내부출혈 의심');
  if (fm.shock>50) risks.push('쇼크 진행');
  if (fm.consciousness<50) risks.push('의식 저하');
  if (fm.breathingEfficiency<60) risks.push('호흡 부전');
  if (!risks.length && !fm.isDead) risks.push('특이사항 없음');
  if (fm.isDead) risks.length=0, risks.push('사망 ('+(fm.deathReason||'불명')+')');
  for (const r of risks) h += `<div class="aar-kv"><span class="k">·</span><span class="v ${fm.isDead?'aar-dead':'aar-down'}">${r}</span></div>`;
  h += `</div></div>`;
  return h;
}
function aarRenderMiniEcg(fm) {
  // 정지 파형 — dead면 flatline, 아니면 HR 기반 간이 파형
  const w=200,h=44;
  if (fm.isDead || fm.heartRate<=0) {
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background:#0d1014;border:1px solid #2a3138;border-radius:4px"><line x1="0" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="#ff4438" stroke-width="1.2"/><text x="6" y="14" fill="#ff6a5a" font-size="9">FLATLINE</text></svg>`;
  }
  // HR로 파형 간격 결정
  const hr = fm.heartRate||75;
  const beats = Math.max(2, Math.round(hr/60*2.2));
  const seg = w/beats;
  let d=`M 0 ${h/2}`;
  for (let i=0;i<beats;i++){
    const x0=i*seg;
    d+=` L ${x0+seg*0.5} ${h/2} L ${x0+seg*0.55} ${h/2-3} L ${x0+seg*0.6} ${h*0.18} L ${x0+seg*0.66} ${h*0.85} L ${x0+seg*0.72} ${h/2} L ${x0+seg} ${h/2}`;
  }
  const col = fm.shock>50?'#ffd040':'#5fe080';
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background:#0d1014;border:1px solid #2a3138;border-radius:4px"><path d="${d}" fill="none" stroke="${col}" stroke-width="1.2"/><text x="6" y="12" fill="#6b7780" font-size="8">HR ${hr}</text></svg>`;
}

function aarRenderArmor() {
  const br = GAME.battleReport, ui = GAME._aarUI;
  const u = UNITS.find(x=>x.id===ui.unitId);
  if (!u) return '유닛을 선택하세요 (유닛 탭에서)';
  const fa = br.finalArmor[u.id]||{};
  const init = br.unitsInitial[u.id]||{};
  let h = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
    <select onchange="aarSelectUnit(+this.value)" style="background:#1c2229;color:#d6dde2;border:1px solid #2a3138;border-radius:4px;padding:5px">
    ${UNITS.map(x=>`<option value="${x.id}" ${x.id===u.id?'selected':''}>${_aarTeamKor(x.team)} ${x.callsign||x.name||x.id}</option>`).join('')}
    </select><span class="aar-unit-stat">최종 장구류 내구도</span></div>`;
  const slotKor = {
    chest_front_soft:'방탄복 (전면 소프트)', chest_rear_soft:'방탄복 (후면 소프트)',
    chest_left_soft:'방탄복 (좌측 소프트)', chest_right_soft:'방탄복 (우측 소프트)',
    abdomen_front_soft:'방탄복 (복부 소프트)', abdomen_rear_soft:'방탄복 (후복부 소프트)',
    chest_front_hard:'전면 플레이트', chest_rear_hard:'후면 플레이트', abdomen_front_hard:'복부 플레이트',
    left_side_hard:'좌측판', right_side_hard:'우측판',
    head_skull_shell:'헬멧 (두개부)', head_temporal_shell:'헬멧 (측두부)', head_face_visor:'바이저/안면판',
    neck_soft:'목 보호대',
  };
  const keys = Object.keys(fa);
  if (!keys.length) { h+=`<div class="aar-unit-stat">장구류 내구도 정보 없음</div>`; return h; }
  for (const k of keys) {
    const d = fa[k];
    const ratio = d.max>0?d.current/d.max:0;
    const broken = d.current<=0;
    const col = broken?'#e05050':ratio>0.6?'#5fc77f':ratio>0.3?'#e0c040':'#e08040';
    h += `<div class="aar-med-part"><span style="width:140px;color:#8a949c">${slotKor[k]||k}</span>
      <div class="aar-med-bar"><div style="width:${Math.round(ratio*100)}%;background:${col}"></div></div>
      <span style="width:70px;text-align:right">${broken?'<span class="aar-dead">파손</span>':d.current+' / '+d.max}</span></div>`;
  }
  return h;
}

function _aarTime(t) { return (typeof t === 'number' && isFinite(t)) ? t.toFixed(1)+'s' : '—'; }
function _aarSlotKeyLabel(key) {
  if (!key) return '장비';
  // 측면판 전용 키
  if (key === 'left_side_hard') return '좌측 플레이트';
  if (key === 'right_side_hard') return '우측 플레이트';
  if (key === 'head_face_visor') return '바이저/안면판';
  if (key === 'head_skull_shell' || key === 'head_skull_hard') return '헬멧 (두개부)';
  if (key === 'head_temporal_shell') return '헬멧 (측두부)';
  // 예: chest_front_hard → 흉부 정면 (하드)
  const partMap = {chest:'흉부',abdomen:'복부',head_skull:'두개골',head_face:'안면',neck:'목',arms:'팔',legs:'다리',helmet:'헬멧'};
  const sideMap = {front:'정면',rear:'후면',side:'측면',left:'좌측',right:'우측'};
  const layerMap = {hard:'하드',soft:'소프트'};
  let part=null, side=null, layer=null;
  for (const p in partMap) if (key.indexOf(p)===0) { part=partMap[p]; break; }
  for (const sk in sideMap) if (key.indexOf('_'+sk)>=0) { side=sideMap[sk]; break; }
  for (const l in layerMap) if (key.indexOf('_'+l)>=0) { layer=layerMap[l]; break; }
  let out = part || key;
  if (side) out += ' '+side;
  if (layer) out += ' ('+layer+')';
  return out;
}
function aarRenderLog() {
  const br = GAME.battleReport, ui = GAME._aarUI;
  const f = ui.logFilter||'all';
  const filters=[['all','전체'],['impact','피격'],['kill','사살'],['shot','사격'],['armor','장비'],['medical','의료']];
  let h = `<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">${filters.map(x=>`<div class="aar-view-tab ${f===x[0]?'on':''}" onclick="aarSetLogFilter('${x[0]}')">${x[1]}</div>`).join('')}</div>`;
  h += `<div style="max-height:60vh;overflow:auto">`;
  const lines=[];
  if (f==='all'||f==='impact') for (const ev of br.impactLog) lines.push([ev.time||0, `<span class="aar-log-time">[${_aarTime(ev.time)}]</span> ${_aarUnitName(ev.shooterId)} → ${_aarUnitName(ev.targetId)} · ${ev.aarLabel||(IA_LABELS.hitPart[ev.hitPart]||ev.hitPart)||'피격'}`]);
  if (f==='all'||f==='kill') for (const k of br.killLog) {
    const causeKor={bullet:'총상',fragment:'파편',frag:'파편',blast:'폭압',bleeding:'출혈',shock:'쇼크',unknown:'불명'}[k.cause]||'불명';
    lines.push([k.time||0, `<span class="aar-log-time">[${_aarTime(k.time)}]</span> ☠ ${k.killerId!=null?_aarUnitName(k.killerId)+' → ':''}${_aarUnitName(k.victimId)} · ${causeKor}${k.hitPart?' / '+(IA_LABELS.hitPart[k.hitPart]||k.hitPart):''}`]);
  }
  if (f==='all'||f==='armor') for (const a of br.armorLog) lines.push([a.time||0, `<span class="aar-log-time">[${_aarTime(a.time)}]</span> ${_aarUnitName(a.unitId)} · ${_aarSlotKeyLabel(a.slotKey)} ${a.before}→${a.after}`]);
  if (f==='all'||f==='medical') for (const md of br.medicalLog) lines.push([md.time||0, `<span class="aar-log-time">[${_aarTime(md.time)}]</span> ${_aarUnitName(md.unitId)} · ${md.label||'상태 변화'}`]);
  if (f==='shot') {
    for (const id in br.unitStats){ const st=br.unitStats[id];
      const rate = st.shotsFired>0?Math.round(st.shotsHit/st.shotsFired*100):0;
      lines.push([0, `${_aarUnitName(+id)} · 발사 ${st.shotsFired||0} / 명중 ${st.shotsHit||0} (${rate}%)`]); }
  }
  if (f!=='shot') lines.sort((a,b)=>a[0]-b[0]);
  if (!lines.length) h += `<div class="aar-unit-stat">기록 없음</div>`;
  else for (const l of lines) h += `<div class="aar-log-line">${l[1]}</div>`;
  h += `</div>`;
  return h;
}


document.getElementById('btnReset').addEventListener('click', () => {
  // 2A-3.5: 전투 중이면 사후강평을 먼저 표시 (즉시 초기화하지 않음)
  if (GAME.phase === 'play' && aarActive() && !GAME.battleReport.finalized) {
    GAME.paused = true;
    aarFinalize('reset');
    return;
  }
  if (confirm('미션을 리셋하고 로드아웃 화면으로 돌아가시겠습니까?')) {
    returnToLoadout();
  }
});

// === 응급처치 메뉴 ===
let medicMenuTreater = null;   // 처치자 id
let medicMenuTarget  = null;   // 대상 id

function openMedicMenu(treater, target) {
  medicMenuTreater = treater.id;
  medicMenuTarget  = target.id;
  // 게임 일시정지 — 메뉴 선택 시 시간 흐름 X
  refreshMedicMenu();
  const el = document.getElementById('medicMenu');
  if (el) el.classList.add('on');
  // 서브 메뉴 닫기
  const sub = document.getElementById('medicSub');
  if (sub) sub.classList.remove('on');
}

function closeMedicMenu() {
  medicMenuTreater = null;
  medicMenuTarget  = null;
  const el = document.getElementById('medicMenu');
  if (el) el.classList.remove('on');
}

function refreshMedicMenu() {
  if (medicMenuTarget == null) return;
  const tgt = unitById(medicMenuTarget);
  if (!tgt) { closeMedicMenu(); return; }
  // 대상이 정상 상태로 회복(의식 있고 downed 아님) → 메뉴 자동 닫기
  if (!tgt.isDowned && tgt.conscious && tgt.alive && !tgt.isDead) {
    closeMedicMenu();
    return;
  }
  const title = document.getElementById('medicTitle');
  const status = document.getElementById('medicStatus');
  if (title) title.textContent = tgt.name;
  if (status) {
    const consLabel = tgt.conscious ? '있음' : '없음';
    const consClass = tgt.conscious ? '' : 'danger';
    const bleedLabels = { none:'없음', light:'경미', heavy:'심함', critical:'치명' };
    const bleedClass = (tgt.bleeding === 'critical') ? 'danger' : (tgt.bleeding === 'heavy' ? 'warn' : '');
    const fxLabels = { none:'없음', arm:'팔', leg:'다리', chest:'흉부', multiple:'다발성' };
    const fxClass = (tgt.fracture === 'multiple') ? 'danger' : (tgt.fracture !== 'none' ? 'warn' : '');
    const painTier = getPainTier(tgt.pain || 0);
    const painLabel = ['낮음','중간','높음','극심'][painTier];
    const painClass = painTier >= 3 ? 'danger' : (painTier >= 2 ? 'warn' : '');
    status.innerHTML = `
      <div class="ms-line"><span class="ms-key">의식</span><span class="ms-val ${consClass}">${consLabel}</span></div>
      <div class="ms-line"><span class="ms-key">출혈</span><span class="ms-val ${bleedClass}">${bleedLabels[tgt.bleeding]||'없음'}${tgt.bleedingLoc?' ('+(BODY_PART_KOR[tgt.bleedingLoc]||tgt.bleedingLoc)+')':''}</span></div>
      <div class="ms-line"><span class="ms-key">골절</span><span class="ms-val ${fxClass}">${fxLabels[tgt.fracture]||'없음'}${tgt.splintApplied?' · 부목':''}</span></div>
      <div class="ms-line"><span class="ms-key">고통</span><span class="ms-val ${painClass}">${painLabel}${tgt.painkillerActive?' · 진통제':''}</span></div>
      ${tgt.stabilized ? '<div class="ms-line"><span class="ms-key">안정화</span><span class="ms-val">적용됨</span></div>' : ''}
      ${tgt.tourniquetActive ? '<div class="ms-line"><span class="ms-key">지혈대</span><span class="ms-val">적용됨</span></div>' : ''}
    `;
  }
  // 서브 메뉴 강조 — 필요한 처치 highlight
  const subBtns = document.querySelectorAll('#medicSub .medic-btn');
  subBtns.forEach(b => {
    b.classList.remove('highlight');
    b.disabled = false;
    const t = b.dataset.treat;
    if (t === 'tourniquet') {
      const needsT = (tgt.bleedingLoc === 'arms' || tgt.bleedingLoc === 'legs') && !tgt.tourniquetActive;
      if (!needsT) b.disabled = true;
      else if (tgt.bleeding === 'heavy' || tgt.bleeding === 'critical') b.classList.add('highlight');
    } else if (t === 'bandage') {
      if (tgt.bleeding === 'none') b.disabled = true;
      else if (tgt.bleeding === 'light') b.classList.add('highlight');
    } else if (t === 'splint') {
      if (tgt.fracture === 'none' || tgt.splintApplied) b.disabled = true;
      else b.classList.add('highlight');
    } else if (t === 'painkiller') {
      if (tgt.painkillerActive || tgt.painkillerDelay > 0) b.disabled = true;
      else if ((tgt.pain || 0) >= 60) b.classList.add('highlight');
    } else if (t === 'stabilizer') {
      if (tgt.stabilized) b.disabled = true;
      else if (!tgt.conscious || tgt.bleeding === 'critical') b.classList.add('highlight');
    }
    // SIDE-MED-2C §23: 적응증 기반 처치 버튼 게이팅 — 해당 태그/모델이 있는 wound가 있을 때만 활성
    const gatedTag = b.dataset.tcccGated;
    if (gatedTag) {
      const med = tgt.medical;
      const wounds = (med && med.wounds) || [];
      let indicated = false, hasOpenChest = false, recommend = false;
      for (const w of wounds) {
        const tags = w.treatmentIndicationTags || [];
        if (tags.includes(gatedTag)) indicated = true;
        if (gatedTag === 'chestSealCandidate' && w.chestTraumaModel && w.chestTraumaModel.openChestWound) { indicated = true; hasOpenChest = true; }
        if (gatedTag === 'hemostaticCandidate' && w.hemorrhageControlModel && w.hemorrhageControlModel.isMassiveHemorrhage) recommend = true;
      }
      if (!indicated) b.disabled = true;
      else if (hasOpenChest || recommend) b.classList.add('highlight');
    }
  });
}

// 메인 메뉴 클릭
document.querySelectorAll('#medicMain .medic-btn').forEach(b => {
  b.addEventListener('click', () => {
    const action = b.dataset.action;
    if (action === 'close') { closeMedicMenu(); return; }
    if (action === 'treat') {
      // 새 의료 오버레이 열기
      if (medicMenuTreater != null && medicMenuTarget != null) {
        closeMedicMenu();
        openMedicOverlay(medicMenuTreater, medicMenuTarget);
      }
      return;
    }
    if (action === 'drag') {
      const tr = unitById(medicMenuTreater);
      const tg = unitById(medicMenuTarget);
      if (tr && tg) startDragging(tr, tg);
      closeMedicMenu();
      return;
    }
  });
});

// 서브 메뉴 (처치 종류) 클릭
document.querySelectorAll('#medicSub .medic-btn').forEach(b => {
  b.addEventListener('click', () => {
    const treat = b.dataset.treat;
    if (treat === 'back') {
      document.getElementById('medicSub').classList.remove('on');
      return;
    }
    const tr = unitById(medicMenuTreater);
    const tg = unitById(medicMenuTarget);
    if (tr && tg) {
      // === 부위 의존 처치는 자동 location 결정 (가장 필요한 부위) ===
      let opts = {};
      const limbDependent = (treat === 'tourniquet' || treat === 'bandage' || treat === 'splint');
      const chestDependent = (treat === 'chestseal');
      if (limbDependent || chestDependent) {
        if (chestDependent) {
          opts.location = 'chest';
        } else if (tg.medical) {
          // medical 우선 — 가장 심한 외부출혈 부위 / 골절 부위 선택
          let bestPart = null, bestPriority = -1;
          const limbs = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
          for (const k of limbs) {
            const p = tg.medical.bodyParts[k];
            if (!p) continue;
            let priority = 0;
            if (treat === 'tourniquet') {
              priority = p.externalBleedRate * 2;
            } else if (treat === 'bandage') {
              priority = p.externalBleedRate;
              // 몸통도 가능
            } else if (treat === 'splint') {
              priority = p.fracture ? 10 : 0;
            }
            if (priority > bestPriority) { bestPriority = priority; bestPart = k; }
          }
          // bandage는 몸통도 검토
          if (treat === 'bandage') {
            for (const k of ['chest', 'abdomen', 'neck', 'head']) {
              const p = tg.medical.bodyParts[k];
              if (!p) continue;
              if (p.externalBleedRate > bestPriority) {
                bestPriority = p.externalBleedRate; bestPart = k;
              }
            }
          }
          // camelCase → snake_case (legacy 호환)
          if (bestPart) {
            if (bestPart === 'leftArm') opts.location = 'left_arm';
            else if (bestPart === 'rightArm') opts.location = 'right_arm';
            else if (bestPart === 'leftLeg') opts.location = 'left_leg';
            else if (bestPart === 'rightLeg') opts.location = 'right_leg';
            else opts.location = bestPart;
          }
        } else if (tg.bleedingLoc) {
          // legacy fallback
          opts.location = tg.bleedingLoc;
        }
        if (!opts.location && limbDependent) {
          // fallback — 부위 결정 불가 시 openMedicOverlay로 redirect
          closeMedicMenu();
          openMedicOverlay(tr.id, tg.id);
          return;
        }
      }
      if (startTreatment(tr, tg, treat, opts)) {
        closeMedicMenu();
      }
    }
  });
});

// === 자가 처치 / 주변 처치 — unitInfo 위임 ===
const MEDIC_NEARBY_RADIUS_PX = 80;   // 4m — 주변 후보 검색용 (실제 처치는 1m 가드)
const MEDIC_TREATMENT_RANGE_M = 2.0;   // SIDE-METRIC-SCALE-1: 처치 가능 거리 m 기준
const MEDIC_TREATMENT_RANGE_PX = mToPx(MEDIC_TREATMENT_RANGE_M);

// 주변 picker 메뉴는 동적 생성 — medicMenu 재활용해서 사용
function openNearbyPicker(treater) {
  if (!treater) return;
  // 주변 친군 중 처치 대상 후보 (dead 제외)
  const targets = [];
  for (const u of UNITS) {
    if (u.team !== 'friend') continue;
    if (u.id === treater.id) continue;
    if (u.isDead) continue;
    const d = Math.hypot(treater.x - u.x, treater.y - u.y);
    if (d > MEDIC_NEARBY_RADIUS_PX) continue;
    // 도움이 필요한지 (downed/bleed/fracture/pain/treatable)
    const needsHelp = u.isDowned || u.bleeding !== 'none' || u.fracture !== 'none'
                    || (u.pain && u.pain >= 40);
    targets.push({ u, d, needsHelp });
  }
  if (targets.length === 0) {
    log('주변에 처치 대상이 없습니다', 'warn');
    return;
  }
  targets.sort((a,b) => (b.needsHelp - a.needsHelp) || (a.d - b.d));
  // medicMenu 재활용 — 상태 영역에 후보 목록 표시
  medicMenuTreater = treater.id;
  medicMenuTarget = null;
  const el = document.getElementById('medicMenu');
  const title = document.getElementById('medicTitle');
  const status = document.getElementById('medicStatus');
  const mainRow = document.getElementById('medicMain');
  const subRow = document.getElementById('medicSub');
  if (!el) return;
  if (title) title.textContent = `주변 처치 — [${treater.name}]`;
  if (status) {
    let html = '<div style="font-size:9px;color:#80c0ff;margin-bottom:4px;">처치 대상 선택 (2m 이내만 즉시 처치):</div>';
    for (const {u, d, needsHelp} of targets) {
      const statusTag = u.isDowned ? (u.conscious ? 'DOWN' : 'UNCON')
                      : (u.combatState === 'wounded' ? 'WOUND' : '활성');
      const help = needsHelp ? ' <span style="color:#ffa060;">필요</span>' : '';
      const inRange = d <= MEDIC_TREATMENT_RANGE_PX;
      const distColor = inRange ? '#80d090' : '#ffa040';
      const distLabel = inRange ? '즉시' : `${(d/PX_PER_M).toFixed(1)}m 접근`;
      html += `<div class="medic-pick-row" data-pick-id="${u.id}" style="cursor:pointer;padding:3px 4px;margin:2px 0;background:#1a242c;border:1px solid #2a3740;border-radius:2px;">
        <span style="color:#ffe066;font-weight:700;">${u.name}</span>
        <span style="color:#6b7780;font-size:9px;"> · ${statusTag} · <span style="color:${distColor};">${distLabel}</span></span>${help}
      </div>`;
    }
    status.innerHTML = html;
  }
  if (mainRow) mainRow.style.display = 'none';
  if (subRow) subRow.classList.remove('on');
  el.classList.add('on');
}

// 자가 처치 메뉴 — treater = target = self → 새 의료 오버레이 직접 열기
function openSelfTreatMenu(u) {
  if (!u || !u.alive) return;
  openMedicOverlay(u.id, u.id);
}

// unitInfo 영역 위임 클릭
document.getElementById('unitInfo').addEventListener('click', (e) => {
  // 투척 장비 버튼
  const tbtn = e.target.closest('.unit-throw-btn, .unit-throw-btn-pick');
  if (tbtn && !tbtn.classList.contains('disabled')) {
    const sel = GAME.selectedId ? unitById(GAME.selectedId) : null;
    if (!sel) return;
    const action = tbtn.dataset.action;
    if (action === 'throwDo') enterThrowMode(sel);
    else if (action === 'throwSelect') openThrowableSelectOverlay(sel);
    return;
  }
  const btn = e.target.closest('.unit-medic-btn, .wpn-slot-btn');
  if (!btn || btn.disabled) return;
  const sel = GAME.selectedId ? unitById(GAME.selectedId) : null;
  if (!sel) return;
  const action = btn.dataset.action;
  if (action === 'self')           openSelfTreatMenu(sel);
  else if (action === 'nearby')    openNearbyPicker(sel);
  else if (action === 'dragStop')  { stopDragging(sel); refreshUI(); }
  else if (action === 'treatCancel') { cancelTreatment(sel, '취소'); refreshUI(); }
  // SIDE-WEAPON-PLATFORM-1A §19/§20: 무기 전환 / 거치
  else if (action === 'weaponSwitch') { if (typeof startWeaponSwitch === 'function') startWeaponSwitch(sel, btn.dataset.slot); refreshUI(); }
  else if (action === 'weaponMount') {
    if (sel.weaponState && sel.weaponState.mounted) { if (typeof stopWeaponMount === 'function') stopWeaponMount(sel, '수동 해제'); }
    else if (typeof canMountWeapon === 'function' && canMountWeapon(sel)) { const cov = findMountableHalfCover(sel); if (cov) startWeaponMount(sel, cov); }
    refreshUI();
  }
});

// picker 선택 — medicMenu 안의 medic-pick-row 클릭 시 새 의료 오버레이 열기
document.getElementById('medicStatus').addEventListener('click', (e) => {
  const row = e.target.closest('.medic-pick-row');
  if (!row) return;
  const pickedId = parseInt(row.dataset.pickId, 10);
  const tr = unitById(medicMenuTreater);
  const tg = unitById(pickedId);
  if (!tr || !tg) return;
  // 옛 picker 메뉴 닫고 새 의료 오버레이 열기
  closeMedicMenu();
  openMedicOverlay(tr.id, tg.id);
});

// 글로벌 — POINT FIRE / 재장전 / 발사모드 (선택 유닛 대상)
document.getElementById('btnPointFireGlobal').addEventListener('click', () => {
  const u = GAME.selectedId ? unitById(GAME.selectedId) : null;
  if (!u || !u.alive) return;
  if (GAME.pointFireMode) {
    GAME.pointFireMode = false;
  } else {
    GAME.pointFireMode = true;
    GAME.facingMode = false;
  }
  refreshUI();
});
document.getElementById('btnReloadGlobal').addEventListener('click', () => {
  const u = GAME.selectedId ? unitById(GAME.selectedId) : null;
  if (!u || !u.alive || u.isReloading) return;
  if (u.reserveAmmo <= 0) { log(`[${u.name}] 예비탄 없음.`, 'warn'); return; }
  const aprof = getWeaponAmmoProfile(WEAPONS[u.weaponId]);
  if (u.magAmmo >= aprof.magazineSize) return;
  startReload(u);
  renderUnitCard();
});
document.getElementById('btnFireModeGlobal').addEventListener('click', () => {
  const u = GAME.selectedId ? unitById(GAME.selectedId) : null;
  if (!u || !u.alive) return;
  cycleFireMode(u);
});

// 하단 unitInfo 패널 — 투척 장비 섹션
function buildUnitThrowableSection(u) {
  if (!u || u.isDead) return '';
  // 현재 보유 수류탄 (첫 번째 항목 — 미래 멀티 슬롯 확장 가능)
  let curId = null, curCount = 0;
  if (u.throwables) {
    for (const id in u.throwables) {
      if (u.throwables[id] > 0) { curId = id; curCount = u.throwables[id]; break; }
    }
  }
  const preset = curId ? THROWABLE_PRESETS[curId] : null;
  const isThrowMode = GAME.throwMode && GAME.throwMode.unitId === u.id;
  const isThrowing = !!u.throwState;

  let infoHtml = '';
  if (preset) {
    const weightG = Math.round(preset.weightKg * 1000);
    infoHtml = `
      <div class="unit-throw-name"><b>${preset.shortName}</b> <span class="unit-throw-count">×${curCount}</span></div>
      <div class="unit-throw-spec">신관 ${preset.fuseTime}s · ${preset.throwRange}m · ${weightG}g</div>
    `;
  } else {
    infoHtml = `<div class="unit-throw-name unit-throw-empty">투척 장비 없음</div>`;
  }

  const throwDisabled = u.isDowned || !preset || curCount <= 0 || isThrowing;
  const throwLabel = isThrowing ? '투척 중' : (isThrowMode ? '취소' : '투척');
  const throwCls = isThrowMode ? 'unit-throw-btn on' : 'unit-throw-btn';
  const selectDisabled = u.isDowned;

  return `
    <div class="unit-throw-row">
      <div class="unit-throw-info">${infoHtml}</div>
      <div class="unit-throw-btns">
        <button class="unit-throw-btn-pick${selectDisabled?' disabled':''}" data-action="throwSelect">선택</button>
        <button class="${throwCls}${throwDisabled?' disabled':''}" data-action="throwDo">${throwLabel}</button>
      </div>
    </div>
  `;
}

// =============================================================
// 수류탄 선택 오버레이
// =============================================================
const THROW_SELECT = {
  open: false,
  unitId: null,
  context: null,    // 'unit' | 'loadout_friend' | 'loadout_enemy'
  selectedId: null,
};

function openThrowableSelectOverlay(unit, context) {
  THROW_SELECT.open = true;
  THROW_SELECT.unitId = unit ? unit.id : null;
  THROW_SELECT.context = context || 'unit';
  // 현재 보유 → 기본 선택
  let curId = 'none';
  if (context === 'loadout_friend') curId = (getScopedLoadout('friend').lethalGrenadeId) || 'none';
  else if (context === 'loadout_enemy') curId = (getScopedLoadout('enemy').lethalGrenadeId) || 'none';
  else if (unit && unit.throwables) {
    for (const id in unit.throwables) {
      if (unit.throwables[id] > 0) { curId = id; break; }
    }
  }
  THROW_SELECT.selectedId = curId;
  document.getElementById('throwableSelectOverlay').style.display = 'flex';
  renderThrowableSelect();
}

function closeThrowableSelectOverlay() {
  THROW_SELECT.open = false;
  document.getElementById('throwableSelectOverlay').style.display = 'none';
}

function renderThrowableSelect() {
  const titleEl = document.getElementById('tsTitle');
  if (titleEl) {
    titleEl.textContent = THROW_SELECT.context === 'loadout_friend' ? '아군 살상용 수류탄'
                       : THROW_SELECT.context === 'loadout_enemy'  ? '적군 살상용 수류탄'
                       : '투척 장비 선택';
  }
  // 리스트: 없음 + 모든 frag 프리셋
  const items = [{ id: 'none', name: '없음', short: '없음', desc: '수류탄 미보유' }];
  for (const id in THROWABLE_PRESETS) {
    const p = THROWABLE_PRESETS[id];
    if (p.type !== 'frag') continue;
    items.push({ id: p.id, name: p.name, short: p.shortName, desc: p.desc, preset: p });
  }
  const listEl = document.getElementById('tsList');
  listEl.innerHTML = items.map(it => {
    const sel = (it.id === THROW_SELECT.selectedId) ? ' selected' : '';
    const meta = it.preset
      ? `신관 ${it.preset.fuseTime}s · ${Math.round(it.preset.weightKg*1000)}g`
      : '';
    return `<div class="ts-list-row${sel}" data-tid="${it.id}">
      <div class="ts-row-name">${it.short}</div>
      <div class="ts-row-meta">${meta}</div>
    </div>`;
  }).join('');

  // 상세
  const detail = document.getElementById('tsDetail');
  const sel = items.find(it => it.id === THROW_SELECT.selectedId);
  if (!sel) { detail.innerHTML = ''; return; }
  if (sel.id === 'none') {
    detail.innerHTML = `
      <div class="ts-detail-title">없음</div>
      <div class="ts-detail-desc">수류탄을 보유하지 않습니다.</div>
    `;
    return;
  }
  const p = sel.preset;
  const ratios = p.fragmentRatioRange || {};
  const lMid = ratios.large ? ((ratios.large[0] + ratios.large[1]) / 2 * 100).toFixed(0) : '?';
  const mMid = ratios.medium ? ((ratios.medium[0] + ratios.medium[1]) / 2 * 100).toFixed(0) : '?';
  const sMid = (ratios.large && ratios.medium)
    ? (100 - parseFloat(lMid) - parseFloat(mMid)).toFixed(0) : '?';
  detail.innerHTML = `
    <div class="ts-detail-title">${p.name}</div>
    <div class="ts-detail-desc">${p.desc}</div>
    <div class="ts-detail-spec"><span>무게</span><b>${Math.round(p.weightKg*1000)}g</b></div>
    <div class="ts-detail-spec"><span>신관 시간</span><b>${p.fuseTime}s</b></div>
    <div class="ts-detail-spec"><span>최대 투척 거리</span><b>${p.throwRange}m</b></div>
    <div class="ts-detail-spec"><span>파편 수</span><b>${p.fragmentCount}개</b></div>
    <div class="ts-detail-spec"><span>파편 비행 반경</span><b>${p.fragmentRadius}m</b></div>
    <div class="ts-detail-spec"><span>파편 속도 보정</span><b>×${(p.fragmentVelocityMul || 1).toFixed(2)}</b></div>
    <div class="ts-detail-spec"><span>폭압 즉살 반경</span><b>${p.blastRadiusLethal}m</b></div>
    <div class="ts-detail-spec"><span>폭압 중상 반경</span><b>${p.blastRadiusInner}m</b></div>
    <div class="ts-detail-spec"><span>폭압 충격 반경</span><b>${p.blastRadiusOuter}m</b></div>
    <div class="ts-detail-spec"><span>파편 비율 (S/M/L)</span><b>~${sMid}% / ${mMid}% / ${lMid}%</b></div>
  `;
}

(function attachTsEvents() {
  const closeBtn = document.getElementById('tsCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeThrowableSelectOverlay);
  const cancelBtn = document.getElementById('tsCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeThrowableSelectOverlay);
  const overlay = document.getElementById('throwableSelectOverlay');
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeThrowableSelectOverlay();
  });
  const listEl = document.getElementById('tsList');
  if (listEl) listEl.addEventListener('click', (e) => {
    const row = e.target.closest('.ts-list-row');
    if (!row) return;
    THROW_SELECT.selectedId = row.dataset.tid;
    renderThrowableSelect();
  });
  const applyBtn = document.getElementById('tsApplyBtn');
  if (applyBtn) applyBtn.addEventListener('click', () => {
    const id = THROW_SELECT.selectedId;
    if (THROW_SELECT.context === 'loadout_friend') {
      const _ld = getWritableScopedLoadout('friend');   // SIDE-PER-OPERATOR-LOADOUT-1
      _ld.lethalGrenadeId = (id === 'none' ? null : id);
      _ld.lethalGrenadeCount = (id === 'none' ? 0 : 1);
      if (typeof renderLoadout === 'function') renderLoadout();
      if (typeof renderAllOperatorScopeBars === 'function') renderAllOperatorScopeBars();
    } else if (THROW_SELECT.context === 'loadout_enemy') {
      const _ld = getWritableScopedLoadout('enemy');
      _ld.lethalGrenadeId = (id === 'none' ? null : id);
      _ld.lethalGrenadeCount = (id === 'none' ? 0 : 1);
      if (typeof renderLoadout === 'function') renderLoadout();
      if (typeof renderAllOperatorScopeBars === 'function') renderAllOperatorScopeBars();
    } else {
      const u = unitById(THROW_SELECT.unitId);
      if (u) {
        u.throwables = (id === 'none') ? {} : { [id]: 1 };
      }
    }
    closeThrowableSelectOverlay();
    refreshUI();
  });
})();

// =============================================================
// 수류탄 투척 모드 진입/취소
// =============================================================
function enterThrowMode(u, throwableId) {
  if (!u || !u.alive || u.isDowned) return;
  // 이미 투척 모드면 취소
  if (GAME.throwMode && GAME.throwMode.unitId === u.id) {
    GAME.throwMode = null;
    refreshUI();
    return;
  }
  // 보유 확인 — throwableId 주어졌으면 그것, 아니면 첫 번째 보유 아이템
  let useId = throwableId;
  if (!useId && u.throwables) {
    for (const id in u.throwables) {
      if (u.throwables[id] > 0) { useId = id; break; }
    }
  }
  if (!useId || !(u.throwables && u.throwables[useId] > 0)) {
    log(`[${u.name}] 보유 투척 장비 없음.`, 'warn');
    return;
  }
  if (u.throwState) { log(`[${u.name}] 이미 투척 진행 중.`, 'warn'); return; }
  const preset = THROWABLE_PRESETS[useId];
  if (!preset) return;
  const defaultDist = Math.min(8 * PX_PER_M_FALLBACK, (preset.throwRange || 22) * PX_PER_M_FALLBACK * 0.4);
  const aimX = u.x + Math.cos(u.facing) * defaultDist;
  const aimY = u.y + Math.sin(u.facing) * defaultDist;
  GAME.throwMode = {
    unitId: u.id,
    throwableId: useId,
    aimX, aimY,
    dragging: false,
  };
  recomputeThrowPreview();
  GAME.facingMode = false;
  GAME.pointFireMode = false;
  refreshUI();
}

// (옛 우측 액션 컬럼 버튼) — DOM에 없으면 무동작
(function attachOldThrowBtn() {
  const btn = document.getElementById('btnThrowGlobal');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const u = GAME.selectedId ? unitById(GAME.selectedId) : null;
    if (u) enterThrowMode(u);
  });
})();

// 미리보기 trajectory 갱신
function recomputeThrowPreview() {
  if (!GAME.throwMode) return;
  const u = unitById(GAME.throwMode.unitId);
  if (!u) return;
  const preset = THROWABLE_PRESETS[GAME.throwMode.throwableId];
  if (!preset) return;
  const launch = computeAutoCornerLaunch(u, GAME.throwMode.aimX, GAME.throwMode.aimY);
  const maxPx = preset.throwRange * PX_PER_M_FALLBACK;
  GAME.throwMode.previewLaunch = launch;
  GAME.throwMode.previewTrajectory = computeThrowTrajectory(launch.x, launch.y, GAME.throwMode.aimX, GAME.throwMode.aimY, maxPx);
}

// =============================================================
