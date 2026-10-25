// Geometry adapter only. A fitted arm/torso union must not swallow a hard side
// plate lying between its entry and exit. Remove that solid's occupied interval
// from the body proxy; unchanged tissue/armor solvers then run in material order.
export function partitionBodyAtSidePlates(paths,contacts){
 return paths.flatMap(path=>{const cuts=contacts.filter(c=>c.targetId===path.actor.id&&c.entryDistance<path.exit-1e-8&&c.exitDistance>path.entry+1e-8).flatMap(c=>(c.materialIntervals||[c]).filter(i=>i.entryDistance<path.exit-1e-8&&i.exitDistance>path.entry+1e-8).map(i=>[Math.max(path.entry,i.entryDistance),Math.min(path.exit,i.exitDistance)])).sort((a,b)=>a[0]-b[0]);if(!cuts.length)return[path];
  const intervals=[];let cursor=path.entry;for(const[a,b]of cuts){if(a>cursor+1e-8)intervals.push([cursor,a,true]);cursor=Math.max(cursor,b);}if(path.exit>cursor+1e-8)intervals.push([cursor,path.exit,path.completeExit]);
  return intervals.flatMap(([entry,exit,completeExit])=>{const cells=path.cells.flatMap(c=>{const a=Math.max(entry,c.entry),b=Math.min(exit,c.exit);return b>a+1e-8?[{...c,entry:a,exit:b}]:[];});if(!cells.length)return[];return[{...path,entry,exit,completeExit,cells,source:cells[0],address:cells[0].address,point:path.point.clone().addScaledVector(path.direction,entry-path.entry),sidePlateBoundary:true}];});
 }).sort((a,b)=>a.entry-b.entry);
}
