// ECG (심전도) UI 시각화 시스템
//   - medical 값을 시각화하는 UI 표현 (medical 상태 자체를 바꾸지 않음)
//   - getEcgVisualState로 medical → ECG 시각 파라미터 변환
//   - sampleEcgValue / updateEcgBuffer로 ring buffer 갱신
//   - drawEcgCanvas로 canvas 그림
//   - DOM 재생성과 sample/phase 보존 분리
// =============================================================

// 유닛별 ECG 상태 초기화 — innerHTML 재생성에도 보존되도록 unit에 저장
function ensureEcgState(unit) {
  if (!unit) return null;
  if (!unit.ecgState) {
    unit.ecgState = {
      samples: new Array(360).fill(0),
      maxSamples: 360,
      writeIdx: 0,
      _sampleAccum: 0,
      _lastUpdateAt: 0,         // 같은 frame 중복 update 방지
      t: 0,
      phase: 0,
      beatJitter: 0,
      thisBeatWeak: false,
      thisBeatDropped: false,
      // 시각 파라미터 — getEcgVisualState target을 lerp으로 따라감
      amplitudeMul: 1.0,
      noiseMul: 0.0,
      irregularity: 0.0,
      qrsWidthMul: 1.0,
      currentHr: 75,
      flatline: false,
      visualMode: 'normal',
    };
  }
  return unit.ecgState;
}

// medical → ECG 시각 파라미터 변환 (향후 medical 확장 시 이 함수만 수정)
// CARDIAC-1R §21: ECG는 이제 medical.cardiacRhythmModel을 읽어 P-QRS-T 템플릿 기반 rhythm-aware display를 수행한다.
//   rhythm state(normal_sinus ~ asystole_candidate)는 생리(preCardiacRisk/hemodynamics/stress)를 반영하는 내부 모델이며,
//   ECG는 그 상태를 '시각화'만 한다. AED / CPR / defib / 소생 처치 엔진은 아직 없다(후속 단계). ECG가 medical 값을 직접 바꾸지 않는다.
//   rhythm은 단독으로 lifeStatus를 dead로 만들지 않으며, vtach/vfib/pea/asystole은 후보(_candidate) 단계까지만이다.
function getEcgVisualState(unit) {
  if (!unit || !unit.medical) {
    return {
      hr: 0, systolicBP: 0, diastolicBP: 0,
      bloodMl: 0, bloodMax: 5000, lifeStatus: 0,
      shock: 0, pain: 0, consciousness: 0, breathingEfficiency: 0,
      amplitudeMul: 0, noiseMul: 0.05, irregularity: 0,
      qrsWidthMul: 1, beatRegularity: 1,
      weakBeatChance: 0, droppedBeatChance: 0, ectopyChance: 0,
      rhythmInstability: 0, rhythmTransition: 0,
      flatline: true, disabled: true,
      visualMode: 'disabled', warningLevel: 0
    };
  }
  const m = unit.medical;
  const isDead = !!unit.isDead || m.lifeStatus <= 0;
  // 1.5단계 옵션 — hemodynamics / stressResponse 있으면 활용
  const hd = m.hemodynamics;
  const sr = m.stressResponse;
  // visualMode 결정 (warningLevel 강한 순)
  let visualMode = 'normal';
  let warningLevel = 0;
  if (isDead) {
    visualMode = 'dead'; warningLevel = 4;
  } else if (m.lifeStatus < 25 || (m.systolicBP < 60 && m.consciousness < 40)
             || (hd && hd.decompensatingShock && hd.compensationExhaustion > 0.7)) {
    visualMode = 'critical'; warningLevel = 3;
  } else if (m.shock > 60 || m.bloodMl < 2800 || m.systolicBP < 80
             || (hd && hd.decompensatingShock)) {
    visualMode = 'shock'; warningLevel = 2;
  } else if (m.heartRate > 110) {
    visualMode = 'tachy'; warningLevel = 1;
  } else if (m.consciousness < 50) {
    visualMode = 'unconscious'; warningLevel = 1;
  }
  // 시각 파라미터 — hemodynamics/stress 우선
  const lifeRatio = Math.max(0, m.lifeStatus / 100);
  const bpRatio = Math.max(0, Math.min(1, m.systolicBP / 120));
  const shockRatio = Math.max(0, m.shock / 100);
  const consRatio = Math.max(0, m.consciousness / 100);
  // amplitude — tissuePerfusion / oxygenDelivery / cardiacOutput 반영
  let ampMul;
  if (hd) {
    const perfRatio = Math.max(0.1, Math.min(1.2, hd.tissuePerfusion));
    const coRatio = Math.max(0.1, Math.min(1.5, hd.cardiacOutputMul));
    ampMul = isDead ? 0 : Math.max(0.15, Math.min(1.0,
      perfRatio * 0.5 + coRatio * 0.3 + lifeRatio * 0.2
    ));
  } else {
    ampMul = isDead ? 0 : Math.max(0.20, Math.min(1.0, lifeRatio * 0.6 + bpRatio * 0.4));
  }
  // noise — shock + adrenaline 과다 + panic
  let noiseMul = isDead ? 0.10 : shockRatio * 2.2 + (1 - lifeRatio) * 1.2 + (1 - bpRatio) * 0.6;
  if (sr) {
    // adrenaline 과다 / panic → noise 증가
    if (sr.adrenaline > 0.7) noiseMul += (sr.adrenaline - 0.7) * 1.5;
    noiseMul += sr.panic * 1.2;
  }
  noiseMul = Math.max(0, Math.min(4.0, noiseMul));
  // irregularity — shock + decompensation + compensationExhaustion
  let irreg = isDead ? 0 : shockRatio * 0.35 + (m.bloodMl < 2500 ? 0.15 : 0) + (m.consciousness < 50 ? 0.10 : 0);
  if (hd) {
    if (hd.decompensatingShock) irreg += 0.20;
    if (hd.compensationExhaustion > 0.5) irreg += (hd.compensationExhaustion - 0.5) * 0.4;
  }
  if (sr) irreg += sr.panic * 0.2;
  // cardiac placeholder (현재 0이지만 향후 fallback)
  if (m.cardiac && m.cardiac.rhythmInstability) irreg += m.cardiac.rhythmInstability * 0.5;
  irreg = Math.max(0, Math.min(0.80, irreg));
  // weakBeat / droppedBeat — tissuePerfusion / oxygenDelivery 반영
  let weakBeat = isDead ? 0 : (m.consciousness < 50 ? 0.18 : 0) + (m.systolicBP < 70 ? 0.20 : 0) + (1 - lifeRatio) * 0.10;
  if (hd) {
    if (hd.tissuePerfusion < 0.55) weakBeat += (0.55 - hd.tissuePerfusion) * 0.6;
    if (hd.oxygenDelivery < 0.55) weakBeat += (0.55 - hd.oxygenDelivery) * 0.4;
  }
  weakBeat = Math.max(0, Math.min(0.40, weakBeat));
  let droppedBeat = isDead ? 0 : (m.lifeStatus < 25 ? 0.12 : 0) + (m.systolicBP < 60 ? 0.05 : 0);
  if (hd && hd.decompensatingShock) droppedBeat += 0.05;
  droppedBeat = Math.max(0, Math.min(0.20, droppedBeat));
  // 향후 — medical.cardiac.arrhythmiaRisk
  const ectopy = (m.cardiac && m.cardiac.arrhythmiaRisk) || 0;
  const rhythmInst = (m.cardiac && m.cardiac.rhythmInstability) || irreg;
  // === CARDIAC-1R §15/§17: cardiacRhythmModel 읽어 rhythm-aware morphology/artifact 반영 ===
  const rm = m.cardiacRhythmModel || null;
  const cp = getUnitComposureProfile(unit);
  // ECG artifact — 움직임/끌림/제압/공황/통증/쇼크/저관류. composure가 높으면 낮음.
  const moving = !!(unit.isMoving || (unit.vx != null && Math.hypot(unit.vx || 0, unit.vy || 0) > 0.05) || (unit.path && unit.path.length));
  const dragged = !!(unit.beingDragged || unit.isBeingDragged);
  let artifactLevel = 0;
  if (!isDead) {
    artifactLevel += moving ? 0.18 : 0;
    artifactLevel += dragged ? 0.22 : 0;
    artifactLevel += (unit.suppression || 0) / 100 * 0.15;
    artifactLevel += (sr ? sr.panic : 0) * 0.30;
    artifactLevel += (sr ? sr.postCombatCrash : 0) * 0.10;
    artifactLevel += Math.min(0.15, m.pain / 100 * 0.15);
    artifactLevel += Math.min(0.12, shockRatio * 0.12);
    artifactLevel *= (1.2 - cp.breathingDiscipline * 0.6);   // elite ≈ ×0.65, recruit ≈ ×0.96
    // FIELD-STAB-1 §8: airway support active → motion/panic artifact 약간 완화
    const _awFs = m.fieldStabilizationModel && m.fieldStabilizationModel.airwaySupport;
    if (_awFs && _awFs.active && _awFs.artifactReduction) artifactLevel *= (1 - _awFs.artifactReduction);
    artifactLevel = Math.max(0, Math.min(0.85, artifactLevel));
  }
  // 저관류 amplitude 감소 (PEA에서 특히 — 전기활동은 있으나 진폭/관류 낮음)
  let lowPerfAmp = 1.0;
  if (hd) { if (hd.tissuePerfusion < 0.6) lowPerfAmp *= Math.max(0.4, hd.tissuePerfusion / 0.6); }
  const ecgPattern = rm ? rm.ecgPattern : 'pqrst_normal';
  const RLABEL = {
    normal_sinus:'정상동율동', sinus_tachycardia:'동성 빈맥', sinus_bradycardia:'동성 서맥',
    unstable_tachycardia:'불안정 빈맥', unstable_bradycardia:'불안정 서맥', ventricular_irritability:'심실 자극(후보)',
    vtach_candidate:'심실빈맥 후보', vfib_candidate:'심실세동 후보', pea_candidate:'무맥성 전기활동 후보', asystole_candidate:'무수축 후보',
  };
  return {
    hr: isDead ? 0 : m.heartRate,
    systolicBP: isDead ? 0 : m.systolicBP,
    diastolicBP: isDead ? 0 : m.diastolicBP,
    bloodMl: m.bloodMl, bloodMax: m.bloodMax,
    lifeStatus: m.lifeStatus,
    shock: m.shock, pain: m.pain, consciousness: m.consciousness,
    breathingEfficiency: m.breathingEfficiency,
    amplitudeMul: ampMul, noiseMul,
    irregularity: irreg,
    qrsWidthMul: 1.0 + (visualMode === 'critical' ? 0.3 : 0),
    beatRegularity: 1 - irreg,
    weakBeatChance: weakBeat,
    droppedBeatChance: droppedBeat,
    ectopyChance: ectopy,
    rhythmInstability: rhythmInst,
    rhythmTransition: 0,
    flatline: isDead,
    disabled: false,
    visualMode, warningLevel,
    // CARDIAC-1R: rhythm-aware 표시
    ecgPattern, rhythmLabel: rm ? (RLABEL[rm.rhythm] || rm.rhythm) : (isDead ? '무수축' : '정상동율동'),
    rhythmClass: rm ? rm.rhythmClass : 'normal',
    shockableHint: rm ? rm.shockableHint : false,
    perfusingRhythm: rm ? rm.perfusing : true,
    artifactLevel, lowPerfAmp,
  };
}

// P-QRS-T 파형 템플릿 (phase 0~1)
function _ecgWaveform(phase, qrsWidth) {
  const qw = qrsWidth || 1.0;
  if (phase < 0.10) return 0;
  if (phase < 0.18) {   // P wave
    const p = (phase - 0.10) / 0.08;
    return Math.sin(p * Math.PI) * 0.15;
  }
  if (phase < 0.22) return 0;
  // QRS — qrsWidth로 폭 조절
  const qrsStart = 0.22;
  const qrsEnd = 0.22 + 0.14 * qw;
  if (phase < qrsEnd) {
    const p = (phase - qrsStart) / (qrsEnd - qrsStart);
    // Q (0~0.20) → R 상승 (0.20~0.45) → R 하강 (0.45~0.80) → S (0.80~1.0)
    if (p < 0.20) return -p / 0.20 * 0.15;
    if (p < 0.45) return -0.15 + (p - 0.20) / 0.25 * 1.15;
    if (p < 0.80) return 1.0 - (p - 0.45) / 0.35 * 1.0;
    return -(p - 0.80) / 0.20 * 0.20;
  }
  if (phase < qrsEnd + 0.20) {   // T wave
    const p = (phase - qrsEnd) / 0.20;
    return Math.sin(p * Math.PI) * 0.25;
  }
  return 0;
}

// === CARDIAC-1R §15/§16: rhythm별 ECG morphology 기술자 ===
function getEcgMorphologyForRhythm(rm) {
  const r = (rm && rm.rhythm) || 'normal_sinus';
  const base = { pAmp:0.15, qrsWidth:1.0, qrsAmp:1.0, tAmp:0.25, wide:false, chaotic:false, flat:false, ectopy:0, pHidden:false, ampScale:1.0, rrJitter:0.02, organized:true };
  switch (r) {
    case 'sinus_tachycardia':      return Object.assign({}, base, { rrJitter:0.04, tAmp:0.22 });
    case 'sinus_bradycardia':      return Object.assign({}, base, { rrJitter:0.05 });
    case 'unstable_tachycardia':   return Object.assign({}, base, { pHidden:true, qrsWidth:1.15, rrJitter:0.18 });
    case 'unstable_bradycardia':   return Object.assign({}, base, { rrJitter:0.22, ampScale:0.8 });
    case 'ventricular_irritability': return Object.assign({}, base, { ectopy:0.30, rrJitter:0.12 });
    case 'vtach_candidate':        return Object.assign({}, base, { pHidden:true, wide:true, qrsWidth:2.2, qrsAmp:1.1, tAmp:0.0, rrJitter:0.05 });
    case 'vfib_candidate':         return Object.assign({}, base, { chaotic:true, organized:false });
    case 'pea_candidate':          return Object.assign({}, base, { ampScale:0.45, rrJitter:0.10 });
    case 'asystole_candidate':     return Object.assign({}, base, { flat:true, organized:false });
    default:                       return base;
  }
}
// rhythm morphology 기반 한 beat 샘플 (phase 0~1). isEctopic=PVC-like 삽입 beat.
function _ecgMorphSample(phase, morph, isEctopic) {
  if (morph.flat) return 0;                         // asystole — flatline (noise는 호출부에서)
  if (morph.chaotic) {                              // vfib — 무질서 파형
    return Math.sin(phase * Math.PI * 7.3) * 0.18 + Math.sin(phase * Math.PI * 11.7 + 1.3) * 0.13 + Math.sin(phase * Math.PI * 17.1 + 0.7) * 0.09;
  }
  if (isEctopic) {                                  // PVC-like — P 없음, 넓고 기괴한 QRS + 불일치 T
    if (phase < 0.30) { const p = phase / 0.30; return Math.sin(p * Math.PI) * -0.50; }
    if (phase < 0.55) { const p = (phase - 0.30) / 0.25; return Math.sin(p * Math.PI) * 0.85; }
    if (phase < 0.85) { const p = (phase - 0.55) / 0.30; return Math.sin(p * Math.PI) * -0.30; }
    return 0;
  }
  if (morph.wide) {                                 // vtach — 넓고 빠른 단조 복합체 (P 없음)
    return Math.sin(phase * Math.PI * 2) * 0.70 * (morph.qrsAmp || 1);
  }
  // 정상형 P-QRS-T (morphology 토글 반영)
  const qw = morph.qrsWidth || 1.0;
  let v = 0;
  if (!morph.pHidden && phase >= 0.10 && phase < 0.18) {
    const p = (phase - 0.10) / 0.08; v = Math.sin(p * Math.PI) * morph.pAmp;
  } else if (phase >= 0.22) {
    const qrsStart = 0.22, qrsEnd = 0.22 + 0.14 * qw;
    if (phase < qrsEnd) {
      const p = (phase - qrsStart) / (qrsEnd - qrsStart);
      if (p < 0.20) v = -p / 0.20 * 0.15 * morph.qrsAmp;
      else if (p < 0.45) v = (-0.15 + (p - 0.20) / 0.25 * 1.15) * morph.qrsAmp;
      else if (p < 0.80) v = (1.0 - (p - 0.45) / 0.35 * 1.15) * morph.qrsAmp;
      else v = (-0.15 + (p - 0.80) / 0.20 * 0.15) * morph.qrsAmp;
    } else if (phase < qrsEnd + 0.20 && morph.tAmp > 0) {
      const p = (phase - qrsEnd) / 0.20; v = Math.sin(p * Math.PI) * morph.tAmp;
    }
  }
  return v * (morph.ampScale || 1.0);
}

// frame 단위 ring buffer 갱신
function updateEcgBuffer(unit, dt) {
  if (!unit) return;
  const st = ensureEcgState(unit);
  if (!st) return;
  // 같은 frame 중복 호출 방지
  const now = performance.now();
  if (st._lastUpdateAt === now) return;
  st._lastUpdateAt = now;
  const vs = getEcgVisualState(unit);
  // 시각 파라미터 lerp (천천히 따라가게 — 갑작스러운 변화 방지)
  const lerpRate = Math.min(1, dt * 1.5);
  st.amplitudeMul += (vs.amplitudeMul - st.amplitudeMul) * lerpRate;
  st.noiseMul += (vs.noiseMul - st.noiseMul) * lerpRate;
  st.irregularity += (vs.irregularity - st.irregularity) * lerpRate;
  st.qrsWidthMul += (vs.qrsWidthMul - st.qrsWidthMul) * lerpRate;
  st.currentHr += ((vs.hr || 75) - st.currentHr) * Math.min(1, dt * 1.0);
  st.flatline = vs.flatline;
  st.visualMode = vs.visualMode;
  // sample rate
  const sampleRate = 120;
  const totalSamples = dt * sampleRate + (st._sampleAccum || 0);
  const samplesNeeded = Math.floor(totalSamples);
  st._sampleAccum = totalSamples - samplesNeeded;
  const subDt = 1 / sampleRate;
  for (let i = 0; i < Math.min(samplesNeeded, 30); i++) {
    st.t += subDt;
    let val;
    // CARDIAC-1R §15~§17: rhythm morphology + artifact 기반 샘플
    const rm = unit.medical && unit.medical.cardiacRhythmModel;
    const morph = getEcgMorphologyForRhythm(rm);
    const artifact = vs.artifactLevel || 0;
    const lowPerfAmp = vs.lowPerfAmp != null ? vs.lowPerfAmp : 1.0;
    if (st.flatline || morph.flat) {
      // asystole/dead — flatline + baseline drift/noise (occasional tiny deflection)
      val = (_cosmeticRand() - 0.5) * 0.035 + Math.sin(st.t * 0.7) * 0.012;
      if (Math.random() < 0.004) val += (Math.random() - 0.5) * 0.10;
    } else if (morph.chaotic) {
      // vfib — beat phase 무관, 연속 chaotic. amplitude는 관류/산소에 따라 감소.
      st.phase += subDt / (60 / Math.max(120, st.currentHr));
      if (st.phase >= 1.0) st.phase -= 1.0;
      val = _ecgMorphSample(st.t * 2.4 % 1.0, morph, false) * st.amplitudeMul * lowPerfAmp;
      val += (Math.random() - 0.5) * 0.05;
    } else {
      const hr = Math.max(20, st.currentHr);
      const beatPeriod = 60 / hr * (1 + st.beatJitter);
      st.phase += subDt / beatPeriod;
      if (st.phase >= 1.0) {
        st.phase -= 1.0;
        st.thisBeatWeak = Math.random() < vs.weakBeatChance;
        st.thisBeatDropped = _cosmeticRand() < vs.droppedBeatChance;
        // ventricular_irritability — PVC-like ectopic beat 삽입
        st.thisBeatEctopic = (morph.ectopy > 0) && (_cosmeticRand() < morph.ectopy);
        // RR variability — morphology rrJitter + irregularity
        st.beatJitter = (_cosmeticRand() - 0.5) * (vs.irregularity * 0.25 + (morph.rrJitter || 0));
      }
      let amp = st.amplitudeMul * lowPerfAmp;
      if (st.thisBeatDropped) amp = 0;
      else if (st.thisBeatWeak) amp *= 0.45;
      val = _ecgMorphSample(st.phase, morph, st.thisBeatEctopic) * amp;
      // baseline noise + artifact (baseline wander + tremor)
      val += (Math.random() - 0.5) * 0.03 * st.noiseMul;
      val += Math.sin(st.t * 2.1) * 0.02 * artifact;            // baseline wander
      val += (Math.random() - 0.5) * 0.06 * artifact;           // motion/tremor noise
    }
    st.samples[st.writeIdx] = val;
    st.writeIdx = (st.writeIdx + 1) % st.maxSamples;
  }
}

// canvas에 ECG 파형 그리기
function drawEcgCanvas(canvas, unit, options) {
  if (!canvas) return;
  const opts = options || {};
  // 캔버스 크기 (devicePixelRatio 대응)
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  const dpr = (window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cssW, H = cssH;
  // 배경
  ctx.fillStyle = opts.bgColor || '#050a0e';
  ctx.fillRect(0, 0, W, H);
  // grid (mini 또는 noGrid 옵션이면 생략)
  if (!opts.mini && !opts.noGrid) {
    ctx.strokeStyle = 'rgba(60, 120, 90, 0.10)';
    ctx.lineWidth = 1;
    const gx = 24, gy = 12;
    for (let x = 0; x < W; x += gx) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gy) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
    }
  }
  if (!unit || !unit.medical) {
    // disabled — 평평한 선
    ctx.strokeStyle = '#3a4048';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
    ctx.stroke();
    return;
  }
  const st = ensureEcgState(unit);
  const vs = getEcgVisualState(unit);
  // visualMode 기반 색상
  let color = '#80d090';   // normal — 청록 녹색
  let glow = 'rgba(128, 208, 144, 0.35)';
  if (vs.visualMode === 'tachy') { color = '#c0d060'; glow = 'rgba(192, 208, 96, 0.35)'; }
  else if (vs.visualMode === 'shock') { color = '#d4a04a'; glow = 'rgba(212, 160, 74, 0.40)'; }
  else if (vs.visualMode === 'critical') { color = '#ff6060'; glow = 'rgba(255, 96, 96, 0.45)'; }
  else if (vs.visualMode === 'dead') { color = '#6a6a6a'; glow = 'rgba(106, 106, 106, 0.15)'; }
  else if (vs.visualMode === 'unconscious') { color = '#a0a060'; glow = 'rgba(160, 160, 96, 0.30)'; }
  // 파형 — ring buffer를 right→left scrolling
  const samples = st.samples;
  const N = st.maxSamples;
  const widx = st.writeIdx;
  const showCount = Math.min(W, N);
  // glow shadow
  if (!opts.mini) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 4;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = opts.mini ? 1.1 : 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < showCount; i++) {
    const sampleIdx = (widx - showCount + i + N * 4) % N;
    const v = samples[sampleIdx] || 0;
    const x = i;
    const y = H / 2 - v * (H * 0.38);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  // critical/dead — 모드 라벨
  if (!opts.mini && (vs.visualMode === 'critical' || vs.visualMode === 'dead')) {
    ctx.fillStyle = color;
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(vs.visualMode.toUpperCase(), W - 4, 10);
  }
}

// 활성 ECG canvas만 갱신 — main render loop에서 호출
function drawActiveEcgCanvases(dt) {
  // 1) 의료 오버레이 큰 ECG (target 기준)
  const medCanvas = document.getElementById('medicalEcgCanvas');
  if (medCanvas && typeof MEDIC_OVERLAY !== 'undefined' && MEDIC_OVERLAY && MEDIC_OVERLAY.open) {
    const target = unitById(MEDIC_OVERLAY.targetId);
    if (target) {
      updateEcgBuffer(target, dt);
      drawEcgCanvas(medCanvas, target, { mini: false });
    } else {
      drawEcgCanvas(medCanvas, null, { mini: false });
    }
  }
  // 2) 하단 mini ECG (selectedUnit 기준)
  const miniCanvas = document.getElementById('selectedMiniEcgCanvas');
  if (miniCanvas) {
    const selUnit = (typeof GAME !== 'undefined' && GAME.selectedId != null) ? unitById(GAME.selectedId) : null;
    if (selUnit) {
      updateEcgBuffer(selUnit, dt);
      drawEcgCanvas(miniCanvas, selUnit, { mini: true, noGrid: true });
    } else {
      drawEcgCanvas(miniCanvas, null, { mini: true, noGrid: true });
    }
  }
}

// medical 값을 UI 텍스트로 (HR/BP/RESP/BLOOD/LIFE/SHOCK/PAIN/CONSC)
function getRespLabel(be) {
  if (be < 20) return '호흡부전';
  if (be < 35) return '심한 호흡곤란';
  if (be < 55) return '호흡곤란';
  if (be < 75) return '숨가쁨';
  if (be < 90) return '호흡 빠름';
  return '정상';
}
function getMedicalVitalsForUi(unit) {
  if (!unit || !unit.medical) {
    return {
      hr: '--', bp: '--/--', bloodL: '--', lifePct: '--',
      respLabel: '--', respCls: '',
      shock: '--', pain: '--', conscious: '--',
      hrCls: '', bpCls: '', lifeCls: '', shockCls: '', painCls: '', consciousCls: '',
      bloodCls: '',
    };
  }
  const m = unit.medical;
  const isDead = unit.isDead || m.lifeStatus <= 0;
  // RESP 라벨
  let respLabel = '정상', respCls = '';
  const be = m.breathingEfficiency;
  if (be < 20) { respLabel = '호흡부전'; respCls = 'bad'; }
  else if (be < 35) { respLabel = '심한 호흡곤란'; respCls = 'bad'; }
  else if (be < 55) { respLabel = '호흡곤란'; respCls = 'warn'; }
  else if (be < 75) { respLabel = '숨가쁨'; respCls = 'warn'; }
  else if (be < 90) { respLabel = '호흡 빠름'; respCls = ''; }
  else { respLabel = '정상'; respCls = 'ok'; }
  return {
    hr: isDead ? '--' : Math.round(m.heartRate),
    bp: isDead ? '--/--' : `${Math.round(m.systolicBP)}/${Math.round(m.diastolicBP)}`,
    bloodL: (m.bloodMl/1000).toFixed(2) + 'L',
    lifePct: isDead ? '0%' : m.lifeStatus.toFixed(0) + '%',
    respLabel, respCls,
    shock: m.shock.toFixed(0),
    pain: m.pain.toFixed(0),
    conscious: m.consciousness.toFixed(0),
    hrCls: isDead ? 'bad' : (m.heartRate > 130 || m.heartRate < 50 ? 'bad' : (m.heartRate > 110 ? 'warn' : '')),
    bpCls: isDead ? 'bad' : (m.systolicBP < 70 ? 'bad' : (m.systolicBP < 90 ? 'warn' : '')),
    lifeCls: m.lifeStatus < 30 ? 'bad' : (m.lifeStatus < 60 ? 'warn' : 'ok'),
    shockCls: m.shock > 70 ? 'bad' : (m.shock > 40 ? 'warn' : ''),
    painCls: m.pain >= 70 ? 'bad' : (m.pain >= 40 ? 'warn' : ''),
    consciousCls: m.consciousness < 50 ? 'bad' : (m.consciousness < 80 ? 'warn' : ''),
    bloodCls: m.bloodMl < 2500 ? 'bad' : (m.bloodMl < 3500 ? 'warn' : ''),
  };
}


