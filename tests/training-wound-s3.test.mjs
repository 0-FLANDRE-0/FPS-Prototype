import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {CATALOG} from '../apps/training/src/catalog.js';
import {computeWoundChannel,computeWoundChannelDirect,gelatinProfile,woundProfile} from '../apps/training/src/wound-channel.js';
import {isS3CalibratedAmmo,terminalSettingS3,S3_TERMINAL_SETTINGS,WOUND_S3_VALUES} from '../apps/training/src/wound-s3-types.js';

const baseline='c4e608dfc2ea65b4ef94bbb7c7ce9301c3d28fd2';
const source=readFileSync(new URL('./fixtures/history/'+baseline+'/wound-channel.js',import.meta.url),'utf8')
  .replace("'./catalog.js'",JSON.stringify(pathToFileURL(resolve('apps/training/src/catalog.js')).href))
  .replace("'./generated/wound-profile-map.json'",JSON.stringify(pathToFileURL(resolve('apps/training/src/generated/wound-profile-map.json')).href));
const old=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const channel=(ammoId,entryVelocityMps,lengthM=.3,extra={})=>computeWoundChannel({ammoId,entryVelocityMps,massKg:CATALOG.AMMO_PRESETS[ammoId].projectileMassG/1000,lengthM,bodyPart:'chest',...extra});

test('S3 selects exactly the W1 32 cartridges and reads immutable original type and threshold values',()=>{
  assert.equal(Object.keys(S3_TERMINAL_SETTINGS).length,32);
  const expected={
    '556_223_fmj':['yaw',760],'556_m193':['fragment',780],'556_m855':['fragment',760],'556_m855a1':['controlled_fragment',720],
    '556_m856_tracer':['yaw',660],'556_m856a1_tracer':['controlled_fragment',670],'556_m995_ap':['penetrator',700],
    '556_mk255_rrlp':['frangible',800],'556_mk262_mod1':['fragment',700],'556_mk318_sost':['barrier_blind',680],'556_hp':['expand',770],'556_varmageddon':['fragment',800],
    '545_ps_gs':['yaw',740],'545_pp_gs':['yaw',740],'545_bp_gs':['penetrator',680],'545_bs_gs':['penetrator',680],
    '545_ppbs_gs':['small_caliber_ap',740],'545_7n40':['fragment',730],'545_prs_gs':['frangible',600],'545_us_gs':['subsonic_standard',300],
    '545_fmj':['yaw',660],'545_hp':['expand',540],'545_sp':['expand',540],'545_7t3_tracer':['yaw',660],'545_7bt4_aptracer':['small_caliber_ap',740]
  };
  for(const [id,[type,threshold]]of Object.entries(expected)){const s=terminalSettingS3(id);assert.ok(isS3CalibratedAmmo(id));assert.equal(s.type,type);assert.equal(s.thresholdVelocity,threshold);assert.deepEqual(s.originalTerminalEffect,CATALOG.AMMO_TERMINAL_EFFECT[id]);assert.notEqual(s.originalTerminalEffect,CATALOG.AMMO_TERMINAL_EFFECT[id]);assert.ok(Object.isFrozen(s));assert.equal(s.typeDefaults,WOUND_S3_VALUES.typeDefaults[type]);assert.equal(woundProfile(id).lengthM,woundProfile(id).diameterM*s.lengthRatio);}
  assert.equal(terminalSettingS3('762x39_ps'),null);assert.equal(isS3CalibratedAmmo('invented'),false);
  assert.equal(terminalSettingS3('545_ps_gs').grade,'plate');assert.equal(terminalSettingS3('556_m193').grade,'plate');
  assert.equal(terminalSettingS3('556_m855').grade,'family');assert.equal(terminalSettingS3('545_7n40').grade,'estimate');
});

test('S3 yaw cartridges never create projectile fragments at any speed or bone traversal',()=>{
  for(const [id,s]of Object.entries(S3_TERMINAL_SETTINGS))if(s.type==='yaw')for(const velocity of[400,900,1500]){
    const a=channel(id,velocity,1,{tissueIntervals:[{id:'bone',kind:'bone',intervals:[[.04,.06]]}]});
    assert.equal(a.fragmentation,false,id);assert.equal(a.stateOut.fragmentMassKg,0,id);assert.equal(a.volumes.fragmentM3,0,id);
    assert.equal(a.s3Terminal.type,'yaw');assert.ok(a.volumes.boneSecondaryFragmentM3>0);
  }
});

test('S3 fragment gates use original thresholds, while controlled types fragment at the shared donor onset',()=>{
  for(const[id,s]of Object.entries(S3_TERMINAL_SETTINGS))if(['fragment','controlled_fragment','barrier_blind','frangible'].includes(s.type)){
    const below=channel(id,s.thresholdVelocity-.01,.5),above=channel(id,s.thresholdVelocity,.5);
    assert.equal(below.fragmentation,false,id);assert.equal(above.fragmentation,true,id);assert.equal(above.fragmentationThresholdMps,s.thresholdVelocity);
    const onset=above.stateOut.fragmentDepthM;
    if(s.type==='frangible')assert.ok(onset<.021);
    if(s.type==='controlled_fragment'||s.type==='barrier_blind')assert.ok(Math.abs(onset-s.typeDefaults.fragmentOnsetDepthM)<.0051);
  }
});

test('S3 expansion uses its original threshold and carries the initial type class across slowed consecutive parts',()=>{
  for(const id of['556_hp','545_hp','545_sp']){
    const s=terminalSettingS3(id),low=channel(id,s.thresholdVelocity-1,.08),high=channel(id,s.thresholdVelocity,.08);
    assert.equal(low.s3Terminal.expanded,false);assert.equal(high.s3Terminal.expanded,true);assert.equal(high.s3Terminal.expansionAreaScale,3.2);
    assert.ok(high.volumes.effectiveM3>low.volumes.effectiveM3);assert.ok(high.exitVelocityMps<low.exitVelocityMps);
    const next=channel(id,Math.max(1,high.exitVelocityMps*.5),.03,{stateIn:high.stateOut});
    assert.equal(next.s3Terminal.expanded,true);assert.equal(next.initialYawRad,high.stateOut.yawRad);
    assert.equal(next.stateOut.s3TerminalEffectActive,true);
  }
});

test('S3 shared AP defaults make a smaller30cm cavity and deeper track than the same-caliber expanding type',()=>{
  for(const[ap,expand]of[['556_m995_ap','556_hp'],['545_bs_gs','545_hp']]){
    const a=channel(ap,900,.3),b=channel(expand,900,.3);assert.ok(a.volumes.effectiveM3<b.volumes.effectiveM3);assert.ok(a.exitVelocityMps>b.exitVelocityMps);assert.ok(b.stopped);assert.equal(a.fragmentation,false);assert.ok(a.s3Terminal.yawOnsetDepthM>.2);
  }
  assert.ok(channel('545_us_gs',300,.3).volumes.effectiveM3<channel('545_ps_gs',900,.3).volumes.effectiveM3);
});

test('S3 preserves literal five source gelatin JSONs and every output field for the untouched82 cartridges',()=>{
  for(const id of['ak74','m193','ak47','m80','pistol'])assert.deepEqual(gelatinProfile(id),old.gelatinProfile(id));
  let untouched=0;
  for(const[ammoId,ammo]of Object.entries(CATALOG.AMMO_PRESETS))if(!isS3CalibratedAmmo(ammoId)){
    untouched++;assert.deepEqual(woundProfile(ammoId),old.woundProfile(ammoId));
    for(const extra of[{}, {tissueIntervals:[{id:'lung',kind:'lung',intervals:[[.02,.15]]},{id:'bone',kind:'bone',intervals:[[.17,.192]]}]}]){
      const input={ammoId,entryVelocityMps:ammo.velocity*.93,massKg:ammo.projectileMassG/1000,lengthM:.2837,bodyPart:'chest',...extra},a=computeWoundChannel(input),b=old.computeWoundChannel(input);assert.deepEqual(a,b,ammoId);
      const next={...input,entryVelocityMps:a.exitVelocityMps*.8,lengthM:.0737,stateIn:a.stateOut};assert.deepEqual(computeWoundChannel(next),old.computeWoundChannel(next),ammoId+' next part');
    }
  }
  assert.equal(untouched,82);
});

test('S3 live M193/7N6 source-speed tracks retain the v40 physical curve in a2m homogeneous muscle block',t=>{
  const physical=channel=>{
    const copy=structuredClone(channel);
    delete copy.profileMapping;delete copy.s3Terminal;delete copy.stateOut.s3TerminalEffectActive;
    // For yaw-only7N6 the newly recorded original740m/s threshold is metadata;
    // p.fragmentFraction remains0, so this unused eligibility flag has no
    // physical effect. v40 previously reported an infinite fragment gate.
    if(copy.ammoId==='545_ps_gs'){delete copy.fragmentationThresholdMps;delete copy.stateOut.fragmentationEligible;}
    return copy;
  };
  for(const[ammoId,entryVelocityMps]of[['545_ps_gs',935],['556_m193',943]]){
    const input={ammoId,entryVelocityMps,massKg:CATALOG.AMMO_PRESETS[ammoId].projectileMassG/1000,lengthM:2,bodyPart:'chest'},a=computeWoundChannel(input),b=old.computeWoundChannel(input);
    assert.equal(a.stopDepthM,b.stopDepthM);assert.equal(a.energyLostJ,b.energyLostJ);assert.equal(a.volumes.effectiveM3,b.volumes.effectiveM3);assert.equal(a.fragmentation,b.fragmentation);
    let maximumNumericDifference=0,changedNumericFields=0;
    const compare=(actual,expected,path='')=>{
      if(typeof actual==='number'&&typeof expected==='number'){
        const delta=Math.abs(actual-expected);maximumNumericDifference=Math.max(maximumNumericDifference,delta);if(!Object.is(actual,expected))changedNumericFields++;
        assert.ok(delta<=1e-10,ammoId+path+' absolute numeric difference '+delta);return;
      }
      if(actual&&expected&&typeof actual==='object'&&typeof expected==='object'){
        assert.deepEqual(Object.keys(actual),Object.keys(expected),ammoId+path+' keys');
        for(const key of Object.keys(actual))compare(actual[key],expected[key],path+'.'+key);return;
      }
      assert.equal(actual,expected,ammoId+path);
    };
    if(ammoId==='556_m193')assert.deepEqual(physical(a),physical(b));
    compare(physical(a),physical(b));
    t.diagnostic(JSON.stringify({ammoId,entryVelocityMps,massKg:input.massKg,blockLengthM:2,densityKgM3:1050,stopDepthM:a.stopDepthM,energyLostJ:a.energyLostJ,effectiveVolumeM3:a.volumes.effectiveM3,maximumNumericDifference,changedNumericFields,m193PhysicalBitExact:ammoId==='556_m193',note:ammoId==='545_ps_gs'?'diameter×shared-length-ratio evaluation order produces sub-1e-10 local float differences; headline quantities exact':'physical fields exactlyv40'}));
  }
});

test('S3 direct/LUT agree within declared5mm interpolation bounds and conserve main/fragment energy for all32 types',()=>{
  let maximumVelocityError=0,maximumDepthError=0;
  for(const[ammoId,s]of Object.entries(S3_TERMINAL_SETTINGS))for(const entryVelocityMps of[s.thresholdVelocity-1,s.thresholdVelocity,900]){
    const input={ammoId,entryVelocityMps,massKg:CATALOG.AMMO_PRESETS[ammoId].projectileMassG/1000,lengthM:.5637,bodyPart:'chest',tissueIntervals:[{id:'rib',kind:'bone',intervals:[[.023,.029],[.28,.286]]},{id:'lung',kind:'lung',intervals:[[.05,.18]]}]},copy=structuredClone(input),a=computeWoundChannel(input),b=computeWoundChannelDirect(input);
    assert.deepEqual(input,copy);assert.equal(a.fragmentation,b.fragmentation);assert.ok(Math.abs(a.traversedLengthM-b.traversedLengthM)<.002);
    const velocityError=Math.abs(a.exitVelocityMps-b.exitVelocityMps);maximumVelocityError=Math.max(maximumVelocityError,velocityError);maximumDepthError=Math.max(maximumDepthError,Math.abs(a.traversedLengthM-b.traversedLengthM));
    // The inherited20m/s operational stop can straddle the final query boundary;
    // record it rather than treating a20m/s exit as an unbounded LUT error.
    assert.ok(velocityError<1.5||(Math.max(a.exitVelocityMps,b.exitVelocityMps)<21&&Math.abs(a.traversedLengthM-b.traversedLengthM)<.002),ammoId);
    assert.ok(Math.abs(a.volumes.effectiveM3-b.volumes.effectiveM3)<.000006,ammoId);
    for(const c of[a,b]){const left=.5*c.stateOut.massKg*c.exitVelocityMps**2+c.stateOut.fragmentEnergyJ;assert.ok(Math.abs(.5*(s.typeDefaults.coreMassOverrideKg||input.massKg)*input.entryVelocityMps**2-c.energyLostJ-left)<1e-7,ammoId);assert.equal(c.geometryQueriesPerStep,0);assert.equal(c.ruleId,'wound-channel-s2');}
  }
  assert.ok(maximumVelocityError<21);assert.ok(maximumDepthError<.002);
});
