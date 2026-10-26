import{CorpseInventory}from'./corpse-inventory.js';
import{EquipmentWorld}from'./equipment-world.js';
import{SelfCare}from'./medical-care.js';
import{MedicalCareUI}from'./medical-care-ui.js';
import{installTouchControls}from'./ui-touch.js';
import{MedicalInventoryUI}from'./medical-ui.js';
import {StatusHUD} from './status-hud.js';
import {MedicalFeedback,HEALTHY_FEEDBACK} from './medical-feedback.js';
import {TrainingSound} from './sound.js';
import {PlayerLocomotion,LOCOMOTION} from './player-locomotion.js';
import {SoundDebug} from './sound-debug.js';
import {installFootstepStrips} from './sound-world.js';
import {createInternalRegions} from './internal-model.js';
import {stepOpticMagnification} from './optic-optics.js';
import {opticDefinition} from './optic-data.js';
import {opticFocus} from './optic-focus.js';
import { lensParameters, lensProject } from './lens.js';
import * as T from 'three';
import { AimState, approach, direction } from './aim.js';
import { GUN, PLAYER, STEP, LOOT_CRATE, RANGE_LANES, LONG_RANGE } from './config.js';
import { createPhysics } from './physics.js';
import { createScene } from './scene.js';
import { TrainingInput } from './input.js';
import { canSprint } from './sprint.js';
import {LEAN,LeanState,leanPoint,leanPose} from './lean.js';
import {CombatTraining} from './combat.js';
import {COMBAT} from './combat-config.js';
import {KILLHOUSE} from './killhouse-config.js';
import {shooterPhysics} from './combat-physics.js';
import { loadWeapon } from './weapon-model.js';
import { TrainingFX } from './fx.js';
import { AIM_DEFAULTS, AIM_PRESETS, loadSettings, saveSettings } from './settings.js';
import { Inventory, CRATE_OWNER } from './inventory.js';
import { InventoryUI } from './inventory-ui.js';
import { DebugAmmoUI } from './debug-ammo-ui.js';
import {debugShotBallistics,debugRecoilBallistics} from './debug-weapon.js';
import { CATALOG, catalogCounts, ammoName, shotBallistics } from './catalog.js';
import { WEAPONS, FIRE_MODES } from './weapon-data.js';
import { zeroingPreset } from './zeroing.js';
import { traceShot, MATERIAL_NAMES } from './ballistics.js';
import { TRAJECTORY_COLORS } from './trajectories.js';
import { loadHumanTargets } from './human-model.js';
import { HumanHitLog, HUMAN_TARGETS } from './human-targets.js';
import { createArmorRegions } from './armor-model.js';
import { ARMOR_COLORS, describeArmorContact } from './armor-targets.js';
import { TrainingMedical } from './medical.js';
import { renderMedicalPanel,renderBleedingDebugB1 } from './medical-panel.js';

const $ = id => document.getElementById(id);
async function start() {
  const view = createScene($('world'));
  const physics = await createPhysics();
  const [weapon, humans] = await Promise.all([loadWeapon(view.scene), loadHumanTargets(view.scene, {rigs:physics.humanRigs})]);
  const humanHits = new HumanHitLog();
  const settings = loadSettings();
  const medical = new TrainingMedical({medicalModel:settings.medicalModel});medical.feedback=new MedicalFeedback();
  const fieldMedical=new TrainingMedical({medicalModel:'v2',targetId:'P01-field',team:'friendly'});fieldMedical.feedback=new MedicalFeedback();
  const statusHUD=new StatusHUD($('statusHUD'));
  function playerMedical(){return combat.active&&combat.player?combat.player.medical:fieldMedical;}
  function playerFeedback(){const bridge=playerMedical();return combat.active?bridge.feedback.output:(bridge.activity.intensity||bridge.activity.hrExtra||bridge.activity.arm<.65||bridge.activity.concussionSeverity?bridge.feedback.output:HEALTHY_FEEDBACK);}
  let medicalPanelStamp = '';let bleedDebugStamp='';
  const armor = createArmorRegions(view.scene, {rigs:physics.humanRigs});
  const internals=createInternalRegions(view.scene,physics);
  const effects = new TrainingFX(view.scene, weapon.brass);
  const sound = new TrainingSound({physics,enabled:settings.sound,microphone:settings.bodycamMic});
  effects.soundEngine=sound;
  installFootstepStrips(view.scene,physics);
  const soundDebug=new SoundDebug(view.scene,sound,$('soundDebug'));

  const aim = new AimState(settings);
  const locomotion=new PlayerLocomotion(humans.source.animations);
  const lean=new LeanState();
  const inventory = new Inventory({includeSCAR:true,includePlates:true,includeEquipment:true,nativeHandling:true,includeDebug:true,includeMedical:true,includeAbdominal:true,includeMedic:true});
  const state = { ready: true, phase: 'menu', tick: 0, time: 0, shots: 0, hits: 0,
    cooldown: 0, lastShotTime: -10, blocked: false, speed: 0, sprinting: false, sprintShotPending:false, lastShot: null,
    viewHeight: PLAYER.standView, previousHeight: PLAYER.standView, motion: 0.7, quality: 'balanced', fpsLimit: 30,
    toastTime: 0, toast: '', hitLife: 0, hitPoint: null, started: false, worldFrames: 0 };
  // Camera-only foot impacts; the simulated rifle and view intent never read this state.
  const stepImpact = { axes: Array.from({ length: 3 }, () => ({ x: 0, v: 0, previous: 0 })), phaseIndex: 0, contacts: 0, lastRollSign: 0 };
  const stepPeakTime = Math.atan(24 / 18) / 24;
  const stepPeakGain = Math.exp(-18 * stepPeakTime) * Math.sin(24 * stepPeakTime) / 24;
  const previousFeet = physics.feet.clone();
  let previousYaw = 0, previousPitch = 0;
  let accumulator = 0, pendingDX = 0, pendingDY = 0, pendingFire = false, lastTime = 0, lastRender = 0, animation;
  let disposed = false;
  const input = new TrainingInput({ onCommand: command, onUnlock: () => effects.unlockAudio() });
  const combat=new CombatTraining({view,physics,weapon,humans,effects,settings,inventory,onPlayerDown:playerDown,onPlayerSettled:playerSettled});
  let selectedMedicalId='H01';let medicalUI=null,bagPose=null;
  const bag = new InventoryUI(inventory, { toast,getDebug:()=>settings.internalRegions, onToggle: (open,options) => {
    const ads=input.ads,crouch=input.crouch;
    input.enabled = state.phase === 'active' && !open && !debugUI.open; input.clear(); pendingDX = pendingDY = 0; pendingFire = false;
    state.sprintShotPending=false;
    input.ads=ads;input.crouch=crouch;
    if(open){bagPose={ads,crouch:physics.crouched};physics.velocity.set(0,0,0);physics.movementVelocity.set(0,0,0);physics.sprinting=false;physics.body.setNextKinematicTranslation(physics.body.translation());input.unlockForUI();}
    else{if(bagPose&&settings.mouseAdsMode==='hold')input.ads=false;bagPose=null;clearLeanPose();}
    medicalUI?.onToggle(open);
    if(state.phase==='down')$('playerDownScreen').hidden=open;
    if(!open&&options?.returnPointer&&state.phase==='active')input.pointerReturn.request(options.event);
  }, onChange: () => { if (!inventory.weapon) input.ads = false; } });
  const equipmentWorld=new EquipmentWorld({scene:view.scene,physics,weapon,humans,armor,medical,combat,inventory,aim,settings});
  const corpses=new CorpseInventory({combat,inventory,world:equipmentWorld,bag,aim,physics,settings,onOpen:()=>{bag.toggle(true);medicalUI?.setTab('inventory');}});
  const plateDebugLabel=document.createElement('label');plateDebugLabel.id='enemyPlateTypeLabel';plateDebugLabel.textContent='다음 적 앞·뒤판(디버그) ';const plateDebugSelect=document.createElement('select');plateDebugSelect.id='enemyPlateType';for(const[value,label]of[['random','Br4/Br5 무작위'],['br4','Granit Br4'],['br5','Granit Br5']]){const option=document.createElement('option');option.value=value;option.textContent=label;plateDebugSelect.append(option);}plateDebugSelect.value=settings.enemyPlateType;plateDebugLabel.append(plateDebugSelect);$('plateRegions').parentElement.after(plateDebugLabel);plateDebugSelect.addEventListener('change',()=>{settings.enemyPlateType=plateDebugSelect.value;saveSettings(settings);});
  inventory.getEquipmentMedical=()=>playerMedical().actor.medical;inventory.getEquipmentFeedback=()=>playerFeedback();
  inventory.canEquipmentAct=()=>{const m=playerMedical().actor.medical;return!m.isUnconscious&&!m.isDead&&!m.cardiacArrest;};
  inventory.onEquipmentAction=()=>{care.interrupt('장비·배낭 동작');input.ads=false;input.clear();pendingFire=false;physics.velocity.set(0,0,0);physics.movementVelocity.set(0,0,0);};
  const syncDebugAim=()=>{aim.zeroingOverride=inventory.isDebugWeapon?inventory.debugState.zeroing:null;};
  const updateDebug=(method,value)=>{const changed=inventory[method](value);if(!changed)toast(inventory.lastError);else syncDebugAim();return changed;};
  const debugUI=new DebugAmmoUI({
    onSelectAmmo:id=>updateDebug('selectDebugAmmo',id),
    onVelocityChange:value=>updateDebug('setDebugVelocity',value),
    onAutoZeroChange:value=>updateDebug('setDebugAutoZero',value),
    onToggle:open=>{
      input.enabled=state.phase==='active'&&!bag.open&&!open;input.clear();pendingDX=pendingDY=accumulator=0;pendingFire=false;state.sprintShotPending=false;clearLeanPose();
      if(open)input.unlockForUI();
    },toast
  });
  medicalUI=new MedicalInventoryUI({bag,getMedical:playerMedical,getDebug:()=>settings.internalRegions,getHearing:()=>sound.hearing.get('P01')});
  const care=new SelfCare({inventory,getMedical:playerMedical,getFeedback:playerFeedback,notify:toast,onStart:()=>{input.ads=false;input.clear();pendingFire=false;state.sprintShotPending=false;inventory.cancel();physics.velocity.set(0,0,0);physics.movementVelocity.set(0,0,0);},onChange:()=>{medicalUI.dirty=true;}});
  const careUI=new MedicalCareUI({medicalUI,care,getPhase:()=>state.phase});medicalUI.careUI=careUI;careUI.touchControls=installTouchControls(careUI.hud);
  window.addEventListener('keydown',e=>{if((care.active||inventory.action?.kind.startsWith('gear-')||inventory.action?.kind==='backpack-open')&&!e.target.matches('input,select,textarea')&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Digit1','Digit2','Digit3'].includes(e.code))care.interrupt('이동·총 들기 입력');});
  window.addEventListener('keydown',e=>{if(!e.target.matches('input,select,textarea')&&['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)){if(inventory.action?.kind.startsWith('gear-')||inventory.action?.kind==='backpack-open')inventory.cancel();if(inventory.backpackOpen)inventory.closeBackpack();}});
  function simulationLive(){return ['active','falling'].includes(state.phase)||(state.phase==='down'&&(care.needsSimulation||inventory.action?.kind.startsWith('gear-')||inventory.action?.kind==='backpack-open')&&!care.m.isDead);}
  const weaponBusy = () => inventory.action && !['pack', 'unpack'].includes(inventory.action.kind);
  function clearLeanPose(){lean.reset();aim.restoreLean();weapon.snap(aim);}
  const crateCenter = new T.Vector3(...LOOT_CRATE.at), lootRay = new T.Vector3(), lootEye = new T.Vector3();
  function lootAvailable() {
    if (Math.hypot(physics.feet.x - crateCenter.x, physics.feet.z - crateCenter.z) > LOOT_CRATE.range) return false;
    lootEye.copy(physics.feet).y += state.viewHeight; lootRay.copy(crateCenter).sub(lootEye);
    return physics.ray(lootEye, lootRay.clone().normalize(), lootRay.length() + 0.01)?.id === LOOT_CRATE.id;
  }
  const medicalTarget = HUMAN_TARGETS.find(actor => actor.id === 'H01');
  function medicalAvailable() {
    if (!settings.internalRegions || !medicalTarget || Math.hypot(physics.feet.x - medicalTarget.at[0], physics.feet.z - medicalTarget.at[2]) > 2.1) return false;
    const eye = physics.feet.clone(); eye.y += state.viewHeight;
    const toward = new T.Vector3(...medicalTarget.at); toward.y += 1.2; toward.sub(eye);
    const hit = physics.ray(eye, toward.clone().normalize(), toward.length());
    return !hit || hit.id === medicalTarget.id;
  }
  function nearbyInteraction() {
    const corpse=corpses.nearby();if(corpse)return corpse;
    const pickup=equipmentWorld.nearby();if(pickup)return pickup;
    const battle=combat.nearby(physics.feet,state.viewHeight);if(battle&&(battle.kind!=='combat-medical'||settings.internalRegions))return battle;
    const lootDistance = lootAvailable() ? Math.hypot(physics.feet.x - crateCenter.x, physics.feet.z - crateCenter.z) : Infinity;
    const medicalDistance = medicalAvailable() ? Math.hypot(physics.feet.x - medicalTarget.at[0], physics.feet.z - medicalTarget.at[2]) : Infinity;
    if (medicalDistance < lootDistance) return { kind: 'medical', targetId: medicalTarget.id, label: 'H01', action: '의료 상태' };
    return Number.isFinite(lootDistance) ? { kind: 'loot', targetId: LOOT_CRATE.id, label: '탄약상자', action: '열기' } : null;
  }
  function selectedMedical(){return combat.bridge(selectedMedicalId)||medical;}
  function syncMedicalTargets(){
    const options=[['H01','H01 · 병사 표적'],...(combat.player?[['P01','P01 · 나의 의료']]:[]),...combat.listEnemies().map(e=>[e.actor.id,e.actor.id+' · 적 의료'])];
    if(!options.some(([id])=>id===selectedMedicalId))selectedMedicalId='H01';
    const selector=$('medicalTargetSelect');if([...selector.options].map(o=>o.value).join('|')!==options.map(([id])=>id).join('|')){selector.replaceChildren(...options.map(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;}));}selector.value=selectedMedicalId;$('myMedicalButton').hidden=!combat.player;
  }
  function openSelfMedical(){
    if(combat.playerDown){state.phase=combat.playerInterfaceShown?'down':'falling';$('menuScreen').hidden=true;}else if(state.phase!=='active')resume();
    $('playerDownScreen').hidden=true;medicalUI.show('medical');
  }
  function openMedical(targetId='H01') {
    if(targetId==='P01'){openSelfMedical();return;}
    if(!settings.internalRegions)return;
    selectedMedicalId=targetId;syncMedicalTargets();$('playerDownScreen').hidden=true;pause('상처와 의료 상태를 확인합니다.');
    $('settings').open = false; $('medicalPanel').open = true;
    renderMedicalPanel(selectedMedical(), $('medicalContent'),{showInternals:settings.internalRegions}); medicalPanelStamp = '';
    const summary = $('medicalPanel').querySelector('summary');
    summary.focus({ preventScroll: true }); summary.scrollIntoView({ block: 'start' });
  }
  function toast(message) { state.toast = message; state.toastTime = 1.8; $('toast').textContent = message; $('toast').classList.add('visible'); }
  function pause(reason = '') {
    if (state.phase === 'menu') return;
    state.phase = 'menu'; debugUI.close(); input.enabled = false; input.clear(); pendingDX = pendingDY = accumulator = 0; pendingFire = false;
    clearLeanPose();
    state.sprintShotPending=false;
    bag.toggle(false);
    $('menuScreen').hidden = false; $('menuTitle').innerHTML = '잠시 멈추고.<br><em>다시 조준하다.</em>';
    $('menuDescription').textContent = reason || '화면과 조작을 조정하고 훈련을 이어가세요.';
    $('startButton').innerHTML = '훈련 계속하기 <span>→</span>';
    // Freeze the latest simulation pose even when the next RAF is suspended.
    weapon.snap(aim); render(0, 1);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function resume(event) {
    $('aiPanelScreen').hidden=true;
    if (innerHeight > innerWidth || !state.ready) return;
    if(combat.playerDown){state.phase=combat.playerInterfaceShown?'down':'falling';input.enabled=false;input.clear();$('menuScreen').hidden=true;$('playerDownScreen').hidden=!combat.playerInterfaceShown;pendingDX=pendingDY=accumulator=0;pendingFire=false;lastTime=performance.now();return;}
    debugUI.close();effects.unlockAudio(); state.phase = 'active'; state.started = true; input.enabled = true; input.clear();
    pendingDX = pendingDY = accumulator = 0; pendingFire = false; $('menuScreen').hidden = true; $('creditsScreen').hidden = true; $('startButton').blur(); lastTime = performance.now();
    if(event)input.pointerReturn.request(event);
  }
  function reset() {
    corpses.reset();bag.plates.reset();equipmentWorld.reset();careUI.pending=null;careUI.lastHUD='';
    locomotion.reset();
    debugUI.close();
    physics.bodyModel=settings.medicalModel==='legacy'?'legacy':'s2';
    combat.leave();selectedMedicalId='H01';$('playerDownScreen').hidden=true;syncMedicalTargets();
    stepImpact.phaseIndex = stepImpact.contacts = stepImpact.lastRollSign = 0;
    for (const axis of stepImpact.axes) axis.x = axis.v = axis.previous = 0;
    physics.reset(); aim.setWeapon('m4a1'); aim.reset(); effects.reset(); bag.windows.reset();inventory.reset(); weapon.reset?.(); view.resetTargets(); humanHits.reset(); input.clear(); input.ads = input.crouch = false;
    lean.reset();
    fieldMedical.reset();fieldMedical.feedback=new MedicalFeedback();
    medical.reset();medical.feedback=new MedicalFeedback(); medicalPanelStamp = '';
    $('barrierResult').hidden = true;
    bag.toggle(false);
    Object.assign(state, { tick: 0, time: 0, shots: 0, hits: 0, cooldown: 0,
      lastShotTime: -10, blocked: false, speed: 0, sprinting: false, sprintShotPending:false, lastShot: null, viewHeight: PLAYER.standView,
      previousHeight: PLAYER.standView, hitLife: 0, hitPoint: null });
    syncHumanPose(0);internals.highlight(null);
    previousFeet.copy(physics.feet); previousYaw = previousPitch = 0; pendingDX = pendingDY = accumulator = 0; pendingFire = false;
    aim.step(STEP, { feet: physics.feet, viewHeight: state.viewHeight, time: 0, speed: 0, ads: false, reloading: false, blocked: false }); weapon.snap(aim);
    toast('훈련을 초기화했습니다.'); updateHUD();
  }
  function canChangeSector(){if(!care.list.length&&![...inventory.items.values()].some(i=>i.owner.startsWith('treatment:')))return true;const message='처치 중이거나 적용한 효과가 남아 있습니다. 제거 가능한 물품을 제거하거나 훈련을 초기화한 뒤 구역을 이동하세요.';toast(message);if(state.phase==='menu')$('menuDescription').textContent=message;return false;}
  function moveRange(long) {
    if(!canChangeSector())return false;
    combat.leave();selectedMedicalId='H01';$('playerDownScreen').hidden=true;syncMedicalTargets();
    bag.toggle(false);input.clear();input.ads=input.crouch=false;
    lean.reset();
    state.sprintShotPending=false;
    locomotion.reset();physics.stance(false);physics.relocate(long?LONG_RANGE.spawn:PLAYER.spawn);
    aim.reset();state.viewHeight=state.previousHeight=PLAYER.standView;state.speed=0;state.sprinting=false;state.blocked=false;
    aim.step(STEP,{feet:physics.feet,viewHeight:state.viewHeight,time:state.time,speed:0,ads:false,reloading:weaponBusy(),nativeHandling:['reload','insert','remove','switch'].includes(inventory.action?.kind),blocked:false});
    previousFeet.copy(physics.feet);previousYaw=aim.viewYaw;previousPitch=aim.viewPitch;
    pendingDX=pendingDY=accumulator=0;pendingFire=false;weapon.snap(aim);effects.reset();
    for(const axis of stepImpact.axes)axis.x=axis.v=axis.previous=0;stepImpact.phaseIndex=Math.floor(aim.gaitPhase/Math.PI);
    $('barrierResult').hidden=true;state.hitLife=0;state.hitPoint=null;
    resume();toast(long?'장거리 사격장 · 사격선 기준 100–500 m':'근거리 사격장으로 돌아왔습니다.');
  }
  async function moveCombat(sector='04'){
    if(!canChangeSector())return false;
    bag.toggle(false);input.clear();input.ads=input.crouch=false;lean.reset();state.sprintShotPending=false;
    locomotion.reset();physics.stance(false);physics.relocate(sector==='05'?KILLHOUSE.spawn:COMBAT.spawn);aim.reset();state.viewHeight=state.previousHeight=PLAYER.standView;state.speed=0;state.sprinting=false;state.blocked=false;
    previousFeet.copy(physics.feet);previousYaw=aim.viewYaw;previousPitch=aim.viewPitch;pendingDX=pendingDY=accumulator=0;pendingFire=false;weapon.snap(aim);effects.reset();
    for(const axis of stepImpact.axes)axis.x=axis.v=axis.previous=0;stepImpact.phaseIndex=Math.floor(aim.gaitPhase/Math.PI);state.hitLife=0;state.hitPoint=null;$('barrierResult').hidden=true;
    if(!await combat.enter(sector))return;equipmentWorld.sync();selectedMedicalId='P01';syncMedicalTargets();$('playerDownScreen').hidden=true;resume();toast(sector==='05'?'Sector05 · 현관 벽 패널에서 적 투입을 설정하세요.':'Sector04 · 벽 패널에서 적을 투입하세요.');
  }
  function playerDown(data){
    state.phase='falling';input.enabled=false;input.clear();input.ads=false;pendingDX=pendingDY=0;pendingFire=false;bag.toggle(false);clearLeanPose();state.sprintShotPending=false;inventory.cancel();$('playerDownScreen').hidden=true;
  }
  function playerSettled(data){
    const m=data.medical;state.phase='down';input.enabled=false;input.clear();pendingDX=pendingDY=0;pendingFire=false;
    $('playerDownTitle').textContent=m.isDead?'사망':m.cardiacArrest?'심정지':'전투 불능';$('playerDownReason').textContent=m.deathReason||m.downReason||(m.isUnconscious?'의식 소실':'다리 기능 상실');$('playerDownScreen').hidden=false;
    if(document.pointerLockElement)document.exitPointerLock();
  }
  function restartCombat(){const sector=combat.sector;reset();moveCombat(sector).catch(error=>toast(error.message));}
  function command(action) {
    if(care.active&&['sprint','weapon1','weapon2','weapon3','debugWeapon','switchWeapon','ads','reload'].includes(action)){care.interrupt('달리기·총 들기');input.ads=false;pendingFire=false;}
    if (action === 'pause') { pause(); return; }
    if (state.phase !== 'active' || debugUI.open) return;
    if(action==='medical'){openSelfMedical();return;}
    if (action === 'inventory') { if(bag.open)bag.toggle(false);else{bag.toggle(true);medicalUI.setTab('inventory');} return; }
    if (bag.open) return;
    if (action === 'interact') {
      const nearby = nearbyInteraction();
      if(nearby?.kind==='world-pickup'){if(!inventory.pickupItem(nearby.targetId))toast(inventory.lastError);return;}
      if(nearby?.kind==='corpse-search'){if(!corpses.search(nearby.targetId))toast(inventory.lastError);return;}
      if(nearby?.kind==='combat-panel'){if(combat.enemy){const result=corpses.requestCleanup();if(!result.confirmed){toast(result.message);return;}}(combat.sector==='05'&&!combat.enemy?(pause(),$('menuScreen').hidden=true,$('aiPanelScreen').hidden=false,Promise.resolve(false)):combat.interact()).then(()=>syncMedicalTargets()).catch(error=>toast(error.message));return;}
      if(nearby?.kind==='combat-medical'){openMedical(nearby.targetId);return;}
      if (nearby?.kind === 'medical') openMedical();
      else if (nearby?.kind === 'loot') bag.toggle(true, CRATE_OWNER);
      return;
    }
    if (action === 'loot') { if (lootAvailable()) bag.toggle(true, CRATE_OWNER); return; }
    if(['weapon1','weapon2','weapon3','debugWeapon','switchWeapon'].includes(action)){
      const slot=action==='weapon1'?0:action==='weapon2'?1:['weapon3','debugWeapon'].includes(action)?2:inventory.primaryId===inventory.weaponSlots[0]?1:0;
      if(inventory.switchWeapon(slot)){input.ads=false;input.firing=input.firePressed=false;pendingFire=false;state.sprintShotPending=false;toast('주무기를 전환합니다.');}return;
    }
    if (action === 'fireMode' && inventory.weapon && !inventory.action) {
      const modes=FIRE_MODES[inventory.weapon.definitionId];inventory.weapon.fireMode=modes[(modes.indexOf(inventory.weapon.fireMode)+1)%modes.length];inventory.revision++;
    }
    if (action === 'ads') { input.ads = !input.ads; }
    if (action === 'crouch') { input.crouch = !input.crouch; }
    if (action === 'sprint') {
      input.sprintIntent.toggle();
      if(input.sprintIntent.toggled){input.ads=false;input.releaseMouseADS();input.crouch=false;}
    }
    if (action === 'reload') {
      if(inventory.isDebugWeapon&&!inventory.action){toast('디버그 총기는 무한 탄창입니다. 좌측 상단 탭에서 탄을 고르세요.');return;}
      if (inventory.action) { inventory.cancel(); toast('동작을 취소했습니다.'); }
      else if (inventory.beginReload()) { toast(inventory.action.mode === 'tactical' ? '약실 탄을 유지하고 탄창을 교체합니다.' : '탄창 교체 후 약실을 장전합니다.'); }
      else toast('리그·벨트에 탄이 든 탄창을 넣으세요.');
    }
  }
  function fire() {
    if(care.active||bag.open||inventory.backpackOpen||!inventory.weapon||inventory.action||inventory.weapon.fireMode==='safe')return;
    const shoulder = physics.feet.clone().add(new T.Vector3(0, state.viewHeight - 0.07, 0));
    if(lean.value)shoulder.copy(leanPoint(shoulder,physics.feet.clone().add(new T.Vector3(0,state.viewHeight,0)),lean.pose));
    if (state.blocked || physics.muzzleBlocked(shoulder, aim.muzzle, aim.barrelDirection)) { state.cooldown = 0.15; toast('총구 앞 공간을 확보하세요.'); return; }
    const pose = aim.shotPose();
    const ammoId = inventory.weapon.chamber, ballistics = inventory.isDebugWeapon?debugShotBallistics(inventory.debugState):shotBallistics(ammoId,inventory.weapon.definitionId);
    const trace = combat.active?combat.profile.measure('traceShot',()=>traceShot(combat.active?shooterPhysics(physics,'P01'):physics, pose.origin, pose.direction, ballistics, { shotId: state.shots + 1, simulateFlight:true, maxDistance:LONG_RANGE.maxShotDistance,bodyModel:combat.active?'s2':physics.bodyModel })):traceShot(combat.active?shooterPhysics(physics,'P01'):physics, pose.origin, pose.direction, ballistics, { shotId: state.shots + 1, simulateFlight:true, maxDistance:LONG_RANGE.maxShotDistance,bodyModel:combat.active?'s2':physics.bodyModel });
    const hit = trace.hit;
    if (inventory.fire() !== ammoId) throw new Error('Chamber changed while confirming shot');
    const event = Object.freeze({ shotId: ++state.shots, time: state.time, ...pose, hit, trace, ammoId, ballistics, weaponId:inventory.weapon.definitionId,shooterId:'P01',team:'player',shooterVelocity:physics.movementVelocity.clone() });
    state.cooldown += 60 / WEAPONS[inventory.weapon.definitionId].action.rateOfFire; state.lastShotTime = state.time;
    const recoilBallistics=inventory.isDebugWeapon?debugRecoilBallistics():inventory.attachmentWeightKg?{...ballistics,weaponMassKg:ballistics.weaponMassKg+inventory.attachmentWeightKg}:ballistics;
    const recoil = aim.onShot(recoilBallistics, event.shotId, { crouched: physics.crouched, speed: state.speed, fireMode: inventory.weapon.fireMode });
    state.lastShot = { shotId: event.shotId, tick: state.tick, origin: pose.origin.toArray(), direction: pose.direction.toArray(),
      zeroing: aim.zeroingOverride??zeroingPreset(aim.weaponId,aim.opticDef), ...(inventory.isDebugWeapon?{debugWeapon:inventory.debugState}:{}), lean:{...lean.snapshot(),playerHitVolumes:combat.active&&!!combat.player}, ammoId, ballistics, recoil, barriers: trace.events, segments: trace.segments, armorContacts: trace.armorContacts,
      armorResults: trace.armorResults, bodyHits: trace.bodyHits, residual: trace.residual, termination: trace.reason, flight:trace.flight,
      hit: hit ? { id: hit.id, kind: hit.kind, point: hit.point.toArray(), normal: hit.normal.toArray(), distance: hit.distance,
        ...(hit.kind === 'human' ? { address: structuredClone(hit.address), incomingDirection: hit.incomingDirection.toArray(), flightState: hit.flightState } : {}) } : null };
    const bodyHit = humanHits.record(event);
    const medicalRecords=medical.record(event, physics);
    internals.highlight(combat.active?{...trace,bodyHits:trace.bodyHits.filter(b=>b.targetId==='H01')}:trace,medicalRecords);
    if(combat.active)combat.record(event);
    const deflection = trace.armorResults.find(c => c.outcome === 'ricochet');
    if (hit?.kind === 'target' || hit?.kind === 'armor' || bodyHit || deflection) {
      state.hits++;
      if (hit?.kind === 'target') { const target = view.targets.get(hit.id); target.hits++; target.pulse = 1; }
      state.hitPoint = bodyHit ? new T.Vector3(...bodyHit.point) : deflection ? new T.Vector3(...deflection.point) : hit.point.clone(); state.hitLife = 0.32;
    }
    const obstacles = trace.events.filter(item => item.id.startsWith('panel-'));
    const result = $('barrierResult');
    const longShot=physics.feet.x>31;
    result.hidden = !obstacles.length && !bodyHit && !trace.armorContacts.length && !longShot;
    result.textContent = '';
    if (obstacles.length) {
      const last = obstacles.at(-1), passed = obstacles.filter(item => item.outcome === 'penetrated').length;
      const lane = RANGE_LANES.find(item => last.id.replace(/-\d+$/, '') === `panel-${item.id}`);
      const spent = trace.reason === 'spent' && last.outcome === 'penetrated';
      const outcome = spent ? `정지 (${passed}겹 관통 후 탄자 소진)` : last.outcome === 'penetrated' ? `관통 ${passed}겹${hit?.kind === 'target' || bodyHit ? ' · 표적 적중' : ''}`
        : last.outcome === 'ricochet' ? '도탄' : last.outcome === 'shattered' ? '탄자 소실' : '정지';
      const speedLabel = trace.reason === 'stopped' || trace.reason === 'shattered' ? '충돌' : last.outcome === 'ricochet' ? '도탄 후' : '관통 후';
      result.textContent = `${lane?.label || MATERIAL_NAMES[last.material]} · ${outcome}\n${spent ? `소진 판정 시점 ${Math.round(trace.residual.velocityMps)} m/s` : `${speedLabel} ${Math.round(trace.residual.velocityMps)} m/s · ${Math.round(0.5 * ballistics.projectileMassKg * trace.residual.velocityMps ** 2)} J`}`;
    }
    if (trace.armorResults.length) {
      const labels = { hard_block: '저지', soft_block: '저지', backer_block: '잔여탄 저지', penetrated: '관통', spent: '통과 후 소진', not_reached: '미도달', ricochet: '도탄' };
      result.textContent += `${result.textContent ? '\n' : ''}${trace.armorResults.map(c => `${describeArmorContact(c)} ${labels[c.outcome] || c.outcome}`).join(' → ')}`;
      const wear = trace.armorResults.find(c => c.wear)?.wear;
      if (wear) result.textContent += `\n방호구 내구도 ${wear.current.toFixed(1)} / ${wear.max}`;
      const deflected = trace.armorResults.find(c => c.outcome === 'ricochet');
      if (deflected) result.textContent += `\n${deflected.ricochet.label} · 입사각 ${deflected.ricochet.incidenceDeg.toFixed(0)}° · 도탄 직후 ${Math.round(deflected.after.velocityMps)} m/s\n내구도 −${(deflected.wear.previous - deflected.wear.current).toFixed(2)}`;
    }
    if (bodyHit) {
      const path = bodyHit.bodyPaths[0], passed = path?.outcome === 'body_through_and_through';
      const depthLabel = { surface_only: '표면 정지', shallow_entry: '얕은 체내 정지', deep_penetration: '체내 정지', near_exit_lodged: '출구 직전 정지', incomplete_body_path: '인체 내부 거리 한계' };
      result.textContent += `${result.textContent ? '\n' : ''}병사 표적 · ${bodyHit.address.label}\n${passed ? '인체 완전 관통' : depthLabel[path?.outcome] || '인체 정지'} · 경로 ${Math.round((path?.pathLengthM || 0) * 1000)} mm`;
      result.textContent += `\n인체 진입 ${Math.round(bodyHit.residual.velocityMps)} m/s · ${Math.round(bodyHit.energyJ)} J`;
      result.textContent += `\n출구 ${Math.round(bodyHit.bodyPaths.at(-1).velocityOutMps)} m/s · 체내 ${Math.round(bodyHit.bodyPaths.reduce((sum, p) => sum + p.energyDepositedJ, 0))} J`;
    } else if (trace.armorResults.length && hit?.kind !== 'armor') result.textContent += '\n인체 미적중';
    if(longShot)result.textContent+=`${result.textContent?'\n':''}${hit?.kind==='target'?'표적 적중':trace.reason==='range'?'거리 한계':'표적 미적중'} · ${trace.flight.distanceM.toFixed(1)} m · ${trace.flight.timeS.toFixed(3)} s\n초속 ${Math.round(ballistics.muzzleVelocityMps)} → ${Math.round(trace.residual.velocityMps)} m/s · ${Math.round(.5*ballistics.projectileMassKg*trace.residual.velocityMps**2)} J`;
    if(combat.active)combat.profile.measure('effectsSound',()=>effects.shot(event));else effects.shot(event);
    if (!inventory.weapon.chamber) toast('약실이 비었습니다. 탄창과 장전 상태를 확인하세요.');
  }
  function syncHumanPose() {
    if(physics.setHumanPose('rest',0,['H01'])){humans.syncPose();armor.syncPose();internals.syncPose();}
  }
  function tick(frame) {
    const gearBusy=inventory.action?.kind.startsWith('gear-')||inventory.action?.kind==='backpack-open';
    if(inventory.backpackOpen&&!bag.open&&!frame.move.x&&!frame.move.y)frame={...frame,firing:false,firePressed:false};
    if(gearBusy){if(frame.move.x||frame.move.y||frame.sprint||frame.firing||frame.firePressed)inventory.cancel();else frame={...frame,move:{x:0,y:0},firing:false,firePressed:false,ads:false,lean:0};}
    if(inventory.backpackOpen&&(frame.move.x||frame.move.y||frame.sprint))inventory.closeBackpack();
    equipmentWorld.sync();inventory.nearbyCrate=lootAvailable();
    if(care.active){
      if(frame.move.x||frame.move.y||frame.sprint)care.interrupt('이동·달리기 입력');
      else if(frame.firing||frame.firePressed||input.ads){care.interrupt('총 들기');frame={...frame,firing:false,firePressed:false};pendingFire=false;}
      if(care.active){care.step(STEP);input.ads=false;state.sprintShotPending=false;pendingFire=false;frame={...frame,move:{x:0,y:0},sprint:false,firing:false,firePressed:false,ads:false,lean:0};}
    }
    if(bag.open){pendingDX=pendingDY=pendingFire=0;frame={...frame,move:{x:0,y:0},dx:0,dy:0,crouch:physics.crouched,sprint:false,firing:false,firePressed:false,fireCancelled:true,opticZoom:0,lean:0};}

    previousFeet.copy(physics.feet); previousYaw = aim.viewYaw; previousPitch = aim.viewPitch; state.previousHeight = state.viewHeight;
    aim.look(pendingDX*(aim.opticLookScale??1), pendingDY*(aim.opticLookScale??1), input.ads); pendingDX = pendingDY = 0;
    state.tick++; state.time = state.tick * STEP;
    if(combat.active)combat.profile.measure('medical',()=>medical.tick(STEP,state.time));else medical.tick(STEP,state.time);
    medical.feedback.step(STEP,state.time,medical.actor.medical);
    const condition=playerFeedback();
    if(combat.playerDown){
      if(gearBusy)inventory.step(STEP);
      pendingDX=pendingDY=0;state.speed=0;state.sprinting=false;physics.sprinting=false;aim.ads=approach(aim.ads,0,12,STEP);
      physics.world.step();combat.tick(STEP,state.time);sound.setListener('P01',combat.playerFall.current.position,{player:true,feedback:combat.player.feedback.output});sound.tick(STEP);view.targetTick(STEP);equipmentWorld.sync();return;
    }
    if(inventory.action||frame.fireCancelled)state.sprintShotPending=false;
    if(frame.firePressed&&aim.sprintPose>=.02&&!inventory.action&&inventory.weapon?.chamber&&inventory.weapon.fireMode!=='safe')state.sprintShotPending=true;
    const sprint = condition.sprintAllowed&&!playerMedical().activity.sprintLocked&&canSprint({...frame,ads:input.ads,firing:frame.firing||state.sprintShotPending}, { busy:Boolean(weaponBusy()) });
    if(sprint){input.clearLean();clearLeanPose();}
    const leaning=!sprint&&(Boolean(frame.lean)||Math.abs(lean.value)>1e-6);
    state.speed = bag.open?(physics.world.step(),physics.sync(),physics.movementVelocity.set(0,0,0),physics.sprinting=false,0):(combat.active?combat.profile.measure('physics',()=>physics.step({...frame,ads:input.ads,sprint,speedMultiplier:(leaning?LEAN.speedMultiplier:1)*condition.moveRate,...(combat.active?{collisionFilter:combat.zone.playerCollisionFilter}:{})}, aim.viewYaw)):physics.step({...frame,ads:input.ads,sprint,speedMultiplier:(leaning?LEAN.speedMultiplier:1)*condition.moveRate,...(combat.active?{collisionFilter:combat.zone.playerCollisionFilter}:{})}, aim.viewYaw));
    state.sprinting = physics.sprinting && state.speed > .25;
    state.viewHeight = approach(state.viewHeight, physics.crouched ? PLAYER.crouchView : PLAYER.standView, 13*condition.stanceRate, STEP);
    state.cooldown = Math.max(-STEP, state.cooldown - STEP);
    if (inventory.step(STEP*(['reload','insert','remove','rack'].includes(inventory.action?.kind)?condition.reloadRate:inventory.action?.kind==='switch'?condition.handlingRate:1))) toast('동작 완료');
    if(inventory.action?.kind==='reload'&&sound.playerReloadAction!==inventory.action)sound.emitNoise('reload',aim.eye,{sourceId:'P01',team:'player',aiOnly:true});sound.playerReloadAction=inventory.action;
    aim.setWeapon(inventory.weapon?.definitionId||'m4a1');
    aim.setOptic(opticDefinition(inventory.optic));
    syncDebugAim();
    if(!inventory.action&&opticDefinition(inventory.optic)?.variableZoom)stepOpticMagnification(inventory.optic,frame.opticZoom,STEP);
    if (bag.container && !lootAvailable()) { bag.toggle(false); toast('탄약상자에서 멀어졌습니다.'); }
    const shoulder = physics.feet.clone().add(new T.Vector3(0, state.viewHeight - 0.05, 0));
    const blockDirection=direction(aim.viewYaw,aim.viewPitch);
    if(lean.value){const pose=leanPose(lean.value,state.viewHeight,aim.viewYaw);shoulder.copy(leanPoint(shoulder,physics.feet.clone().add(new T.Vector3(0,state.viewHeight,0)),pose));blockDirection.applyQuaternion(pose.rotation);}
    state.blocked = Boolean(physics.ray(shoulder,blockDirection,0.78));
    const bodyMotion=locomotion.step({dt:STEP,time:state.time,feet:physics.feet,velocity:physics.movementVelocity,yaw:aim.viewYaw,crouched:physics.crouched,sprinting:state.sprinting,ads:input.ads,grounded:physics.grounded,physics,deferContacts:true,gaitImpairment:condition.limp});
    aim.step(STEP, { feet: physics.feet, viewHeight: state.viewHeight, time: state.time, speed: state.speed,
      ads: input.ads && Boolean(inventory.weapon), reloading: weaponBusy(), nativeHandling: ['reload','insert','remove','switch'].includes(inventory.action?.kind), blocked: state.blocked, crouched: physics.crouched, sprint:state.sprinting, runPose:weapon.fps.runPose,locomotion:bodyMotion,swayMultiplier:leaning?LEAN.swayMultiplier:1,medicalFeedback:condition });
    if(!bag.open)lean.step(STEP,{requested:sprint?0:frame.lean,sprint,viewHeight:state.viewHeight,yaw:aim.viewYaw,physics,aim});
    aim.applyLean(lean.pose);
    if(leaning){
      const retracted=lean.restrictWeapon(physics,aim),shiftedShoulder=aim.eye.clone().add(new T.Vector3(0,-.07,0).applyQuaternion(lean.pose.rotation));
      state.blocked=retracted||physics.muzzleBlocked(shiftedShoulder,aim.muzzle,aim.barrelDirection);
    }
    locomotion.sampleContacts(aim.viewYaw);combat.player?.feedback.contacts(bodyMotion.contacts);
    const phaseIndex = Math.floor(aim.gaitPhase / Math.PI);
    for (const axis of stepImpact.axes) axis.previous = axis.x;
    if (settings.stepImpact > 0) {
      for (const contact of bodyMotion.contacts) {
        const sign = contact.side==='left'?-1:1;
        const scale = Math.min(1, state.speed / PLAYER.speed) * state.motion * settings.stepImpact / 100
          * (physics.crouched ? 0.6 : state.sprinting ? 1.5 : 1) * (1 - 0.7 * aim.ads);
        const peaks = [-0.008, -T.MathUtils.degToRad(0.4), sign * T.MathUtils.degToRad(0.3)];
        for (let i = 0; i < 3; i++) stepImpact.axes[i].v += peaks[i] * scale / stepPeakGain;
        stepImpact.contacts++; stepImpact.lastRollSign = sign;
      }
      // Exact fixed-step solution of x'' + 36x' + 900x = 0 (omega 30, zeta .6).
      const decay = Math.exp(-18 * STEP), cos = Math.cos(24 * STEP), sin = Math.sin(24 * STEP);
      for (const axis of stepImpact.axes) {
        const x = axis.x, v = axis.v;
        axis.x = decay * (x * cos + (v + 18 * x) / 24 * sin);
        axis.v = decay * (v * cos - (18 * v + 900 * x) / 24 * sin);
      }
    } else for (const axis of stepImpact.axes) axis.x = axis.v = axis.previous = 0;
    stepImpact.phaseIndex = phaseIndex;
    sound.medicalEffects=settings.medicalEffects;
    sound.setListener('P01',aim.eye,{player:true,feedback:condition});
    sound.playerEquipmentMassKg=inventory.carriedMassKg;
    sound.playerStep({feet:physics.feet,contacts:bodyMotion.contacts,speed:state.speed,grounded:physics.grounded,crouched:physics.crouched,sprinting:state.sprinting});
    const activity=playerMedical().activity;
    activity.setInput({equipmentMassKg:inventory.carriedMassKg,speedMps:state.speed,sprinting:state.sprinting,ads:input.ads&&!!inventory.weapon,crouched:physics.crouched,weaponId:inventory.weapon?.definitionId,weaponMassKg:inventory.weaponWeightKg,attachmentMassKg:inventory.attachmentWeightKg,yaw:aim.viewYaw,pitch:aim.viewPitch});
    if(activity.concussionSeverity&&state.tick%5===0)activity.setInput({focusDepthM:(combat.active?shooterPhysics(physics,'P01'):physics).contact(aim.eye,direction(aim.viewYaw,aim.viewPitch),200)?.distance??200});
    if(combat.active){weapon.capture(aim);render(0,1,true);combat.tick(STEP,state.time);}
    else {fieldMedical.tick(STEP,state.time);fieldMedical.feedback.step(STEP,state.time,fieldMedical.actor.medical,{crouched:physics.crouched,sprinting:state.sprinting});}
    equipmentWorld.sync();
    const trigger = state.sprintShotPending || (inventory.weapon?.fireMode === 'semi' ? frame.firePressed : frame.firing);
    if (trigger && !combat.playerDown && aim.sprintPose<.02 && !inventory.action && inventory.weapon?.fireMode!=='safe' && inventory.weapon?.chamber && state.cooldown <= 0) {state.sprintShotPending=false;fire();}
    if(!combat.active)weapon.capture(aim); view.targetTick(STEP);
    sound.tick(STEP);
    state.toastTime = Math.max(0, state.toastTime - STEP);
    if (!state.toastTime) $('toast').classList.remove('visible');
  }
  function updateHUD() {
    $('ammo').textContent = inventory.isDebugWeapon?'∞':String(inventory.loadedRounds).padStart(2, '0'); $('reserve').textContent = inventory.isDebugWeapon?'∞':inventory.reserveRounds;
    $('ammoType').textContent = inventory.weapon?.chamber ? ammoName(inventory.weapon.chamber) : '약실 비어 있음';
    $('chamberStatus').textContent = inventory.isDebugWeapon?'디버그 · 무한 탄창 · 현실값 아님':inventory.weapon ? `탄창 ${inventory.magazine?.rounds.length || 0} + 약실 ${inventory.weapon.chamber ? 1 : 0}` : '주무기 미장착';
    $('weaponName').textContent=inventory.isDebugWeapon?'DEBUG AK · 3':inventory.weapon?WEAPONS[inventory.weapon.definitionId].display.name:'UNARMED';
    $('opticControls').hidden=!opticDefinition(inventory.optic)?.variableZoom;
    $('opticMagnification').textContent=`${(inventory.optic?.magnification??1).toFixed(1)}×`;
    for(const id of ['zoomOutButton','zoomInButton'])$(id).disabled=Boolean(inventory.action)||state.phase!=='active';
    $('fireModeButton').textContent = inventory.weapon?.fireMode==='safe'?'SAFE':inventory.weapon?.fireMode === 'semi' ? 'SEMI' : 'AUTO';
    $('fireModeButton').disabled = !inventory.weapon || Boolean(inventory.action);
    $('reloadButton').querySelector('small').textContent = inventory.action ? '취소' : '장전';
    $('reloadButton').setAttribute('aria-label', inventory.action ? '진행 중인 동작 취소' : '재장전');
    debugUI.update({...inventory.debugState,enabled:state.phase==='active'&&!bag.open});
    $('shotCount').textContent = String(state.shots).padStart(2, '0'); $('hitCount').textContent = String(state.hits).padStart(2, '0');
    $('clock').textContent = `${String(Math.floor(state.time / 60)).padStart(2, '0')}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`;
    statusHUD.update(playerMedical().actor.medical,playerMedical().activity,{crouched:physics.crouched,sprinting:state.sprinting,speed:state.speed,lean:lean.value},state.time,combat.playerDown);
    $('combatStatus').hidden=!combat.active;$('combatStatus').textContent=combat.enemy&&combat.listEnemies().every(e=>e.collapsed)?'패널에서 정리할 수 있습니다.':combat.enemy?`SECTOR ${combat.sector} · 적 ${combat.listEnemies().filter(e=>!e.collapsed).length} / ${combat.listEnemies().length}명`:'패널에서 적을 투입하세요.';
    $('hitDirection').hidden=!combat.active||combat.hitLife<=0;$('hitDirection').style.transform=`translateX(-50%) rotate(${combat.hitAngle-aim.viewYaw}rad)`;
    $('adsButton').classList.toggle('active', input.ads); $('crouchButton').classList.toggle('active', physics.crouched);
    for(const [id,side]of [['leanLeftButton',-1],['leanRightButton',1]]){
      const active=input.leanIntent.requested===side;$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));$(id).disabled=state.sprinting;
    }
    const sprintRequested=input.sprintIntent.requested(input.keys);
    $('sprintButton').classList.toggle('armed',sprintRequested);$('sprintButton').classList.toggle('active',state.sprinting);
    $('sprintButton').setAttribute('aria-pressed',String(sprintRequested));
    $('sprintButton').querySelector('small').textContent=state.sprinting?'달리는 중':sprintRequested?'달리기 대기':'달리기';
    $('moveZone').classList.toggle('sprinting',state.sprinting);
    $('weaponStatus').textContent = inventory.action ? '작업 중' : !inventory.weapon ? 'UNARMED' : state.blocked ? 'MUZZLE BLOCKED' : !inventory.weapon.chamber ? 'EMPTY' : 'READY';
    $('reloadFill').style.width = inventory.action ? `${inventory.action.elapsed / inventory.action.duration * 100}%` : '0';
    const nearby = state.phase === 'active' && !bag.open ? nearbyInteraction() : null;
    $('lootButton').hidden = !nearby;
    if (nearby) {
      $('interactionLabel').textContent = nearby.label; $('interactionAction').textContent = nearby.action;
      $('lootButton').dataset.interaction = nearby.kind;
      $('lootButton').setAttribute('aria-label', `${nearby.label} ${nearby.action}`);
    }
    bag.update();
  }
  const renderedPosition = new T.Vector3();
  function render(dt, alpha,poseOnly=false) {
    const condition=playerFeedback();
    const height = T.MathUtils.lerp(state.previousHeight, state.viewHeight, alpha);
    renderedPosition.lerpVectors(previousFeet, physics.feet, alpha);
    // ADS sight movement comes from the simulated rifle/mount, not extra lens translation.
    const swayScale = state.motion * (1 - aim.ads) ** 2*(lean.value?LEAN.swayMultiplier:1);
    const synchronized = settings.stepImpact > 0;
    const impact = stepImpact.axes.map(axis => synchronized ? T.MathUtils.lerp(axis.previous, axis.x, alpha) : 0);
    const bodyMotion=locomotion.frame,offset=bodyMotion.position.clone().multiplyScalar(LOCOMOTION.headTranslationGain*bodyMotion.weight*swayScale).applyAxisAngle(new T.Vector3(0,1,0),aim.viewYaw);
    view.camera.position.copy(renderedPosition).add(offset).add(new T.Vector3(0,height+impact[0]+condition.cameraDropM,0));
    view.camera.rotation.set(T.MathUtils.lerp(previousPitch, aim.viewPitch, alpha) + aim.recoilState.visualPitch * state.motion + impact[1],
      T.MathUtils.lerp(previousYaw, aim.viewYaw, alpha),
      (bodyMotion.rotation.z*.25*bodyMotion.weight-physics.velocity.x*.003)*swayScale+impact[2], 'YXZ');
    if(lean.value||lean.previous){
      const pose=lean.renderPose(alpha,height,T.MathUtils.lerp(previousYaw,aim.viewYaw,alpha)),eye=renderedPosition.clone().add(new T.Vector3(0,height,0));
      view.camera.position.copy(leanPoint(view.camera.position,eye,pose));view.camera.quaternion.premultiply(pose.rotation);
    }
    if(combat.active&&combat.hitLife>0)view.camera.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(combat.shake(),combat.shake()*.3,0)));
    combat.applyPlayerView(view.camera,alpha);
    sound.updateListenerCamera(view.camera);
    sound.setPaused(!simulationLive()||debugUI.open);
    soundDebug.update();
    const focus=opticFocus(settings,aim.ads,view.camera.aspect,['m4a1','scar_h'].includes(inventory.weapon?.definitionId)?opticDefinition(inventory.optic):null,inventory.optic?.magnification);
    const lens=focus.lens;aim.opticLookScale=focus.lookScale;
    view.lens.setFeedback(condition.vision,settings.medicalEffects);
    view.lens.setParameters(lens);
    const fov=focus.verticalFov; if (lens ? view.camera.fov !== fov : Math.abs(view.camera.fov - fov) > 0.01) { view.camera.fov = fov; view.camera.updateProjectionMatrix(); }
    view.camera.updateMatrixWorld(true);
    view.setLongRange(physics.feet.x>31&&!combat.active);
    weapon.render(alpha, state.time - state.lastShotTime, inventory,{settings,aim,camera:view.camera,time:state.time,speed:state.speed,sprint:state.sprinting,physics,leaning:Boolean(lean.value||lean.previous||lean.requested),leanRotation:lean.renderPose(alpha,height,T.MathUtils.lerp(previousYaw,aim.viewYaw,alpha)).rotation});
    if(combat.playerDown||care.active)weapon.rig.visible=false;
    if(combat.active)combat.syncPlayer({camera:view.camera,aim,lean:lean.renderPose(alpha,height,T.MathUtils.lerp(previousYaw,aim.viewYaw,alpha)),crouched:physics.crouched,time:state.time,locomotion});
    if(poseOnly)return;
    weapon.optic.optics.update({eyeCamera:view.camera,inventory,ads:aim.ads,lens:view.lens.parameters});
    if(combat.active)combat.profile.measure('effectsSound',()=>effects.update(simulationLive()&&!debugUI.open?dt:0));else effects.update(state.phase==='active'&&!debugUI.open?dt:0);
    view.camera.updateMatrixWorld(true);
    if ($('guide').checked) {
      const world=aim.muzzle.clone().addScaledVector(aim.barrelDirection,15),scope=weapon.optic.optics.snapshot().pip;
      const projected=scope?weapon.optic.optics.projectWorldPoint(world):world;
      const point = projected?lensProject(projected.project(view.camera), view.lens.parameters):new T.Vector3(0,0,2);
      $('aimGuide').hidden = point.z < -1 || point.z > 1;
      $('aimGuide').style.left = `${(point.x * 0.5 + 0.5) * innerWidth}px`; $('aimGuide').style.top = `${(-point.y * 0.5 + 0.5) * innerHeight}px`;
    } else $('aimGuide').hidden = true;
    if (state.phase === 'active') state.hitLife = Math.max(0, state.hitLife - dt);
    $('hitFeedback').style.opacity = Math.min(1, state.hitLife * 4);
    if (state.hitPoint && state.hitLife > 0) { const scope=weapon.optic.optics.snapshot().pip,world=scope?weapon.optic.optics.projectWorldPoint(state.hitPoint):state.hitPoint.clone();if(world){const point=lensProject(world.project(view.camera),view.lens.parameters);$('hitFeedback').style.left=`${(point.x*.5+.5)*innerWidth}px`;$('hitFeedback').style.top=`${(-point.y*.5+.5)*innerHeight}px`;}else $('hitFeedback').style.opacity=0; }
    updateHUD();medicalUI.update();careUI.updateHUD();
    const bleedVisible=settings.internalRegions&&state.phase==='active'&&!bag.open&&!debugUI.open;$('bleedingDebug').hidden=!bleedVisible;
    if(bleedVisible){const bridge=selectedMedical(),stamp=selectedMedicalId+':'+Math.floor(bridge.time*4)+':'+bridge.events.length;if(stamp!==bleedDebugStamp){renderBleedingDebugB1(bridge.actor.medical,$('bleedingDebugContent'));$('bleedingDebugTarget').textContent=selectedMedicalId;bleedDebugStamp=stamp;}}
    if ($('medicalPanel').open) {
      syncMedicalTargets();const bridge=selectedMedical(),stamp = `${selectedMedicalId}:${Math.floor(bridge.time * 4)}:${bridge.events.length}`;
      if (stamp !== medicalPanelStamp) { renderMedicalPanel(bridge, $('medicalContent'),{showInternals:settings.internalRegions}); medicalPanelStamp = stamp; }
    }
    // The inventory covers the scene. Keep simulation, UI, effects and part poses live,
    // but avoid shading an obscured 3D frame on mobile while the player handles items.
    if (!bag.open) {
      const collect=combat.active,autoReset=view.renderer.info.autoReset;
      if(collect){view.renderer.info.autoReset=false;view.renderer.info.reset();}
      const draw=()=>{weapon.optic.optics.render(view.renderer,view.scene,weapon.rig,state.quality,state.phase==='active');view.render();};if(combat.active)combat.profile.measure('render',draw);else draw();state.worldFrames++;if(combat.active)combat.profile.finish();
      if(collect){combat.frameCost={calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles,enemyCount:combat.listEnemies().length,includesPiP:true,quality:state.quality};view.renderer.info.autoReset=autoReset;}
    }
  }
  function frame(now) {
    if (disposed) return;
    const elapsed = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : STEP; lastTime = now;
    if (simulationLive()&&!debugUI.open) {
      const controls = combat.playerDown?{move:{x:0,y:0},crouch:false,sprint:false,firing:false,firePressed:false}:input.frame(); pendingDX += controls.dx||0; pendingDY += controls.dy||0;
      if(controls.fireCancelled)pendingFire=false;
      pendingFire ||= controls.firePressed; accumulator += elapsed;
      let steps = 0;
      while (accumulator >= STEP && steps < 6) { tick({ ...controls, firing: controls.firing || pendingFire, firePressed: pendingFire }); pendingFire = false; accumulator -= STEP; steps++;if(!['active','falling'].includes(state.phase)){accumulator=0;break;} }
      if (accumulator >= STEP) accumulator = 0;
    }
    if (now - lastRender >= 1000 / state.fpsLimit - 1) {
      const renderDt = lastRender ? Math.min(0.1, (now - lastRender) / 1000) : STEP;
      render(renderDt, ['active','falling'].includes(state.phase)&&!debugUI.open ? accumulator / STEP : 1); lastRender = now;
    }
    animation = requestAnimationFrame(frame);
  }
  $('startButton').disabled = false; $('startButton').innerHTML = '훈련 시작하기 <span>→</span>';
  $('startButton').addEventListener('click', resume);
  $('medicalCloseButton').addEventListener('click', resume);
  $('resetButton').addEventListener('click', reset);
  $('longRangeButton').addEventListener('click',()=>moveRange(true));
  $('shortRangeButton').addEventListener('click',()=>moveRange(false));
  $('combatRangeButton').addEventListener('click',()=>moveCombat().catch(error=>toast(error.message)));
  $('killhouseRangeButton').addEventListener('click',()=>moveCombat('05').catch(error=>toast(error.message)));
  $('aiPanelClose').addEventListener('click',()=>{$('aiPanelScreen').hidden=true;resume();});
  $('aiDeployButton').addEventListener('click',async()=>{const selected=$('aiPlayerWeapon').value;if(selected!==inventory.primaryWeaponId){inventory.primaryWeaponId=selected;inventory.reset();}combat.deployment={count:Number($('aiCount').value),skill:$('aiSkill').value,placement:$('aiPlacement').value,behavior:$('aiBehavior').value,posture:$('aiPosture').value};if(await combat.deploy()){$('aiPanelScreen').hidden=true;syncMedicalTargets();resume();}});
  $('combatRestartButton').addEventListener('click',restartCombat);
  $('downMedicalButton').addEventListener('click',()=>openMedical('P01'));
  $('myMedicalButton').addEventListener('click',()=>openMedical('P01'));
  $('medicalTargetSelect').addEventListener('change',event=>{selectedMedicalId=event.target.value;medicalPanelStamp='';renderMedicalPanel(selectedMedical(),$('medicalContent'),{showInternals:settings.internalRegions});});
  $('creditsButton').addEventListener('click', () => { $('creditsScreen').hidden = false; });
  $('closeCredits').addEventListener('click', () => { $('creditsScreen').hidden = true; });
  $('fullscreenButton').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('이 브라우저는 전체화면을 지원하지 않습니다.'); } catch { toast('전체화면을 열 수 없습니다.'); } });
  $('motion').addEventListener('input', event => { state.motion = Number(event.target.value); });
  $('quality').addEventListener('change', event => { state.quality = event.target.value; view.resize(state.quality); });
  $('fpsLimit').addEventListener('change', event => { state.fpsLimit = Number(event.target.value); });
  $('sound').addEventListener('change', event => { settings.sound=event.target.checked;saveSettings(settings);syncPreferences(); });
  $('soundPaths').addEventListener('change',event=>{settings.soundPaths=event.target.checked;saveSettings(settings);syncPreferences();});
  const preferenceFields = {scarMaterialStrength: value=>value+"%", medicalEffects:value=>`${value}%`,bodycamMic:value=>`${value}%`, sensitivity: value => `${value}%`, adsSensitivity: value => `${value}%`,
    cameraFollow: value => value.toFixed(1), freeAim: value => `${value}°`, weaponResponse: value => String(value), fov: value => `${value}°`, lensStrength: value => `${value}%`, lensFov: value => `${value}°`, scopeFocus: value => `${value}%`, stepImpact: value => `${value}%`,
    weaponSize: value => `${value}%`, weaponHeight: value => `${value > 0 ? '+' : ''}${value} cm`, weaponMotion: value => `${value}%` };
  function syncPreferences() {
    $('medicalPanel').hidden=!settings.internalRegions;medicalUI.dirty=true;
    $('aiDisplay').checked=settings.aiDisplay;$('sound').checked=settings.sound;if(sound.enabled!==settings.sound)sound.setEnabled(settings.sound);sound.setMicrophone(settings.bodycamMic);$('soundPaths').checked=settings.soundPaths;soundDebug.setEnabled(settings.soundPaths);
    physics.bodyModel=settings.medicalModel==='legacy'?'legacy':'s2';
    medical.setMedicalModel(settings.medicalModel); $('medicalModel').value = settings.medicalModel;
    $('mouseAdsMode').value = settings.mouseAdsMode; input.setMouseAdsMode(settings.mouseAdsMode);
    $('leanMode').value=settings.leanMode;input.setLeanMode(settings.leanMode);
    $('fov').closest('.setting-row').hidden = settings.lensStrength > 0;
    $('lensFov').closest('.setting-row').hidden = settings.lensStrength === 0;
    $('trajectories').checked = settings.trajectories; effects.trajectories.setEnabled(settings.trajectories);
    $('hitRegions').checked = settings.hitRegions; humans.setRegionsVisible(settings.hitRegions);
    $('internalRegions').checked=settings.internalRegions;internals.setVisible(settings.internalRegions);
    $('skeletonRegions').checked = settings.skeletonRegions; humans.setSkeletonVisible(settings.skeletonRegions);
    syncHumanPose();
    plateDebugSelect.value=settings.enemyPlateType;plateDebugLabel.hidden=!settings.internalRegions;
    $('softArmorRegions').checked = settings.softArmorRegions; $('plateRegions').checked = settings.plateRegions;
    $('helmetRegions').checked = settings.helmetRegions;
    armor.setVisible(settings.softArmorRegions, settings.plateRegions, settings.helmetRegions);
    combat.debug();
    $('armorLegend').hidden = !settings.softArmorRegions && !settings.plateRegions && !settings.helmetRegions;
    for (const item of document.querySelectorAll('[data-armor-kind]')) {
      const kind = item.dataset.armorKind; item.style.setProperty('--region-color', ARMOR_COLORS[kind]);
      item.hidden = !settings[{ soft: 'softArmorRegions', plate: 'plateRegions', helmet: 'helmetRegions' }[kind]];
    }
    $('trajectoryLegend').hidden = !settings.trajectories;
    for (const item of document.querySelectorAll('[data-trajectory-state]')) item.style.setProperty('--trajectory-color', TRAJECTORY_COLORS[item.dataset.trajectoryState]);
    for (const [id, format] of Object.entries(preferenceFields)) { $(id).value = settings[id]; $(id + 'Value').textContent = format(settings[id]); }
    for (const button of document.querySelectorAll('[data-aim-preset]')) {
      const selected = Object.entries(AIM_PRESETS[button.dataset.aimPreset]).every(([key, value]) => settings[key] === value);
      button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
    }
  }
  $('aiDisplay').addEventListener('change',event=>{settings.aiDisplay=event.target.checked;saveSettings(settings);syncPreferences();});
  $('trajectories').addEventListener('change', event => { settings.trajectories = event.target.checked; saveSettings(settings); syncPreferences(); });
  $('medicalModel').addEventListener('change', event => { settings.medicalModel = event.target.value; saveSettings(settings); syncPreferences(); medicalPanelStamp = ''; renderMedicalPanel(medical, $('medicalContent')); });
  $('mouseAdsMode').addEventListener('change', event => { settings.mouseAdsMode = event.target.value; saveSettings(settings); syncPreferences(); });
  $('leanMode').addEventListener('change',event=>{settings.leanMode=event.target.value;input.clearLean();clearLeanPose();saveSettings(settings);syncPreferences();});
  $('internalRegions').addEventListener('change',event=>{settings.internalRegions=event.target.checked;saveSettings(settings);syncPreferences();});
  $('skeletonRegions').addEventListener('change',event=>{settings.skeletonRegions=event.target.checked;saveSettings(settings);syncPreferences();});
  $('hitRegions').addEventListener('change', event => { settings.hitRegions = event.target.checked; saveSettings(settings); syncPreferences(); });
  for (const id of ['softArmorRegions', 'plateRegions', 'helmetRegions']) $(id).addEventListener('change', event => { settings[id] = event.target.checked; saveSettings(settings); syncPreferences(); });
  for (const id of Object.keys(preferenceFields)) $(id).addEventListener('input', event => {
    settings[id] = Number(event.target.value); saveSettings(settings); syncPreferences();
  });
  document.querySelectorAll('[data-aim-preset]').forEach(button => button.addEventListener('click', () => {
    Object.assign(settings, AIM_PRESETS[button.dataset.aimPreset]); saveSettings(settings); syncPreferences(); button.blur();
  }));
  $('resetPreferences').addEventListener('click', () => { Object.assign(settings, AIM_DEFAULTS); saveSettings(settings); syncPreferences(); });
  syncPreferences();
  function resize() { view.resize(state.quality); if (innerHeight > innerWidth) pause('가로화면으로 돌아온 뒤 훈련을 계속하세요.'); }
  window.addEventListener('resize', resize);
  window.addEventListener('blur', () => pause('훈련이 일시정지됐습니다.'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause('앱으로 돌아온 뒤 훈련을 계속하세요.'); });
  window.addEventListener('pagehide', event => { pause(); if (!event.persisted) { disposed = true; cancelAnimationFrame(animation); combat.leave();physics.dispose(); humans.dispose(); armor.dispose(); internals.dispose(); weapon.optic.optics.dispose();view.lens.dispose(); view.renderer.dispose(); effects.trajectories.dispose(); effects.audio?.close(); } });
  reset(); $('toast').classList.remove('visible'); state.toastTime = 0;
  render(STEP, 1); animation = requestAnimationFrame(frame);
  // Read-only observations for regression checks and development diagnostics.
  window.CQBTraining = Object.freeze({ snapshot: () => ({ phase: state.phase, tick: state.tick, time: state.time, ammo: inventory.loadedRounds, reserve: inventory.reserveRounds, shots: state.shots, hits: state.hits,
    corpse:corpses.snapshot(),plateWindows:bag.plates.snapshot(),equipmentWorld:equipmentWorld.snapshot(),inventory: inventory.snapshot(),inventoryWindows:bag.windows.snapshot(),selfCare:care.snapshot(), debugWeapon:{...inventory.debugState,infiniteMagazine:true,panel:debugUI.snapshot()}, inventoryOpen: bag.open, loot: { available: lootAvailable(), open: Boolean(bag.container), id: LOOT_CRATE.id }, interaction: nearbyInteraction(), medicalAvailable: medicalAvailable(), medicalUI:medicalUI.snapshot(), catalog: catalogCounts(), recoil: aim.recoilState.snapshot(),
    feet: physics.feet.toArray(), crouched: physics.crouched, grounded: physics.grounded, ads: aim.ads, reloading: Boolean(weaponBusy()), blocked: state.blocked,
    medicalFeedback:combat.active?playerMedical().feedback.snapshot():playerFeedback(),activity:playerMedical().activity.snapshot(),
    movement:{speedMps:state.speed,sprinting:state.sprinting,sprintRequested:input.sprintIntent.requested(input.keys),sprintAutomatic:input.sprintIntent.automatic,sprintToggled:input.sprintIntent.toggled,sprintPose:aim.sprintPose},
    lean:{...lean.snapshot(),playerHitVolumes:combat.active&&!!combat.player},
    camera: { position: view.camera.position.toArray(), quaternion: view.camera.quaternion.toArray(), fov: view.camera.fov, yaw: aim.viewYaw, pitch: aim.viewPitch },
    settings: { ...settings },
    range: { sector: combat.active?combat.sector:physics.feet.x>31?'03':physics.feet.x > 9 ? '02' : '01', lanes: RANGE_LANES, long:LONG_RANGE },
    humans: { ...humans.snapshot(), ...humanHits.snapshot() }, armorCondition: physics.armorCondition.snapshot(),
    medical: medical.snapshot(),combat:combat.snapshot(),sound:sound.snapshot(),
    armor: armor.snapshot(),
    weapon: { zeroing:aim.zeroingOverride??zeroingPreset(aim.weaponId,aim.opticDef), shotDirection:aim.shotPose().direction.toArray(), logicalMuzzle: aim.muzzle.toArray(), logicalDirection: aim.barrelDirection.toArray(), rearSight: aim.sight.toArray(), frontSight: aim.frontSight.toArray(), eye: aim.eye.toArray(),
      rendered: weapon.snapshot(), locomotion:locomotion.snapshot(), scale: aim.scale, walking: aim.walking, gaitPhase: aim.gaitPhase, sightLagYaw: aim.sightLagYaw, sightLagPitch: aim.sightLagPitch,
      intentYaw: aim.intentYaw, intentPitch: aim.intentPitch, yaw: aim.weaponYaw, pitch: aim.weaponPitch, freeYaw: aim.freeYaw, freePitch: aim.freePitch },
    input: { pointers: input.owners.size,zoomPointers:input.zoomPointers.size,leanPointers:input.leanPointers.size,leanRequested:input.leanIntent.requested, firing: input.firing, ads: input.ads, move: { ...input.move }, keys: [...input.keys] },
    lastShot: state.lastShot ? structuredClone(state.lastShot) : null, effects: { casings: effects.pool.filter(item => item.active).length, impacts: effects.marks.length, particles: effects.particles.length, trajectories: effects.trajectories.snapshot() },
    renderer: { width: view.renderer.domElement.width, height: view.renderer.domElement.height, calls: view.renderer.info.render.calls, triangles: view.renderer.info.render.triangles, worldFrames: state.worldFrames, lens: view.lens.snapshot() } }),
    project: position => { const p = lensProject(new T.Vector3(...position).project(view.camera), view.lens.parameters); return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, depth: p.z }; } });
}
start().catch(error => {
  console.error(error); $('startButton').disabled = true; $('startButton').textContent = '훈련장을 준비하지 못했습니다';
  $('errorText').hidden = false; $('errorText').textContent = 'WebGL2와 WebAssembly를 지원하는 브라우저에서 다시 열어주세요. ' + error.message;
});
