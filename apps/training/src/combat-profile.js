// Small bounded tape. No full scene snapshots or stringify on the frame path.
export class CombatProfile{
 constructor(){this.reset();}
 reset(){this.rows=[];this.current={};this.frame=0;}
 measure(name,fn){const t=performance.now();try{return fn();}finally{this.current[name]=(this.current[name]||0)+performance.now()-t;}}
 finish(){this.rows.push({frame:this.frame++,...this.current});if(this.rows.length>1800)this.rows.shift();this.current={};}
 summary(){const names=['ai','sight','traceShot','medical','physics','muscles','skinning','render','effectsSound','fall','deploy'];return Object.fromEntries(names.map(n=>{const a=this.rows.map(r=>r[n]||0).sort((a,b)=>a-b);return[n,{medianMs:a[Math.floor(a.length/2)]||0,maxMs:a.at(-1)||0}];}));}
}
