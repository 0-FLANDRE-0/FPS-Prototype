import {SCAR_DATA,SCAR_MARKERS,SCAR_CONTACTS} from './scar-data.js';
import { ORIGINAL_TABLES } from './generated/catalog.js';
import { MARKERS } from './config.js';

// W2 source-backed differences only. The frozen original ak74 remains untouched.
const ak = ORIGINAL_TABLES.WEAPON_REGISTRY.ak74;
export const AK74M = Object.freeze({ ...ak, id: 'ak74m', display: { ...ak.display, name: 'AK-74M' },
  action: { ...ak.action, supportsFireModes: ['safe', 'full', 'semi'], burstCount: 0 },
  physical: { ...ak.physical, weightKg: 3.6, overallLengthM: .943 },
  provenance: { physical: 'https://azersilah.com/en/mehsul/8',
    selector: 'AK74/RPK74 manual, Voenizdat 1984 §117, https://ru.djvu.online/file/VdNjJdWnyUBdn',
    handling: 'unchanged original ak74', ammo: 'unchanged original 13 cartridges' } });
const scar=ORIGINAL_TABLES.WEAPON_REGISTRY.scar_h;
export const SCAR_H=Object.freeze({...scar,display:{...scar.display,name:SCAR_DATA.name},physical:{...scar.physical,weightKg:SCAR_DATA.weightKg,overallLengthM:SCAR_DATA.overallLengthM},action:{...scar.action,supportsFireModes:['safe','full','semi'],burstCount:0,rateOfFire:SCAR_DATA.rateOfFire}});
export const WEAPONS = Object.freeze({ ...ORIGINAL_TABLES.WEAPON_REGISTRY, ak74m: AK74M,scar_h:SCAR_H });
export const FIRE_MODES = Object.freeze({ m4a1: ['safe', 'full', 'semi'], ak74m: ['safe', 'full', 'semi'],scar_h:['safe','full','semi'] });
// Attachment coordinates are authored geometry measurements, not ballistic tuning.
export const M4_ATTACHMENTS = Object.freeze({ rightGrip: [.018, -.055, .23], leftGrip: [-.024, .013, -.04],
  magazineWell: [0, -.066, .004], boltCatch: [-.026, .046, .054] });
export const AK_MARKERS = Object.freeze({ muzzle: [-.00002, .0002, -.465841], breech: [.024, -.012, .095],
  sight: [-.00034, .04775, -.009243], frontSight: [-.000335, .046139, -.372982], grip: [0, -.08, .24] });
export const weaponMarkers = id => id === 'scar_h'?SCAR_MARKERS:id === 'ak74m' ? AK_MARKERS : MARKERS;
export const SWITCH_LOWER_S = .2; // W5 visual transition tuning; original Draw duration follows.
export const DRAW_S = .6483333706855774;
// Butt-pad contact markers measured on the supplied geometry. No recoil tuning.
export const STOCK_CONTACTS = Object.freeze({scar_h:SCAR_CONTACTS.stock,m4a1:[0,.015,.4592226147651673],ak74m:[0,-.01548502955837501,.47715866348918834]});

// Match the hip sight-line height to M4; fade to the calibrated native ADS pose.
// Display stance calibration only; logical muzzle/breech share this translation.
export const WEAPON_HIP_LIFT = Object.freeze({scar_h:0,m4a1:0,ak74m:MARKERS.frontSight[1]-AK_MARKERS.frontSight[1]});
