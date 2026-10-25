// QA-only instrumentation. The production HTML is never edited.
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
export async function migrationSession({viewport={width:1280,height:720},hasTouch=false,medicalOverhaul=false}={}) {
  const html=await readFile(resolve(root,'dist/CQB_Training.html'),'utf8');
  const bundle=await build({absWorkingDir:root,entryPoints:['apps/training/src/main.js'],bundle:true,format:'iife',target:['es2020'],minify:true,write:false,legalComments:'inline',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'migration-qa',setup(b){b.onLoad({filter:/\/main\.js$/},async({path})=>({loader:'js',contents:(medicalOverhaul?"import {internalWorldShapes as __internalShapes} from './internal-anatomy.js';\nimport {TrainingMedical as __ProbeMedical} from './medical.js';\n":'')+(await readFile(path,'utf8')).replace('  window.CQBTraining =',medicalOverhaul?'  window.__CQBTest={reset,settings,syncPreferences,state,bag,inventory,aim,tick,render,view,fieldMedical,care,careUI,medicalUI,command,physics,T,combat,moveCombat,traceShot,shotBallistics,internalWorldShapes:__internalShapes,ProbeMedical:__ProbeMedical};\n  window.CQBTraining =':'  window.__CQBTest={reset,settings,syncPreferences,state,bag,inventory,aim,tick,render,view,fieldMedical};\n  window.CQBTraining =')}));}}]});
  const start=html.lastIndexOf('<script>'),end=html.indexOf('</script>',start);
  assert.ok(start>0&&end>start);
  const qa=html.slice(0,start+8)+bundle.outputFiles[0].text+html.slice(end);
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try {
    const context=await browser.newContext({viewport,hasTouch});await context.setOffline(true);
    const page=await context.newPage(),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>{const u=r.request().url();if(u==='http://cqb.test/migration')return r.fulfill({body:qa,contentType:'text/html'});if(u.startsWith('blob:')||u.startsWith('data:'))return r.continue();external.push(u);return r.abort();});
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;});
    await page.goto('http://cqb.test/migration');await page.waitForFunction(()=>window.__CQBTest,null,{timeout:120000,polling:100});
    return {page,async close(){await browser.close();assert.deepEqual(errors,[]);assert.deepEqual(external,[]);}};
  } catch(e) {await browser.close();throw e;}
}
