// Touch/pen controls must not depend on a browser compatibility click after an
// item drag. Grid/equipment gestures remain owned by InventoryUI, unchanged.
export function installTouchControls(root){
 const presses=new Map(),held=new Set(),compatibility=new WeakMap(),selector='button,summary,[role="button"]';let recent=null;
 const target=e=>{const b=e.target.closest?.(selector);return b&&root.contains(b)&&!b.disabled&&!b.closest('[data-item],[data-cell],[data-equipment]')?b:null;};
 root.addEventListener('pointerdown',e=>{if(e.button!==0)return;const button=target(e);if(button){held.add(e.pointerId);if(e.pointerType!=='mouse'){e.preventDefault();presses.set(e.pointerId,{button,x:e.clientX,y:e.clientY});}}},true);
 root.addEventListener('pointercancel',e=>{presses.delete(e.pointerId);held.delete(e.pointerId);},true);
 root.addEventListener('pointerup',e=>{held.delete(e.pointerId);const p=presses.get(e.pointerId);presses.delete(e.pointerId);if(!p||target(e)!==p.button||Math.hypot(e.clientX-p.x,e.clientY-p.y)>=7)return;e.preventDefault();const until=performance.now()+700;compatibility.set(p.button,until);recent={until,x:e.clientX,y:e.clientY};if(typeof p.button.click==='function')p.button.click();else p.button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));},true);
 // A care action replaces its button (cancel -> resume) during pointerup.
 // Its trailing compatibility click can hit the NEW node at the same point.
 root.addEventListener('click',e=>{const b=target(e),touch=e.pointerType&&e.pointerType!=='mouse'||e.sourceCapabilities?.firesTouchEvents,duplicate=(compatibility.get(b)||0)>performance.now()||recent&&recent.until>performance.now()&&Math.hypot(e.clientX-recent.x,e.clientY-recent.y)<8;if(b&&e.detail>0&&touch&&duplicate){e.preventDefault();e.stopImmediatePropagation();}},true);
 const clear=()=>{presses.clear();held.clear();};for(const type of['pointerup','pointercancel'])window.addEventListener(type,e=>{presses.delete(e.pointerId);held.delete(e.pointerId);});window.addEventListener('blur',clear);
 return{clear,get holding(){return held.size>0;}};
}
