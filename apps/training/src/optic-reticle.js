// Manufacturer SR3, VD1905 Rev B (April 2021), pp. 8–9. Private project
// reproduction; manufacturer artwork is not covered by the model's CC BY.
export const SR3 = Object.freeze({
 source:'https://cdn.shopify.com/s/files/1/0698/3044/3191/files/Vudu_Reticle_Manual_SR2-3_RevB_98e2cd9b-6729-466e-91da-e502b3c21fdc.pdf?v=1763358308',
 sourcePage:9,checked:'2026-10-11',use:'private personal project reproduction',
 radiusRad:.00215,ringStrokeRad:.00030,dotDiameterRad:.00044,
 bottomGapWidthRad:.002,holdoversRad:Object.freeze([.002,.003,.0041]),
 horizontalTickRad:Object.freeze([.004,.006]),spineStrokeRad:.00007,
 design:Object.freeze({zeroYards:100,bulletGrain:75,velocityFps:2900,bc:.395,sightHeightInch:1.5}),
 // These lengths/typography are not dimensioned in the manual; explicit tuning.
 tickLengthRad:.0008,holdoverWidthRad:.0008,labelHeightRad:.0007,minStrokePixels:1,
 speedRing:false,speedRingReason:'Outer speed-ring angular diameter not dimensioned in the obtained official manuals; not invented',
});
export const sr3Fragment = `
 float segment(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0));}
 float mark(float distance,float halfWidth,float aa){return 1.0-smoothstep(halfWidth-aa*.5,halfWidth+aa*.5,distance);}
 vec3 reticle(vec3 sourceColor,vec2 ndc,float tangent){
   vec2 p=atan(ndc*tangent);float aa=max(max(fwidth(p.x),fwidth(p.y)),.000001);
   float ring=mark(abs(length(p)-.002),max(.00015,aa*.5),aa);
   if(p.y<0.0&&abs(p.x)<.001)ring=0.0;
   float dotMask=mark(length(p),max(.00022,aa*.5),aa),black=0.0;
   float width=max(.000035,aa*.5);
   for(int i=0;i<2;i++){float x=i==0?.004:.006;black=max(black,mark(segment(p,vec2(x,-.0004),vec2(x,.0004)),width,aa));black=max(black,mark(segment(p,vec2(-x,-.0004),vec2(-x,.0004)),width,aa));}
   black=max(black,mark(segment(p,vec2(0.0,-.002),vec2(0.0,-.0041)),width,aa));
   for(int i=0;i<3;i++){float y=i==0?-.002:(i==1?-.003:-.0041);black=max(black,mark(segment(p,vec2(-.0004,y),vec2(.0004,y)),width,aa));
     // Vector 4/5/6 labels at the same angular coordinates as their holds.
     vec2 q=(p-vec2(.00125,y))/.0007;float d=1.0;
     if(i==0){d=min(segment(q,vec2(.4,-.5),vec2(.4,.5)),min(segment(q,vec2(0.0,.5),vec2(0.0,0.0)),segment(q,vec2(0.0,0.0),vec2(.5,0.0))));}
     else{d=min(segment(q,vec2(0.0,0.0),vec2(.4,0.0)),min(segment(q,vec2(0.0,.5),vec2(.4,.5)),segment(q,vec2(0.0,-.5),vec2(.4,-.5))));d=min(d,segment(q,vec2(.4,-.5),vec2(.4,0.0)));d=min(d,segment(q,vec2(0.0,0.0),vec2(0.0,.5)));if(i==2)d=min(d,segment(q,vec2(0.0,-.5),vec2(0.0,0.0)));}
     black=max(black,mark(d*.0007,width,aa));
   }
   vec3 color=mix(sourceColor,vec3(.002),black);
   float gw=max(aa*2.5,.00025),glow=exp(-pow(abs(length(p)-.002)/gw,2.0));if(p.y<0.0&&abs(p.x)<.001)glow=0.0;glow=max(glow,exp(-pow(length(p)/(gw*1.4),2.0)));
   color+=vec3(.42,.01,.012)*glow*.45;
   return mix(color,vec3(.65,.004,.007),max(ring,dotMask));
 }
`;
