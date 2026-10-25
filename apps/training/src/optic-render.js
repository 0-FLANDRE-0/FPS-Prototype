import * as T from 'three';
import {lensProject} from './lens.js';
import {VUDU_RENDER_PROFILE} from './optic-specs.js';

export function createOpticImage({mount,markers,pack,profile=VUDU_RENDER_PROFILE}){
 const camera=new T.PerspectiveCamera(20,1,.03,800),geometry=new T.CircleGeometry(profile.ocularRadiusM,128);
 const uniforms={source:{value:null},imageEnabled:{value:0},eye:{value:new T.Vector3(0,0,.09)},radius:{value:profile.ocularRadiusM},apparentTan:{value:1},trueTan:{value:1},exitRadius:{value:.012},pupilRadius:{value:profile.eyePupilRadiusM},axialAperture:{value:1},transmission:{value:profile.transmission},vignette:{value:profile.vignette},distortion:{value:profile.distortion[0]},chroma:{value:profile.chroma},edgeBlur:{value:profile.edgeBlur},exitPupilZ:{value:profile.adsEyeReliefM},glare:{value:profile.glare}};
 const material=new T.ShaderMaterial({uniforms,side:T.DoubleSide,depthWrite:true,depthTest:true,toneMapped:true,
  vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`varying vec2 vUv; uniform sampler2D source;uniform float imageEnabled;uniform vec3 eye;uniform float radius,apparentTan,trueTan,exitRadius,pupilRadius,axialAperture,transmission,vignette,distortion,chroma,edgeBlur,exitPupilZ,glare;
   ${profile.reticle}
   vec3 lensSample(vec2 n){float r2=dot(n,n);vec2 d=n*(1.0+distortion*r2);float ca=chroma*r2,b=edgeBlur*r2*r2*.7071;vec3 c=vec3(0.0);
    for(int k=0;k<5;k++){vec2 o=k==0?vec2(0.0):vec2((k==1||k==2)?b:-b,(k==1||k==3)?b:-b);
     c.r+=texture2D(source,(d*(1.0+ca)+o)*.5+.5).r;c.g+=texture2D(source,(d+o)*.5+.5).g;c.b+=texture2D(source,(d*(1.0-ca)+o)*.5+.5).b;}
    return c*.2;}
   void main(){
    vec2 plane=(vUv*2.0-1.0)*radius;
    // Apparent output rays are eye-relative; this maintains optical angular
    // magnification when eye relief changes, instead of stretching a flat TV.
    vec2 ndc=(plane-eye.xy)/(max(eye.z,.001)*apparentTan);
    float rn=length(ndc),aa=max(fwidth(rn),.001),soft=max(aa,.012);
    // Field stop: slightly soft edge with a thin lateral-colour fringe.
    vec3 field=vec3(1.0-smoothstep(axialAperture*.997-soft,axialAperture*.997+soft,rn),1.0-smoothstep(axialAperture-soft,axialAperture+soft,rn),1.0-smoothstep(axialAperture*1.003-soft,axialAperture*1.003+soft,rn));
    // Each field bundle crosses the eye plane displaced by axial eye-relief error; the eye pupil
    // area sliding off the exit pupil gives a soft swimming crescent instead of a hard cut.
    vec2 ray=eye.xy+ndc*(pupilRadius*.8+apparentTan*abs(eye.z-exitPupilZ));float pd=length(ray);
    float pupil=1.0-smoothstep(exitRadius-pupilRadius*.5,exitRadius+pupilRadius*.5,pd);
    vec3 color=vec3(.003,.006,.007);
    if(imageEnabled>.5){vec2 dn=ndc*(1.0+distortion*rn*rn);color=lensSample(ndc)*transmission*(1.0-vignette*pow(clamp(rn,0.0,1.0),3.0));color=reticle(color,dn,trueTan);color*=field*pupil;}
    // Eyepiece glass: AR-coated residual reflection of the surroundings and a rim glint.
    vec2 gq=plane/radius;float gr=length(gq);vec3 vd=normalize(vec3(plane-eye.xy,-max(eye.z,.001)));vec3 nr=normalize(vec3(gq*.35,1.0));vec3 rd=reflect(vd,nr);
    float sky=smoothstep(-.15,.55,rd.y);vec3 env=mix(vec3(.05,.045,.04),vec3(.62,.68,.74),sky);float fres=.012+.06*pow(1.0-abs(dot(vd,nr)),5.0);
    color+=env*vec3(.55,.9,.6)*fres*glare*(imageEnabled>.5&&rn<axialAperture?.5:1.0);color+=vec3(.5,.55,.6)*glare*.08*smoothstep(.86,.96,gr)*(1.0-smoothstep(.96,1.0,gr))*(.4+.6*sky);
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const surface=new T.Mesh(geometry,material);surface.name='VuduOpticalImage';surface.position.copy(markers.ocular.position);surface.frustumCulled=false;mount.add(surface);
 // The source combines both glass discs in one primitive. Preserve objective
 // glass while replacing only the ocular face, without changing the saved GLB.
 const glass=profile.glassName?pack.getObjectByName(profile.glassName):null,originalGeometry=glass?.geometry;
 if(glass){
 pack.updateMatrixWorld(true);const indices=originalGeometry.index,front=[];
 const v=new T.Vector3();for(let i=0;i<indices.count;i+=3){let z=0;for(let j=0;j<3;j++)z+=glass.getVertexPosition(indices.getX(i+j),v).applyMatrix4(glass.matrixWorld).z/3;if(z<-.1)for(let j=0;j<3;j++)front.push(indices.getX(i+j));}
 glass.geometry=originalGeometry.clone();glass.geometry.setIndex(front);
 }
 let target=null,frames=0,last={pip:false,rendered:false,magnification:1};
 const worldEye=new T.Vector3(),ocular=new T.Vector3(),objective=new T.Vector3(),rotation=new T.Quaternion(),eyeLocal=new T.Vector3();
 function update({eyeCamera,inventory,ads,lens}){
  mount.updateWorldMatrix(true,true);eyeCamera.getWorldPosition(worldEye);markers.ocular.getWorldPosition(ocular);markers.objective.getWorldPosition(objective);mount.getWorldQuaternion(rotation);
  const scale=mount.getWorldScale(new T.Vector3()).x;
  eyeLocal.copy(worldEye).sub(ocular).applyQuaternion(rotation.clone().invert()).divideScalar(scale);
  const field=profile.field(profile.fixedMag??inventory.optic?.magnification??1),box=profile.eyeBox(eyeLocal.toArray(),field.magnification);
  const inFront=new T.Vector3(0,0,-1).applyQuaternion(rotation).dot(eyeCamera.getWorldDirection(new T.Vector3()))>.5;
  const attached=mount.visible&&Boolean(inventory.weapon)&&!inventory.action;
  if(!mount.visible&&target){target.dispose();target=null;uniforms.source.value=null;}
  const enabled=attached&&ads>.5&&box.visible&&inFront;
  uniforms.eye.value.copy(eyeLocal);uniforms.distortion.value=profile.distortion[0]+(profile.distortion[1]-profile.distortion[0])*(field.magnification-1)/5;uniforms.apparentTan.value=field.apparentTan;uniforms.trueTan.value=field.trueTan;uniforms.exitRadius.value=field.exitPupilDiameterM/2;uniforms.axialAperture.value=box.axialAperture;uniforms.imageEnabled.value=enabled&&target?1:0;
  camera.position.copy(objective);camera.quaternion.copy(rotation);camera.fov=field.trueFovRad*180/Math.PI;camera.far=eyeCamera.far;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const imageRadius=field.apparentTan*Math.max(.01,eyeLocal.z)*scale,points=[];
  for(let i=0;i<8;i++){const angle=i*Math.PI/4,p=new T.Vector3(Math.cos(angle)*imageRadius,Math.sin(angle)*imageRadius,0).applyQuaternion(rotation).add(ocular).project(eyeCamera);lensProject(p,lens);points.push([(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2,p.z]);}
  const diameterPx=Math.max(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1])));
  const onscreen=points.some(p=>p[0]>-diameterPx&&p[0]<innerWidth+diameterPx&&p[1]>-diameterPx&&p[1]<innerHeight+diameterPx&&p[2]>-1&&p[2]<1);
  last={pip:attached&&ads>.5,rendered:false,eligible:enabled&&onscreen,magnification:field.magnification,trueFovRad:field.trueFovRad,apparentFovRad:field.apparentFovRad,exitPupilDiameterM:field.exitPupilDiameterM,eye:eyeLocal.toArray(),eyeBox:box,ocular:ocular.toArray(),objective:objective.toArray(),axis:new T.Vector3(0,0,-1).applyQuaternion(rotation).toArray(),diameterPx,sourceFrames:frames,scopeCameraFov:camera.fov,scopeCameraPosition:camera.position.toArray(),sourceIncludesViewmodel:false,reticle:profile.reticleName,target:target?{width:target.width,height:target.height,type:'HalfFloat',colorSpace:'srgb-linear'}:null};
 }
 function render(renderer,scene,weaponRig,quality,running=true){
  if(!last.eligible){uniforms.imageEnabled.value=0;return;}
  if(!running)return;
  const cap=profile.targetCaps[quality]||768,diameter=last.diameterPx*renderer.getPixelRatio(),size=Math.min(cap,Math.max(128,2**Math.ceil(Math.log2(Math.max(1,diameter)))));
  if(!target||target.width!==size){target?.dispose();target=new T.WebGLRenderTarget(size,size,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,generateMipmaps:false});target.texture.colorSpace=T.LinearSRGBColorSpace;target.texture.name='VuduScopeSource';}
  const oldTarget=renderer.getRenderTarget(),oldViewport=renderer.getViewport(new T.Vector4()),oldScissor=renderer.getScissor(new T.Vector4()),oldScissorTest=renderer.getScissorTest(),visible=weaponRig.visible;
  try{weaponRig.visible=false;renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.render(scene,camera);last.sourceDrawCalls=renderer.info.render.calls;last.sourceTriangles=renderer.info.render.triangles;}
  finally{weaponRig.visible=visible;renderer.setRenderTarget(oldTarget);renderer.setViewport(oldViewport);renderer.setScissor(oldScissor);renderer.setScissorTest(oldScissorTest);}
  uniforms.source.value=target.texture;uniforms.imageEnabled.value=1;last.rendered=true;last.sourceFrames=++frames;last.target={width:size,height:size,type:'HalfFloat',colorSpace:'srgb-linear'};
 }
 function dispose(){target?.dispose();target=null;geometry.dispose();material.dispose();if(glass){glass.geometry.dispose();glass.geometry=originalGeometry;}surface.removeFromParent();}
 function projectWorldPoint(point){
  if(!last.eligible||!target)return null;
  const p=point.clone().project(camera),e=uniforms.eye.value,aperture=uniforms.axialAperture.value;
  const bundle=profile.eyePupilRadiusM*.8+uniforms.apparentTan.value*Math.abs(e.z-profile.adsEyeReliefM),inverse=1/(1+uniforms.distortion.value*(p.x*p.x+p.y*p.y)),x=p.x*inverse,y=p.y*inverse;
  if(p.z< -1||p.z>1||Math.hypot(x,y)>aperture||Math.hypot(e.x+x*bundle,e.y+y*bundle)>uniforms.exitRadius.value)return null;
  return mount.localToWorld(surface.position.clone().add(new T.Vector3(e.x+x*e.z*uniforms.apparentTan.value,e.y+y*e.z*uniforms.apparentTan.value,0)));
 }
 return {update,render,dispose,projectWorldPoint,surface,camera,snapshot:()=>({...last,eye:last.eye?[...last.eye]:null,eyeBox:last.eyeBox?{...last.eyeBox}:null})};
}
