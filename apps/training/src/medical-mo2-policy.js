// MO2b: product capacities/efficiency are user design; hazard rates are fitted game tuning.
export const MO2=Object.freeze({ruleId:'medical-mo2b',bandageQ:20,bandageInitialBlock:.6,bandageRiseS:12,
 unwrapSeconds:2,unwrapRetainedBlock:.5,workPerAreaMm2:3,minimumComponentWork:2,oozeOpeningAreaFraction:.05,organOpeningAreaFraction:.05,
 recoveryHpPerS:3,recoveryMinimumHpPerS:.2,stopFlowMlS:.01,
 products:Object.freeze({bandage:{seconds:4,maximum:2,resource:'uses'},gauze:{seconds:6,maximum:250,efficiency:1,resource:'durability'},injector:{seconds:5,maximum:180,efficiency:1,resource:'durability'},foam:{seconds:7,maximum:350,efficiency:1,resource:'durability'},cat:{seconds:5,removeSeconds:2,maximum:1,resource:'uses'}}),
 movement:Object.freeze({walkSeepPerS:.0197756,walkReopenPerS:.003146,runSeepPerS:.0472758,runReopenPerS:.029072,seepSeconds:8,seepFlowMlS:.3,reopenFraction:.45}),
 tourniquet:Object.freeze({painStart:5,painMaximum:55,painRiseS:180,painFadeS:30,armTremorMaximumRad:.002,limpStartS:60,limpFullS:240,limpMaximum:.6,minimumMoveRate:.65}),
 classification:'사용자 설계값: 기준 유량 고정·비례 차단·내구도/효율·횟수·범위·회복 조건·제거 절반 재유출 / 수치: 튜닝·게임 허용'});
export const GAUZE_KINDS=Object.freeze(['gauze','injector','foam']);
// Temporary constants: former realistic values, pending each later rewrite.
export const TEMPORARY_CARE=Object.freeze({classification:'임시 고정 — 해당 단계에서 재작성',
 durations:{seal:6,needle:8,txa:8,pill:4,otfc:2,ketamine:5,blood:20,npa:0},
 maximum:{seal:2,needle:2,txa:1,pill:1,otfc:1,ketamine:1,blood:1,npa:1},
 backSealMultiplier:1.8,backpackSeconds:2,gearSeconds:1.2,searchSeconds:3,plateSeconds:{worn:5,off:3},
 needleRadius:.065,needleDrainPerS:.35,ventDrainPerS:.015,iatrogenicPneumo:.12,txaWindowS:10800,txaDelay:30,txa:.75,txaArtery:1});
export const productRule=id=>MO2.products[id]||{seconds:TEMPORARY_CARE.durations[id]||0,maximum:TEMPORARY_CARE.maximum[id]||1,resource:'uses'};
