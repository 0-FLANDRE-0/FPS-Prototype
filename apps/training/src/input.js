import { SprintIntent } from './sprint.js';
import {LeanIntent} from './lean.js';
import{PointerLockReturn}from'./pointer-lock-return.js';

export class TrainingInput {
  constructor({ onCommand, onUnlock }) {
    this.onCommand = onCommand; this.onUnlock = onUnlock;
    this.owners = new Map(); this.keys = new Set();
    this.zoomPointers = new Map();
    this.leanPointers=new Map();this.leanIntent=new LeanIntent();
    this.sprintIntent = new SprintIntent();
    this.mouseAdsMode = 'toggle'; this.mouseAdsHeld = false;
    this.move = { x: 0, y: 0 }; this.look = { x: 0, y: 0 };
    this.firing = false; this.firePressed = false; this.fireCancelled = false; this.ads = false; this.crouch = false; this.enabled = false;
    this.knob = document.getElementById('stickKnob');
    const moveZone = document.getElementById('moveZone');
    const lookZone = document.getElementById('lookZone');
    this.pointerReturn=new PointerLockReturn({element:lookZone});
    const fire = document.getElementById('fireButton');
    const begin = (event, kind, pointerType = event.pointerType, pointerId = event.pointerId) => {
      if (!this.enabled || event.button !== 0) return;
      if(kind==='fire'&&pointerType==='mouse'&&this.pointerReturn.consumeRetry(event))return;
      if (kind === 'move' && [...this.owners.values()].some(owner => owner.kind === 'move')) return;
      event.preventDefault(); this.onUnlock();
      const owner = { kind, pointerType, x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY, element: event.currentTarget };
      this.owners.set(pointerId, owner);
      // Pointer Lock owns desktop mouse movement; capture remains for touch pointers.
      if (pointerType !== 'mouse') event.currentTarget.setPointerCapture(pointerId);
      if (kind === 'fire') { this.firing = true; this.firePressed = true; fire.classList.add('held'); }
    };
    moveZone.addEventListener('pointerdown', event => begin(event, 'move'));
    lookZone.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') {
        this.mousePointerId = event.pointerId;
      } else begin(event, 'look');
    });
    // Mouse events report each button even when left and right are held together.
    lookZone.addEventListener('mousedown', event => {
      if (!this.enabled) return;
      if (event.button === 0) {
        if(this.pointerReturn.consumeRetry(event))return;
        begin(event, 'fire', 'mouse', this.mousePointerId ?? 1);
        if (!document.pointerLockElement) lookZone.requestPointerLock?.()?.catch(() => {});
        return;
      }
      if (event.button !== 2) return;
      event.preventDefault(); this.onUnlock();
      if (this.mouseAdsMode === 'hold') { this.mouseAdsHeld = true; this.ads = true; }
      else this.onCommand('ads');
    });
    fire.addEventListener('pointerdown', event => begin(event, 'fire'));
    for(const [id,axis]of [['zoomOutButton',-1],['zoomInButton',1]]){
      const button=document.getElementById(id);if(!button)continue;
      button.addEventListener('pointerdown',event=>{if(!this.enabled||button.disabled||event.button!==0)return;event.preventDefault();this.onUnlock();this.zoomPointers.set(event.pointerId,{axis,element:button});button.setPointerCapture(event.pointerId);});
      const release=event=>this.zoomPointers.delete(event.pointerId);
      for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
      button.addEventListener('contextmenu',event=>event.preventDefault());
    }
    for(const [id,side]of [['leanLeftButton',-1],['leanRightButton',1]]){
      const button=document.getElementById(id);if(!button)continue;
      button.addEventListener('pointerdown',event=>{
        if(!this.enabled||button.disabled||event.button!==0)return;
        event.preventDefault();event.stopPropagation();this.onUnlock();
        this.leanPointers.set(event.pointerId,{element:button,side});this.leanIntent.press('pointer:'+event.pointerId,side);button.setPointerCapture(event.pointerId);
      });
      const release=event=>{this.leanPointers.delete(event.pointerId);this.leanIntent.release('pointer:'+event.pointerId);};
      for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
      button.addEventListener('contextmenu',event=>event.preventDefault());
    }
    const move = event => {
      const owner = this.owners.get(event.pointerId); if (!owner) return;
      event.preventDefault();
      if (event.pointerType === 'mouse' && document.pointerLockElement) return;
      const dx = event.clientX - owner.x, dy = event.clientY - owner.y;
      if (owner.kind === 'move') {
        let x = (event.clientX - owner.originX) / 44, y = (event.clientY - owner.originY) / 44;
        const distance = Math.hypot(x, y); if (distance > 1) { x /= distance; y /= distance; }
        this.move.x = Math.abs(x) < 0.07 ? 0 : x; this.move.y = Math.abs(y) < 0.07 ? 0 : y;
        this.sprintIntent.updateStick(this.move.y);
        this.knob.style.transform = `translate(${x * 32}px,${y * 32}px)`;
      } else { this.look.x += dx; this.look.y += dy; }
      owner.x = event.clientX; owner.y = event.clientY;
    };
    const end = event => {
      if (event.pointerType === 'mouse' && event.type !== 'pointerup') this.releaseMouseADS();
      const owner = this.owners.get(event.pointerId); if (!owner) return;
      // Left and right mouse buttons share one pointer ID. Releasing ADS must
      // not release an independently held left-button shot.
      if (event.pointerType === 'mouse' && event.type === 'pointerup' && event.button !== 0) return;
      this.owners.delete(event.pointerId);
      if (owner.kind === 'move') { this.move.x = this.move.y = 0; this.sprintIntent.updateStick(0); this.knob.style.transform = ''; }
      this.firing = [...this.owners.values()].some(item => item.kind === 'fire');
      if (event.type !== 'pointerup' && owner.kind === 'fire') {this.firePressed = false;this.fireCancelled=true;}
      fire.classList.toggle('held', this.firing);
    };
    for (const element of [moveZone, lookZone, fire]) {
      element.addEventListener('pointermove', move);
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(type, end);
      element.addEventListener('contextmenu', event => event.preventDefault());
    }
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    document.addEventListener('mouseup', event => {
      if (event.button === 2) this.releaseMouseADS();
      if (event.button === 0) for (const [pointerId, owner] of this.owners) {
        if (owner.pointerType === 'mouse') end({ pointerId, pointerType: 'mouse', type: 'pointerup', button: 0 });
      }
    });
    window.addEventListener('keydown', event => {
      if (!this.enabled) {if(event.code==='Escape'&&!event.repeat)this.onCommand('pause');return;}
      if (['Tab', 'KeyI'].includes(event.code)) {
        event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) this.onCommand('inventory'); return;
      }
      if (event.target.matches('input,select,textarea') || event.target.isContentEditable) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (!event.repeat) {
        if (event.code === 'KeyR') this.onCommand('reload');
        if (event.code === 'KeyC') this.onCommand('crouch');
        if (event.code === 'KeyQ') this.leanIntent.press(event.code,-1);
        if (event.code === 'KeyE') this.leanIntent.press(event.code,1);
        if (event.code === 'KeyF') this.onCommand('interact');
        if (event.code === 'KeyB') this.onCommand('fireMode');
        if (event.code === 'Digit1') this.onCommand('weapon1');
        if (event.code === 'Digit2') this.onCommand('weapon2');
        if (event.code === 'Digit3') this.onCommand('debugWeapon');
        if (event.code === 'Escape') this.onCommand('pause');
        if (event.code === 'KeyP') document.getElementById('lookZone').requestPointerLock?.();
      }
    });
    window.addEventListener('keyup', event => { this.keys.delete(event.code);this.leanIntent.release(event.code); });
    window.addEventListener('blur',()=>this.clear());
    lookZone.addEventListener('wheel',event=>{if(!this.enabled)return;event.preventDefault();this.onCommand('switchWeapon');},{passive:false});
    document.addEventListener('mousemove', event => { if (this.enabled && document.pointerLockElement) { this.look.x += event.movementX; this.look.y += event.movementY; } });
    let pointerLocked = false;
    document.addEventListener('pointerlockchange', () => {
      const locked = Boolean(document.pointerLockElement);
      if (pointerLocked && !locked) { this.clear(); if (!this.uiUnlock) this.onCommand('pause'); this.uiUnlock = false; }
      pointerLocked = locked;
    });
    document.querySelectorAll('[data-command]').forEach(button => {
      let touchPressed = false;
      const run = () => { if (!this.enabled&&button.dataset.command!=='pause') return; this.onUnlock(); this.onCommand(button.dataset.command); button.blur(); };
      // Secondary fingers do not reliably produce a compatibility click.
      // Execute touch/pen actions on press without touching other owners.
      button.addEventListener('pointerdown', event => {
        touchPressed = event.pointerType !== 'mouse';
        if (event.pointerType === 'mouse' || event.button !== 0 || (!this.enabled&&button.dataset.command!=='pause')) return;
        event.preventDefault(); event.stopPropagation(); run();
      });
      button.addEventListener('click', event => {
        if ((touchPressed && event.detail > 0) || (event.pointerType && event.pointerType !== 'mouse') || event.sourceCapabilities?.firesTouchEvents) return;
        run();
      });
    });
  }
  releaseMouseADS() {
    if (this.mouseAdsHeld) { this.mouseAdsHeld = false; this.ads = false; }
  }
  setMouseAdsMode(mode) {
    if (this.mouseAdsMode === mode) return;
    this.releaseMouseADS(); this.mouseAdsMode = mode === 'hold' ? 'hold' : 'toggle';
  }
  setLeanMode(mode){this.leanIntent.setMode(mode);}
  clearLean(){
    this.leanIntent.clear();const pointers=[...this.leanPointers.entries()];this.leanPointers.clear();
    for(const [id,p]of pointers)if(p.element.hasPointerCapture(id))p.element.releasePointerCapture(id);
  }
  frame() {
    let x = this.move.x, y = this.move.y;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    const opticZoom=Math.max(-1,Math.min(1,Number(this.keys.has('KeyX'))-Number(this.keys.has('KeyZ'))+[...this.zoomPointers.values()].reduce((sum,p)=>sum+p.axis,0)));
    const state = { move: { x, y }, dx: this.look.x, dy: this.look.y, firing: this.firing, firePressed: this.firePressed, fireCancelled:this.fireCancelled, ads: this.ads, crouch: this.crouch, sprint: this.sprintIntent.requested(this.keys),opticZoom,lean:this.leanIntent.requested };
    this.look.x = this.look.y = 0; this.firePressed = this.fireCancelled = false; return state;
  }
  unlockForUI() {
    if (document.pointerLockElement) { this.uiUnlock = true; document.exitPointerLock(); }
  }
  clear() {
    this.releaseMouseADS();
    this.clearLean();
    this.sprintIntent.clear();
    const owners = [...this.owners.entries()]; this.owners.clear();
    const zoom=[...this.zoomPointers.entries()];this.zoomPointers.clear();for(const [id,p]of zoom)if(p.element.hasPointerCapture(id))p.element.releasePointerCapture(id);
    for (const [id, owner] of owners) if (owner.element.hasPointerCapture(id)) owner.element.releasePointerCapture(id);
    this.keys.clear(); this.move.x = this.move.y = this.look.x = this.look.y = 0; this.firing = this.firePressed = this.fireCancelled = false;
    this.knob.style.transform = ''; document.getElementById('fireButton').classList.remove('held');
  }
}
