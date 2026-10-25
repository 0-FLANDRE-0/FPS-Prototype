import * as T from 'three';
import {holoFragment} from './optic-holo-shader.js';
export function createHolographicSight({mount,markers,pack,definition}){
 let glass=null;pack.traverse(n=>{if(n.isMesh&&n.material?.name==='XPS3_Glass')glass=n;});
 const uniforms={qInv:{value:new T.Quaternion()},origin:{value:new T.Vector3()},scale:{value:1},brightness:{value:1.5}},original=glass?.material;
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:true,vertexShader:'varying vec3 vWorld; void main(){vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',fragmentShader:holoFragment});
 if(glass){glass.material=material;glass.renderOrder=5;}
 const rotation=new T.Quaternion(),scale=new T.Vector3();let last={pip:false,rendered:false,eligible:false,kind:'holo',magnification:1,reticle:'EOTECH 68 MOA ring + 1 MOA dot, quadrant ticks (tick length/line width tuning)',windowM:definition.windowM};
 function update({eyeCamera,ads}){mount.updateWorldMatrix(true,true);mount.getWorldQuaternion(rotation);uniforms.qInv.value.copy(rotation).invert();markers.window.getWorldPosition(uniforms.origin.value);uniforms.scale.value=mount.getWorldScale(scale).x;last={...last,ads,eye:eyeCamera.getWorldPosition(new T.Vector3()).toArray(),window:uniforms.origin.value.toArray(),axis:new T.Vector3(0,0,-1).applyQuaternion(rotation).toArray(),glass:Boolean(glass)};}
 return {update,render(){},dispose(){material.dispose();if(glass&&original)glass.material=original;},projectWorldPoint:point=>point,surface:glass,camera:null,snapshot:()=>({...last})};
}
