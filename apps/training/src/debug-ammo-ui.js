import { CATALOG, ammoName } from './catalog.js';
import { createLegacyProtection } from './generated/legacy-protection.js';
import { damageIndexS3, DAMAGE_INDEX_S3_INFO } from './damage-index-s3.js';

// The original 2D ammunition table's order, material list, class representatives
// and 0–6 grade boundaries: src/presentation/armor-analysis.js (Ammo Info tab).
// The generated protection helpers are unchanged copies of the original rules.
export const DEBUG_AMMO_TABLE = Object.freeze({
  source: 'src/presentation/armor-analysis.js',
  calibers: Object.freeze(['12ga', '9x19mm', '9x21mm', '4.6x30mm', '5.7x28mm', '5.56x45mm', '5.45x39mm', '7.62x39mm', '.300 BLK', '9x39mm', '7.62x51mm', '7.62x54mmR', '.30-06', '6.8x51mm', '9.3x64mm', '.338 Lapua', '.338 Norma', '12.7x55mm', '12.7x99mm', '12.7x108mm']),
  materials: Object.freeze(['fabric', 'aramid', 'pe', 'aluminum', 'steel', 'titanium', 'ceramic', 'composite']),
  classArmors: Object.freeze([15, 25, 35, 45, 55, 65, 72]),
  gradeBoundaries: Object.freeze([1 / 21, 1 / 14, 1 / 10, 1 / 6, 1 / 4, 1 / 2]),
});
const protection = createLegacyProtection();
const grade = p => DEBUG_AMMO_TABLE.gradeBoundaries.findIndex(limit => p <= limit) < 0 ? 6 : DEBUG_AMMO_TABLE.gradeBoundaries.findIndex(limit => p <= limit);
const escape = value => String(value ?? '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => Number.isFinite(value) ? String(value) : '—';
const decimal = value => Number.isFinite(value) ? value.toFixed(1) : '—';
const penetrationDepth = block => block.stopped ? `${decimal(block.stopDepthM * 100)} cm` : `>${decimal(block.observedBlockDepthM * 100)} cm`;
const effectName = block => [block.fragmented && '파편화', block.deformation && '변형'].filter(Boolean).join('·') || '안 함';
export const DEBUG_AMMO_COLUMN_COUNT = 24;

/** Display-only values come from the registry and its original generated view. */
export function debugAmmoRows(material = 'composite') {
  if (!DEBUG_AMMO_TABLE.materials.includes(material)) throw new Error('Unknown ammunition table material: ' + material);
  const groups = new Map();
  for (const [id, entry] of Object.entries(CATALOG.AMMO_REGISTRY)) {
    const ammo = CATALOG.AMMO_PRESETS[id], caliber = entry.ballistic.caliber;
    const effectivePenetration = protection.effectivePenetration(ammo, null, material);
    const row = {
      id, name: entry.display.name, shortName: entry.display.shortName, caliber,
      massG: entry.projectile?.massG, velocityMps: entry.ballistic.velocity,
      penetration: entry.ballistic.penetration, effectivePenetration,
      damage: entry.ballistic.damage, suppression: entry.ballistic.suppression,
      damageIndex: damageIndexS3(id),
      recoil: entry.ballistic.recoil, accuracyMul: entry.ballistic.accuracyMul,
      armorDamagePct: entry.durability?.armorDamagePct,
      pelletCount: entry.projectile?.pelletCount || 1,
      classes: DEBUG_AMMO_TABLE.classArmors.map((armor, index) => {
        const probability = protection.penetrationProbability(effectivePenetration - armor);
        return { class: index + 1, armor, probability, grade: grade(probability) };
      }),
    };
    if (!groups.has(caliber)) groups.set(caliber, []);
    groups.get(caliber).push(row);
  }
  const order = [...DEBUG_AMMO_TABLE.calibers.filter(caliber => groups.has(caliber)), ...[...groups.keys()].filter(caliber => !DEBUG_AMMO_TABLE.calibers.includes(caliber))];
  return order.flatMap(caliber => groups.get(caliber).sort((a, b) => a.penetration - b.penetration));
}

export class DebugAmmoUI {
  constructor({ onSelectAmmo, onVelocityChange, onAutoZeroChange, onToggle }) {
    this.onSelectAmmo = onSelectAmmo; this.onVelocityChange = onVelocityChange;
    this.onAutoZeroChange = onAutoZeroChange; this.onToggle = onToggle;
    this.open = false; this.material = 'composite'; this.rows = null; this.state = { active: false };
    this.nodes = Object.fromEntries(['debugAmmoTab', 'debugAmmoCurrent', 'debugAmmoScreen', 'closeDebugAmmo', 'debugAmmoMaterial', 'debugVelocity', 'resetDebugVelocity', 'debugAutoZero', 'debugAmmoSelected', 'debugAmmoTable', 'debugAmmoError', 'debugWeaponButton'].map(id => [id, document.getElementById(id)]));
    let tabTouchPressed = false;
    this.nodes.debugAmmoTab.addEventListener('pointerdown', event => {
      tabTouchPressed = event.pointerType !== 'mouse';
      if (event.pointerType === 'mouse' || event.button !== 0 || this.nodes.debugAmmoTab.disabled) return;
      event.preventDefault(); event.stopPropagation(); this.suppressOpeningTouchClick=true;this.toggle();
    });
    this.nodes.debugAmmoTab.addEventListener('click', event => {
      if (tabTouchPressed && event.detail > 0 || event.pointerType && event.pointerType !== 'mouse' || event.sourceCapabilities?.firesTouchEvents) return;
      this.toggle();
    });
    this.nodes.closeDebugAmmo.addEventListener('click', () => this.close());
    this.nodes.debugAmmoMaterial.addEventListener('change', event => { this.material = event.target.value; this.renderRows(); });
    this.nodes.debugAmmoTable.addEventListener('click', event => this.selectRow(event.target.closest('[data-debug-ammo]')));
    this.nodes.debugAmmoTable.addEventListener('keydown', event => {
      const row = event.target.closest('[data-debug-ammo]'); if (!row) return;
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.selectRow(row); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const rows = [...this.nodes.debugAmmoTable.querySelectorAll('[data-debug-ammo]')], index = rows.indexOf(row);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
        rows[next]?.focus();
      }
    });
    this.nodes.debugVelocity.addEventListener('change', () => this.commitVelocity());
    this.nodes.debugVelocity.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); this.commitVelocity(); event.target.blur(); } });
    this.nodes.resetDebugVelocity.addEventListener('click', () => { this.nodes.debugVelocity.value = ''; this.commitVelocity(); });
    this.nodes.debugAutoZero.addEventListener('change', event => {
      if (this.onAutoZeroChange(event.target.checked) === false) {
        event.target.checked = Boolean(this.state.autoZero);
        this.nodes.debugAmmoError.textContent = '이 탄약·속도 조건에서는 자동 영점을 적용할 수 없습니다.';
      } else this.nodes.debugAmmoError.textContent = '';
    });
    // Native scrolling and input focus remain available. The panel never claims
    // a movement/fire pointer, and opening it is coordinated with TrainingInput.
    // Opening on touch-down moves the overlay under the finger. Its synthetic
    // click can be retargeted to an ammunition row. Accept rows only after a
    // fresh panel pointer-down; no timer and no delay for deliberate selection.
    this.nodes.debugAmmoScreen.addEventListener('pointerdown', event => {this.suppressOpeningTouchClick=false;event.stopPropagation();});
    this.nodes.debugAmmoScreen.addEventListener('click',event=>{if(this.suppressOpeningTouchClick&&event.detail>0){this.suppressOpeningTouchClick=false;event.preventDefault();event.stopImmediatePropagation();}},true);
    window.addEventListener('keydown', event => {
      if (!this.open) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.close(); }
      if (event.key === 'Tab') {
        const focusable = [...this.nodes.debugAmmoScreen.querySelectorAll('button,input,select,[tabindex="0"]')].filter(node => !node.disabled && !node.hidden), first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }, true);
  }
  selectRow(row) {
    if (!row || !this.open) return;
    if (this.onSelectAmmo(row.dataset.debugAmmo) !== false) { this.nodes.debugAmmoError.textContent = ''; this.close(); }
    else this.nodes.debugAmmoError.textContent = '이 탄약을 장전할 수 없습니다. 자동 영점 설정과 입력 속도를 확인하세요.';
  }
  commitVelocity() {
    const input = this.nodes.debugVelocity, value = input.value.trim() === '' ? null : Number(input.value);
    if (input.validity?.badInput || value !== null && (!Number.isFinite(value) || value < 1 || value > 5000)) {
      input.setAttribute('aria-invalid', 'true'); this.nodes.debugAmmoError.textContent = '초속은 1–5000 m/s로 입력하거나 비워서 기준 속도를 사용하세요.';
      return false;
    }
    input.removeAttribute('aria-invalid'); this.nodes.debugAmmoError.textContent = '';
    if (this.onVelocityChange(value) === false) {
      input.value = this.state.velocityOverrideMps ?? '';
      this.nodes.debugAmmoError.textContent = '이 속도에서는 적용할 수 없습니다. 자동 영점 설정을 확인하세요.';
      return false;
    }
    return true;
  }
  update(state) {
    this.state = { ...state };
    const key = JSON.stringify([Boolean(state.active), state.enabled !== false, state.ammoId, state.velocityOverrideMps ?? null, Boolean(state.autoZero), state.muzzleVelocityMps]);
    if (key === this.key) return;
    this.key = key;
    this.nodes.debugAmmoTab.hidden = !state.active;
    this.nodes.debugAmmoTab.disabled = state.enabled === false;
    this.nodes.debugWeaponButton.disabled = state.enabled === false;
    this.nodes.debugWeaponButton.classList.toggle('active', Boolean(state.active));
    this.nodes.debugWeaponButton.setAttribute('aria-pressed', String(Boolean(state.active)));
    if (!state.active && this.open) this.close();
    this.nodes.debugAmmoCurrent.textContent = `${ammoName(state.ammoId) || '탄약'} · ∞`;
    const base = CATALOG.AMMO_REGISTRY[state.ammoId]?.ballistic.velocity;
    this.nodes.debugAmmoSelected.textContent = `${CATALOG.AMMO_REGISTRY[state.ammoId]?.display.name || '탄약 미선택'} · ∞${Number.isFinite(state.muzzleVelocityMps) ? ` · ${number(state.muzzleVelocityMps)} m/s` : ''}${state.velocityOverrideMps != null ? ' (직접 입력)' : ' (기준 속도)'}`;
    if (document.activeElement !== this.nodes.debugVelocity) this.nodes.debugVelocity.value = state.velocityOverrideMps ?? '';
    this.nodes.debugVelocity.placeholder = Number.isFinite(base) ? `${base} m/s (기준)` : '레지스트리 기준';
    this.nodes.debugAutoZero.checked = Boolean(state.autoZero);
    this.highlight();
  }
  highlight() {
    if (!this.rows) return;
    for (const row of this.nodes.debugAmmoTable.querySelectorAll('[data-debug-ammo]')) {
      const selected = row.dataset.debugAmmo === this.state.ammoId;
      row.classList.toggle('selected', selected);
      if (selected) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
      row.querySelector('.debug-ammo-mark').textContent = selected ? '● ' : '';
    }
  }
  renderRows() {
    this.rows = debugAmmoRows(this.material);
    let previousCaliber = null;
    const body = this.rows.map(row => {
      let group = '';
      if (row.caliber !== previousCaliber) {
        previousCaliber = row.caliber;
        group = `<tr class="debug-ammo-group"><th colspan="${DEBUG_AMMO_COLUMN_COUNT}" scope="rowgroup">${escape(row.caliber)}${row.caliber === '12ga' ? ' · 산탄의 피해·관통·방호피해·질량은 펠릿 1개 기준' : ''}</th></tr>`;
      }
      const pen = row.penetration === row.effectivePenetration ? number(row.penetration) : `${number(row.penetration)} → ${number(row.effectivePenetration)}`;
      const classes = row.classes.map(c => `<td><span class="debug-ammo-grade g${c.grade}" title="Class ${c.class} · 방호 ${c.armor} · 관통 ${(c.probability * 100).toFixed(0)}% · 평균 ${(1 / c.probability).toFixed(1)}발" aria-label="Class ${c.class}, 관통 등급 ${c.grade}, 관통 확률 ${(c.probability * 100).toFixed(0)}%">${c.grade}</span></td>`).join('');
      const index = row.damageIndex;
      let indexCells;
      if (index) {
        const range = !index.flight.hasThresholdEffect ? '속도 문턱 효과 없음' : index.flight.effectEndRangeM === 0 ? '기준 초속부터 문턱 아래' : index.flight.effectStillActiveAtFlightLimit ? `약 ${Math.floor(index.flight.observedHorizontalLimitM / 10) * 10} m 밖까지` : `약 ${Math.round(index.flight.effectEndRangeM / 10) * 10} m까지`;
        indexCells = `<td data-damage-index="near" title="10 m 입사 ${decimal(index.near.entryVelocityMps)} m/s · 처음 30 cm 유효 손상 ${decimal(index.near.effectiveVolumeCm3)} cm³">${decimal(index.near.index)}</td>` +
          `<td data-damage-index="early" title="10 m 입사 · 처음 10 cm 유효 손상 ${decimal(index.early.effectiveVolumeCm3)} cm³ · M855 10 m 첫 30 cm = 100">${decimal(index.early.index)}</td>` +
          `<td data-damage-index="far" title="300 m 입사 ${decimal(index.far.entryVelocityMps)} m/s · 처음 30 cm 유효 손상 ${decimal(index.far.effectiveVolumeCm3)} cm³">${decimal(index.far.index)}</td>` +
          `<td data-damage-index="yaw">${index.near.yawOnsetDepthM === null ? '—' : `${decimal(index.near.yawOnsetDepthM * 100)} cm`}</td>` +
          `<td data-damage-index="effect"><span>10 m ${escape(effectName(index.near))} / 300 m ${escape(effectName(index.far))}</span><small>${escape(range)}</small></td>` +
          `<td data-damage-index="depth"><span>10 m ${penetrationDepth(index.near)}</span><small>300 m ${penetrationDepth(index.far)}</small></td>` +
          `<td data-damage-index="grade"><span class="debug-data-grade">${escape(index.grade)}</span></td>`;
      } else indexCells = '<td data-damage-index="near"></td><td data-damage-index="early"></td><td data-damage-index="far"></td><td data-damage-index="yaw"></td><td data-damage-index="effect"></td><td data-damage-index="depth"></td><td data-damage-index="grade" class="debug-uncalibrated">미보정</td>';
      const damageTitle = index ? '원본 2D 참고값. 이 탄의 S3 몸 HP 감소에는 사용하지 않습니다.' : '미보정 탄. S3 몸 HP 감소에 기존 레지스트리 피해 × 조직 배율 × m을 사용합니다.';
      return group + `<tr data-debug-ammo="${escape(row.id)}" data-s3-calibrated="${Boolean(index)}" tabindex="0" title="${escape(row.name)} · 선택하면 즉시 장전">` +
        `<th scope="row"><span class="debug-ammo-mark"></span>${escape(row.name)}${row.pelletCount > 1 ? ` <small>×${row.pelletCount}</small>` : ''}</th>` +
        `<td>${escape(row.caliber)}</td><td>${number(row.massG)} g</td><td>${pen}</td><td class="debug-original-damage" title="${damageTitle}">${number(row.damage)}<small>${index ? '몸 HP 미사용' : '미보정 · 사용 중'}</small></td><td>${number(row.suppression)}</td><td>${row.recoil >= 0 ? '+' : ''}${number(row.recoil)}</td><td>×${row.accuracyMul?.toFixed(2) ?? '—'}</td><td>${number(row.velocityMps)} m/s</td><td>${number(row.armorDamagePct)}%</td>${classes}${indexCells}</tr>`;
    }).join('');
    this.nodes.debugAmmoTable.innerHTML = '<thead><tr><th scope="col">탄종 · 누르면 장전</th><th scope="col">구경</th><th scope="col">탄두 질량</th><th scope="col">관통<br>기본 → 재질</th><th scope="col">원본 데미지<br>참고 / 미보정</th><th scope="col">제압</th><th scope="col">반동</th><th scope="col">정확도</th><th scope="col">기준 탄속</th><th scope="col">방호피해</th>' + DEBUG_AMMO_TABLE.classArmors.map((_, i) => `<th scope="col">Class ${i + 1}</th>`).join('') + '<th scope="col">근거리 피해 지수<br>10 m</th><th scope="col">근거리 초반 지수<br>10 m · 처음 10 cm</th><th scope="col">원거리 피해 지수<br>300 m</th><th scope="col">회전 시작 깊이<br>10 m 입사</th><th scope="col">파편화·변형<br>작동 한계(사거리)</th><th scope="col">총 관통 깊이<br>근육 등가 블록</th><th scope="col">자료 등급</th></tr></thead><tbody>' + body + '</tbody>';
    this.highlight();
  }
  toggle(open = !this.open) {
    if (open && (!this.state.active || this.state.enabled === false) || open === this.open) return;
    this.open = open;
    this.nodes.debugAmmoScreen.hidden = !open;
    this.nodes.debugAmmoTab.setAttribute('aria-expanded', String(open));
    if (open && !this.rows) this.renderRows();
    this.onToggle?.(open);
    if (open) this.nodes.closeDebugAmmo.focus();
    else if (this.state.active) this.nodes.debugAmmoTab.focus({ preventScroll: true });
  }
  close() { this.toggle(false); }
  snapshot() {
    return { open: this.open, active: Boolean(this.state.active), material: this.material,
      rowCount: this.rows?.length || 0, registryCount: Object.keys(CATALOG.AMMO_REGISTRY).length,
      columnCount: DEBUG_AMMO_COLUMN_COUNT, calibratedCartridges: DAMAGE_INDEX_S3_INFO.cartridges,
      damageIndexReference: DAMAGE_INDEX_S3_INFO.reference,
      selectedAmmoId: this.state.ammoId || null, velocityOverrideMps: this.state.velocityOverrideMps ?? null,
      autoZero: Boolean(this.state.autoZero) };
  }
}
