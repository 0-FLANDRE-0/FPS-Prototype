import * as T from 'three';
import {D1} from './medical-feedback.js';
import {EYELIDS} from './medical-eyelids.js';
import {BLACKOUT_REMNANT as REMNANT} from './blackout-remnant.js';

const radians = Math.PI / 180;
function angle(rho, k, halfFov) { return (1 - k) * Math.atan(rho * Math.tan(halfFov)) + k * rho * halfFov; }
export function lensParameters(aspect, strength, horizontalFov, ads = 0) {
  const k = strength / 100 * (1 - 0.6 * ads), corner = Math.hypot(1, 1 / aspect);
  let halfFov = horizontalFov * (1 - 0.2 * ads) * radians / 2;
  if (angle(corner, k, halfFov) > 85 * radians) {
    let low = 0, high = halfFov;
    for (let i = 0; i < 48; i++) { const mid = (low + high) / 2; if (angle(corner, k, mid) > 85 * radians) high = mid; else low = mid; }
    halfFov = low;
  }
  const sourceHalf = k === 0 ? halfFov : Math.atan(Math.tan(angle(corner, k, halfFov)) / corner);
  const sourceTan = Math.tan(sourceHalf);
  return { aspect, k, halfFov, sourceTan, corner, horizontalFov: halfFov * 2 / radians,
    verticalFov: 2 * Math.atan(sourceTan / aspect) / radians,
    centerDerivative: ((1 - k) * Math.tan(halfFov) + k * halfFov) / sourceTan };
}
// CPU counterpart of the shader, used for numerical verification.
export function lensSample(ndc, params) {
  if (!params || params.k === 0) return { x: ndc.x, y: ndc.y };
  const x = ndc.x, y = ndc.y / params.aspect, rho = Math.hypot(x, y);
  const scale = rho === 0 ? params.centerDerivative : Math.tan(angle(rho, params.k, params.halfFov)) / (params.sourceTan * rho);
  return { x: x * scale, y: y * scale * params.aspect };
}
// Invert source-camera NDC to output NDC. Preserve depth for existing visibility checks.
export function lensProject(ndc, params) {
  if (!params || params.k === 0) return ndc;
  const radius = Math.hypot(ndc.x, ndc.y / params.aspect);
  if (radius === 0) return ndc;
  const theta = Math.atan(radius * params.sourceTan);
  let low = 0, high = params.corner;
  // Off-screen points still project off-screen rather than sticking to an edge.
  while (angle(high, params.k, params.halfFov) < theta) high *= 2;
  for (let i = 0; i < 48; i++) { const mid = (low + high) / 2; if (angle(mid, params.k, params.halfFov) < theta) low = mid; else high = mid; }
  const scale = (low + high) / (2 * radius);
  ndc.x *= scale; ndc.y *= scale; return ndc;
}

export function createLens(renderer) {
  let target = null, pass = null, quality = 'balanced', params = null;
  let feedback=null,effectStrength=0;
  const buffer = new T.Vector2();
  const clearColor = new T.Color(), backgroundColor = new T.Color();
  const debug = { forceIdentity: false }; // Only development diagnostics; no settings/UI path.
  function releaseTarget() { target?.dispose(); target = null; }
  function dispose() { releaseTarget(); if (pass) { pass.mesh.geometry.dispose(); pass.mesh.material.dispose(); pass = null; } }
  function render(scene, camera) {
    if ((!params || params.k === 0)&&!debug.forceIdentity&&!effectStrength) { dispose(); renderer.render(scene, camera); return; }
    const aspect=camera.aspect,halfFov=Math.atan(Math.tan(camera.fov*Math.PI/360)*aspect),effective=params||{aspect,k:0,halfFov,sourceTan:Math.tan(halfFov),centerDerivative:1};
    renderer.getDrawingBufferSize(buffer);
    const scale = T.MathUtils.clamp(1 / effective.centerDerivative, 1, quality === 'low' ? 1 : 1.25);
    const width = Math.ceil(buffer.x * scale), height = Math.ceil(buffer.y * scale);
    const remnantMips=effectStrength>0&&(feedback?.blackout||0)>0&&!feedback?.unconscious;
    if (!target || target.width !== width || target.height !== height || target.texture.generateMipmaps!==remnantMips) {
      releaseTarget(); target = new T.WebGLRenderTarget(width, height, { type: T.HalfFloatType, minFilter: remnantMips?T.LinearMipmapLinearFilter:T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true, generateMipmaps: remnantMips });
      target.texture.colorSpace = T.LinearSRGBColorSpace;
    }
    if (!pass) {
      const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3)); geometry.setAttribute('uv', new T.Float32BufferAttribute([0,0, 2,0, 0,2], 2));
      const material = new T.ShaderMaterial({ depthTest: false, depthWrite: false, toneMapped: true,
        uniforms: { source: {value:null}, background: {value:new T.Vector3()}, aspect: {value:1}, k: {value:0}, halfFov: {value:0}, sourceTan: {value:1},medicalA:{value:new T.Vector4()},medicalB:{value:new T.Vector4()},medicalC:{value:new T.Vector4()},concussion:{value:new T.Vector2()},drug:{value:new T.Vector4()},medicalJitter:{value:new T.Vector2()},medicalStrength:{value:0},medicalUnconscious:{value:0},cssTexel:{value:new T.Vector2()},texel:{value:new T.Vector2()} },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }',
        fragmentShader: `uniform sampler2D source; uniform vec3 background; uniform float aspect; uniform float k; uniform float halfFov; uniform float sourceTan; uniform vec4 medicalA; uniform vec4 medicalB; uniform vec4 medicalC; uniform vec2 concussion; uniform vec4 drug; uniform vec2 medicalJitter; uniform float medicalStrength; uniform vec2 texel; uniform vec2 cssTexel; uniform float medicalUnconscious; varying vec2 vUv;
          float eyeMask(float amount, bool pain){
            if(amount<=0.0)return 0.0;
            // Height-based coordinates keep the physical eye-arc shape when
            // changing aspect ratio; a wider display reveals more of the arc.
            vec2 e=(vUv-0.5)*2.0;float x=e.x*aspect/${EYELIDS.shapeReferenceAspect.toFixed(8)};
            float arc=min(1.7,x*x),upper=1.0-amount*(pain?1.0:1.48)-arc*amount*0.42;
            float lower=-1.0+amount*(pain?1.0:0.52)+arc*amount*0.18;
            float lid=max(smoothstep(upper-${EYELIDS.boundaryFeather},upper+${EYELIDS.boundaryFeather},e.y),1.0-smoothstep(lower-${EYELIDS.boundaryFeather},lower+${EYELIDS.boundaryFeather},e.y));
            return mix(lid,1.0,smoothstep(0.94,1.0,amount));
          }
          void main(){
            vec2 outputUV=vUv+medicalJitter*medicalStrength;
            vec2 p=vec2(outputUV.x*2.0-1.0,(outputUV.y*2.0-1.0)/aspect);
            float rho=length(p); float theta=(1.0-k)*atan(rho*tan(halfFov))+k*rho*halfFov;
            float scale=rho>0.000001 ? tan(theta)/(sourceTan*rho) : ((1.0-k)*tan(halfFov)+k*halfFov)/sourceTan;
            vec2 uv=(p*scale*vec2(1.0,aspect))*0.5+0.5;
            if(any(lessThan(uv,vec2(-0.000001))) || any(greaterThan(uv,vec2(1.000001)))) gl_FragColor=vec4(0.0,0.0,0.0,1.0);
            else gl_FragColor=texture2D(source,clamp(uv,0.0,1.0));
            if(medicalStrength>0.0&&(concussion.x>0.0||concussion.y>0.0)){
              vec2 d=cssTexel*(1.0+concussion.x*5.0);
              vec3 soft=(texture2D(source,clamp(uv+d,0.0,1.0)).rgb+texture2D(source,clamp(uv-d,0.0,1.0)).rgb+texture2D(source,clamp(uv+vec2(d.x,-d.y),0.0,1.0)).rgb+texture2D(source,clamp(uv+vec2(-d.x,d.y),0.0,1.0)).rgb)*0.25;
              gl_FragColor.rgb=mix(gl_FragColor.rgb,soft,clamp(concussion.x*medicalStrength,0.0,0.9));
              float light=smoothstep(0.4,1.1,dot(soft,vec3(0.2126,0.7152,0.0722)));
              gl_FragColor.rgb+=soft*light*concussion.y*medicalStrength;
            }
            if(medicalStrength>0.0&&(drug.x>0.0||drug.y>0.0)){vec3 echo=texture2D(source,clamp(uv+vec2(cssTexel.x*drug.x,cssTexel.y*drug.x*.18),0.0,1.0)).rgb;gl_FragColor.rgb=mix(gl_FragColor.rgb,echo,.25*medicalStrength);vec3 c=gl_FragColor.rgb;gl_FragColor.rgb=mix(c,vec3(c.r*1.06,c.g*.97,c.b*1.08),drug.y*medicalStrength);}
            float closure=max(medicalC.x,medicalC.y);
            if(medicalStrength>0.0&&(medicalB.x>0.0||closure>0.0)){
              float peripheral=smoothstep(0.20,0.95,length((vUv-0.5)*2.0));
              vec2 d=texel*(1.0+medicalB.x*7.0+closure*10.0);
              vec4 soft=(texture2D(source,clamp(uv+d,0.0,1.0))+texture2D(source,clamp(uv-d,0.0,1.0))+texture2D(source,clamp(uv+vec2(d.x,-d.y),0.0,1.0))+texture2D(source,clamp(uv+vec2(-d.x,d.y),0.0,1.0)))*0.25;
              gl_FragColor=mix(gl_FragColor,soft,medicalStrength*max(medicalB.x*peripheral,closure*0.6));
            }
            // Four extra source taps only while the adrenaline effect is on.
            // Preserve bright unsharp overshoot; reduce the dark halo.
            if(medicalStrength>0.0&&medicalC.z>0.0){
              vec2 d=texel*1.6;vec3 low=(texture2D(source,clamp(uv+vec2(d.x,0.0),0.0,1.0)).rgb+texture2D(source,clamp(uv-vec2(d.x,0.0),0.0,1.0)).rgb+texture2D(source,clamp(uv+vec2(0.0,d.y),0.0,1.0)).rgb+texture2D(source,clamp(uv-vec2(0.0,d.y),0.0,1.0)).rgb)*0.25;
              float center=1.0-smoothstep(0.1,1.1,length((vUv-0.5)*2.0));vec3 high=gl_FragColor.rgb-low;
              gl_FragColor.rgb+=(max(high,0.0)+min(high,0.0)*${D1.adrenalineDarkOvershootRatio})*${D1.adrenalineSharpenGain}*medicalC.z*medicalStrength*center*(1.0-medicalA.w);
              gl_FragColor.rgb+=high*${D1.adrenalineLocalContrast}*medicalC.z*medicalStrength*center*(1.0-medicalA.w);
            }
            // Mip prefiltering removes fine detail without sparse-tap aliasing.
            // Only conscious blackout frames allocate/generate source mipmaps.
            float remnantMask=1.0-smoothstep(${REMNANT.fullRadius},${REMNANT.outerRadius},length((vUv-0.5)*vec2(aspect,1.0)*2.0));
            if(medicalStrength>0.0&&medicalA.w>0.0&&medicalUnconscious<0.5&&remnantMask>0.0){
              float pixelRatio=max(cssTexel.x/texel.x,cssTexel.y/texel.y);
              vec4 soft=textureLod(source,clamp(uv,0.0,1.0),log2(pixelRatio*${REMNANT.blurRadiusCssPx.toFixed(1)}));
              vec4 mean=textureLod(source,clamp(uv,0.0,1.0),log2(pixelRatio*${REMNANT.coarseRadiusCssPx.toFixed(1)}));
              gl_FragColor=mix(gl_FragColor,mix(mean,soft,${REMNANT.contrast}),medicalStrength*smoothstep(0.35,1.0,medicalA.w));
            }
            float coverage=gl_FragColor.a;
            if(coverage>0.0) gl_FragColor.rgb/=coverage;
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            gl_FragColor=vec4(mix(background,gl_FragColor.rgb,coverage),1.0);
            if(medicalStrength>0.0){
              vec3 c=gl_FragColor.rgb;float radius=length((vUv-0.5)*2.0);
              c=mix(c,vec3(dot(c,vec3(0.2126,0.7152,0.0722))),max(medicalA.x,medicalA.w)*medicalStrength);
              float edge=smoothstep((1.0-medicalA.z*0.82)*0.5,1.4-medicalA.z*1.05,radius);
              c*=1.0-medicalStrength*edge*max(max(medicalA.y,medicalB.y),medicalC.w);
              vec3 remnant=c;
              c*=1.0-medicalA.w*medicalStrength;
              c=mix(c,vec3(1.0),medicalB.w*medicalStrength*(1.0-medicalA.w));
              c+=remnant*${REMNANT.brightness}*medicalA.w*medicalStrength*remnantMask*(1.0-medicalUnconscious);
              float lid=max(eyeMask(medicalC.x,false),eyeMask(medicalC.y,true));
              if(closure>0.0)c*=(1.0-lid*medicalStrength)*(1.0-closure*0.15*medicalStrength);
              c*=1.0-medicalUnconscious*medicalStrength;
              gl_FragColor=vec4(c,1.0);
            }
          }` });
      const mesh = new T.Mesh(geometry, material); mesh.frustumCulled = false;
      const scene = new T.Scene(); scene.add(mesh); pass = {scene,mesh,camera:new T.Camera()};
    }
    const uniforms = pass.mesh.material.uniforms;
    uniforms.source.value = target.texture;
    for (const key of ['aspect','k','halfFov','sourceTan']) uniforms[key].value = effective[key];
    uniforms.medicalUnconscious.value=feedback?.unconscious?1:0;uniforms.medicalStrength.value=effectStrength;uniforms.texel.value.set(1/width,1/height);
    uniforms.medicalA.value.set(feedback?.desaturation||0,feedback?.peripheralDark||0,feedback?.tunnel||0,feedback?.blackout||0);
    uniforms.medicalB.value.set(feedback?.blur||0,feedback?.stressDark||0,feedback?.eyelid||0,feedback?.white||0);
    uniforms.drug.value.set(feedback?.drugDoubleCssPx||0,feedback?.drugColor||0,0,0);
    uniforms.concussion.value.set(feedback?.concussionBlur||0,feedback?.concussionBloom||0);
    uniforms.medicalC.value.set(feedback?.eyelidDrowsy||0,feedback?.eyelidPain||0,feedback?.adrenalineSharpness||0,feedback?.perfusionTunnel||0);
    const css=renderer.domElement;uniforms.cssTexel.value.set(1/(css.clientWidth||buffer.x),1/(css.clientHeight||buffer.y));uniforms.medicalJitter.value.set(((feedback?.screenJitterCssPx?.[0]||0)+(feedback?.drugDizzyCssPx?.[0]||0))/(css.clientWidth||buffer.x),((feedback?.screenJitterCssPx?.[1]||0)+(feedback?.drugDizzyCssPx?.[1]||0))/(css.clientHeight||buffer.y));
    // Three's solid-color clear is never tone-mapped on the direct path. Keep that
    // clear outside ACES as well; otherwise the identity pass brightens the sky.
    const background = scene.background, clearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(clearColor);
    backgroundColor.copy(background?.isColor ? background : clearColor).convertLinearToSRGB();
    uniforms.background.value.set(backgroundColor.r,backgroundColor.g,backgroundColor.b);
    try {
      if (background?.isColor) scene.background = null;
      renderer.setClearColor(0,0); renderer.setRenderTarget(target); renderer.render(scene,camera);
    } finally { scene.background = background; renderer.setClearColor(clearColor,clearAlpha); }
    renderer.setRenderTarget(null); renderer.render(pass.scene,pass.camera);
  }
  return { render, dispose, debug,setFeedback(value,strength=100){feedback=value;effectStrength=value&&(value.unconscious||['desaturation','peripheralDark','tunnel','blackout','blur','stressDark','eyelid','white','adrenalineSharpness','concussionBlur','concussionBloom','drugDoubleCssPx','drugColor'].some(k=>value[k]>0)||value.screenJitterCssPx?.some(v=>v!==0))?T.MathUtils.clamp(strength/100,0,1):0;if(value?.unconscious)effectStrength=1;}, setParameters: value => { params = value; if ((!value || value.k === 0)&&!effectStrength) dispose(); },
    resize: mode => { quality = mode; releaseTarget(); }, get parameters() { return params; },
    snapshot: () => ({ target: target ? {width:target.width,height:target.height,type:'HalfFloat',colorSpace:'srgb-linear'} : null, pass: Boolean(pass), parameters: params ? {...params} : null,medicalEffects:{strength:effectStrength,feedback:feedback?{...feedback}:null} }) };
}
