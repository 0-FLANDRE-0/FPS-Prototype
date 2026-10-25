// S3b user-designed abdomen HP semantics, independent of original 2D medical.
// This is a game pain floor, not a measured clinical pain score.
export const MEDICAL_S3B_VALUES=Object.freeze({
  ruleId:'abdomen-hp-s3b',abdomenDestroyedPainFloor:95,
  abdomenDestroyedState:'abdomen_destroyed',structuralArrestParts:Object.freeze(['chest']),
  painClassification:'tuning: persistent Q5-a floor component; existing masking and stress/physiology formulas unchanged',
  directAbdomenCollapse:false,automatic2DPort:false,reversePortCandidate:true,
});
export const abdomenPainFloorS3b=m=>m.bodyParts.abdomen.hp<=0?MEDICAL_S3B_VALUES.abdomenDestroyedPainFloor:0;
