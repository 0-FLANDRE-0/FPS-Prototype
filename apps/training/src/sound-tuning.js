// v47 user-feedback tuning. Playback dB is independent of physical source SPL.
// These are game presentation values, not a hearing-damage prediction.
export const AUDIO_TUNING = Object.freeze({
 gunshotBoostDb:3,
 dosePer140DbImpulse:.00025,
 referenceImpulseS:.12,
 doseRecoveryS:18,
 hearingAttackS:.18,
 tinnitusOnsetLoss:.25,
 tinnitusFullLoss:.8,
 tinnitusMaxGain:.004,
 tinnitusAttackS:.25,
});
// v50 footwear/equipment audibility tuning; affects both teams symmetrically.
// Physical source increase is shared by AI. Playback boost is presentation only.
export const FOOTSTEP_AUDIO=Object.freeze({sourceBoostDb:6,playbackBoostDb:10,ownPlaybackBoostDb:6,playbackFloorDb:12,playbackFadeDb:12,sourceHeightM:.03,maxScreenHeightM:1.6,screenClearanceM:.04,screenLossScale:.65});
