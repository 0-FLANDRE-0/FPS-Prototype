import{test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
import sharp from'sharp';import{compressGLB,assertTextureOnly,imageMetrics}from'../scripts/training-webp.mjs';import{readGLB}from'../scripts/training-soldier-skin.mjs';
test('actual M4 WebP derivative is deterministic, preserves geometry and material links, and meets base-color/normal policies',async()=>{
 const source=await readFile(new URL('../apps/training/assets/m4a1-training.glb',import.meta.url));
 const a=await compressGLB(source,{name:'m4'}),b=await compressGLB(source,{name:'m4'});assert.deepEqual(a.glb,b.glb);assertTextureOnly(source,a.glb);
 const parsed=readGLB(a.glb);assert.ok(parsed.g.extensionsRequired.includes('EXT_texture_webp'));
 for(const row of a.meta.rows){assert.equal(row.alphaMaxError,0);if(row.uses.some(u=>u.role==='baseColor'))assert.ok(row.ssim>=.97);if(row.uses.some(u=>u.role==='normal')){assert.equal(row.lossless,true);assert.equal(row.ssim,1);assert.ok(row.trials.some(t=>t.quality===95&&!t.lossless));}}
 for(const texture of parsed.g.textures){assert.equal('source'in texture,false);assert.equal(parsed.g.images[texture.extensions.EXT_texture_webp.source].mimeType,'image/webp');}
});
test('RGBA image conversion retains non-opaque alpha and SSIM distinguishes a damaged image',async()=>{
 const width=16,height=16,raw=Buffer.alloc(width*height*4);for(let i=0;i<raw.length;i+=4){raw[i]=110;raw[i+1]=145;raw[i+2]=192;raw[i+3]=(i/4)%256;}
 const png=await sharp(raw,{raw:{width,height,channels:4}}).png().toBuffer(),webp=await sharp(png).webp({quality:85,alphaQuality:100,effort:6}).toBuffer(),decoded=await sharp(webp).ensureAlpha().raw().toBuffer();
 assert.equal(imageMetrics(raw,decoded,width,height).alphaMaxError,0);assert.equal(imageMetrics(raw,raw,width,height).ssim,1);
 const bad=Buffer.from(raw);for(let i=0;i<bad.length;i+=4)bad[i]=0;assert.ok(imageMetrics(raw,bad,width,height).ssim<.8);
});
