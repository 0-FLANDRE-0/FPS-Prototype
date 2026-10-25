// Deterministic image-only derivatives. Source GLBs and v9/v13 outputs are immutable.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { readGLB } from './training-soldier-skin.mjs';
const hash = b => createHash('sha256').update(b).digest('hex');
export const WEBP_POLICY = Object.freeze({ baseQuality: 85, normalQuality: 95, alphaQuality: 100, baseSSIMMinimum: .97, m4ORMIndices: [1,4], m4ORMQualityOverrides: {}, m4ORMRenderSSIMMinimum: .97, effort: 6,
  jpegMinimumSaving: .10, metric: 'RGB mean SSIM, uniform 7x7 window, sample covariance; PSNR RGB 8-bit', source: 'user P1 tuning; not material/medical calibration' });
// Same local SSIM definition as skimage's default 7x7, channel_axis=-1.
export function imageMetrics(a, b, width, height) {
  assert.equal(a.length, width * height * 4); assert.equal(b.length, a.length);
  const stride = width + 1, size = stride * (height + 1), radius = 3, N = 49, cov = N / (N - 1), C1 = (255 * .01) ** 2, C2 = (255 * .03) ** 2;
  let mse = 0, ssim = 0, alphaMaxError = 0;
  for (let i = 0; i < a.length; i += 4) { for (let c = 0; c < 3; c++) mse += (a[i+c]-b[i+c])**2; alphaMaxError = Math.max(alphaMaxError, Math.abs(a[i+3]-b[i+3])); }
  for (let channel = 0; channel < 3; channel++) {
    const tables = Array.from({length:5}, () => new Float64Array(size));
    for (let y = 0; y < height; y++) {
      const sums = [0,0,0,0,0];
      for (let x = 0; x < width; x++) {
        const i=(y*width+x)*4+channel, A=a[i], B=b[i], values=[A,B,A*A,B*B,A*B], p=(y+1)*stride+x+1;
        for(let k=0;k<5;k++){sums[k]+=values[k];tables[k][p]=tables[k][p-stride]+sums[k];}
      }
    }
    let total=0;
    for(let y=radius;y<height-radius;y++)for(let x=radius;x<width-radius;x++){
      const top=(y-radius)*stride, bottom=(y+radius+1)*stride, left=x-radius, right=x+radius+1;
      const mean=tables.map(t=>(t[bottom+right]-t[top+right]-t[bottom+left]+t[top+left])/N);
      const [u,v]=mean, va=(mean[2]-u*u)*cov, vb=(mean[3]-v*v)*cov, ab=(mean[4]-u*v)*cov;
      total+=((2*u*v+C1)*(2*ab+C2))/((u*u+v*v+C1)*(va+vb+C2));
    }
    ssim += total / ((width-radius*2)*(height-radius*2)) / 3;
  }
  mse /= width*height*3;
  return {psnrDB:mse===0?null:10*Math.log10(255**2/mse), identicalRGB:mse===0, ssim, alphaMaxError};
}
function textureUses(g) {
  const uses=g.images.map(()=>[]);
  const add=(info,role,material,alpha=false)=>{if(!info)return;const texture=g.textures[info.index],source=texture.source??texture.extensions?.EXT_texture_webp?.source;uses[source].push({role,material:material.name,alphaUsed:alpha});};
  for(const m of g.materials){const p=m.pbrMetallicRoughness||{};add(p.baseColorTexture,'baseColor',m,!!m.alphaMode&&m.alphaMode!=='OPAQUE');add(m.normalTexture,'normal',m);add(p.metallicRoughnessTexture,'metallicRoughness',m);add(m.occlusionTexture,'occlusion',m);add(m.emissiveTexture,'emissive',m);}
  return uses;
}
export function assertTextureOnly(source, output) {
  const a=readGLB(source),b=readGLB(output),imageViews=new Set(a.g.images.map(i=>i.bufferView));
  for(const key of ['accessors','meshes','nodes','skins','animations','scenes','scene','materials','samplers'])assert.deepEqual(b.g[key],a.g[key],key);
  assert.equal(b.g.bufferViews.length,a.g.bufferViews.length);
  let preservedBytes=0;
  for(const[i,v]of a.g.bufferViews.entries())if(!imageViews.has(i)){
    const w=b.g.bufferViews[i],{byteOffset:oldOffset,...oldMeta}=v,{byteOffset:newOffset,...newMeta}=w;assert.deepEqual(newMeta,oldMeta);
    const bytes=a.binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);
    assert.deepEqual(b.binary.subarray(w.byteOffset||0,(w.byteOffset||0)+w.byteLength),bytes,`non-image bufferView ${i}`);preservedBytes+=bytes.length;
  }
  return {accessorsMeshesNodesSkinsClipsMaterialsSamplersExact:true,nonImageBufferViewsExact:true,preservedBytes,views:a.g.bufferViews.length-imageViews.size};
}
export async function compressGLB(source,{name,output,proofDirectory,losslessNormals=true,losslessMaterialMaps=false}={}) {
  const {g,binary}=readGLB(source),uses=textureUses(g),replacements=new Map(),rows=[];
  for(const[i,image]of g.images.entries()){
    const view=g.bufferViews[image.bufferView],original=binary.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),metadata=await sharp(original).metadata();
    const raw=await sharp(original).ensureAlpha().raw().toBuffer(),normal=uses[i].some(u=>u.role==='normal'),base=uses[i].some(u=>u.role==='baseColor');
    const q6ORM=name==='m4'&&WEBP_POLICY.m4ORMIndices.includes(i)&&uses[i].some(u=>['metallicRoughness','occlusion'].includes(u.role));
    let quality=normal?WEBP_POLICY.normalQuality:(q6ORM?(WEBP_POLICY.m4ORMQualityOverrides[i]??85):WEBP_POLICY.baseQuality),lossless=losslessMaterialMaps&&uses[i].some(u=>['metallicRoughness','occlusion'].includes(u.role)),candidate,metrics;
    const trials=[];
    do {
      candidate=await sharp(original).webp({quality,alphaQuality:100,effort:6,lossless,smartSubsample:true}).toBuffer();
      metrics=imageMetrics(raw,await sharp(candidate).ensureAlpha().raw().toBuffer(),metadata.width,metadata.height);
      trials.push({quality,lossless,bytes:candidate.length,...metrics});
      if(normal&&losslessNormals&&!lossless){
        if(proofDirectory){await mkdir(proofDirectory,{recursive:true});await writeFile(resolve(proofDirectory,`${name}-${i}-q95.webp`),candidate);}
        // Reviewed q95 crops have changed boundaries/microstructure. Preserve
        // all normal vectors exactly instead of retaining chroma subsampling.
        lossless=true;continue;
      }
      if(!base||metrics.ssim>=.97||lossless)break;
      if(quality<100)quality=Math.min(100,quality+5);else lossless=true;
    } while(true);
    assert.equal(metrics.alphaMaxError,0,'alpha retained exactly');
    const jpeg=image.mimeType==='image/jpeg',saving=1-candidate.length/original.length,retained=jpeg&&saving<.10;
    const selected=retained?original:candidate;
    if(!retained){replacements.set(image.bufferView,selected);image.mimeType='image/webp';for(const t of g.textures)if(t.source===i){t.extensions={...t.extensions,EXT_texture_webp:{source:i}};delete t.source;}}
    const row={index:i,uses:uses[i],width:metadata.width,height:metadata.height,alphaChannel:!!metadata.hasAlpha,alphaUsed:uses[i].some(u=>u.alphaUsed),originalMime:jpeg?'image/jpeg':'image/png',outputMime:image.mimeType,originalBytes:original.length,candidateBytes:candidate.length,outputBytes:selected.length,quality,lossless,retainedOriginalJPEG:retained,candidateSaving:saving,trials,...(retained?{psnrDB:null,identicalRGB:true,ssim:1,alphaMaxError:0}:metrics),originalSHA256:hash(original),outputSHA256:hash(selected)};
    rows.push(row);
    if(proofDirectory){await mkdir(proofDirectory,{recursive:true});await writeFile(resolve(proofDirectory,`${name}-${i}-original.${jpeg?'jpg':'png'}`),original);await writeFile(resolve(proofDirectory,`${name}-${i}-selected.${retained?'jpg':'webp'}`),selected);}
  }
  if(replacements.size){g.extensionsUsed=[...new Set([...(g.extensionsUsed||[]),'EXT_texture_webp'])];g.extensionsRequired=[...new Set([...(g.extensionsRequired||[]),'EXT_texture_webp'])];}
  const pieces=[];let offset=0;
  for(const v of g.bufferViews){const padding=(4-offset%4)%4;if(padding){pieces.push(Buffer.alloc(padding));offset+=padding;}const bytes=replacements.get(g.bufferViews.indexOf(v))??binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);v.byteOffset=offset;v.byteLength=bytes.length;pieces.push(bytes);offset+=bytes.length;}
  g.buffers[0].byteLength=offset;
  let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const bin=Buffer.concat([...pieces,Buffer.alloc((4-offset%4)%4)]),header=Buffer.alloc(20),chunk=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);chunk.writeUInt32LE(bin.length,0);chunk.writeUInt32LE(0x004e4942,4);
  const glb=Buffer.concat([header,json,chunk,bin]),proof=assertTextureOnly(source,glb);
  if(output)await writeFile(output,glb);
  return {glb,meta:{name,sourceBytes:source.length,sourceSHA256:hash(source),bytes:glb.length,sha256:hash(glb),policy:WEBP_POLICY,encoder:sharp.versions,rows,proof}};
}
export async function generateWebP({proofDirectory}={}){
  await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
  const existing=JSON.parse(await readFile(new URL('../dist/training-build-info.json',import.meta.url),'utf8').catch(()=>'{}'));
  async function prepare(path,name,output,key){
    const source=await readFile(new URL(path,import.meta.url)),meta=existing.textureDerivatives?.[key];
    if(!proofDirectory&&meta?.sourceSHA256===hash(source)&&JSON.stringify(meta.policy)===JSON.stringify(WEBP_POLICY)&&JSON.stringify(meta.encoder)===JSON.stringify(sharp.versions)){
      const glb=await readFile(new URL(output,import.meta.url)).catch(()=>null);
      if(glb&&hash(glb)===meta.sha256&&meta.rows.filter(r=>r.uses.some(u=>u.role==='normal')).every(r=>r.lossless)){assertTextureOnly(source,glb);return{glb,meta};}
    }
    return compressGLB(source,{name,output:new URL(output,import.meta.url),proofDirectory});
  }
  const soldier=await prepare('../dist/soldier-skinned.glb','soldier','../dist/soldier-webp.glb','soldier');
  const weapon=await prepare('../apps/training/assets/m4a1-training.glb','m4','../dist/m4a1-webp.glb','weapon');
  return {soldier,weapon};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){const r=await generateWebP({proofDirectory:process.env.CQB_TEXTURE_PROOFS});await writeFile(new URL('../dist/training-webp-info.json',import.meta.url),JSON.stringify({soldier:r.soldier.meta,weapon:r.weapon.meta},null,2)+'\n');console.log(JSON.stringify({soldier:r.soldier.meta.bytes,weapon:r.weapon.meta.bytes}));}
