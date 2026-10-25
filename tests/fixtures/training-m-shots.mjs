// Existing v10/v11 aim points remain unchanged. Arm-first is additive.
export const M_SHOTS = [
 {name:'plate-stop',feet:[16.845,0],target:[17,1.335,-4],stop:true},
 {name:'plate-penetration-rear',feet:[16.845,0],target:[17,1.335,-4],ammoId:'556_m995_ap',maxShots:12,untilBody:'body_through_and_through'},
 {name:'soft-through-body-rear',feet:[16.845,0],target:[17,1.11,-4],untilBody:'body_through_and_through',maxShots:8},
 {name:'body-retained',feet:[19,-4.205],target:[17,1.11,-4.05],ammoId:'556_m193',untilBody:'retained',maxShots:8},
 {name:'front-neck',feet:[16.845,0],target:[17,1.51,-4],untilBody:'body_through_and_through'},
 {name:'bare-forearm',feet:[16.845,0],target:[17.445,1.10,-4],untilBody:'body_through_and_through'},
 {name:'exposed-eyes',feet:[16.845,0],target:[17,1.65,-4],untilBody:'body_through_and_through'},
 {name:'6b47-crown',feet:[16.845,0],target:[17,1.71,-4],helmet:true},
 {name:'6b47-side',feet:[19,-4.155],target:[17,1.71,-4],helmet:true},
 {name:'fixed-boot',feet:[16.845,0],shape:'left-foot',untilBody:'body_through_and_through'},
 {name:'arm-first-body',feet:[19,-4.205],target:[17,1.15,-3.9],ammoId:'556_m995_ap',maxShots:8,untilParts:true},
 // Historical pose is exercised through debug, without adding a production selector.
 {name:'crouch-plate-stop',feet:[16.845,0],pose:'crouch',shape:'chest',stop:true,debugOnly:true},
 {name:'crouch-boot',feet:[16.845,0],pose:'crouch',shape:'left-foot',untilBody:'body_through_and_through',debugOnly:true},
];
