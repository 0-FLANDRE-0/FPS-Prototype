// Called synchronously inside the close click/key handler to retain activation.
export class PointerLockReturn{
 constructor({element,document:doc=document}){this.element=element;this.doc=doc;this.retry=false;this.lastPointerType='mouse';doc.addEventListener('pointerdown',e=>{this.lastPointerType=e.pointerType||'mouse';},true);doc.addEventListener('pointerlockerror',()=>{if(!doc.pointerLockElement)this.retry=true;});doc.addEventListener('pointerlockchange',()=>{if(doc.pointerLockElement)this.retry=false;});}
 request(event){if(event?.code==='Escape'||this.lastPointerType!=='mouse'||!this.element.requestPointerLock)return false;this.retry=true;try{const p=this.element.requestPointerLock();p?.catch(()=>{if(!this.doc.pointerLockElement)this.retry=true;});}catch{this.retry=true;}return true;}
 consumeRetry(event){if(!this.retry||this.doc.pointerLockElement||event.button!==0)return false;event.preventDefault();this.request(event);return true;}
}
