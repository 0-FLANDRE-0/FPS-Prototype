// A separate extraction keeps the established barrier/protection declaration sets unchanged.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
const path='src/data/ammunition-legacy.js',names=['getCaliberEnergyClass','getVelocityDragClass','getDistanceVelocityRetention'];
export async function extractFlight(){
 const source=await readFile('reference/2d/'+path,'utf8'),declarations=names.map(name=>{
  const matches=[...source.matchAll(new RegExp(`^function ${name}\\b`,'gm'))];if(matches.length!==1)throw Error('Review flight extraction: '+name);
  const start=matches[0].index,rest=source.slice(start+matches[0][0].length),next=/^(?:const|let|var|function|for)\s/m.exec(rest);
  const text=source.slice(start,next?start+matches[0][0].length+next.index:source.length).trim();new Script(text);return 'export '+text;
 });
 const sources=[{path,sha256:createHash('sha256').update(source).digest('hex'),declarations:names,table:'CATALOG.DRAG_RETENTION_PER_100M'}];
 return {sources,source:'// Generated from unchanged CQB declarations by scripts/training-flight.mjs.\nimport {CATALOG} from "../catalog.js";\nconst DRAG_RETENTION_PER_100M=CATALOG.DRAG_RETENTION_PER_100M;\n'+declarations.join('\n')+'\n'};
}
export async function generateFlight(){if(!process.argv.includes("--allow-reference-import"))throw Error("Reference import is opt-in; normal3Dbuild uses independently owned modules.");const r=await extractFlight();const p='apps/training/src/generated/legacy-flight.js';if(await readFile(p,'utf8').catch(()=> '')!==r.source)await writeFile(p,r.source);return r;}
if(process.argv[1]?.endsWith('/training-flight.mjs'))await generateFlight();
