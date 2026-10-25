import{M_SHOTS}from'./training-m-shots.mjs';
// Additive fixture only: existing 13 M fixtures are unchanged. Aim point is
// normalized model geometry in metres, not a new physiology constant.
export const P_SHOTS=['bare-forearm','front-neck','soft-through-body-rear'].map(name=>M_SHOTS.find(f=>f.name===name)).concat([
 {name:'bare-upper-thigh',feet:[16.845,0],target:[17.17,.805,-4],untilBody:'body_through_and_through',maxShots:1,pose:'rest'},
 M_SHOTS.find(f=>f.name==='arm-first-body')]);
