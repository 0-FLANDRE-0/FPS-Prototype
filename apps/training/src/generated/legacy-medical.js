// 3D-owned CQB medical port. MO3 removes pulmonary sequelae/care and unifies bleeding.
// LEGACY_MEDICAL_SOURCES retains extraction provenance, not current-file identity.
import {drugSympathetic} from '../medical-care-drugs.js';
import {preloadTargetR2,circulatingReserveR2} from '../medical-r2.js';
export const LEGACY_MEDICAL_SOURCES=[{"path":"src/runtime/scale.js","sha256":"0eb26687262cda2130bfbfbd71b209d16c9479ac0e7b97929eff1804c8e91cb5","declarations":[{"name":"PX_PER_M","sha256":"90050c7adb2f8a2f5e1eb357ab53823161ddc4cb5bf5ae833abe12dc7b74b339"},{"name":"mToPx","sha256":"1e786103cb841c619436dea101df331eae5a8134b8fd912940ee5633d5d37a95"}]},{"path":"src/data/equipment-base.js","sha256":"f4cf721776f3582a20cb666a9ea1a49b5ce06d8e75f040bada9dce2717a2d906","declarations":[{"name":"getMaterialBluntRatio","sha256":"519afd95c08ebdaf33353e4df2e2e7fc69bca9657be0d8b8ef921b9fe3d693e6"}]},{"path":"src/combat/visor-accessories.js","sha256":"57c75c506ad67c364b8191fcfecb9c2e96807dd7e469adcc5b2ce18a9a3f25ff","declarations":[{"name":"initUnitVisorState","sha256":"de25fac58b1233261b8996b0b1512d9628e76ccc39e634a87c84c869c818160d"}]},{"path":"src/combat/armor-durability.js","sha256":"432d05492fc34b41ac90b6a8a2eb6810583f9c3df21567d99f50a03305d1a853","declarations":[{"name":"getSubsonicClass","sha256":"3ab27999de3f3557f574a90f3b2faa4586166721b58b8ee808e5951cd4dbfbb3"},{"name":"_apLikeFromBehavior","sha256":"437cb3e19bb7214f29796cb009709c512981c2e3fdd46f67ebb6e95051567cb9"},{"name":"_isBarrierBlindBehavior","sha256":"d9005e01b5589bfbf293d04052cd58de7d591104b10ac4ef1f30361f768b6c50"},{"name":"getCanonicalProjectileMassG","sha256":"52446e6d105f26457508cb17468867b5d7efad3c6b5b9ae2ebc7a0696c389dd7"},{"name":"getCanonicalProjectileProfile","sha256":"3ad9113ea7303857d0d6273548a897de825b398826986af968349392439b4506"},{"name":"getArmorThreatClass","sha256":"e214ea7e2a7b0e783a59dd56c75f275366c8890bdc49afcc10fbf3e4ce9748d0"},{"name":"computeProjectileKinetics","sha256":"16051deb48a977638e195106939f0a9ed26d304bbdc677cd2c902e08a7aa99b1"}]},{"path":"src/data/ammunition-legacy.js","sha256":"0a7298e8fa5cd021e40edc67bffffcc736ee1c0ce7ca7284c19405dd7f60156f","declarations":[{"name":"getSkillPreset","sha256":"0e8c1651a6623a4ee0e5cf5ba2d7d48b93bfd93bad4b5603a9dc50ce2b10c419"},{"name":"getUnitComposureProfile","sha256":"89580d938bb525f5edc330460cba94e1c23655b59cc50c82839300d4d52579e2"}]},{"path":"src/data/weapons.js","sha256":"957117d7b0fc84ece2b02813e4d0dcc23b8cb7d65e8abeb590a4a529c80a6569","declarations":[{"name":"_resolveLoadoutWeaponId","sha256":"a6d76f3f7d02e349da1cb81082bdf822310848f2a8c3e69520e07f4d29355413"},{"name":"getWeaponPhysicalProfile","sha256":"6bebb368243f9858ebdda9df3343be7fb59d5492d67eb0fe03bd40055bf89640"},{"name":"getWeaponPresets","sha256":"e75e6ad14a6d0f8b88c5dcd160ea6e03cfdb504bc705457dd9cc058cccd4e966"},{"name":"getDefaultWeaponPresetId","sha256":"2eb73f8434c2f97a400e5a0141b2d22fc158b835e357b3d94e2013e37417b93e"},{"name":"applyWeaponPresetToBuild","sha256":"e2482a728bd34e1ac18e20933ceaa492268da1a0ede5aa8b39ee4087f944ba0e"},{"name":"createDefaultWeaponBuild","sha256":"34860e33f0a341f206d0e91e2dd349d98487e70e9e15b299f0865ff44e2157c7"},{"name":"DEFAULT_SECONDARY_WEAPON_ID","sha256":"c07f72bbc73accad760c9047cc0315cc9519830bd3b0e39887b2c1eb44efc131"},{"name":"migrateTeamLoadout","sha256":"eeaf768e1c741e57f8a3556b0e2d23117d86ae63213d01f5e78ff4fabadd91c5"},{"name":"getAllowedAmmoForWeapon","sha256":"35fbd4bd35cb42b1f647254061bfd287c401b7847e4992518e199633a4ced784"},{"name":"sanitizeWeaponAmmoSelection","sha256":"ad945de749091c4cf8516aac6eee2aad11f857b8bfd91aec6b35d5e4225ffef2"},{"name":"initializeWeaponStateFromLoadout","sha256":"6044eb067a0b6e622b978cea2932d625ea1c5289184619e99fb6ef8a5abb6ca8"},{"name":"getActiveWeaponId","sha256":"ab056c337086990eb5d4b4f9be8180034bb29b4244a666b0780a3fada686b20a"},{"name":"getActiveAmmoId","sha256":"b182a48a1ead2d682a6f3945476b3a35f42066319ebc341f30395bc74b34fdf8"},{"name":"getActiveMagAmmo","sha256":"1f02558d15aecb720855420783fdc6bb0587d21dd64daa43db000f20c640e68d"},{"name":"getActiveReserveAmmo","sha256":"9b7d605e7ffaf82d98b2ec02524be194147c8f3ddcec7e95b3c3faa5987c4ce0"},{"name":"syncLegacyWeaponFieldsFromActiveSlot","sha256":"464a1f5121414b06d42ebd680990651132d33139b84454699cde84f49ba55170"}]},{"path":"src/combat/hit-tables-injuries.js","sha256":"0e362a5aa0f335c5121b646a637ba3517ab19fb80a8d5f2da84da10ba12f98e1","declarations":[{"name":"OUTCOME","sha256":"5a440db807fce7415c9bfbcec0cbc63b5631f55b9fc793fd35318db26b592de9"},{"name":"BODY_PART_KOR","sha256":"2e1bb54e6b293108e477fc00439e372d26a83aba6a14ee9d34fffa765834dabd"},{"name":"locationToBodyPart","sha256":"b9322d5552322b8c8b5aafed30e4fa7cf60e770b6ec8a42f23f0733b2436e9bc"},{"name":"SEVERITY","sha256":"d58e2517d94a24412875e1e34d84f9b91aa293e4912303f5e1504ee48e68b504"},{"name":"outcomeToSeverity","sha256":"ff2222f241f0aa598af9ca5412a182457ff617d8f4e448b8f88ad73e7d0dfd6f"},{"name":"severityToBodyDamage","sha256":"5669ad30f86cdcad5e40d9ac2c4ff86d2dbcb88d09c9e08f81c2e6b148e36a55"},{"name":"BODY_HP_BLEED","sha256":"7889c92bcd38abd8c712d7117b25825d31721d63005b7d0e8c64816bd5b2d7d0"},{"name":"updateCombatState","sha256":"c43e0c2ccdfc1124e256049fa81dd3979fb7e6f4e19631e7e61444e01b5936b5"},{"name":"getEquipmentWeightKg","sha256":"95474071ac840d7baed380dca98cbf94234d30e74b609ef7a42fdd6f7a5d4fd7"},{"name":"getLoadClass","sha256":"d85642372f36f6558d5d90c629cec2faf8dd38340ad2c2fdb090375c53593685"},{"name":"updateUnitWeight","sha256":"3964511c6baf0ca2a09fd9e5b3269bc8b3e90aae3ab19b76029b8d8d9f940b7a"},{"name":"applyStopping","sha256":"829936ec969f9da57fa9f12694a5ade7f998a909c24a12c7fd173f1d2d5ed06a"},{"name":"addPain","sha256":"d3115b281c11f94e94822e1c110386ac0218a9b79e8cde20b5e415e1e196672d"}]},{"path":"src/combat/armor-resolution.js","sha256":"f5a4dc104a6c5d6b434a687030a3280e1dc875a4350268969f609c7271a385f7","declarations":[{"name":"_sabotInfo","sha256":"05affc5a0a82118f398480baf6720078cd8657418740e1f9c8744e0e61e2ea3e"},{"name":"AMMO_MEDICAL_DEFAULTS","sha256":"fdc0f5569db45d750b81d4d04f0a26834df72c47c8cabe890b32492b90e0b6ba"},{"name":"getAmmoMedicalProfile","sha256":"517bf116a54b5895f87e969e301a2c6a8ff2f54a16839a5a389f5693a05ab38e"}]},{"path":"src/validation/presets-closures.js","sha256":"525770452b608b7c88ec9e38ab3186dfce905d6915339582fdac7023b37a479c","declarations":[{"name":"validatePartDestructionFoundation","sha256":"9ed03ad0cb235e968b9ce8b2a1279cfbcf155988b0b551a71dea3bacfaaa63e2"}]},{"path":"src/combat/damage-outcomes.js","sha256":"0b41791a21bd809630e12d9d339edbd6a8ac635008c0a515ddcaf545af2fd191","declarations":[{"name":"applyOutcome","sha256":"83b60980af21520a797032226f6d4904403437c7833c753548a7a12692d3881e"}]},{"path":"src/combat/ammo-reload.js","sha256":"dfc196742a43e62b35ce3e4a94d221ff86607239615a5edd9bfcf88b799115dc","declarations":[{"name":"DEFAULT_AMMO_PROFILE","sha256":"b08c5485e4034ea5de922a66c08d9b0bc84807ddd22ff175f7983d56b50f4421"},{"name":"getWeaponAmmoProfile","sha256":"bfa77e9cf0ef20ff24da5a9c7128ea5c60bcf981d7dcd78ed94508d2aa037962"},{"name":"initUnitAmmo","sha256":"dbb32774106b3bdae6d51282dbb3cfef98e25b492c55092deb9ff943761309a4"}]},{"path":"src/combat/impact-address.js","sha256":"3cb53d13f4175e78630dd3bffd1f5d67c8ca256ae70d03b496a9d1f0a6da2cc2","declarations":[{"name":"makeArmorAddressKey","sha256":"e2d1746699973c715b88b2cf68ecd250e57c42ccdfde39e9264ea018872b5a67"}]},{"path":"src/presentation/impact-labels.js","sha256":"65115edd5ee12001630b48ac829f6257f879e0749770b5e08c2a939d1072e8cc","declarations":[{"name":"IA_LABELS","sha256":"395a78880c4e94fadb957a7d61901dabd0023d703d07b4cfe3cf0a806f3e3332"}]},{"path":"src/combat/impact-resolution.js","sha256":"92b8c5eb1ab063523cf7092e4594d0cb6545110bc87c25dde4f7ff3cf2264d7f","declarations":[{"name":"aggregatePhysiologicEffectProfile","sha256":"530ee9a94833abe82373b7318c3015f3ebb7b51f92bdf8dca8166e459f180741"}]},{"path":"src/runtime/game-state.js","sha256":"d890509f8ba0dfb0b708ec61950756e57a35470b0a47d4feec1ccfa87b5282ee","declarations":[{"name":"nextUnitId","sha256":"f421122627fff01cddd7c35bd7d6feef9f084264ab1e9d166eb3da0d04fb39ca"}]},{"path":"src/medical/foundation.js","sha256":"05df9e2384bd84da793aeee331f14845ef024f4d29c80a86f0b0b3fd6a4bf39e","declarations":[{"name":"VIEW_ARC_FRIEND","sha256":"da75cd1ccef7fc165346a6a3f35e6c6ecfc2becf03dbf32d496e9aa702b37d33"},{"name":"FIRE_ARC_FRIEND","sha256":"f3ebea1e073ac61479c9163fa3550bcf4e769518cd919511f79132c7bb88e1ca"},{"name":"VIEW_ARC_ENEMY","sha256":"f599d2974ca6e4e798f8c6a6819607e0c62c29faa01087a273c61ee742534aea"},{"name":"FIRE_ARC_ENEMY","sha256":"dcf04b77e503acc5bb4e74eda98bfdd9aab56365041f263ae545859060ff12d4"},{"name":"SIGHT_RANGE_M","sha256":"83e898202ab48a6d22c8ec48471273195564b9911ef89e1e022adc1e2efe0437"},{"name":"SIGHT_RANGE","sha256":"c7c480c8e38df680b1c2eca4d9256f5abcdef8fcad554dd23305d3a2d5fee34c"},{"name":"BODY_PART_KEYS","sha256":"ad54a34a71297f6ca39e70e85652615866a167e9c7d58771e5d0a3fe273ece68"},{"name":"PART_DESTRUCTION_FUNCTIONAL_CAP","sha256":"e6fdaaf2cb4e402d34955b8136dd3ebd3fe018094db8711c3bf653330076410f"},{"name":"_LIMB_PART_KEYS","sha256":"b2998e3bab26f747ce9d67be17b90634504978ac21c2084d2b4714784e158392"},{"name":"makeDefaultPartDestruction","sha256":"4211764613f9f833b366a17b389a609d9d807845d0cc0377c14707251a567590"},{"name":"_makeAllPartDestruction","sha256":"7848dcd90a6d2d02d4ac031b0979cc3bfd46a703dd1d2404250b36fa422030a2"},{"name":"BODY_PART_MAX_HP","sha256":"54f9433fff72bc1f42897afa41c3a455be27bc76e85a73ce5200ab38425975b9"},{"name":"BODY_HP_TOTAL_MAX","sha256":"679c03a6031fc7487064ab3746d83c0997201950bd6917d372fd1ff7dd66051c"},{"name":"BLOOD_MAX","sha256":"47a9e9361af48171ff9bee1d382b5fee562daa77d75157e086dbb84aaa9acc27"},{"name":"createMedical","sha256":"71ed9d17eb9ee2feb712286756ac751c84869511144df4cd127f2f0c17e55c62"},{"name":"approachValue","sha256":"7a7f880330e84df29fff3ad144e624ad2a82bb3f5a75bace00f0977ca6a0ba33"},{"name":"decayExp","sha256":"4c79fcf20d0b5c1d65ad7edc8027f88690686e5669fc4a2aa21f1ace11c009d1"},{"name":"clamp01","sha256":"7d5f9d4c8896b8c14d340c72bd2b926c4f4474d03c0850de803f1613eaea6b5b"},{"name":"clampMed","sha256":"2fa87cbe4e69a1f525912deb769b7d6760094315334e950d71cbf356b5352ede"},{"name":"ensureMedicalExtensions","sha256":"c367899cb06adc92e2c98503dc6a9cf9bf2d647c96fbfb67c6abada2222a1ca1"},{"name":"ensureFieldStabilizationModel","sha256":"e2a988e9372ff55293dd0a264499683981180aaba11cc78d3c4ce8e876ae1938"},{"name":"_CANON_TO_STORAGE","sha256":"1241b298e12a20b5af84eb877c1cb30136dc73aeba43b5c2a83b95bc270f2d78"},{"name":"_STORAGE_TO_CANON","sha256":"ee110e558ba1a74686d8cac19b52de1d0a8952fefb5910c9ae4ad761b4c174c3"},{"name":"_partKeyWarn","sha256":"8990a019350ab703ac562bfe66f11b2c8907401003ed4919e4018be260703c5d"},{"name":"normalizeAnatomicalPartKey","sha256":"7f0acfef166309a1dbb7a26396f23f1eb5facbb929e9e9e12e1ec9ce511ca3a7"},{"name":"getMedicalBodyPart","sha256":"9a8e6c45158d9fae5c6cb7fbf8e369733b599e4d246ca18deb6b1bd3d1cd1f0f"},{"name":"resolveBodyPartKey","sha256":"387857e1c9572493b1470d5c70f69a9658a96ac37340ed0177c9942a66d58cf1"},{"name":"bleedRateForSeverity","sha256":"b999add373ef1e2a3a09ca6df5f069239505f52e85729877377465f9691c0153"}]},{"path":"src/medical/wound-metadata.js","sha256":"78c275b1fae05d0f56b04d60a680ce8460ee21d1e460a9d1bf6ce292b54542c1","declarations":[{"name":"_WOUND_ID_SEQ","sha256":"41b80a633c00282ccba734076a5eac2d6394c2a7456a8cb805c9838522a221f8"},{"name":"WOUND_SIZE_LABEL_KO","sha256":"ec2d4f1f0d3ac49936018d4fa911b2319a995fa49efb11c57c2f647d7db13acf"},{"name":"WOUND_TYPE_LABEL_KO","sha256":"da9defe7a39fb7cb7b2c6c1fa0c619b27984c57e07d2e0fff663aefe61a174c4"},{"name":"FIELD_CARE_LABEL_KO","sha256":"59abd2b2da97d9c8429e160a6553ecc20efe6ae48e6727eff7c8ac2da495f4ce"},{"name":"_JUNCTIONAL_HINT","sha256":"a922c447f75d60067a19cf3328790ab39b1ac64f09bfba218c62c5500722311a"},{"name":"_VESSEL_CRIT_HINT","sha256":"211249ce12b1c955392e0def39ada76f1922bbdb54eff71a077700186627e810"},{"name":"getMedicalProjectileMeta","sha256":"00ba639e6d02b5a235db347cf14ea4dade4a7f27d9b9853ff99a1fe3229927c0"},{"name":"_WOUND_CLASS_ORDER","sha256":"bebc64f8ea44e09f9f7476a2987cefdb58a9ce4cf507984af96b860636b7f0d9"},{"name":"clampWoundClass","sha256":"ab84bf9e0ff39930aecc2b43c5c3ccb7630cc7de19339903ebe1ae0bc909ef89"},{"name":"getShotgunPelletAcutePhysiologyMeta","sha256":"003976582aa4e59cf491ae706ceb844a5a61795b8cb1207864e6958a6a302231"},{"name":"_CALIBER_MM_TABLE","sha256":"6125933d1f6de9657e74da85e7689534569f8bac119c1020c610eeeeff8ed937"},{"name":"_caliberStringToMm","sha256":"f6e57d351b00fe5b8de45287c57b73525bf125c73d230a2924fc76a1776c72bb"},{"name":"getProjectileDiameterMm","sha256":"b771a26f7f13a5754cedc96e6af393bd3ef175816a36640f73adeb95bf9ffe63"},{"name":"_caliberMm","sha256":"343661f38880535e6b759430ae3fe9fbeeecc09a8880198901e6d7bd74183d12"},{"name":"_woundSizeClassFromScore","sha256":"deb729906232885394d790c0d88e0ead33c004da24e6e117c4b4cfa6b48c3db1"},{"name":"_zoneIsJunctional","sha256":"932c310608844c5caae1b7a6044fbb5c7cd8ada2e62771a53024430630f444b9"},{"name":"_zoneIsVesselCritical","sha256":"023a3024c82b749ddaf97190b58449bf012703a38e77c54534d0146a26fd5a46"},{"name":"_normalizeResidualThreat","sha256":"ab6cbd3fd37c095d38c9c1325975e82c41665cb065cac5be1442941453de1166"},{"name":"deriveWoundPenetrationState","sha256":"b5ae58190705a784048778567207d1b216eb1b700f9685d6ca66ae87ed3fb44c"},{"name":"classifyWoundType","sha256":"d53da1b9bd194ff67f6b05e8aa29f37b008744619baab04c11b73fe906d368ae"},{"name":"computeWoundSize","sha256":"0e482a1b0acb32d5c7de1d4c671c5bd6afa335c9e8e37e317856e09af9c5605c"},{"name":"computeBleedingProfile","sha256":"caeeb66465dbe4e6265e55e52082c8f272206f6642eca5031f04c1504ea9cec1"},{"name":"computeFieldCare","sha256":"7dee0095bc6acc6a53212f5f381d120324ff5c2c35c3536e7c8fc9c5f4065466"},{"name":"computeTreatmentProfile","sha256":"a1d0eb0e6cb3a0ae60deb43cf205f1ebbaf1703530e7aedbd9d2b8a9a4f017d9"},{"name":"_woundShouldBleed","sha256":"24350dda479112bdf57e144d6cfaf74015a46810bf02af6834054a7057749616"}]},{"path":"src/medical/body-trauma.js","sha256":"1fb2bfa93ce9328ad2d46fe3c309f4120e43e1aa024393541124a94c620dbcf1","declarations":[{"name":"BODY_RESISTANCE","sha256":"ba4e0d68c807dd8ffb49fd67dade491d2a3e7646c4f9bac87632dabbab329be3"},{"name":"_projectileSizeClass","sha256":"b890169cf83cd96ea35d5a60db1c928cd4643b8430cd6003eb8b8351781aebb7"},{"name":"_PROJ_SIZE_MODS","sha256":"908f99db6b058e386168df14f536972b997e184440780d3afa2c691ab411024e"},{"name":"_bodyTerminalMods","sha256":"863b7a5d7a63c83928bfc485708cd7687d59ea2be1e45f4ac4736830c72205ba"},{"name":"normalizeMedicalImpactAddress","sha256":"e1f2bb69a62b7acad04c503bc292c0ebfea728f9050c6dd73c8aed67f9613604"},{"name":"classifyBleedingClass","sha256":"1e2d2f8b8fe11df723f0bc7e9963e5c8c3534b01446ac99717db55e8553584c5"},{"name":"buildOrganVesselCandidateMap","sha256":"7b0c6ae3a290a8a8e495b9a9ba9311bea3b011ddc7f97228921121ab3b8db1cb"},{"name":"_finishMap","sha256":"d7f08c2f7a28e38873f0bf40fe9e27c0d13044cfe409aa76fd1a1b10c0cdaccf"},{"name":"_deriveTreatmentIndicationTags","sha256":"2f224161555440817fd08fce523b2dedd198d8b98d9db000c42795fb6f81acae"},{"name":"buildInternalBleedingModel","sha256":"cbf3398428acabc85c08ff7fe715249eb0367281e7172d33cf7cd43a4bdff771"},{"name":"buildChestTraumaModel","sha256":"a0ebd5887312b764a5ca439f51fcee3330dc9de351c903fb29aeebafabeeec52"},{"name":"buildOpenTorsoModel","sha256":"f2b1638f96f98b83aa91a219e182a71c2daa4a43f968ef5cd4cdea105e3821a2"},{"name":"buildOrganInjuryModel","sha256":"06370b0cb4f765f59b0339e4c53c8d2f54a9b00d8ed4e840ffecdc0aa8d963c2"},{"name":"buildHemorrhageControlModel","sha256":"4b670e55466894dcd9bf87d8ba927e9a850283cc79cae999194bf17d898c53c6"},{"name":"buildBodyTrajectoryContext","sha256":"6473d0a09f051b3c2af02cc57d26183bf1969122b15f5c87b705f5a4aaa28269"},{"name":"_WOUND_DEPTH_KO","sha256":"8556fd4984885f9253b8321e0e04963be098afcd2f9f86f49ee9d9fcf7c1f861"},{"name":"_BLEED_CLASS_KO","sha256":"28eea072ccbe5b189581c004e8d5633f5e235dabbe2fcbdb2c5d8fadac66d91e"},{"name":"_REAR_RESULT_KO","sha256":"6a8b567aa4cb60ef86eec6ea86d9a9f2bd9d627f0f370d91fd5528be29661a6f"},{"name":"entryArmorSummaryLabel","sha256":"3b2d52819b7c29c298ccae73a63041af14f9689de3e02ecc27cc407900e2d8f9"},{"name":"rearArmorSummaryLabel","sha256":"cdaef33e4775ad66dc50e35ef469558b0ed9cc2bbd601e973825d4b5fa526430"},{"name":"continuationSummaryLabel","sha256":"1be7b4e6b2868209f97806472714616eae3dcaf9815cf454be6f08382179b85b"},{"name":"bodyTrajectorySummaryLabel","sha256":"1bddb924fbaca2717f86b5020e9a31d79c711a4bc015a9dd409b1997cbc5ed6a"}]},{"path":"src/medical/physiologic-injury.js","sha256":"788e21cee067bdfbdcc0bf6d3e86c35aa534d1e7dc87257df4d7f6e9f7cd951f","declarations":[{"name":"buildPhysiologicInjuryModel","sha256":"43d5f01b5d9369b7463701279a1431df88732bedd388c372facad14f6f0f9d5d"},{"name":"buildConfirmedInjuryModel","sha256":"da23dda381f952c2e9360a1fbc2b9aad4aba6ec082875cf4c4914f481ce14e08"},{"name":"_confirmedInjurySummary","sha256":"2289a8872e024bc233dabe14b5977bb6a22a6db3f3d3887190245c39218888a2"},{"name":"classifyInternalBleedingCategory","sha256":"e653ce9ba6b5e6771f691c27a82d6e0aaf31bc77ae39475bfb02d86f65a2f0e8"},{"name":"_VESSEL_NAMED_RE","sha256":"a08f0bd8af210014b8f3ffa641529f96111beca6801570f57251b2f5d9dd21ca"},{"name":"_VESSEL_MAJOR_RE","sha256":"4e83175ab014c75e4f3e8c0cbaa7c887e6c4f962764b74f9935c6e84ed2fedfe"},{"name":"buildVascularEvidence","sha256":"f5bf5c0b12b895b58db0ae549fe541acd741cb5627c172753b609d5cf9a3d683"},{"name":"_BONE_ZONE_MAP","sha256":"d4cd47e26a21f0f234e099350389c52ca5c0489a56cab915f2803c117f582b51"},{"name":"buildFractureEvidence","sha256":"0ff60577a9624c3e012d73d51116ec818a0115b68dd301cc0d5a3d9737aa287d"}]},{"path":"src/medical/part-destruction.js","sha256":"862699efbb5381ec299c15b822a874bd7fa3f7b2180c3dbabe08e4963c35349d","declarations":[{"name":"ensurePartDestructionModel","sha256":"8721f9019fdc60a3d90f02254b79ab1b7bf90fcf3ac5f95087557275f5ee4951"},{"name":"getPartDestruction","sha256":"300e3b0e4b6c75f608864f4f7ccf17ca90e5e2dd1057af08d27a55f8aab5bcf8"},{"name":"computePartDestructionContribution","sha256":"8dd8fb98177b5d1a14aa4691c1b65d94bd51d8bbf9fde4427b2b19e741b987cc"},{"name":"_shotgunDestructionContributionMul","sha256":"f8bdad86c552fafe621617f88818d4291da9a70d9a662254b15feba827c1dd35"},{"name":"_localClusterState","sha256":"46e2bf8d116addf79e43e3d7f1df04dba5552fff1a62ad9820fba632c1bf1eb0"},{"name":"reinforceVascularEvidenceWithPartDestruction","sha256":"d32a57ac7a3d7edb00c5d916914130601b288986d44f2281608cafccedf04f7d"},{"name":"updatePartDestructionFromWound","sha256":"c8cc8676ff5e1aac7e91903e077c41bdc492376217188dacd4a862a853fab251"},{"name":"PD_STATE_RANK_LIMB","sha256":"9d218c5864f41a2453ea28775a641bdfe76ba95941abd8cae29a20e3a1b385c8"},{"name":"PD_STATE_RANK_NON_LIMB","sha256":"2ad830372536f6065915a2fc9a8c33dc3f4e25c843970afffba816c7b5167601"},{"name":"PD_LIMB_ONLY_STATES","sha256":"adc00049463edd41a7534d91915d2c2d62710db976194b4cbb1f20d0313035d4"},{"name":"PD_NON_LIMB_ONLY_STATES","sha256":"ecc1eb4d2ec43148fb6d03c60d26349157d2763da28a238b2b72178aa8c1054e"},{"name":"PD_DISABLED_STATES","sha256":"e58ce012560e8fc7281174a2833339525faec3d15be933c491045c0f839c887b"},{"name":"PD_ALL_STATES","sha256":"a8c9201d6b7ef690d7012a15cc0d5b8da0a0067fcf2268a3e1f8b48a5bc7209e"},{"name":"getPartDestructionStateRank","sha256":"9431217d3580dda4d44b46c5060042dae8e0fcddb14343e4e941c6b4d51b0f80"},{"name":"PD_DISTAL_CLUSTER_RE","sha256":"482b69f95b0bcbe6846dcf73a355975366b6c3fd1054b64ca3db65fd3708316b"},{"name":"PD_PROXIMAL_CLUSTER_RE","sha256":"f74ad5c7e8e8a29e314c73cedd5558046935619e43cb0a4cbd66f63757c806dc"},{"name":"PD_FX_RANK","sha256":"74a3ffae54b33acbb198fe6a83f36d893b91c7a0758ae1b1b3ad27ffa3284252"},{"name":"_pdProjectileEvidenceClass","sha256":"caa35c46359d7c22054f43cb0b223aab0f1834eabdd775f4b90b88811ecc969a"},{"name":"buildPartDestructionEvidence","sha256":"a1fc5845701f2bf8d1888fcef283bec5d4f1d41f318116476d15bad3cd3a84fc"},{"name":"refreshPartDestructionState","sha256":"5c765eb10e897e8e8b336fa5c1571dcae3dcff220a55c986ab3ad5b34c270465"},{"name":"applyPartDestructionEffects","sha256":"3245e879c5b4873fe3e5ff2f4bf044173c7ed14e0de6e4b71299bc0098c51897"},{"name":"finalizeBleedingProfileWithEvidence","sha256":"aa0d2efafadf1e55b68e0930599b1c955076e922cfd73e4535ecb58547c071f3"}]},{"path":"src/medical/wound-clusters.js","sha256":"aa2707a2f73b7da8bd493de124b03ec03ead626525716b080e603c66dd209520","declarations":[{"name":"normalizeShotgunPelletGroupBleeding","sha256":"e0f37c453a56f183c7182c2c53201838f1718cffcd05f98239195aab4cb3a7b2"},{"name":"normalizeShotgunPelletGroupPhysiology","sha256":"f0bfe8790be81cee0bc02cf436218ec888e669a0047394e5f7cf3d4622e29326"},{"name":"buildWoundDescriptor","sha256":"e806213625877e4b68f151028cd618d15a4543d5f2e5a63cd42f4e4c0b99f544"},{"name":"normalizeWoundAddressCluster","sha256":"f79008c431b28c565f5954ee8be92feb1cb98fcd1e0741ff4720d29cf6ef8ac3"},{"name":"getWoundClusterKey","sha256":"d0f6bf854df5a52d1729a67e25116a7a4fe15407e9aec9a8c65f849c69453e33"},{"name":"computeWoundClusterTreatmentCost","sha256":"804abbc331ecd5dad30a4fb6cbd6442a6c1319fe8a5c5e97efb160f9d2961a60"},{"name":"refreshWoundCluster","sha256":"f4704defbb9c4e5a25c176e17f58783b2d6c475fe6b7a8bf84377f0d7dec9c29"},{"name":"assignWoundToTreatmentCluster","sha256":"7a88c03098d9c7dbd0257b199f18de3207a5ba3f309074959ce301d649d708a9"},{"name":"_woundPipelineError","sha256":"7913862bd60b4d42437699926300f958c0c190f426460ad6e78c7ff1bc9dc522"},{"name":"_markMedicalInconsistent","sha256":"99e512383d198dcf642d9dfc343c2c33fcea1f543faaedf0afe36ae21e11d3cd"},{"name":"validateWoundPipelineInvariants","sha256":"3475d88eed7b8d25b28f3f1390508738d1dbcf67dcd8cc6264637c69da91e198"}]},{"path":"src/medical/wound-pipeline.js","sha256":"0920d78065afae13245db2f34dc8cb296ea22bcb12e93cc5a0fed8294de60a09","declarations":[{"name":"applyFractureEvidenceToBodyPart","sha256":"0dac53be432e7184ae82883aaaf3a5ed99d4478484bfebcddf33fd38f0914dcb"},{"name":"processWoundEvent","sha256":"9dd63ec93466a09c50cbe807532ab4200d2e1c30cc1c6f9c9d3d84abf768d19e"},{"name":"recordWoundFromDamageEvent","sha256":"0dd0c1d3483b32a30fa6030944cf170bf97fd98063533060ab0cf0b6c80008b3"},{"name":"_pruneWoundsWithRemovedIds","sha256":"1ef34dbda41af6cabf0a0364e385f93d15578773227da9228542eba07bec5761"},{"name":"cleanupPrunedWoundReferences","sha256":"306b7267fa9702b12b10a47cb905725f722c358ce5a1607e5da39788549aef63"},{"name":"_bleedLabelKo","sha256":"81b743e4739fdf018544e6f14d7eca7c880edfcd037d96952c1d6f956d05dbc3"},{"name":"_treatLabelKo","sha256":"0a70e144e9dff41bee3c5e84721e9e39297ddf79c8f5593d097173cdaeaa054c"},{"name":"buildWoundUiLabels","sha256":"2d69b78df68bdebaba12f2d3b0036381556b6121323e761e5a3b0c49c560f2dc"},{"name":"woundLocationLabelKo","sha256":"5dc3e8ce1e8d0959a379ad19d5a5b7fcef834dee1771ff7e56d99f29c1de587d"},{"name":"_woundPartKo","sha256":"de3a51d893e0cfbc8b58d78d18d42f11c2ab0c6b8a26f78560feaaf45431cea2"},{"name":"_medicalPartToLegacy","sha256":"5d17a31b22c2722213f1eb47ca370ccf946c9829e54d389999f3ae724450cabc"},{"name":"ensureBodyPartTreatments","sha256":"c760667999461d2bc1ac23cdc91ec4f07588535aa7d11ac6ae5c18bb5dfbe2de"},{"name":"buildBleedingPulseModel","sha256":"e32468c90f622cd3b3c2006eaf567245511cda54c301a8bd7e9c12d1f62215b2"},{"name":"updateMedicalBleedingWoundBased","sha256":"dfae77a12b9dd28f60e75eb6f193a98da2b9012a19a25e81be51fe629315ab19"},{"name":"_woundUrgency","sha256":"505c8fd2979c4dd0bebacd5d7099e5aff88f3e8ec05804f912b6b453e84a01ed"},{"name":"getPartWounds","sha256":"0b9d17b3336601caf6ee80127a47f1f354187dae7eaea8309fafc38b8a74a031"},{"name":"_normalizeWoundAddressClusterKey","sha256":"adda4c28ffb7539eee7ce75558e90716621677a4f4fa75795ebcdde744c7b00d"},{"name":"_woundAddressClusterKey","sha256":"0cf30952df5e1ad659014666c1fd639ea50fa6a4751136819c6c6a1f43e7783e"},{"name":"_NORM_ADDR_KO","sha256":"1c3846acb56d9b49e8e2be0256fd39c2d44f756d9e1a2a78deb1f8b20639967a"},{"name":"_addressClusterKeyLabel","sha256":"dc4f59950c223aa8f1a37134ae0a349affc32949c0c80fe747555f67b8cc901a"},{"name":"getClusterWounds","sha256":"67eaaa2c8b8e29855da94e191a088d40ede9d995066b0e13a9a4a3fb50937a70"},{"name":"_clusterRepLabel","sha256":"1fda84aa25ffa1b8b52fcdae6b526af362e4bfae00f58a5e6719f7a2083a7b29"},{"name":"_clusterBleedSummary","sha256":"386c596be96a41700871b1f6d4e26818e3daeb9746a3c0bd40bd860f9fe9e13a"},{"name":"_clusterTreatSummary","sha256":"ee6cad0f36191d0b049b408cf1890894932f7adafd9bba6510d1f26f1550919c"},{"name":"_buildSingleRow","sha256":"50aa2845c64fb2d9a64093c4c31273e6678c301eb45005e2d980c3e0c83e41dc"},{"name":"_buildClusterRow","sha256":"db1db4d546dca553d5bcf75197530d6e3b9094a02b46fa3461f4b71ca97dc017"},{"name":"buildWoundDisplayRows","sha256":"4fb9f25720a044b5d21131b056ed4c1fd22f2cd75ba9fad88813b7af8131b3a8"},{"name":"validateWoundUiProjection","sha256":"aca0b50ea5cf901d1c6b0f398a8c00c83e60d0aa294a6b87129e566e8982336f"}]},{"path":"src/medical/damage-physiology.js","sha256":"d0fe232b3d3c724e038910f2036a13bf4da2c9fa3cf93bf0dedbd3e5057530f8","declarations":[{"name":"recomputeBodyPartFunctionRatio","sha256":"fc4ac235fc8685cebf90aeedea41729950d8ee141c992b3db7e68fccd9dcaa14"},{"name":"computeAcuteImpactResponse","sha256":"74521045d4e61fcf085001bcdf0dda830e40b1e434aae226dffb0200268fd45c"},{"name":"applyDamageEvent","sha256":"9880fb35ef2f5e576e28683063d24e37a12cba3acdd4b61f5f2f836707cd360f"},{"name":"tickMedical","sha256":"2f0d378a5112dac13ad6a044316b03c2822114ae856b4d2a6fa6a43e8c40506d"},{"name":"updateChestTrauma","sha256":"a79fa488547bc603ec4d51523e0499604311b283f43d2b1944441221eaef9a9c"},{"name":"getTcccCarePhase","sha256":"245e92f52edb02631f5b049ef0cd0e6020d2646b564aa75d413666cdd7a30f43"},{"name":"_woundIsPelvicRegion","sha256":"c72140db7d4e5f29a451004c86d22844eb1acc061110e975812019a3d38083e3"},{"name":"_woundIsJunctionalRegion","sha256":"d6f717008b1abf067d77c92287f81684a4f3309bb027c1dfe32ce90041b7243d"},{"name":"updateFieldStabilization","sha256":"75a44be37014ba2590b4872e9c9729089e362ef8f5027915040bf7f08de466fa"},{"name":"buildEvacuationModel","sha256":"e1685e00923e99d1368b1f843e46a63449f07b173f07db5a20debfc1fea76fb4"},{"name":"buildCardiacRhythmModel","sha256":"1917da308e332aa375bd4ae837d9bcb18e649b8f2584a74ec6fdb07e8435d5f7"},{"name":"buildPreCardiacRisk","sha256":"49639d37340c0aa2a15c5696fa933b3a5fddece3507be638514a045e6fde2496"},{"name":"buildTcccAssessment","sha256":"b7e009204d2bb81656863d56fda0502999716d08150954390f579e41e50add60"},{"name":"updateMedicalBleeding","sha256":"3c2d2abaa32a5d12f7968390e77c38e91112b774a0367c276affdb7f5f44b3c9"},{"name":"updateSystemicHypoxiaDamage","sha256":"5042fa2f09a9879e95cc95ba001f301a32b560add29eb327161b05f5bf356dd0"},{"name":"updateStressResponse","sha256":"450b13911d1ce8178a3db9d65254a255121f53b22daceeb20f9aa2c053870266"},{"name":"updateHormonalCompensation","sha256":"fbe2cc205d44ca9dc55574135c6014318dba31a743efa52e9bb0f8cb9f150024"},{"name":"updateHemodynamics","sha256":"fb8b082acc96d35ad46e79f67a0e50b9190136a9bea7c17901e2dff9e6cc4e6e"},{"name":"getHeartRateState","sha256":"92579629552ff7559c09fb0da92164ab4c8ce971896d13dab4ee2b645caf5224"},{"name":"updateVitalsFromHemodynamics","sha256":"8c08d954d0951e8dde38c02d022f2c22cc0d9068c309cec9d6fc97b34cb5ccec"},{"name":"updatePainShockConsciousness","sha256":"36e167796991bc2caf3a6bbf1a0cadd31cb17351120292467f2cae081be3dec2"},{"name":"updateMedicalPerformanceMultipliers","sha256":"b404e3d4359821839e165311346e0704827c8ef3b86873c849a76bc9ca12ba0a"},{"name":"recalcMedicalSummary","sha256":"3bf8297433521dcc4acad40d8692fba4b41f37fdd8402ddda73a259ca171a4d3"},{"name":"syncLegacyCombatState","sha256":"48fa16c9cb94842ce92bd53cf5deadd9b8c3772d9e030c8ec007a331d87eca22"}]},{"path":"src/runtime/unit-factory.js","sha256":"31c92390f82dc2f3097af4bc5a4b82f336f1bb72e69e77949e3f863bda30a297","declarations":[{"name":"makeUnit","sha256":"25865aab93afe48614b7a2e1d6f80397b6a2a8fbb0b935794cd39f2242def9bb"},{"name":"rebuildArmorDurability","sha256":"e8ee04cceffa60baf79df999aab586bacfe96b7b8166944f2a529d3c7804e953"}]},{"path":"src/ai/utility.js","sha256":"1e170b7a83bb756fc9a5a904969021da64da8d2526675e806633bb8271f5aa2b","declarations":[{"name":"TRAIT_ARCHETYPES","sha256":"5474e9a1caf60137491c1e2fdc682583a8ef6158e458bcf8b7a5a886d94a1fc3"},{"name":"_traitHash","sha256":"91d04c3b85c133d2fc32f5a8f39384fa17b1c376ba794e01c3a50f9229414ed4"},{"name":"rollTraits","sha256":"fb07427d4f5fb4c6739d6f76a049eddebef0c94bca23b68797406dbccc989f05"}]},{"path":"src/simulation/noise-projectile-effects.js","sha256":"0be04daa11cdd5be6d91cb0fa17910d9a3e32ce07535a637ab526975f8d82aea","declarations":[{"name":"_ammoBigBore","sha256":"a26fbab4b08144db757283b002a1c76de2f342e4097b601e3cb33cdb5c63469a"},{"name":"_ammoNotes","sha256":"3c0a127711349c9d53db380b155f57b2ebf3bd5b69ec3b965ea0a6b41f2c1d02"},{"name":"_noteHas","sha256":"639dee5a68293af49f467280a5815b49def5646140e444a69fe2da35ce0e7561"},{"name":"_incendiaryInfo","sha256":"d9be1cbed1b58be3deb98f51d9d41b53398cb568b6fd449fd4cee0261da75e18"},{"name":"BODY_HIT_DIRECTION_RESISTANCE_MUL","sha256":"11f0ef63319ea0bedca3fa2a503b3a37073a79147548e7ba8d7ffb2a3ef0c124"},{"name":"BODY_PART_RESISTANCE_TABLE","sha256":"c5b3890413652214da30ea9423450c2f8be3eacdecbdd22bcca7666d6f5796cb"}]},{"path":"src/medical/treatment.js","sha256":"94e3789e875911d2c5e2aa993be75b6c4ee5631b36144c7560e32028c42e30c0","declarations":[{"name":"MEDICAL_RESOURCE_DEFAULTS","sha256":"cabe5a1ddb53bd0efd8af900e84762b39142b7866d2edcd8e9a269c6d7cfb8ac"},{"name":"initMedicalResources","sha256":"4baece814d3aa1837f10e5bf99dad20f8719b23271f952f2a8c1860bc62f5a12"}]},{"path":"src/presentation/loadout.js","sha256":"5740173e3b0bbcdc2f2ee26c012474c0934fcb7d3889c3fc05037be146586e70","declarations":[{"name":"cloneLoadoutForOperator","sha256":"157bcbdaf6b7ea126d9ebda9176df57b1f1ad5de2d31d4b64398beae678a3332"}]}];
export const LEGACY_MEDICAL_CONTEXT_SOURCE={"path":"src/simulation/unit-update.js","sha256":"5bb3aa4ecc48760b30537c24f55c1a8312d134ab99249141fc170255a4cda645","before":["unit.suppression = Math.max(0, unit.suppression - dt * 9);","unit.pinned = unit.suppression >= 70;","if (unit.isDowned) unit.downedTime += dt;"],"after":["if (unit.stoppingTimer > 0) unit.stoppingTimer = Math.max(0, unit.stoppingTimer - dt);","if (unit.flashBlindTimer > 0) unit.flashBlindTimer = Math.max(0, unit.flashBlindTimer - dt);","if (unit.flashDeafTimer > 0) unit.flashDeafTimer = Math.max(0, unit.flashDeafTimer - dt);","if ((unit.impactKnockdownTimer || 0) > 0) {\n    unit.impactKnockdownTimer = Math.max(0, unit.impactKnockdownTimer - dt);\n    if (unit.medical) unit.medical.impactKnockdownTimer = unit.impactKnockdownTimer;   // alias 동기화\n    unit._knockdownStanceApplied = (unit.impactKnockdownTimer > 0);   // 종료 시 false → 정상 제어 복귀 신호\n  } else if (unit._knockdownStanceApplied) {\n    unit._knockdownStanceApplied = false;\n  }"],"statementSHA256":["dcdbc0769b10e8c7b85f337bfbd74d49893844786a3a689d9ff28bece88fea7c","1bc928182018d2e96242b178847931acdf88b0cf6b7ab2f634d46ba220c1ba25","9da8d2a90af2af5a5c2993b5b85c24f25bc029ada32d419bb71ffd8135a98cbf","ccd16f137211a09df54f63423006a90d6996d3b86be98b34d998b11622a6f044","8e2b7173103702a2da920864cb89265040b02ae9f44771ce1d5a00eaa0b76b3e","c1f5ab0a3969de44a10d4b7ae5241ddcd7d37b3e5b158b0f012b89cb42568eed","ea786c10b8014c6d66303aff2af83d0822873a53e2ccc55b2b29f2ef7cbb4bd3"]};
export function createLegacyMedical(catalog, random, rearArmorProjection) {
const Math=Object.create(globalThis.Math);Math.random=random;
const GAME={gameTime:0,debugBallistic:false,debugStrictPipeline:true};
const resolveRearArmorInteraction=rearArmorProjection;
const BODY_ARMOR_REGISTRY=catalog.BODY_ARMOR_REGISTRY;
const HELMET_REGISTRY=catalog.HELMET_REGISTRY;
const HELMET_ACCESSORY_REGISTRY=catalog.HELMET_ACCESSORY_REGISTRY;
const PLATE_REGISTRY=catalog.PLATE_REGISTRY;
const SUBSONIC_CLASS_REGISTRY=catalog.SUBSONIC_CLASS_REGISTRY;
const WEAPON_REGISTRY=catalog.WEAPON_REGISTRY;
const WEAPON_OPTIC_REGISTRY=catalog.WEAPON_OPTIC_REGISTRY;
const WEAPON_BARREL_REGISTRY=catalog.WEAPON_BARREL_REGISTRY;
const WEAPON_MUZZLE_REGISTRY=catalog.WEAPON_MUZZLE_REGISTRY;
const WEAPON_FOREGRIP_REGISTRY=catalog.WEAPON_FOREGRIP_REGISTRY;
const WEAPON_PRESET_REGISTRY=catalog.WEAPON_PRESET_REGISTRY;
const AMMO_REGISTRY=catalog.AMMO_REGISTRY;
const AMMO_PRESETS=catalog.AMMO_PRESETS;
const AMMO_VELOCITY=catalog.AMMO_VELOCITY;
const AMMO_ENERGY_CLASS=catalog.AMMO_ENERGY_CLASS;
const ARMOR_DAMAGE_PCT=catalog.ARMOR_DAMAGE_PCT;
const AMMO_MEDICAL=catalog.AMMO_MEDICAL;
const AMMO_TERMINAL_PROFILE=catalog.AMMO_TERMINAL_PROFILE;
const AMMO_TERMINAL_EFFECT=catalog.AMMO_TERMINAL_EFFECT;
const AMMO_DRAG_CLASS=catalog.AMMO_DRAG_CLASS;
const DRAG_RETENTION_PER_100M=catalog.DRAG_RETENTION_PER_100M;
const AMMO_LORE=catalog.AMMO_LORE;
const WEAPONS=catalog.WEAPONS;
const WEAPON_VELOCITY_MUL=catalog.WEAPON_VELOCITY_MUL;
const BODY_ARMOR_PRESETS=catalog.BODY_ARMOR_PRESETS;
const HELMET_PRESETS=catalog.HELMET_PRESETS;
const PROTECTION_ACCESSORY_PRESETS=catalog.PROTECTION_ACCESSORY_PRESETS;
const PLATE_PRESETS=catalog.PLATE_PRESETS;
const PLATE_MAX_DURABILITY=catalog.PLATE_MAX_DURABILITY;
const HELMET_MAX_DURABILITY=catalog.HELMET_MAX_DURABILITY;
const ACCESSORY_MAX_DURABILITY=catalog.ACCESSORY_MAX_DURABILITY;
const ARMOR_SOFT_MAX_DURABILITY=catalog.ARMOR_SOFT_MAX_DURABILITY;
const MATERIAL_PROPS=catalog.MATERIAL_PROPS;
const THROWABLE_PRESETS=catalog.THROWABLE_PRESETS;
const SKILL_PRESETS=catalog.SKILL_PRESETS;
const COMPOSURE_PROFILES=catalog.COMPOSURE_PROFILES;
const AMMO_REGISTRY_GROUPS=catalog.AMMO_REGISTRY_GROUPS;
const WEAPON_REGISTRY_GROUPS=catalog.WEAPON_REGISTRY_GROUPS;
const HELMET_REGISTRY_GROUPS=catalog.HELMET_REGISTRY_GROUPS;
const PLATE_REGISTRY_GROUPS=catalog.PLATE_REGISTRY_GROUPS;
const PX_PER_M = 32;
function mToPx(m)  { return m * PX_PER_M; }
function getMaterialBluntRatio(id) {
  return (MATERIAL_PROPS[id] && MATERIAL_PROPS[id].bluntRatio != null) ? MATERIAL_PROPS[id].bluntRatio : 0.55;
}
function initUnitVisorState(unit) {
  unit.visorState = null;
  if (!unit || !unit.visorId) return;
  const v = (typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined') ? PROTECTION_ACCESSORY_PRESETS[unit.visorId] : null;
  if (!v || v.isNone || v.accessoryType !== 'visor') return;
  const spec = v.visorDurabilitySpec || {};
  const hasGlass = (spec.glassMaxDurability != null) || !!v.visorHitTable || (v.material === 'pe');
  const glassMax = spec.glassMaxDurability != null ? spec.glassMaxDurability : (v.maxDurability || 22);   // SIDE-ARMOR-DURABILITY-REALISM-1 §17: visor glass 16~24
  const st = {
    visorId: unit.visorId,
    hasGlass: hasGlass,
    glassMaxDurability: glassMax,
    glassDurability: glassMax,
    glassCondition: 'clean',
    glassHit: false,
  };
  // K6-3 등 titanium faceplate 분리
  if (spec.facePlateMaxDurability != null || (v.visorHitTable && v.visorHitTable.some(z=>z.id==='titanium'))) {
    st.hasFacePlate = true;
    st.facePlateMaxDurability = spec.facePlateMaxDurability != null ? spec.facePlateMaxDurability : 42;
    st.facePlateDurability = st.facePlateMaxDurability;
    st.facePlateCondition = 'intact';
    st.facePlateHit = false;
  }
  unit.visorState = st;
}
function getSubsonicClass(ammo) {
  if (!ammo) return 'none';
  // 1) 인라인 명시 필드 (registry override / future-proof)
  const inline = ammo.subsonicClass || (ammo.projectile && ammo.projectile.subsonicClass);
  if (inline === 'none' || inline === 'pdw_light' || inline === 'standard' || inline === 'heavy' || inline === 'armor_piercing') return inline;
  // 2) exact-ID registry (canonical source-of-truth)
  const id = ammo.id || '';
  if (Object.prototype.hasOwnProperty.call(SUBSONIC_CLASS_REGISTRY, id)) return SUBSONIC_CLASS_REGISTRY[id];
  // 3) 미분류 — none (ID 정규식 추측 없음). subsonic이지만 미등록이면 안전하게 none.
  return 'none';
}
function _apLikeFromBehavior(beh) {
  if (!beh) return false;
  const b = String(beh);
  return b === 'penetrator' || b === 'penetrator_unstable' || b === 'pistol_penetrator'
      || b === 'slow_penetrator' || b === 'slow_penetrator_unstable' || b === 'slow_penetrator_high'
      || b === 'slow_large_penetrator' || b === 'large_penetrator'
      || b === 'precision' || b === 'precision_heavy'
      || /sabot/.test(b) || /_api\b|heiap|_ap\b/.test(b);
}
function _isBarrierBlindBehavior(beh) { return String(beh || '') === 'barrier_blind'; }
function getCanonicalProjectileMassG(ammo) {
  if (!ammo) return { massG: null, source: 'none' };
  if (ammo.projectile && typeof ammo.projectile.massG === 'number' && ammo.projectile.massG > 0) return { massG: ammo.projectile.massG, source: 'explicit_projectile' };
  if (typeof ammo.projectileMassG === 'number' && ammo.projectileMassG > 0) return { massG: ammo.projectileMassG, source: 'explicit_flat' };
  return { massG: null, source: 'missing' };
}
function getCanonicalProjectileProfile(ammo) {
  const fallbackReasons = [];
  if (!ammo) return { ammoId: null, massG: null, diameterMm: 7, energyClass: null, subsonicClass: 'none',
    armorThreatClass: 'pistol_fmj', terminalBehaviorClass: 'rifle_ball', apLike: false, fragmentingLike: false,
    expandingLike: false, heavySlow: false, physicalSource: 'none', classificationSource: 'none', fallbackUsed: true, fallbackReasons: ['no_ammo'] };
  const id = ammo.id || null;
  const beh = ammo.barrierBehavior || (ammo.armorInteraction && ammo.armorInteraction.barrierBehavior) || 'normal';
  const energyClass = ammo.energyClass || (ammo.energy && ammo.energy.class) || null;
  // physical
  const massR = getCanonicalProjectileMassG(ammo);
  if (massR.massG == null) fallbackReasons.push('mass_missing');
  const _diaExplicit = (ammo.projectile && ammo.projectile.diameterMm > 0) || ammo.projectileDiameterMm > 0
    || (ammo.projectile && ammo.projectile.effectiveDiameterMm > 0);
  const diameterMm = getProjectileDiameterMm(ammo);
  let physicalSource;
  if (_diaExplicit && massR.massG != null) physicalSource = 'explicit';
  else if (_caliberStringToMm(ammo.caliber) != null) { physicalSource = 'caliber_table'; if (!_diaExplicit) fallbackReasons.push('diameter_caliber_table'); }
  else { physicalSource = 'legacy_parser'; fallbackReasons.push('diameter_legacy_parser'); }
  // classification
  const subsonicClass = getSubsonicClass(ammo);
  const _subExplicit = !!(ammo.subsonicClass || (ammo.projectile && ammo.projectile.subsonicClass) || (id && Object.prototype.hasOwnProperty.call(SUBSONIC_CLASS_REGISTRY, id)));
  const classificationSource = _subExplicit ? 'registry' : ((energyClass === 'subsonic') ? 'inferred_subsonic' : 'non_subsonic');
  // [0.39.3] degraded fallback만 추적: subsonic인데 미분류 = 문제. non-subsonic의 none은 정상.
  const _degradedSubsonic = (energyClass === 'subsonic' && !_subExplicit);
  if (_degradedSubsonic) fallbackReasons.push('subsonic_unclassified');
  // terminal behavior class — subsonic 분류 우선, 그 외 behavior/energy 기반
  const isPellet = (ammo.pelletCount || 1) > 1;
  const isSlug = /slug/i.test(id || '') || /slug/i.test(String(ammo.caliber || ''));
  const fragmentingLike = (beh === 'fragment' || beh === 'fragment_heavy' || beh === 'frangible');
  const expandingLike = (beh === 'deform' || beh === 'deform_heavy');
  const apLike = _apLikeFromBehavior(beh) || subsonicClass === 'armor_piercing';
  const barrierBlind = _isBarrierBlindBehavior(beh);   // [0.39.4] barrier-blind는 AP와 독립 속성
  let terminalBehaviorClass;
  if (subsonicClass === 'pdw_light') terminalBehaviorClass = 'pdw_subsonic';
  else if (subsonicClass === 'standard') terminalBehaviorClass = 'subsonic_standard';
  else if (subsonicClass === 'armor_piercing') terminalBehaviorClass = 'subsonic_ap';
  else if (subsonicClass === 'heavy') terminalBehaviorClass = 'subsonic_heavy';
  else if (isPellet) terminalBehaviorClass = /flech/i.test(id || '') ? 'pellet' : 'pellet';
  else if (isSlug) terminalBehaviorClass = 'slug';
  else if (fragmentingLike) terminalBehaviorClass = 'fragmenting';
  else if (expandingLike) terminalBehaviorClass = 'expanding';
  else if (apLike) terminalBehaviorClass = 'rifle_ap';
  else if (barrierBlind) terminalBehaviorClass = expandingLike ? 'expanding' : 'rifle_ball';   // barrier-blind는 rifle_ap 아님
  else terminalBehaviorClass = 'rifle_ball';
  // heavy-slow: 오직 subsonicClass==='heavy'
  const heavySlow = (subsonicClass === 'heavy');
  // armor threat — 기존 canonical 로직 재사용 (이미 getSubsonicClass 반영됨)
  const armorThreatClass = getArmorThreatClass(ammo);
  return {
    ammoId: id, massG: massR.massG, diameterMm, energyClass, subsonicClass,
    armorThreatClass, terminalBehaviorClass, apLike, barrierBlind, fragmentingLike, expandingLike, heavySlow,
    physicalSource, classificationSource,
    // fallbackUsed는 "실제로 degraded된" 경로만: legacy parser diameter, mass 누락, subsonic 미분류.
    //   caliber 변환표(§3-1 우선순위 #3)는 정상 canonical source이므로 flag 아님 — reason에만 기록.
    fallbackUsed: (physicalSource === 'legacy_parser') || (massR.massG == null) || _degradedSubsonic,
    fallbackReasons,
  };
}
function getArmorThreatClass(ammo) {
  if (!ammo) return 'pistol_fmj';
  const id = (ammo.id || '').toLowerCase();
  const cal = (ammo.caliber || '').toLowerCase();
  const bb = ammo.barrierBehavior || 'normal';
  const pen = ammo.penetration || 0;
  // [0.39.2 Fix4] canonical 아음속 분류 — ID 정규식 오분류 교정 (pdw_light/AP가 subsonic_heavy로 새지 않게)
  const _subCls = getSubsonicClass(ammo);
  // [0.39.3 A-Closure] 아음속탄은 구경만으로 anti_material/high_power_ap가 되지 않는다(§5).
  //   실제 penetration + barrier behavior 기반 threat를 명시적으로 결정. (.338 UCW subsonic ≠ .338 AP threat)
  if (_subCls !== 'none') {
    const _apBeh = _apLikeFromBehavior(bb);
    if (_subCls === 'armor_piercing' || _apBeh) {
      // 아음속 AP — penetration 수준별 penetrator 등급 (anti_material은 실제 대물 관통력일 때만)
      if (pen >= 55) return 'high_power_ap';
      if (pen >= 40) return 'intermediate_penetrator';
      return 'pistol_penetrator';
    }
    // 아음속 heavy/standard/pdw_light — penetration 기반 (구경 무관)
    // [0.39.4] pdw_light은 pdw_penetrator(등록 class)로 — pdw_ball(미등록) 제거. PDW penetrator 성격 보존.
    if (_subCls === 'pdw_light') return 'pdw_penetrator';
    if (_subCls === 'standard') return (pen >= 30) ? 'small_rifle_fmj' : 'pistol_fmj';
    // heavy
    if (pen >= 42) return 'full_power_fmj';
    if (pen >= 30) return 'intermediate_fmj';
    return 'subsonic_heavy';
  }
  // SIDE-AMMO-KINETICS §7: sabot/slap/tungsten_ap 계열을 AP/penetrator로 명시 인식
  const apMark = /sabot|slap|tungsten_ap|sabot_penetrator|sabot_tungsten_ap/.test(bb) || /sabot|slap|tungsten_ap|m948|m903/.test(id);
  if ((ammo.pelletCount || 1) > 1) return /flech/.test(id) ? 'flechette' : 'shotgun_buck';
  if (/12ga|12 ga|20ga/.test(cal)) return 'shotgun_slug';
  if (/12\.7|14\.5|\.50|50bmg/.test(cal) || /^127x|^145x/.test(id)) return 'anti_material';
  if (/frangible/.test(bb) || /frangible|rip\b/.test(id)) return 'frangible';
  const isPistolCal = /9x19|9x18|9x21|45 ?acp|40 ?s&w|357|38 ?spe|10mm|5\.7x28|4\.6x30|22lr/.test(cal) || /^9mm|^45_|^40_|^357|^57x28|^46x30/.test(id);
  const isPDW = /5\.7x28|4\.6x30/.test(cal) || /57x28|46x30/.test(id);
  if (isPistolCal) {
    // [0.39.4] pdw_light은 pdw_penetrator(등록) 유지 — pdw_ball 제거, barrier_blind는 penetrator 아님
    if (_subCls === 'pdw_light') return 'pdw_penetrator';
    if (_subCls !== 'heavy' && /subsonic|147gr_sub/.test(id)) {
      // subsonic ID지만 heavy 미등록(standard/none) — subsonic_heavy 오분류 방지
      if (/penetrator/.test(bb)) return isPDW ? 'pdw_penetrator' : 'pistol_penetrator';
      if (/jhp|hollow|hst|gold_dot|rip/.test(id)) return 'pistol_jhp';
      return 'pistol_fmj';
    }
    if (/subsonic|147gr_sub/.test(id)) return 'subsonic_heavy';
    if (isPDW && /penetrator/.test(bb)) return 'pdw_penetrator';
    if (/penetrator/.test(bb) || /7n21|7n31|_ap\b/.test(id)) return 'pistol_penetrator';
    if (/jhp|hollow|hst|gold_dot|rip/.test(id)) return 'pistol_jhp';
    return 'pistol_fmj';
  }
  // [0.39.2 Fix4] 9x39 계열 — canonical AP 분류 우선 (pab9/bp_7n12가 subsonic_heavy로 새지 않게)
  if (/9x39/.test(cal) || /sp5|sp6/.test(id)) {
    if (_subCls === 'armor_piercing') return 'intermediate_penetrator';
    if (/sp6|ap/.test(id)) return 'intermediate_penetrator';
    return 'subsonic_heavy';   // sp5 등 heavy 아음속
  }
  const isSmall = /5\.56|5\.45|\.223/.test(cal) || /^556|^545|^223/.test(id);
  const isInter = /7\.62x39|300 ?blk/.test(cal) || /762x39|300blk/.test(id);
  const isFull = /7\.62x51|7\.62x54|\.308|\.30-06/.test(cal) || /762x51|762x54|^308/.test(id);
  const isHighAP = /\.338|lapua/.test(cal) || /^338/.test(id);
  const pene = /penetrator/.test(bb) || /m995|m993|7n39|7n24|m855a1|m61|b32|_ap\b|ap_/.test(id) || apMark;   // [0.39.4] barrier_blind 제외 (AP 아님)
  const frag = !pene && /m193|mk262|varmint|frag|sst/.test(id);
  // [0.39.4] barrier-blind 비AP탄은 높은 penetration(chamber pressure)만으로 high_power_ap/penetrator가 되지 않는다.
  const _bBlind = _isBarrierBlindBehavior(bb) && !pene && !apMark;
  if (isSmall) return pene ? 'small_rifle_penetrator' : (frag ? 'small_rifle_fragmenting' : 'small_rifle_fmj');
  if (isInter) return pene ? 'intermediate_penetrator' : 'intermediate_fmj';
  if (isFull) return pene ? 'full_power_penetrator' : 'full_power_fmj';
  if (isHighAP && !_bBlind) return 'high_power_ap';
  if (pen >= 60 && !_bBlind) return 'high_power_ap';
  if (pen >= 42) return (pene && !_bBlind) ? 'full_power_penetrator' : 'full_power_fmj';
  if (pen >= 30) return (pene && !_bBlind) ? 'small_rifle_penetrator' : 'small_rifle_fmj';
  return (pene && !_bBlind) ? 'pistol_penetrator' : 'pistol_fmj';
}
function computeProjectileKinetics(ammo, impactVelocityMps, initialVelocityMps) {
  const massG = (ammo && ammo.projectileMassG != null) ? ammo.projectileMassG
              : (ammo && ammo.projectile && ammo.projectile.massG != null ? ammo.projectile.massG : null);
  const projectileCount = (ammo && ammo.pelletCount) || 1;
  const massBasis = projectileCount > 1 ? 'per_projectile' : 'single_projectile';
  const iv0 = Math.max(0, impactVelocityMps || 0);
  const nv0 = Math.max(1, initialVelocityMps || iv0 || 1);
  if (massG == null || !(massG > 0)) {
    return { hasKinetics:false, massG:null, massKg:null, projectileCount, massBasis,
             impactVelocityMps:iv0, initialVelocityMps:nv0,
             velocityRatio: Math.max(0, Math.min(1.2, iv0 / nv0)),
             impactEnergyJ:null, initialEnergyJ:null, energyRatio:null,
             impactMomentumNs:null, initialMomentumNs:null, momentumRatio:null,
             totalImpactEnergyJ:null, totalImpactMomentumNs:null };
  }
  const massKg = massG / 1000;
  const impactEnergyJ = 0.5 * massKg * iv0 * iv0;
  const initialEnergyJ = 0.5 * massKg * nv0 * nv0;
  const impactMomentumNs = massKg * iv0;
  const initialMomentumNs = massKg * nv0;
  return {
    hasKinetics:true, massG, massKg, projectileCount, massBasis,
    impactVelocityMps:iv0, initialVelocityMps:nv0,
    velocityRatio: nv0 > 0 ? iv0 / nv0 : 1,
    impactEnergyJ: +impactEnergyJ.toFixed(2), initialEnergyJ: +initialEnergyJ.toFixed(2),
    energyRatio: initialEnergyJ > 0 ? +(impactEnergyJ / initialEnergyJ).toFixed(4) : 1,
    impactMomentumNs: +impactMomentumNs.toFixed(3), initialMomentumNs: +initialMomentumNs.toFixed(3),
    momentumRatio: initialMomentumNs > 0 ? +(impactMomentumNs / initialMomentumNs).toFixed(4) : 1,
    totalImpactEnergyJ: +(impactEnergyJ * projectileCount).toFixed(2),
    totalImpactMomentumNs: +(impactMomentumNs * projectileCount).toFixed(3),
  };
}
function getSkillPreset(id) {
  return SKILL_PRESETS[id] || SKILL_PRESETS.regular;
}
function getUnitComposureProfile(unit) {
  const id = (unit && unit.skill && (unit.skill.presetId || unit.skill.id)) || 'regular';
  return COMPOSURE_PROFILES[id] || COMPOSURE_PROFILES.regular;
}
function _resolveLoadoutWeaponId(id) {
  if (typeof WEAPONS !== 'undefined' && id && WEAPONS[id]) return id;
  // 테스트 총기 또는 미존재 → 실총 fallback (m4a1 우선, 없으면 mp5, 그래도 없으면 첫 실총)
  if (typeof WEAPONS !== 'undefined') {
    if (WEAPONS['m4a1']) return 'm4a1';
    if (WEAPONS['mp5']) return 'mp5';
    const first = Object.keys(WEAPONS)[0];
    if (first) return first;
  }
  return 'm4a1';
}
function getWeaponPhysicalProfile(weaponId) {
  const reg = WEAPON_REGISTRY[weaponId];
  const phys = (reg && reg.physical) || {};
  const grp = (reg && ((reg.ui && reg.ui.group) || (reg.display && reg.display.group))) || 'Rifle';
  const FB = {
    Secondary:{ weaponClass:'pistol', baseBodyLengthMm:200, defaultBarrelLengthMm:115, defaultMuzzleForwardAddMm:0, defaultMountable:false, baseNoise:1.0, baseMuzzleFlash:0.6 },
    PDW:{ weaponClass:'pdw', baseBodyLengthMm:430, defaultBarrelLengthMm:200, defaultMuzzleForwardAddMm:20, defaultMountable:true, baseNoise:1.0, baseMuzzleFlash:1.0 },
    SMG:{ weaponClass:'smg', baseBodyLengthMm:500, defaultBarrelLengthMm:225, defaultMuzzleForwardAddMm:0, defaultMountable:true, baseNoise:1.0, baseMuzzleFlash:0.9 },
    Rifle:{ weaponClass:'rifle', baseBodyLengthMm:460, defaultBarrelLengthMm:368, defaultMuzzleForwardAddMm:35, defaultMountable:true, baseNoise:1.0, baseMuzzleFlash:1.0 },
    DMR:{ weaponClass:'dmr', baseBodyLengthMm:560, defaultBarrelLengthMm:500, defaultMuzzleForwardAddMm:30, defaultMountable:true, baseNoise:1.2, baseMuzzleFlash:1.1 },
    LMG:{ weaponClass:'lmg', baseBodyLengthMm:640, defaultBarrelLengthMm:465, defaultMuzzleForwardAddMm:35, defaultMountable:true, baseNoise:1.3, baseMuzzleFlash:1.4 },
    Shotgun:{ weaponClass:'shotgun', baseBodyLengthMm:760, defaultBarrelLengthMm:470, defaultMuzzleForwardAddMm:0, defaultMountable:true, baseNoise:1.2, baseMuzzleFlash:1.3 },
  };
  const fb = FB[grp] || FB.Rifle;
  return {
    weaponClass: phys.weaponClass || fb.weaponClass,
    platformId: phys.platformId || ('generic_' + (phys.weaponClass || fb.weaponClass)),
    baseBodyLengthMm: phys.baseBodyLengthMm != null ? phys.baseBodyLengthMm : fb.baseBodyLengthMm,
    defaultBarrelLengthMm: phys.defaultBarrelLengthMm != null ? phys.defaultBarrelLengthMm : fb.defaultBarrelLengthMm,
    defaultMuzzleForwardAddMm: phys.defaultMuzzleForwardAddMm != null ? phys.defaultMuzzleForwardAddMm : fb.defaultMuzzleForwardAddMm,
    weightKg: phys.weightKg != null ? phys.weightKg : 3.0,
    defaultOpticId: phys.defaultOpticId || 'iron',
    defaultMountable: phys.defaultMountable != null ? phys.defaultMountable : fb.defaultMountable,
    baseNoise: phys.baseNoise != null ? phys.baseNoise : fb.baseNoise,
    baseMuzzleFlash: phys.baseMuzzleFlash != null ? phys.baseMuzzleFlash : fb.baseMuzzleFlash,
  };
}
function getWeaponPresets(weaponId) {
  return Object.keys(WEAPON_PRESET_REGISTRY).filter(id => WEAPON_PRESET_REGISTRY[id].weaponId === weaponId)
    .map(id => WEAPON_PRESET_REGISTRY[id]).sort((a, b) => (a.uiOrder || 0) - (b.uiOrder || 0));
}
function getDefaultWeaponPresetId(weaponId) { const ps = getWeaponPresets(weaponId); return ps.length ? ps[0].id : null; }
function applyWeaponPresetToBuild(build, presetId) {
  const preset = WEAPON_PRESET_REGISTRY[presetId];
  if (!preset) return build;
  const p = preset.parts || {};
  return Object.assign({}, build, {
    presetId, customModified: false,
    opticId: p.opticId != null ? p.opticId : build.opticId,
    barrelId: p.barrelId != null ? p.barrelId : build.barrelId,
    muzzleId: p.muzzleId != null ? p.muzzleId : build.muzzleId,
    foregripId: p.foregripId != null ? p.foregripId : build.foregripId,
    updatedAt: (typeof GAME !== 'undefined' && GAME.gameTime) || 0,
  });
}
function createDefaultWeaponBuild(weaponId) {
  const phys = getWeaponPhysicalProfile(weaponId);
  let build = { weaponId, platformId: phys.platformId, presetId: null, customModified: false,
    opticId: phys.defaultOpticId, barrelId: null, muzzleId: null, foregripId: null, buildName: null, updatedAt: 0 };
  const presetId = getDefaultWeaponPresetId(weaponId);
  if (presetId) build = applyWeaponPresetToBuild(build, presetId);
  return build;
}
const DEFAULT_SECONDARY_WEAPON_ID = 'glock17';
function migrateTeamLoadout(ld) {
  if (!ld) return ld;
  if (!ld.primaryWeaponId) ld.primaryWeaponId = ld.weaponId || 'm4a1';
  if (!ld.primaryAmmoId) ld.primaryAmmoId = ld.ammoId || (WEAPON_REGISTRY[ld.primaryWeaponId] && WEAPON_REGISTRY[ld.primaryWeaponId].ammo.defaultAmmoId);
  if (!ld.secondaryWeaponId) ld.secondaryWeaponId = DEFAULT_SECONDARY_WEAPON_ID;
  if (!ld.secondaryAmmoId) ld.secondaryAmmoId = (WEAPON_REGISTRY[ld.secondaryWeaponId] && WEAPON_REGISTRY[ld.secondaryWeaponId].ammo.defaultAmmoId);
  if (!ld.primaryBuild) ld.primaryBuild = createDefaultWeaponBuild(ld.primaryWeaponId);
  if (!ld.secondaryBuild) ld.secondaryBuild = createDefaultWeaponBuild(ld.secondaryWeaponId);
  // legacy 동기화 유지
  ld.weaponId = ld.primaryWeaponId; ld.ammoId = ld.primaryAmmoId;
  return ld;
}
function getAllowedAmmoForWeapon(weaponId) {
  const reg = WEAPON_REGISTRY[weaponId];
  return (reg && reg.ammo && reg.ammo.allowedAmmoIds) ? reg.ammo.allowedAmmoIds.slice() : [];
}
function sanitizeWeaponAmmoSelection(weaponId, ammoId) {
  const allowed = getAllowedAmmoForWeapon(weaponId);
  if (ammoId && allowed.indexOf(ammoId) >= 0) return ammoId;
  const reg = WEAPON_REGISTRY[weaponId];
  return (reg && reg.ammo && reg.ammo.defaultAmmoId) || (allowed[0] || null);
}
function initializeWeaponStateFromLoadout(unit, ld) {
  ld = migrateTeamLoadout(ld || {});
  // unit literal이 opts.weaponId/ammoId로 이미 설정했으면 그것을 primary로 존중 (per-unit override / 테스트)
  const pW = (unit.weaponId && WEAPON_REGISTRY[unit.weaponId]) ? unit.weaponId : ld.primaryWeaponId;
  const sW = ld.secondaryWeaponId;
  const pAmmoRaw = (unit.weaponId === ld.primaryWeaponId) ? (unit.ammoId || ld.primaryAmmoId) : (unit.ammoId || ld.primaryAmmoId);
  const pAmmo = sanitizeWeaponAmmoSelection(pW, pAmmoRaw);
  const sAmmo = sanitizeWeaponAmmoSelection(sW, ld.secondaryAmmoId);
  const pProf = (typeof getWeaponAmmoProfile === 'function') ? getWeaponAmmoProfile(WEAPONS[pW]) : { magazineSize: 30, reserveMags: 4 };
  const sProf = (typeof getWeaponAmmoProfile === 'function') ? getWeaponAmmoProfile(WEAPONS[sW]) : { magazineSize: 17, reserveMags: 3 };
  // build: loadout build가 해당 무기와 일치할 때만 사용, 아니면 기본 생성
  const pBuild = (ld.primaryBuild && ld.primaryBuild.weaponId === pW) ? Object.assign({}, ld.primaryBuild) : createDefaultWeaponBuild(pW);
  const sBuild = (ld.secondaryBuild && ld.secondaryBuild.weaponId === sW) ? Object.assign({}, ld.secondaryBuild) : createDefaultWeaponBuild(sW);
  unit.weaponState = {
    activeSlot: 'primary',
    primaryWeaponId: pW, secondaryWeaponId: sW,
    primaryAmmoId: pAmmo, secondaryAmmoId: sAmmo,
    primaryMagAmmo: pProf.magazineSize, primaryReserveAmmo: pProf.magazineSize * pProf.reserveMags,
    secondaryMagAmmo: sProf.magazineSize, secondaryReserveAmmo: sProf.magazineSize * sProf.reserveMags,
    primaryBuild: pBuild, secondaryBuild: sBuild,
    switching: false, switchTimer: 0, switchTarget: null,
    mounted: false, mountObjectId: null, mountArcCenter: null, mountArcLimit: 0, mountStartedAt: 0,
    obstructionState: 'clear',
    _stats: { switchCount: 0, mountedShots: 0, obstructInhibitedShots: 0 },
  };
  syncLegacyWeaponFieldsFromActiveSlot(unit);
}
function getActiveWeaponId(unit) { const ws = unit.weaponState; if (!ws) return unit.weaponId; return ws.activeSlot === 'secondary' ? ws.secondaryWeaponId : ws.primaryWeaponId; }
function getActiveAmmoId(unit) { const ws = unit.weaponState; if (!ws) return unit.ammoId; return ws.activeSlot === 'secondary' ? ws.secondaryAmmoId : ws.primaryAmmoId; }
function getActiveMagAmmo(unit) { const ws = unit.weaponState; if (!ws) return unit.magAmmo; return ws.activeSlot === 'secondary' ? ws.secondaryMagAmmo : ws.primaryMagAmmo; }
function getActiveReserveAmmo(unit) { const ws = unit.weaponState; if (!ws) return unit.reserveAmmo; return ws.activeSlot === 'secondary' ? ws.secondaryReserveAmmo : ws.primaryReserveAmmo; }
function syncLegacyWeaponFieldsFromActiveSlot(unit) {
  const ws = unit.weaponState; if (!ws) return;
  unit.weaponId = getActiveWeaponId(unit);
  unit.ammoId = getActiveAmmoId(unit);
  unit.magAmmo = getActiveMagAmmo(unit);
  unit.reserveAmmo = getActiveReserveAmmo(unit);
}
const OUTCOME = {
  MISS:'miss', NEAR:'near', BLOCK:'block',
  LIGHT:'light', SERIOUS:'serious', DOWN:'down', KILL:'kill'
};
const BODY_PART_KOR = { head:'머리', neck:'목', chest:'가슴', abdomen:'복부',
                        arms:'팔', legs:'다리',
                        left_arm:'왼팔', right_arm:'오른팔', left_leg:'왼다리', right_leg:'오른다리' };
function locationToBodyPart(loc) {
  if (loc === 'head_skull' || loc === 'head_temporal' || loc === 'head_face' || loc === 'neck') return 'head';
  if (loc === 'chest')    return 'chest';
  if (loc === 'abdomen')  return 'abdomen';
  if (loc === 'arms' || loc === 'left_arm' || loc === 'right_arm') return 'arms';
  if (loc === 'legs' || loc === 'left_leg' || loc === 'right_leg') return 'legs';
  return 'chest';
}
const SEVERITY = { GRAZE:'graze', LIGHT:'light', SERIOUS:'serious', CRITICAL:'critical' };
function outcomeToSeverity(outcome, bodyPart) {
  if (outcome === OUTCOME.MISS || outcome === OUTCOME.NEAR) return null;
  if (outcome === OUTCOME.BLOCK)   return SEVERITY.GRAZE;
  if (outcome === OUTCOME.LIGHT)   return SEVERITY.LIGHT;
  if (outcome === OUTCOME.SERIOUS) return SEVERITY.SERIOUS;
  // DOWN/KILL — 머리/가슴/복부에서는 치명, 팔/다리는 한 단계 낮춤
  if (outcome === OUTCOME.KILL) {
    if (bodyPart === 'arms' || bodyPart === 'legs') return SEVERITY.SERIOUS;
    return SEVERITY.CRITICAL;
  }
  if (outcome === OUTCOME.DOWN) {
    if (bodyPart === 'arms' || bodyPart === 'legs') return SEVERITY.SERIOUS;
    return SEVERITY.CRITICAL;
  }
  return SEVERITY.LIGHT;
}
function severityToBodyDamage(sev) {
  switch (sev) {
    case SEVERITY.GRAZE:    return 4;
    case SEVERITY.LIGHT:    return 14;
    case SEVERITY.SERIOUS:  return 38;
    case SEVERITY.CRITICAL: return 80;
  }
  return 0;
}
const BODY_HP_BLEED = {
  head: 1.20, chest: 1.10, abdomen: 0.85, arms: 0.30, legs: 0.40,
};
function updateCombatState(unit) {
  if (unit.isDead) return null;
  // === 새 medical system이 있으면 그쪽이 사망/다운 판정 ===
  //   syncLegacyCombatState가 unit.isDead/isDowned/combatState/conscious 모두 갱신함
  if (unit.medical) {
    const prev = unit.combatState;
    if (typeof recalcMedicalSummary === 'function') recalcMedicalSummary(unit);
    if (typeof syncLegacyCombatState === 'function') syncLegacyCombatState(unit);
    return (prev !== unit.combatState) ? unit.combatState : null;
  }
  // === Legacy fallback (medical 없는 유닛 — 예: 사격장 패시브) ===
  const prev = unit.combatState;
  let newState = prev;
  if (!unit.bodyHp) return null;
  if (unit.bodyHp.head <= 25 || unit.bodyHp.chest <= 25 || unit.hp <= 0) {
    newState = 'dead';
  } else if (unit.bodyHp.abdomen <= 25 || unit.hp <= 25) {
    newState = 'downed';
  } else if (unit.bodyHp.arms <= 30 || unit.bodyHp.legs <= 30 ||
             unit.bodyHp.chest <= 60 || unit.bodyHp.abdomen <= 60 ||
             unit.hp <= 60) {
    newState = 'wounded';
  }
  unit.combatState = newState;
  if (newState === 'dead') {
    unit.isDead = true; unit.isDowned = false; unit.conscious = false;
    unit.alive = false; unit.hp = 0; unit.canBeDragged = false;
    unit.shotQueue = null; unit.movePath = []; unit.aiIntent = 'none';
  } else if (newState === 'downed' && !unit.isDowned) {
    unit.isDowned = true; unit.canBeDragged = true; unit.downedTime = 0;
    const head = unit.bodyHp.head, chest = unit.bodyHp.chest, abd = unit.bodyHp.abdomen;
    const pain = unit.pain || 0;
    let unconsciousProb = 0.20;
    if (head <= 50)  unconsciousProb += 0.30;
    if (chest <= 50) unconsciousProb += 0.20;
    if (abd <= 30)   unconsciousProb += 0.15;
    if (pain >= 80)  unconsciousProb += 0.25;
    else if (pain >= 60) unconsciousProb += 0.10;
    unit.conscious = (Math.random() >= Math.min(0.90, unconsciousProb));
    unit.shotQueue = null; unit.movePath = []; unit.aiIntent = 'none';
    unit.stance = 'prone'; unit.alive = true;
  }
  return (prev !== newState) ? newState : null;
}
function getEquipmentWeightKg(unit) {
  let kg = 0;
  if (unit.weaponId    && WEAPONS[unit.weaponId])             kg += WEAPONS[unit.weaponId].weightKg || 0;
  if (unit.bodyArmorId && BODY_ARMOR_PRESETS[unit.bodyArmorId]) kg += BODY_ARMOR_PRESETS[unit.bodyArmorId].weightKg || 0;
  if (unit.helmetId    && HELMET_PRESETS[unit.helmetId])      kg += HELMET_PRESETS[unit.helmetId].weightKg || 0;
  if (unit.frontPlateId && typeof PLATE_PRESETS !== 'undefined' && PLATE_PRESETS[unit.frontPlateId])
    kg += PLATE_PRESETS[unit.frontPlateId].weightKg || 0;
  if (unit.backPlateId  && typeof PLATE_PRESETS !== 'undefined' && PLATE_PRESETS[unit.backPlateId])
    kg += PLATE_PRESETS[unit.backPlateId].weightKg || 0;
  if (unit.sidePlateId  && typeof PLATE_PRESETS !== 'undefined' && PLATE_PRESETS[unit.sidePlateId])
    kg += PLATE_PRESETS[unit.sidePlateId].weightKg || 0;
  // 추가 보호구 무게
  if (typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined') {
    for (const idKey of ['groinGuardId','shoulderGuardId','neckGuardId','visorId','slaapId']) {
      const id = unit[idKey];
      if (id && PROTECTION_ACCESSORY_PRESETS[id]) kg += PROTECTION_ACCESSORY_PRESETS[id].weightKg || 0;
    }
  }
  return kg;
}
function getLoadClass(kg) {
  if (kg < 8)  return 'light';
  if (kg < 13) return 'standard';
  if (kg < 18) return 'heavy';
  return 'overloaded';
}
function updateUnitWeight(unit) {
  unit.loadWeightKg = getEquipmentWeightKg(unit);
  unit.loadClass = getLoadClass(unit.loadWeightKg);
}
function applyStopping(target, stoppingPower, weapon, opts) {
  // [0.39.1 Fix1] medical 유닛은 acute response가 stopping/aim/shotQueue를 이미 적용 → 중복 방지 위해 skip.
  if (opts && opts.skipIfAcute) return { finalStop: 0, stoppedFire: !!target._lastStoppedFire, skipped: true };
  // stoppingPower의 의미: 1.0이 표준. 0.4~1.4 범위.
  // 적용량은 부위/관통/방호 결과에 따라 ctx에서 계수가 추가로 곱해진다.
  const sevMul = (opts && opts.severityMul) || 1.0;
  // 숙련도가 높으면 stopping에 덜 흔들림
  const reaction = (target.skill && target.skill.reaction) || 1.0;
  const stoppingResist = Math.max(0.6, reaction);
  const finalStop = stoppingPower * sevMul / stoppingResist;
  // stoppingTimer — 보통 0.15~0.6초
  const dur = Math.min(0.7, 0.15 + finalStop * 0.20);
  target.stoppingTimer = Math.max(target.stoppingTimer || 0, dur);
  // 진행 중인 사격 묶음 중단 — 강한 stopping이면 높은 확률로 끊음
  let stoppedFire = false;
  if (target.shotQueue) {
    const breakProb = Math.max(0, Math.min(0.95, finalStop * 0.7));
    if (Math.random() < breakProb) {
      target.shotQueue = null;
      stoppedFire = true;
    }
  }
  // aimTimer 감소 — 흔들림
  target.aimTimer = Math.max(0, (target.aimTimer || 0) - finalStop * 0.35);
  return { finalStop, stoppedFire };
}
function addPain(target, amount) {
  if (amount <= 0) return;
  // 진통 효과 게이지에 따라 pain 증가율 감소 (analgesia 0~85 → mul 1.0~0.30)
  if (target.painkillerActive && target.analgesiaLevel > 0) {
    const gainMul = Math.max(0.30, 1.0 - target.analgesiaLevel / 120);
    amount *= gainMul;
  }
  // medical 있으면 medical.pain에 적용 (단일 출처) — syncLegacyCombatState가 unit.pain 갱신
  if (target.medical) {
    target.medical.pain = Math.min(100, target.medical.pain + amount);
    // 즉시 sync
    target.pain = target.medical.pain;
  } else {
    target.pain = Math.min(100, (target.pain || 0) + amount);
  }
}
function _sabotInfo(ammo) {
  if (!ammo) return null;
  const beh = ammo.barrierBehavior || '';
  const notes = (ammo.ui && ammo.ui.notes) || ammo.notes || ammo._notes || [];
  const nh = (k) => Array.isArray(notes) && notes.indexOf(k) >= 0;
  const projSabot = ammo.projectile && (ammo.projectile.projectileType === 'sabot' || (ammo.projectile.sabot && ammo.projectile.sabot.enabled));
  const isSabot = beh === 'sabot_tungsten_ap' || beh === 'sabot_penetrator' || projSabot ||
                  nh('slap') || nh('sabot_ap') || nh('sabot_penetrator') || nh('cbj_subcaliber');
  if (!isSabot) return null;
  let subtype;
  if (beh === 'sabot_penetrator' || nh('cbj_subcaliber')) subtype = 'cbj_subcaliber';
  else if ((ammo.caliber && String(ammo.caliber).indexOf('12.7') >= 0) || (ammo.penetration || 0) >= 95) subtype = 'heavy_slap';
  else subtype = 'legacy_slap';
  const T = {
    legacy_slap:    { integrity:0.82, dragAfterSeparationMul:1.20, woundChannelMul:0.65, armorFocusMul:1.18, backerCatchPenaltyMul:0.70, backerEfficiencyMul:0.35, penetratorMassClass:'light' },
    heavy_slap:     { integrity:0.90, dragAfterSeparationMul:1.10, woundChannelMul:0.75, armorFocusMul:1.25, backerCatchPenaltyMul:0.58, backerEfficiencyMul:0.27, penetratorMassClass:'medium_light' },
    cbj_subcaliber: { integrity:0.72, dragAfterSeparationMul:0.98, woundChannelMul:0.65, armorFocusMul:1.15, backerCatchPenaltyMul:0.75, backerEfficiencyMul:0.42, penetratorMassClass:'medium_light' },
  }[subtype];
  return Object.assign({ subtype, enabled:true, penetratorMaterial:'tungsten', penetratorDiameterClass:'small' }, T);
}
const AMMO_MEDICAL_DEFAULTS = {
  bleedChance: 0.20, bleedSeverityMul: 1.00,
  fractureChance: 0.10, fractureSeverityMul: 1.00,
  shockChance: 0.10, bluntTraumaMul: 1.00, tissueDamageMul: 1.00,
};
function getAmmoMedicalProfile(ammo) {
  if (!ammo) return Object.assign({}, AMMO_MEDICAL_DEFAULTS);
  const id = ammo.id || ammo;
  const fromTable = AMMO_MEDICAL[id] || {};
  return Object.assign({}, AMMO_MEDICAL_DEFAULTS, fromTable);
}
function validatePartDestructionFoundation(rep, unit) {
  // 1) 모든 상태가 functional cap table에 존재 + 범위 0~1
  for (const st of PD_ALL_STATES) {
    const cap = PART_DESTRUCTION_FUNCTIONAL_CAP[st];
    if (cap == null) rep.error('partDestruction', `상태 ${st}: functional cap table에 없음`);
    else if (!(cap >= 0 && cap <= 1)) rep.error('partDestruction', `상태 ${st}: functionalCap 범위 밖 (${cap})`);
  }
  for (const st of Object.keys(PART_DESTRUCTION_FUNCTIONAL_CAP)) {
    if (PD_ALL_STATES.indexOf(st) < 0) rep.error('partDestruction', `cap table의 ${st}: 알 수 없는 상태`);
  }
  // 2) rank table 정합성
  for (const st of PD_ALL_STATES) {
    const isLimbOnly = PD_LIMB_ONLY_STATES.indexOf(st) >= 0, isNonLimbOnly = PD_NON_LIMB_ONLY_STATES.indexOf(st) >= 0;
    if (!isNonLimbOnly && PD_STATE_RANK_LIMB[st] == null) rep.error('partDestruction', `상태 ${st}: 사지 rank 없음`);
    if (!isLimbOnly && PD_STATE_RANK_NON_LIMB[st] == null) rep.error('partDestruction', `상태 ${st}: 비사지 rank 없음`);
  }
  if (!unit || !unit.medical || !unit.medical.partDestruction) return rep;
  // 3) 런타임 계약
  const m = unit.medical, allPd = m.partDestruction;
  const woundIds = new Set((m.wounds || []).map(w => w && w.id).filter(x => x != null));
  for (const k of BODY_PART_KEYS) {
    const pd = allPd[k]; if (!pd) { rep.error('partDestruction', `${k}: model 없음`); continue; }
    const isLimb = _LIMB_PART_KEYS.indexOf(k) >= 0;
    if (PD_ALL_STATES.indexOf(pd.state) < 0) rep.error('partDestruction', `${k}: 알 수 없는 상태 ${pd.state}`);
    if (!isLimb && PD_LIMB_ONLY_STATES.indexOf(pd.state) >= 0) rep.error('partDestruction', `${k}: 비사지에 limb-only 상태 ${pd.state}`);
    if (isLimb && PD_NON_LIMB_ONLY_STATES.indexOf(pd.state) >= 0) rep.error('partDestruction', `${k}: 사지에 non-limb 상태 ${pd.state}`);
    if (!(pd.functionalCap >= 0 && pd.functionalCap <= 1)) rep.error('partDestruction', `${k}: functionalCap 범위 밖 (${pd.functionalCap})`);
    const expCap = PART_DESTRUCTION_FUNCTIONAL_CAP[pd.state];
    if (expCap != null && pd.functionalCap !== expCap) rep.error('partDestruction', `${k}: functionalCap ${pd.functionalCap} != 상태 ${pd.state} cap ${expCap}`);
    const evd = pd.evidence || null;
    // 극단 상태 증거 요구
    if (pd.state === 'traumatic_amputation' && evd && !(evd.dominantCatastrophicSource || evd.dominantShattered))
      rep.error('partDestruction', `${k}: traumatic_amputation인데 dominant catastrophic evidence 없음`);
    if (pd.state === 'partial_traumatic_loss' && evd && !evd.dominantClusterIsDistal)
      rep.error('partDestruction', `${k}: partial_traumatic_loss인데 dominant distal evidence 없음`);
    // dangling reference
    for (const wid of (pd.sourceWoundIds || [])) if (!woundIds.has(wid)) rep.error('partDestruction', `${k}: sourceWoundIds dangling (${wid})`);
    for (const ck of Object.keys(pd.localClusters || {})) {
      for (const wid of (pd.localClusters[ck].woundIds || [])) if (!woundIds.has(wid)) rep.error('partDestruction', `${k}/${ck}: cluster woundId dangling (${wid})`);
    }
    // disabled 계약
    const part = m.bodyParts && m.bodyParts[k];
    if (part) {
      if (PD_DISABLED_STATES.indexOf(pd.state) >= 0 && !part.disabled) rep.error('partDestruction', `${k}: ${pd.state}인데 disabled 아님`);
      if ((part.functionRatio || 0) > pd.functionalCap + 1e-6) rep.error('partDestruction', `${k}: functionRatio ${part.functionRatio} > cap ${pd.functionalCap}`);
    }
    // part destruction만으로 vascular confirmed 생성 금지
    for (const w of (m.wounds || [])) {
      if (!w || w.partKey !== k) continue;
      const ve = w.vascularEvidence || {};
      if (ve.level === 'confirmed' && ve._confirmedByPartDestruction) rep.error('partDestruction', `${k}: part destruction이 vascular confirmed를 생성함`);
    }
  }
  return rep;
}
function applyOutcome(target, outcome, weapon, ctx) {
  if (target) target._acuteHandledThisHit = false;   // [0.39.1 Fix1] per-hit 리셋 (applyDamageEvent가 이 hit에서 set)
  // 2A-6.4 마감: 백커 보정 modifier 안전 읽기 (NaN/undefined → 1.0)
  const _isFin = (x) => typeof x === 'number' && isFinite(x);
  const bluntMod = (ctx && _isFin(ctx.bluntModifier)) ? ctx.bluntModifier : 1.0;
  const shockMod = (ctx && _isFin(ctx.shockModifier)) ? ctx.shockModifier : 1.0;
  const painMod  = (ctx && _isFin(ctx.painModifier))  ? ctx.painModifier  : 1.0;
  let dmgFrac = 0;
  let supGain = weapon.suppressionHit || 5;
  switch (outcome) {
    case OUTCOME.MISS:    dmgFrac = 0;     supGain = weapon.suppressionMiss || 2; break;
    case OUTCOME.NEAR:    dmgFrac = 0;     supGain = (weapon.suppressionMiss || 2) * 1.6; break;
    case OUTCOME.BLOCK:   dmgFrac = 0.015; supGain *= 0.6; break;
    case OUTCOME.LIGHT:   dmgFrac = 0.06;  supGain *= 0.85; break;
    case OUTCOME.SERIOUS: dmgFrac = 0.18;  supGain *= 1.30; break;
    case OUTCOME.DOWN:    dmgFrac = 0.32;  supGain *= 1.55; break;
    case OUTCOME.KILL:    dmgFrac = 0.48;  supGain *= 1.85; break;
  }
  if (outcome === OUTCOME.BLOCK && ctx && ctx.stopStage) {
    // 차단 시 기본 충격 비율 — stopStage별 기본값
    let baseDmgFrac, supMul;
    switch (ctx.stopStage) {
      case 'hard_block':          baseDmgFrac = 0.008; supMul = 0.75; break;
      case 'soft_block':          baseDmgFrac = 0.030; supMul = 1.00; break;
      case 'hard_pen_soft_block': baseDmgFrac = 0.040; supMul = 1.20; break;
      default:                    baseDmgFrac = 0.015; supMul = 1.00;
    }
    // 차단한 재질의 bluntRatio 반영 — 재질별로 충격 전달이 다르게
    //   예: 아라미드(0.80) 막힘 → 0.80배 / 티타늄(0.45) → 0.45배
    const bRatio = getMaterialBluntRatio(ctx.blockMaterial);
    dmgFrac = baseDmgFrac * (0.5 + bRatio);   // bluntRatio 1.0이면 ×1.5, 0.45면 ×0.95
    supGain *= supMul * (0.6 + bRatio * 0.5); // 충격이 큰 재질은 제압도 약간 강함
    // === 바이저 block — 얼굴과 이격, 큰 둔상 X. accessory.bluntMul 적용 ===
    //   K6-3 visorHitTable의 영역별 bluntMul: ctx.blockMaterial과 zone.material 일치 시 그 zone의 bluntMul.
    //   FAST/LShZ 일반 visor: visor.bluntMul (0.10) 적용.
    if (ctx.location === 'head_face' && target && target.visorId) {
      const visor = PROTECTION_ACCESSORY_PRESETS[target.visorId];
      if (visor && !visor.isNone) {
        let bMul = visor.bluntMul != null ? visor.bluntMul : 0.10;
        if (visor.visorHitTable) {
          for (const z of visor.visorHitTable) {
            if (z.material === ctx.blockMaterial) { bMul = z.bluntMul; break; }
          }
        }
        dmgFrac *= bMul;     // 일반 0.10 → 90% 감소
        supGain *= 0.5;      // 어지러움 정도의 약한 suppression
      }
    }
    // ctx에 저장 — 아래 stopping/pain 가중에서 사용
    ctx._bluntRatio = bRatio;
    // 2A-6.4: 백커 충족도에 따른 둔상 보정 (ICW 부족 시 둔상↑, 충족 시 둔상↓) — dmgFrac에 1회만 적용
    if (bluntMod !== 1.0) dmgFrac *= bluntMod;
  }
  const ds = (weapon.damageScale != null) ? weapon.damageScale : 1.0;
  dmgFrac *= ds;

  // === velocity 보정 + terminalEffect ===
  //   ctx.damageVelMul: 거리/장벽 후 속도에 따른 피해 보정
  //   weapon._ammo.terminalEffect: 파쇄/yaw/확장 임계
  //   penetrated인 경우에만 적용 (BLOCK은 그대로)
  const wasPenInOutcome = (outcome !== OUTCOME.MISS && outcome !== OUTCOME.NEAR && outcome !== OUTCOME.BLOCK);
  if (wasPenInOutcome && ctx && ctx.damageVelMul != null) {
    dmgFrac *= ctx.damageVelMul;
    // terminalEffect
    const te = weapon._ammo && weapon._ammo.terminalEffect;
    if (te) {
      const above = ctx.impactVelocity >= te.thresholdVelocity;
      const tissueMul = above ? (te.aboveTissueMul || 1.0) : (te.belowTissueMul || 1.0);
      dmgFrac *= tissueMul;
      // ctx에 저장 — bleed/shock 적용 시 사용
      ctx._terminalAbove = above;
      ctx._terminalBleedMul = above ? (te.aboveBleedMul || 1.0) : (te.belowBleedMul || 1.0);
      ctx._terminalShockMul = above ? (te.aboveShockMul || 1.0) : (te.belowShockMul || 1.0);
    }
    // 클램프 — 너무 극단으로 가지 않도록
    dmgFrac = Math.max(0, dmgFrac);
  }

  const dmgFull = target.maxHp * dmgFrac;

  // === 부위별 + 전체 hp 분리 적용 ===
  const bodyPart = (ctx && ctx.bodyPart) ? ctx.bodyPart
                 : (ctx && ctx.location ? locationToBodyPart(ctx.location) : 'chest');
  const severity = outcomeToSeverity(outcome, bodyPart);
  let dmg = 0;
  // === 2A-1 정합성: ricocheted 여부 ===
  //   impactAddress가 도탄으로 확정한 경우 비관통 처리를 강제
  const wasRicocheted = !!(ctx && ctx.impactAddress && ctx.impactAddress.ricochetHint && ctx.impactAddress.ricochetHint.ricocheted);
  // === NEW: Medical applyDamageEvent로 통합 ===
  //   부위 HP는 더 이상 직접 깎지 않고 applyDamageEvent가 처리
  //   legacy unit.hp는 syncLegacyCombatState가 medical.lifeStatus로 갱신
  if (severity != null && target.medical) {
    const bodyDmg = severityToBodyDamage(severity) * ds;
    // 좌우 — ctx.isLeft(impactAddress와 공유된 확정값) 우선, 없으면 location 기반
    const isLeft = (ctx && ctx.isLeft != null) ? ctx.isLeft
                 : (ctx && ctx.location === 'left_arm') ? true
                 : (ctx && ctx.location === 'right_arm') ? false : null;
    // === 2A-1 정합성: armorResult를 ctx.penetrated 기준으로 일관 결정 ===
    //   - 실제 penetrated=false: outcome이 LIGHT여도 비관통 (stopped/deflected). 관통 출혈 X.
    //   - 실제 penetrated=true: 관통 (기존 흐름).
    //   - ricocheted=true: penetrated=false 위에서 deflected로 표시.
    let armorResult;
    if (wasRicocheted) armorResult = 'deflected';
    else if (outcome === OUTCOME.BLOCK) armorResult = 'stopped';
    else if (ctx && ctx.penetrated === false) armorResult = 'stopped';   // 차단됐는데 LIGHT 결과 — 둔상으로
    else armorResult = 'penetrated';
    // 출혈/충격 위험도 — severity 기반 (비관통이면 모두 0으로)
    let bleedRisk = 0, shockRisk = 0;
    if (armorResult === 'penetrated') {
      switch (outcome) {
        case OUTCOME.LIGHT:   bleedRisk = 0.20; shockRisk = 0.15; break;
        case OUTCOME.SERIOUS: bleedRisk = 0.55; shockRisk = 0.50; break;
        case OUTCOME.DOWN:    bleedRisk = 0.80; shockRisk = 0.75; break;
        case OUTCOME.KILL:    bleedRisk = 0.95; shockRisk = 0.90; break;
      }
    } else {
      // 비관통 — 작은 shock만, 출혈 없음
      shockRisk = (outcome === OUTCOME.BLOCK) ? 0.25 : 0.10;
    }
    // 탄종 medical profile (있으면 보정)
    // SHOTGUN-PHYS-CLUSTER-1 Phase1 §2: ammoMedicalProfile fallback — weapon에 없으면 ammo에서 조회(산탄 medical 보정이 즉시 생리에도 반영되게)
    const _ammoObj = (weapon && weapon._ammo) || ((weapon && weapon.ammoId && typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[weapon.ammoId] : null);
    const ammoProf = (weapon && weapon.ammoMedicalProfile) || ((typeof getAmmoMedicalProfile === 'function') ? getAmmoMedicalProfile(_ammoObj) : null) || null;
    if (ammoProf) {
      if (ammoProf.bleedChance != null) bleedRisk *= ammoProf.bleedChance;
      if (ammoProf.shockChance != null) shockRisk *= ammoProf.shockChance;
    }
    // 2A-6.4 마감: 백커 충족도 → shock 보정 (백커 부족 시 shock↑, 충족 시 shock↓)
    shockRisk *= shockMod;
    // SIDE-AMMO-1B §6: API/API-T 관통 후 내부 소이 효과 — 관통 성공시에만 소폭 보정 (화상 wound/지속피해 없음)
    let _incPainMul = 1.0, _incTissueMul = 1.0;
    const _incAmmo = (weapon && weapon._ammo) || null;
    const _inc = (typeof _incendiaryInfo === 'function') ? _incendiaryInfo(_incAmmo) : null;
    if (_inc && armorResult === 'penetrated') {
      _incTissueMul = _inc.postPenInternalDamageMul;
      shockRisk *= _inc.postPenShockMul;
      _incPainMul = _inc.postPenPainMul;
      if (GAME.debugUtility) log(`[debug] ${_incAmmo.id} API 관통: 내부 소이 효과 / 피해 소폭 증가`, 'info');
    } else if (_inc && armorResult !== 'penetrated') {
      if (GAME.debugUtility) log(`[debug] ${_incAmmo.id} API 탄착: flash/scorch / 관통 실패 (내부피해 없음)`, 'info');
    }
    // SIDE-HIT-ADDRESS-DAMAGE-ATTENUATION-1: 세부주소 감쇠 (≤1.0). applyOutcome에서만 tissue/pain/bleed/shock 감쇠.
    //   원본 물리값(rawDamage/penetration/velocity/energy/terminal/internalScores)은 불변. applyDamageEvent에서 재감쇠 금지.
    const _hap = (ctx && ctx.impactAddress && ctx.impactAddress.hitAddressDamageProfile) || null;
    const _hapDmg = _hap ? _hap.damageMul : 1.0;
    const _hapWound = _hap ? _hap.woundMul : 1.0;
    const _hapPain = _hap ? _hap.painMul : 1.0;
    const _hapBleed = _hap ? _hap.bleedMul : 1.0;
    const _hapShock = _hap ? _hap.shockMul : 1.0;
    const _tissueAtten = ((armorResult === 'penetrated') ? bodyDmg * _incTissueMul : 0) * _hapDmg;
    const _painAtten = (weapon && weapon.painMul != null ? weapon.painMul : 1.0) * painMod * bodyDmg * 1.2 * _incPainMul * _hapPain;
    const _origRaw = dmgFull;
    const _effRaw = dmgFull * _hapWound;
    applyDamageEvent(target, {
      sourceType: 'bullet',
      hitPart: bodyPart, isLeft,
      hitZone: ctx && ctx.location,
      rawDamage: dmgFull,
      originalRawDamage: _origRaw, effectiveRawDamage: _effRaw,
      hitAddressDamageProfile: _hap, hitAddressDamageMul: _hapDmg, hitAddressWoundMul: _hapWound, hitAddressPhysiologyMul: (_hap ? _hap.physiologyMul : 1.0),
      // 비관통(stopped/deflected) — tissue 관통 X, 둔상으로 처리. 관통 tissue는 세부주소 감쇠 적용.
      tissueDamage: _tissueAtten,
      armorResult,
      bleedRisk: bleedRisk * _hapBleed, shockRisk: shockRisk * _hapShock,
      bluntTrauma: (armorResult === 'penetrated') ? 0
                 : (outcome === OUTCOME.BLOCK) ? dmgFull * 0.4
                 : dmgFull * 0.25,   // LIGHT non-penetrated: 둔상 (보수적, 방호 결과 불변)
      // 2A-6.4 마감: 백커 충족도 → pain 보정 (백커 부족 시 통증↑) — painAmount에만 적용(중복 방지)
      painAmount: _painAtten,
      ammoMedicalProfile: ammoProf,
      ammoId: (weapon && weapon._ammo && weapon._ammo.id) || (weapon && weapon.ammoId) || null,
      weaponId: weapon && weapon.id || null,
      fragmentPenetrated: !!(ctx && ctx.fragmentPenetrated),
      terminalEffect: weapon && weapon.terminalEffect,
      impactAddress: (ctx && ctx.impactAddress) || null,
      // [IMPACT-A Phase1] canonical impact packet — computeWoundSize가 원본 kinetics를 읽는 경로
      impactPacket: (ctx && ctx.impactPacket) || null,
      // SIDE-ARMOR-2C §5: coverage 메타 — AAR/wound 표시용
      armorHitResult: (ctx && ctx.armorHitResult) || null,
      coverageSource: (ctx && ctx.armorHitResult && ctx.armorHitResult.coverageSource) || null,
      selectedLayerType: (ctx && ctx.armorHitResult && ctx.armorHitResult.selectedLayerType) || null,
      durabilityOwnerId: (ctx && ctx.armorHitResult && ctx.armorHitResult.durabilityOwnerId) || null,
      _shotVelocity: (ctx && ctx.shotVelocity) != null ? ctx.shotVelocity : null,
      _shotInitialVelocity: (ctx && ctx.shotInitialVelocity) != null ? ctx.shotInitialVelocity : null,
      _continuationDepth: (ctx && ctx.continuationDepth) || 0,
      _entryArmorContext: (ctx && ctx.entryArmorContext) || null,
      // SHOTGUN-MED-NORM-1 §13: 산탄 pellet 그룹 메타 (wound까지 전달)
      pelletGroupId: (ctx && ctx.pelletGroupId) || null, pelletIndex: (ctx && ctx.pelletIndex), pelletCount: (ctx && ctx.pelletCount),
      shotgunPellet: !!(ctx && ctx.shotgunPellet), shotgunAmmoId: (ctx && ctx.shotgunAmmoId) || null, shotgunPatternType: (ctx && ctx.shotgunPatternType) || null,
    });
    // legacy dmg값 — UI/로그용으로만 (실제 hp는 syncLegacyCombatState가 lifeStatus로 갱신함)
    dmg = Math.round(dmgFull * (BODY_HP_BLEED[bodyPart] || 0.5));
  } else if (severity == null) {
    dmg = 0;
  } else {
    // medical 없음 — fallback (개발 중 안전망)
    dmg = Math.round(dmgFull);
  }

  // [0.39.1 Fix1] acute response가 suppression을 적용한 hit(medical)은 legacy supGain 중복 금지.
  //   MISS/NEAR/비medical은 기존대로 supGain 적용 (acute 미발생 경로).
  if (!(target._acuteHandledThisHit && target.medical)) {
    target.suppression = Math.min(100, target.suppression + supGain);
  }

  // === stoppingPower / pain 적용 ===
  //   - severity가 있고 부위 손상이 있을 때만 적용 (MISS/NEAR는 X)
  //   - 부위/관통/severity로 계수 결정
  //   - 방호 차단도 약한 stopping/pain
  if (severity != null && weapon) {
    const sp = (weapon.stoppingPower != null) ? weapon.stoppingPower : 1.0;
    const pm = (weapon.painMul != null) ? weapon.painMul : 1.0;
    const wasPenetrated = !!(ctx && ctx.penetrated) && outcome !== OUTCOME.BLOCK;
    // 부위별 stopping 가중 — 머리/가슴/복부 크게, 팔/다리 보통, BLOCK 약하게
    let stopBodyMul = 1.0;
    if (bodyPart === 'head')         stopBodyMul = 1.7;
    else if (bodyPart === 'chest')   stopBodyMul = 1.4;
    else if (bodyPart === 'abdomen') stopBodyMul = 1.2;
    else if (bodyPart === 'arms')    stopBodyMul = 0.85;
    else if (bodyPart === 'legs')    stopBodyMul = 0.95;
    // severity 가중
    let sevStopMul = 1.0;
    if (severity === SEVERITY.GRAZE)        sevStopMul = 0.30;
    else if (severity === SEVERITY.LIGHT)   sevStopMul = 0.60;
    else if (severity === SEVERITY.SERIOUS) sevStopMul = 1.10;
    else if (severity === SEVERITY.CRITICAL) sevStopMul = 1.50;
    // 방호로 막힌 경우 — bluntRatio 기반으로 stopping/pain 조정
    //   재질이 아라미드/세라믹이면 막아도 큰 충격, 티타늄/복합소재면 작은 충격
    //   ctx에 저장된 _bluntRatio 사용 (BLOCK 처리에서 세팅)
    if (!wasPenetrated) {
      const bRatio = (ctx && ctx._bluntRatio != null) ? ctx._bluntRatio
                   : getMaterialBluntRatio((ctx && ctx.blockMaterial) || null);
      // 기존 0.45 고정값 대신 bluntRatio 기반 (0.25~0.70 범위)
      sevStopMul *= (0.20 + bRatio * 0.50);
    }
    // SHOTGUN-PHYS-CLUSTER-1 Phase2 §5: 산탄 펠릿당 순간 저지력 보정 (완전 제거 아님 — buck 근거리 유지, flechette per-dart 낮춤)
    const _stopAmmo = (weapon && weapon._ammo) || ((weapon && weapon.ammoId && typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[weapon.ammoId] : null);
    const _pelletStop = getShotgunPelletAcutePhysiologyMeta(ctx || {}, _stopAmmo);
    const _pelletStopMul = _pelletStop.isShotgunPellet ? _pelletStop.stoppingMul : 1.0;
    const stopRes = applyStopping(target, sp * _pelletStopMul, weapon, { severityMul: stopBodyMul * sevStopMul, skipIfAcute: !!target.medical });
    target._lastStoppedFire = (target.medical && target._lastStoppedFire) ? target._lastStoppedFire : (stopRes && stopRes.stoppedFire);

    // pain 증가 — severity와 부위와 painMul로 결정
    let painGain = 0;
    if (severity === SEVERITY.GRAZE)        painGain = 4;
    else if (severity === SEVERITY.LIGHT)   painGain = 12;
    else if (severity === SEVERITY.SERIOUS) painGain = 28;
    else if (severity === SEVERITY.CRITICAL) painGain = 50;
    // 부위 가중
    if (bodyPart === 'head')        painGain *= 1.20;
    else if (bodyPart === 'chest')  painGain *= 1.15;
    else if (bodyPart === 'abdomen') painGain *= 1.10;
    else if (bodyPart === 'arms')   painGain *= 0.85;
    else if (bodyPart === 'legs')   painGain *= 0.90;
    // 방호 차단 시 — bluntRatio 반영
    if (!wasPenetrated) {
      const bRatio = (ctx && ctx._bluntRatio != null) ? ctx._bluntRatio
                   : getMaterialBluntRatio((ctx && ctx.blockMaterial) || null);
      // 0.25~0.75 범위 (재질에 따라 둔상통 강도 차이)
      painGain *= (0.25 + bRatio * 0.50);
    }
    painGain *= pm;
    // 2A-6.4 마감: 백커 보정 — legacy painGain은 medical 없는 유닛에만 실행되므로 painAmount와 중복 안 됨
    painGain *= painMod;
    // === medical 있으면 pain은 applyDamageEvent에서 단일 처리 ===
    //   addPain은 medical 없는 유닛(legacy fallback)에만 적용
    if (!target.medical) {
      addPain(target, painGain);
    }

    // === 출혈 부여 ===
    //   medical 있는 유닛은 applyDamageEvent에서 이미 bleedRate를 부여함
    //   legacy bleeding 태그(none/light/heavy/critical)는 syncLegacyCombatState가 갱신
    //   여기 코드는 medical 없는 유닛(사격장 등)에만 적용
    const ammo = weapon && weapon._ammo;
    const med = getAmmoMedicalProfile(ammo);
    if (!target.medical && wasPenetrated && severity !== SEVERITY.GRAZE) {
      let bleedProb = med.bleedChance;
      if (ctx && ctx._terminalBleedMul != null) bleedProb *= ctx._terminalBleedMul;
      if (severity === SEVERITY.LIGHT)         bleedProb *= 0.5;
      else if (severity === SEVERITY.SERIOUS)  bleedProb *= 1.1;
      else if (severity === SEVERITY.CRITICAL) bleedProb *= 1.5;
      if (bodyPart === 'arms' || bodyPart === 'legs') bleedProb *= 1.0;
      else if (bodyPart === 'abdomen')                bleedProb *= 1.20;
      else if (bodyPart === 'chest')                  bleedProb *= 1.00;
      else                                            bleedProb *= 0.3;
      bleedProb = Math.min(0.95, bleedProb);
      if (Math.random() < bleedProb) {
        const sevMul = med.bleedSeverityMul;
        const ranks = { none:0, light:1, heavy:2, critical:3 };
        let newRank;
        if (severity === SEVERITY.CRITICAL) {
          newRank = (Math.random() < Math.min(0.85, 0.45 * sevMul)) ? 3 : 2;
        } else if (severity === SEVERITY.SERIOUS) {
          newRank = (Math.random() < Math.min(0.75, 0.30 * sevMul)) ? 2 : 1;
          if (sevMul >= 1.45 && Math.random() < 0.15) newRank = 3;
        } else {
          newRank = 1;
          if (sevMul >= 1.40 && Math.random() < 0.20) newRank = 2;
        }
        if ((bodyPart === 'abdomen' || bodyPart === 'chest') && newRank < 3 && Math.random() < 0.25) newRank++;
        const cur = ranks[target.bleeding] || 0;
        if (newRank > cur) {
          const labels = ['none','light','heavy','critical'];
          target.bleeding = labels[newRank];
          target.bleedingLoc = bodyPart;
          target.bleedingTime = 0;
          if (target.team === 'friend') {
            const tag = newRank === 3 ? '치명' : newRank === 2 ? '심함' : '경미';
            log(`[${target.name}] 출혈 ${tag} (${BODY_PART_KOR[bodyPart]||bodyPart})`, newRank>=2 ? 'danger' : 'warn');
          }
        }
      }
    }

    // === 골절 부여 ===
    //   탄약 fractureChance + bluntTraumaMul. AP/penetrator도 골절 위험 높음.
    //   관통 시: fractureChance 기준. blunt-only: fractureChance × bluntTraumaMul × bluntRatio.
    // === 골절 / 둔상 ===
    //   medical 있는 유닛은 applyDamageEvent에서 fracture 처리됨
    if (!target.medical)
    {
      let fxProb = med.fractureChance;
      if (severity === SEVERITY.LIGHT)         fxProb *= 0.5;
      else if (severity === SEVERITY.SERIOUS)  fxProb *= 1.1;
      else if (severity === SEVERITY.CRITICAL) fxProb *= 1.5;
      if (!wasPenetrated) {
        const bRatio = (ctx && ctx._bluntRatio != null) ? ctx._bluntRatio
                     : getMaterialBluntRatio((ctx && ctx.blockMaterial) || null);
        fxProb *= med.bluntTraumaMul * bRatio;
      }
      if (bodyPart !== 'arms' && bodyPart !== 'legs' && bodyPart !== 'chest') fxProb *= 0;
      fxProb = Math.min(0.85, fxProb);
      if (fxProb > 0 && Math.random() < fxProb) {
        let newFx = null;
        if (bodyPart === 'arms') newFx = 'arm';
        else if (bodyPart === 'legs') newFx = 'leg';
        else if (bodyPart === 'chest') newFx = 'chest';
        if (newFx) {
          if (target.fracture === 'none')      target.fracture = newFx;
          else if (target.fracture !== newFx)  target.fracture = 'multiple';
          if (target.team === 'friend') log(`[${target.name}] 골절 (${BODY_PART_KOR[bodyPart]||bodyPart})`, 'warn');
        }
      }
    }

    // === 쇼크 / 의식상실 ===
    //   medical 있는 유닛은 applyDamageEvent에서 shock/consciousness 처리됨
    if (!target.medical && wasPenetrated && (severity === SEVERITY.SERIOUS || severity === SEVERITY.CRITICAL)) {
      let shockProb = med.shockChance;
      if (ctx && ctx._terminalShockMul != null) shockProb *= ctx._terminalShockMul;
      if (severity === SEVERITY.CRITICAL) shockProb *= 1.5;
      if (bodyPart === 'head')        shockProb *= 1.6;
      else if (bodyPart === 'chest')  shockProb *= 1.2;
      else if (bodyPart === 'abdomen') shockProb *= 1.1;
      shockProb = Math.min(0.90, shockProb);
      if (Math.random() < shockProb) {
        if (target.isDowned && target.conscious) {
          target.conscious = false;
          if (target.team === 'friend') log(`[${target.name}] 쇼크로 의식 잃음`, 'danger');
        } else if (!target.isDowned) {
          target.pain = Math.min(100, (target.pain || 0) + 15);
        }
      }
    }

    // 큰 충격은 큰 stopping → "사격 중단" 로그 (strong cases만)
    if (target.shotQueue == null && severity === SEVERITY.CRITICAL && wasPenetrated && (bodyPart === 'head' || bodyPart === 'chest')) {
      // shotQueue가 있다가 위에서 break됐다면 이미 null. 여기서는 추가 로그는 fireSingleShot에서 처리.
    }
  }
  // updateCombatState에서 alive/combatState 갱신 (전체 hp 0이거나 부위 치명일 때)
  if (severity != null) {
    updateCombatState(target);

    // === 머리/목 관통 별도 판정 ===
    //   bodyHp 임계와 무관하게, head 계열이 관통되고 손상이 충분하면 즉시 상태 강제.
    //   방호로 막힌 경우(penetrated=false 또는 BLOCK)는 적용하지 않음 (suppression만 가산).
    const isHeadHit = (ctx && ctx.location === 'head_skull')
                   || (ctx && ctx.location === 'head_temporal')
                   || (ctx && ctx.location === 'head_face')
                   || (ctx && ctx.location === 'neck');
    const wasPenetrated = !!(ctx && ctx.penetrated) && outcome !== OUTCOME.BLOCK;
    // === medical 있는 유닛은 applyDamageEvent가 head/neck 치명 처리 (lifeStatus/consciousness/deathReason) ===
    //   legacy 강제 dead/downed는 medical 없는 fallback 유닛에만 적용
    if (isHeadHit && wasPenetrated && target.alive !== false && !target.medical) {
      let forced = null;
      if (severity === SEVERITY.CRITICAL) {
        forced = (Math.random() < 0.90) ? 'dead' : 'downed';
      } else if (severity === SEVERITY.SERIOUS) {
        forced = (Math.random() < 0.70) ? 'downed' : 'dead';
      } else if (severity === SEVERITY.LIGHT) {
        if (Math.random() < 0.20) forced = 'downed';
      }
      if (forced) {
        if (forced === 'dead') {
          target.combatState = 'dead';
          target.isDead = true;
          target.isDowned = false;
          target.conscious = false;
          target.alive = false; target.hp = 0;
          target.canBeDragged = false;
          if (target.bodyHp) target.bodyHp.head = 0;
          target.shotQueue = null;
          target.movePath = [];
        } else if (forced === 'downed') {
          target.combatState = 'downed';
          target.isDowned = true;
          target.canBeDragged = true;
          target.downedTime = 0;
          target.conscious = (Math.random() < 0.25);
          target.alive = true;
          target.shotQueue = null;
          target.movePath = [];
          target.stance = 'prone';
        }
      }
    }
    // === medical 유닛의 head/neck 치명 처리 강화 ===
    //   applyDamageEvent에서 이미 처리됐지만, 사격 outcome KILL/SERIOUS이고 head/neck 관통인 경우 보정
    else if (isHeadHit && wasPenetrated && target.medical) {
      const med = target.medical;
      if (severity === SEVERITY.CRITICAL) {
        // 치명상 관통 — [IMPACT-A Phase2] consciousness 즉시 급락 (physiological shock 경유 금지, 직접 신경학적 손상)
        med.consciousness = Math.max(0, med.consciousness - 60);
        med.transientNeurologicDisruption = Math.max(med.transientNeurologicDisruption || 0, 60);
        if (ctx && ctx.location === 'neck') {
          // 목 — 호흡 + 외부 출혈 추가
          med.breathingEfficiency = Math.max(15, med.breathingEfficiency - 35);
          if (med.bodyParts.neck) med.bodyParts.neck.externalBleedRate += 40;
        }
        if (typeof recalcMedicalSummary === 'function') recalcMedicalSummary(target);
        if (typeof syncLegacyCombatState === 'function') syncLegacyCombatState(target);
      } else if (severity === SEVERITY.SERIOUS) {
        med.consciousness = Math.max(0, med.consciousness - 30);
        med.transientNeurologicDisruption = Math.max(med.transientNeurologicDisruption || 0, 30);
        if (typeof recalcMedicalSummary === 'function') recalcMedicalSummary(target);
        if (typeof syncLegacyCombatState === 'function') syncLegacyCombatState(target);
      }
    }
  } else if (target.hp <= 0 && target.alive && !target.medical) {
    // legacy fallback만
    target.alive = false; target.hp = 0; target.combatState = 'dead';
    target.isDead = true; target.conscious = false;
  }
  return { dmg, supGain, outcome, severity, bodyPart };
}
const DEFAULT_AMMO_PROFILE = {
  magazineSize: 30,
  reserveMags: 4,
  reloadTime: 2.6,
  tacticalReloadTime: 2.0,
  supportsFireModes: ['semi'],
  defaultFireMode: 'auto',
  burstCount: 3,
  fullAutoCount: 5,
  fullAutoMin: 3,
  fullAutoMax: 8,
  burstShotDelay: 0.07,
};
function getWeaponAmmoProfile(weapon) {
  if (!weapon) return Object.assign({}, DEFAULT_AMMO_PROFILE);
  return {
    magazineSize:       weapon.magazineSize       != null ? weapon.magazineSize       : DEFAULT_AMMO_PROFILE.magazineSize,
    reserveMags:        weapon.reserveMags        != null ? weapon.reserveMags        : DEFAULT_AMMO_PROFILE.reserveMags,
    reloadTime:         weapon.reloadTime         != null ? weapon.reloadTime         : DEFAULT_AMMO_PROFILE.reloadTime,
    tacticalReloadTime: weapon.tacticalReloadTime != null ? weapon.tacticalReloadTime : DEFAULT_AMMO_PROFILE.tacticalReloadTime,
    supportsFireModes:  weapon.supportsFireModes  || DEFAULT_AMMO_PROFILE.supportsFireModes.slice(),
    defaultFireMode:    weapon.defaultFireMode    || DEFAULT_AMMO_PROFILE.defaultFireMode,
    burstCount:         weapon.burstCount         != null ? weapon.burstCount         : DEFAULT_AMMO_PROFILE.burstCount,
    fullAutoCount:      weapon.fullAutoCount      != null ? weapon.fullAutoCount      : DEFAULT_AMMO_PROFILE.fullAutoCount,
    fullAutoMin:        weapon.fullAutoMin        != null ? weapon.fullAutoMin        : DEFAULT_AMMO_PROFILE.fullAutoMin,
    fullAutoMax:        weapon.fullAutoMax        != null ? weapon.fullAutoMax        : DEFAULT_AMMO_PROFILE.fullAutoMax,
    burstShotDelay:     weapon.burstShotDelay     != null ? weapon.burstShotDelay     : DEFAULT_AMMO_PROFILE.burstShotDelay,
    tubeReload:         weapon.tubeReload         != null ? weapon.tubeReload         : (DEFAULT_AMMO_PROFILE.tubeReload || false),
    perShellReloadTime: weapon.perShellReloadTime != null ? weapon.perShellReloadTime : (DEFAULT_AMMO_PROFILE.perShellReloadTime || null),
  };
}
function initUnitAmmo(unit) {
  const w = WEAPONS[unit.weaponId];
  const prof = getWeaponAmmoProfile(w);
  unit.magAmmo = prof.magazineSize;
  unit.reserveAmmo = prof.magazineSize * prof.reserveMags;
  unit.isReloading = false;
  unit.reloadTimer = 0;
  unit.fireModePolicy  = prof.defaultFireMode || 'auto';
  unit.currentFireMode = null;     // 실제 직전 사격에 사용된 fireMode (UI 표시용)
}
function makeArmorAddressKey(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  if (addr.fullAddress) return addr.fullAddress;
  const side = addr.side || addr.impactSide || 'front';
  const region = addr.region || 'torso';
  const hp = addr.hitPart || '';
  const parts = [side, region, hp, addr.zone, addr.subZone].filter(p => p != null && p !== '');
  return parts.join('.');
}
const IA_LABELS = {
  hitPart: { head:'머리', face:'안면', neck:'목', chest:'흉부', abdomen:'복부',
    leftArm:'좌완', rightArm:'우완', leftLeg:'좌각', rightLeg:'우각' },
  impactSide: { front:'정면', rear:'후면', left:'좌측', right:'우측', side:'측면', oblique:'경사', omni:'전방위', unknown:'불명' },
  stance: { standing:'직립', crouched:'쪼그림', prone:'엎드림', kneeling:'무릎' },
  armorLayer: { hard:'하드', soft:'소프트', softInsert:'소프트 삽입재', unprotected:'비방호',
    helmet:'헬멧', helmetAccessory:'헬멧 부착물', faceShield:'안면보호구', blast:'폭압' },
  coverageZone: {
    plateCore:'플레이트 중심부', plateEdge:'플레이트 엣지', softOnly:'소프트 단독', softInsert:'소프트 삽입재',
    unprotectedGap:'비방호 노출', helmetShell:'헬멧 외피', helmetLiner:'헬멧 라이너', skullExposed:'두개부 노출',
    slaapFrontUpper:'SLAAP 전면상부', slaapSideFrontOverlap:'SLAAP 측면전방 중첩',
    eyeGlass:'시야 유리부', visionSlitGlass:'시야 슬릿 유리', glassVisor:'폴리카보네이트 바이저', ballisticGlass:'방탄유리',
    titaniumFacePlate:'티타늄 안면판', steelFacePlate:'강철 안면판', metalFacePlate:'금속 안면판', faceShieldHard:'안면 경질부',
    faceSoft:'안면 연질부', faceExposed:'안면 노출', blastArea:'폭압 영역',
    rearLowerHardApprox:'후면 하부 방호범위', lowerHardApprox:'하복부 방호범위' },
  edgeLocation: {
    upperShoulderEdge:'상부-어깨 엣지', topFlatEdge:'상단 엣지', lowerEdge:'하단 엣지',
    leftSideEdge:'좌측 엣지', rightSideEdge:'우측 엣지', upperEdge:'상단 엣지', frontEdge:'전방 엣지', rearEdge:'후방 엣지' },
  softLocation: {
    softUpper:'상부 소프트', softCenter:'중앙 소프트', softLateral:'측면 소프트', softLower:'하부 소프트', shoulderCoverage:'어깨 커버',
    softRearUpper:'후면 상부', softRearCenter:'후면 중앙', softRearLower:'후면 하부', softRearLateral:'후면 측면',
    sideWrapCenter:'측면 랩 중앙', sideWrapUpper:'측면 랩 상부', sideWrapLower:'측면 랩 하부', sideWrapFrontEdge:'측면 랩 전연', sideWrapRearEdge:'측면 랩 후연',
    softUpperAbdomen:'상복부 소프트', softCenterAbdomen:'중복부 소프트', softLowerAbdomen:'하복부 소프트', softLateralAbdomen:'측복부 소프트',
    softFlank:'측복부 소프트', sideWrapAbdomen:'복부 측면 랩', sideWrapLower:'하부 측면 랩', softPelvisSide:'골반 측면 소프트',
    softRearUpperAbdomen:'후복부 상부', softRearCenterAbdomen:'후복부 중앙', softRearLowerAbdomen:'후복부 하부', softRearFlank:'후측복부', softGeneral:'소프트' },
  exposedLocation: {
    upperGap:'상부 노출', upperLateralGap:'상부 측면 노출', axillaGap:'겨드랑이 노출', lowerGap:'하부 노출', neckAdjacent:'목 인접 노출',
    lateralThoraxGap:'측흉부 노출', lowerSideGap:'하측면 노출', armShoulderGap:'팔-어깨 노출',
    rearUpperGap:'후상부 노출', rearLateralGap:'후측면 노출', rearLowerGap:'후하부 노출', neckRearAdjacent:'후경부 인접',
    upperAbdomenExposed:'상복부 노출', centralAbdomenExposed:'중복부 노출', lowerAbdomenExposed:'하복부 노출',
    flankExposed:'측복부 노출', flankGap:'측복부 노출', pelvisGroinAdjacent:'서혜부 인접', kidneySideRegion:'신장 측면부',
    lowerSideGap:'하측면 노출', pelvisSideGap:'골반 측면 노출', rearFlankGap:'후측복부 노출', rearLowerGap:'후하복부 노출',
    kidneyRearRegion:'신장 후면부', pelvisRearAdjacent:'골반 후면 인접', generalGap:'노출부',
    earCoverageGap:'귀/측면 하부 노출', sideLowerHelmetGap:'헬멧 측면 하부 노출' },
  helmetZone: {
    helmetFrontCenter:'전면 중앙', helmetFrontUpper:'전면 상부', helmetSideFront:'측면 전방', helmetSideCenter:'측면 중앙',
    helmetSideRear:'측면 후방', helmetRearCenter:'후면 중앙', helmetRearLower:'후면 하부', helmetTop:'정수리', helmetLowerEdge:'하부 엣지' },
  faceLocation: { eyes:'눈', nose:'코', mouth:'입', jaw:'턱', cheekLeft:'좌측 볼', cheekRight:'우측 볼', brow:'눈썹', lowerFace:'하안면' },
  neckLocation: { throat:'전경부', frontNeck:'전경부', rearNeck:'후경부', sideNeckLeft:'좌경부', sideNeckRight:'우경부', lowerNeck:'하경부', neckAdjacent:'경부 인접' },
  limbLocation: {
    upperArm:'상완부', forearm:'전완부', elbowJoint:'팔꿈치 관절', upperArmProximal:'상완 근위부', forearmDistal:'전완 원위부',
    thigh:'허벅지', kneeJoint:'무릎 관절', lowerLeg:'하퇴부', innerThigh:'허벅지 안쪽', thighProximal:'대퇴 근위부',
    upperInnerThighProximal:'대퇴 내측 근위부(서혜 인접)', lowerLegDistal:'하퇴 원위부' },
  anatomicalZone: {
    centralThorax:'중앙 흉부', upperThorax:'상부 흉부', lateralThorax:'측흉부', leftLateralThorax:'좌측흉부', rightLateralThorax:'우측흉부',
    axilla:'겨드랑이', lowerThorax:'하부 흉부', upperAbdomen:'상복부', centralAbdomen:'중복부', lowerAbdomen:'하복부',
    leftFlank:'좌측복부', rightFlank:'우측복부', pelvisAdjacent:'골반 인접', skull:'두개부', frontalSkull:'전두부',
    frontTemporal:'전측두부', temporalRegion:'측두부', parietalOccipital:'두정후두부', cranialVault:'두개관', occipital:'후두부',
    lowerSkullEdge:'두개 하연', orbitalRegion:'안와부', nasalRegion:'비부', lowerFace:'하안면', midFace:'중안면', frontalRegion:'전두부',
    throat:'전경부', posteriorNeck:'후경부', lateralNeck:'측경부', lowerNeck:'하경부', upperArm:'상완부', forearm:'전완부',
    elbow:'팔꿈치', shoulder:'어깨', thigh:'허벅지', femoralRegion:'대퇴부(서혜 인접)', innerThigh:'허벅지 안쪽', knee:'무릎', lowerLeg:'하퇴부' },
  organ: {
    lung:'폐', leftLung:'좌폐', rightLung:'우폐', upperLung:'상부 폐', lowerLung:'하부 폐', heart:'심장', greatVessel:'대혈관',
    subclavianVessel:'쇄골하동맥', axillaryVessel:'액와동맥', diaphragm:'횡격막', liver:'간', liverSide:'간 측부', stomach:'위',
    spleen:'비장', spleenSide:'비장 측부', bowel:'장', mesentericVessels:'장간막 혈관', abdominalAorta:'복대동맥', bladder:'방광',
    pelvicVessels:'골반 혈관', pelvicVessel:'골반 혈관', kidney:'신장', leftKidney:'좌신장', rightKidney:'우신장', abdominalWall:'복벽',
    femoralVessel:'대퇴혈관', femoralVesselDistalBranch:'대퇴혈관 분지', brachialVessel:'상완동맥', radialVessel:'요골동맥', distalVessel:'원위 혈관', brain:'뇌',
    brainFrontalLobe:'전두엽', brainTemporalLobe:'측두엽', brainOccipitalLobe:'후두엽', brainstemRisk:'뇌간 위험', eye:'안구',
    vision:'시야', frontalBrainRisk:'전두엽 위험', upperAirway:'상기도', airway:'기도', trachea:'기관', carotid:'경동맥',
    jugular:'경정맥', spinalCord:'척수', softTissue:'연부조직' },
  structure: {
    rib:'늑골', sternum:'흉골', lumbarSpine:'요추', pelvis:'골반', clavicle:'쇄골', skull:'두개골', temporalBone:'측두골',
    parietalBone:'두정골', occipitalBone:'후두골', cranialVault:'두개관', skullBase:'두개저', orbitalBone:'안와골', nasalBone:'비골',
    jaw:'턱뼈', facialBone:'안면골', frontalBone:'전두골', cervicalSpine:'경추', upperThoraxInlet:'흉곽 입구',
    humerus:'상완골', radius:'요골', ulna:'척골', tendon:'건', muscle:'근육', femur:'대퇴골', largeMuscle:'대근육',
    tibia:'경골', fibula:'비골', jointDamageCandidate:'관절 손상 후보', bone:'뼈', shoulderJoint:'어깨 관절' },
};
function aggregatePhysiologicEffectProfile(m) {
  const agg = { oxygenDrain:0, shockBoost:0, perfusingRhythmPenalty:0, majorVesselMul:1.0, breathingDrain:0, rhythmRiskBoost:0, preArrestBoost:0 };
  if (!m || !m.wounds) return agg;
  for (const w of m.wounds) {
    const p = w.physiologicEffectProfile;
    if (!p) continue;
    agg.oxygenDrain += p.oxygenDrain || 0;
    agg.shockBoost += p.shockBoost || 0;
    agg.perfusingRhythmPenalty = Math.max(agg.perfusingRhythmPenalty, p.perfusingRhythmPenalty || 0);
    agg.majorVesselMul = Math.max(agg.majorVesselMul, p.majorVesselMul || 1.0);   // max (곱셈 폭주 방지)
    agg.breathingDrain = Math.max(agg.breathingDrain, p.breathingDrain || 0);
    agg.rhythmRiskBoost = Math.max(agg.rhythmRiskBoost, p.rhythmRiskBoost || 0);
    agg.preArrestBoost = Math.max(agg.preArrestBoost, p.preArrestBoost || 0);
  }
  agg.oxygenDrain = Math.min(0.18, agg.oxygenDrain);
  agg.shockBoost = Math.min(0.30, agg.shockBoost);
  agg.perfusingRhythmPenalty = Math.min(0.30, agg.perfusingRhythmPenalty);
  agg.majorVesselMul = Math.min(2.4, agg.majorVesselMul);
  return agg;
}
let nextUnitId = 1;
const VIEW_ARC_FRIEND = (140 * Math.PI) / 180;
const FIRE_ARC_FRIEND = (100 * Math.PI) / 180;
const VIEW_ARC_ENEMY  = (130 * Math.PI) / 180;
const FIRE_ARC_ENEMY  = (95  * Math.PI) / 180;
const SIGHT_RANGE_M = 100;
const SIGHT_RANGE = mToPx(SIGHT_RANGE_M);
const BODY_PART_KEYS = ['head', 'neck', 'chest', 'abdomen', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const PART_DESTRUCTION_FUNCTIONAL_CAP = {
  intact: 1.0, damaged: 0.85, impaired: 0.60, mangled: 0.20, destroyed: 0.0,
  partial_traumatic_loss: 0.05, traumatic_amputation: 0.0, catastrophic_non_limb: 0.10,
};
const _LIMB_PART_KEYS = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
function makeDefaultPartDestruction(partKey) {
  return {
    partKey,
    state: 'intact',
    traumaScore: 0, cumulativeTraumaScore: 0, acuteTraumaScore: 0,
    localClusters: {},
    destructionRisk: 0, traumaticLossRisk: 0,
    functionalCap: 1.0, bleedBonusMul: 1.0, vascularRiskBonus: 0,
    lastMajorHitAt: 0, lastUpdatedAt: 0,
    sourceWoundIds: [], sourceClusterIds: [],
    evidenceTags: [], notes: [],
  };
}
function _makeAllPartDestruction() {
  const o = {};
  for (const k of BODY_PART_KEYS) o[k] = makeDefaultPartDestruction(k);
  return o;
}
const BODY_PART_MAX_HP = {
  head: 35, neck: 25, chest: 85, abdomen: 70,
  leftArm: 60, rightArm: 60, leftLeg: 65, rightLeg: 65,
};
const BODY_HP_TOTAL_MAX = 465;
const BLOOD_MAX = 5000;
function createMedical() {
  const bodyParts = {};
  for (const k of BODY_PART_KEYS) {
    bodyParts[k] = {
      hp: BODY_PART_MAX_HP[k], maxHp: BODY_PART_MAX_HP[k],
      externalBleedRate: 0, internalBleedRate: 0,
      pain: 0, fracture: false, functionRatio: 1.0,
      tourniquetApplied: false, bandageApplied: false,
      splinted: false,
      treated: false, disabled: false,
    };
  }
  return {
    bodyParts,
    wounds: [],                 // 2B-0: 개별 상처 목록
    woundClusters: {},          // SHOTGUN-PHYS-CLUSTER-1 Phase4: 처치/UI 묶음 (개별 wound는 그대로 유지 — 의학적 진실)
    partDestruction: _makeAllPartDestruction(),   // PART-DESTRUCTION-1 Phase1: 부위 상태/누적외상/기능상한 판정층 (bodyPart.hp는 그대로 유지)
    bodyPartTreatments: {},     // 2B-0: 부위 전체 처치 (지혈대/부목/골반바인더)
    bodyHpTotal: BODY_HP_TOTAL_MAX, bodyHpMax: BODY_HP_TOTAL_MAX,
    bloodMl: BLOOD_MAX, bloodMax: BLOOD_MAX,
    externalBleedRate: 0, internalBleedRate: 0,
    pain: 0, shock: 0, consciousness: 100,
    heartRate: 75, systolicBP: 120, diastolicBP: 80,
    breathingEfficiency: 100,
    lifeStatus: 100, combatEffectiveness: 100,
    aimPerformance: 100, mobility: 100, reactionPerformance: 100,
    // summary multipliers (적용 측에서 곱해 사용)
    aimMul: 1.0, moveMul: 1.0, reactionMul: 1.0,
    reloadMul: 1.0, stanceChangeMul: 1.0, weaponHandlingMul: 1.0,
    // booleans
    isAlive: true, isDead: false, isDowned: false,
    isUnconscious: false, isCombatEffective: true,
    canWalk: true, canCrawl: true, canMove: true, canShoot: true,
    // diagnosis
    downReason: null, deathReason: null,
    statusTags: [],
    // legacy mapping support
    _lastVitalUpdate: 0,
    // === 1.5단계 전투 생리/보상 시스템 확장 ===
    stressResponse: {
      sympatheticTone: 0,      // 교감신경 활성 (0~1)
      adrenaline: 0,           // 아드레날린 (0~1) — 통증마스킹/반응성/HR↑
      combatArousal: 0,        // 전투흥분 (0~1)
      panic: 0,                // 공황 (0~1) — 손떨림/사격 부정확
      painMasking: 0,          // 통증 둔화 비율 (0~1) — perceivedPain 계산용
      perceivedPain: 0,        // 느끼는 통증 (pain * (1-painMasking))
      threatDrive: 0,          // 위협 자극
      injuryDrive: 0,          // 부상 자극
      suppressionDrive: 0,     // 제압 자극
      postCombatCrash: 0,      // 전투 후 crash 수치
      timeSinceLastThreat: 999,
      timeSinceLastDamage: 999,
    },
    hemodynamics: {
      volumeRatio: 1.0,           // bloodMl / bloodMax
      vascularTone: 1.0,           // 혈관수축 보조
      systemicVascularResistance: 1.0,
      preload: 1.0,                // 정맥환류
      contractility: 1.0,          // 심수축력
      strokeVolumeMul: 1.0,        // 1회 박출량
      cardiacOutputMul: 1.0,       // 심박출량 종합
      map: 93,                     // mean arterial pressure
      pulsePressure: 40,
      tissuePerfusion: 1.0,        // 조직 관류
      oxygenDelivery: 1.0,         // 산소 공급
      compensationLoad: 0,         // 현재 보상 부하 (0~1)
      compensationExhaustion: 0,   // 보상 피로 누적 (0~1)
      compensatedShock: false,
      decompensatingShock: false,
    },
    hormonalCompensation: {
      vasopressin: 0,         // ADH (0~1) — 느린 혈관수축 보조
      raasActivation: 0,      // RAAS 활성 (0~1)
      angiotensinTone: 0,     // angiotensin 톤
      aldosteroneEffect: 0,
      cortisolStress: 0,
    },
    // === 2.5단계 placeholder (현재 gameplay 미사용, ECG fallback용) ===
    cardiac: {
      rhythm: 'sinus',
      arrhythmiaRisk: 0,
      ischemiaRisk: 0,
      cardiacStrain: 0,
      rhythmInstability: 0,
    },
  };
}
function approachValue(current, target, rateUp, rateDown, dt) {
  if (current == null || isNaN(current)) return target;
  const diff = target - current;
  if (Math.abs(diff) < 1e-6) return target;
  const rate = diff > 0 ? rateUp : rateDown;
  const step = Math.max(0, rate * dt);
  if (Math.abs(diff) <= step) return target;
  return current + Math.sign(diff) * step;
}
function decayExp(value, dt, tau) {
  if (value == null || isNaN(value)) return 0;
  return value * Math.exp(-dt / Math.max(0.001, tau));
}
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function clampMed(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function ensureMedicalExtensions(unit) {
  if (!unit || !unit.medical) return;
  const m = unit.medical;
  if (!m.woundClusters) m.woundClusters = {};   // SHOTGUN-PHYS-CLUSTER-1 Phase4
  if (!m._activeWoundClusterGen) m._activeWoundClusterGen = {};   // SAME-AREA-CLUSTER-ACTIVE-GEN-1
  // [IMPACT-A Phase2] 급성 피격반응 필드 (physiological과 분리)
  if (m.impactKnockdownTimer == null) m.impactKnockdownTimer = 0;
  if (m.transientNeurologicDisruption == null) m.transientNeurologicDisruption = 0;
  if (m._acuteResponseLoad == null) m._acuteResponseLoad = 0;
  // PART-DESTRUCTION-1 Phase1-2: partDestruction 보장 (save/load·구버전 유닛)
  if (!m.partDestruction) m.partDestruction = _makeAllPartDestruction();
  else for (const k of BODY_PART_KEYS) { if (!m.partDestruction[k]) m.partDestruction[k] = makeDefaultPartDestruction(k); }
  if (!m.stressResponse) {
    m.stressResponse = {
      sympatheticTone: 0, adrenaline: 0, combatArousal: 0, panic: 0,
      painMasking: 0, perceivedPain: m.pain || 0,
      threatDrive: 0, injuryDrive: 0, suppressionDrive: 0,
      postCombatCrash: 0, timeSinceLastThreat: 999, timeSinceLastDamage: 999,
    };
  }
  if (!m.hemodynamics) {
    m.hemodynamics = {
      volumeRatio: m.bloodMl / m.bloodMax, vascularTone: 1.0,
      systemicVascularResistance: 1.0, preload: 1.0, contractility: 1.0,
      strokeVolumeMul: 1.0, cardiacOutputMul: 1.0, map: 93, pulsePressure: 40,
      tissuePerfusion: 1.0, oxygenDelivery: 1.0,
      compensationLoad: 0, compensationExhaustion: 0,
      compensatedShock: false, decompensatingShock: false,
    };
  }
  if (!m.hormonalCompensation) {
    m.hormonalCompensation = {
      vasopressin: 0, raasActivation: 0, angiotensinTone: 0,
      aldosteroneEffect: 0, cortisolStress: 0,
    };
  }
  if (!m.cardiac) {
    m.cardiac = { rhythm: 'sinus', arrhythmiaRisk: 0, ischemiaRisk: 0, cardiacStrain: 0, rhythmInstability: 0 };
  }
  if (!m.fieldStabilizationModel) ensureFieldStabilizationModel(unit);
}
function ensureFieldStabilizationModel(unit) {
  if (!unit || !unit.medical) return null;
  const m = unit.medical;
  if (!m.fieldStabilizationModel) {
    m.fieldStabilizationModel = {
      airwaySupport:    { candidate:false, active:false, applied:false, quality:0, effectStrength:0, oxygenDeliveryModifier:1.0, artifactReduction:0, breathingDisciplineSupport:0, obstructionRisk:0, startedAt:0, completedAt:0, recurrenceRisk:0, failureReason:null, tags:[] },
      pelvicControl:    { candidate:false, active:false, applied:false, quality:0, effectStrength:0, pelvicBleedModifier:1.0, mobilityPenalty:0, evacuationPriorityBoost:0, recurrenceRisk:0, startedAt:0, completedAt:0, tags:[] },
      junctionalControl:{ candidate:false, active:false, applied:false, quality:0, effectStrength:0, pulseSuppression:0, recurrenceRisk:0, startedAt:0, completedAt:0, tags:[] },
      circulationSupport:{ candidate:false, active:false, available:false, fieldLimited:true, resourceRequired:true, effectStrength:0, mapSupportModifier:1.0, perfusionSupportModifier:1.0, transfusionRequired:false, definitiveCareRequired:false, startedAt:0, tags:[] },
      evacuationPriority:'none', definitiveCareRequired:false, lastUpdateTime:0,
    };
  }
  return m.fieldStabilizationModel;
}
const _CANON_TO_STORAGE = { head:'head', neck:'neck', chest:'chest', abdomen:'abdomen',
  left_arm:'leftArm', right_arm:'rightArm', left_leg:'leftLeg', right_leg:'rightLeg' };
const _STORAGE_TO_CANON = { head:'head', neck:'neck', chest:'chest', abdomen:'abdomen',
  leftArm:'left_arm', rightArm:'right_arm', leftLeg:'left_leg', rightLeg:'right_leg' };
function _partKeyWarn(raw, ctx) {
  if (typeof GAME !== 'undefined') {
    GAME._partKeyWarnings = GAME._partKeyWarnings || [];
    if (GAME._partKeyWarnings.length < 200) GAME._partKeyWarnings.push({ raw: String(raw), ctx: ctx || null, t: (GAME.gameTime || 0) });
    if (GAME.debugStrictPipeline) throw new Error('UNKNOWN_PART_KEY: ' + raw + (ctx ? (' @' + ctx) : ''));
  }
}
function normalizeAnatomicalPartKey(raw, meta) {
  if (raw == null) return null;
  if (_STORAGE_TO_CANON[raw]) return _STORAGE_TO_CANON[raw];   // storage camel 그대로 온 경우
  const p = String(raw).toLowerCase().trim();
  const M = { head:'head', neck:'neck', chest:'chest', thorax:'chest', abdomen:'abdomen', abd:'abdomen',
    left_arm:'left_arm', leftarm:'left_arm', arm_left:'left_arm',
    right_arm:'right_arm', rightarm:'right_arm', arm_right:'right_arm',
    left_leg:'left_leg', leftleg:'left_leg', leg_left:'left_leg',
    right_leg:'right_leg', rightleg:'right_leg', leg_right:'right_leg' };
  if (M[p]) return M[p];
  if (p === 'arms' || p === 'arm' || p === 'legs' || p === 'leg') {
    const isArm = (p[0] === 'a');
    let isLeft = (meta && meta.isLeft != null) ? !!meta.isLeft : null;
    if (isLeft == null && meta && typeof meta.rng === 'function') isLeft = meta.rng() < 0.5;   // 명시 rng로 1회만 결정
    if (isLeft == null) { _partKeyWarn(raw, (meta && meta.ctx) || 'ambiguous_side_unresolved'); return null; }
    return isArm ? (isLeft ? 'left_arm' : 'right_arm') : (isLeft ? 'left_leg' : 'right_leg');
  }
  _partKeyWarn(raw, meta && meta.ctx);
  return null;
}
function getMedicalBodyPart(medical, anyKey, meta) {
  if (!medical || !medical.bodyParts) return null;
  if (medical.bodyParts[anyKey]) return medical.bodyParts[anyKey];
  const c = normalizeAnatomicalPartKey(anyKey, meta);
  const sk = c && _CANON_TO_STORAGE[c];
  return sk ? (medical.bodyParts[sk] || null) : null;
}
function resolveBodyPartKey(hitPart, isLeft) {
  const c = normalizeAnatomicalPartKey(hitPart, { isLeft: (isLeft == null ? null : !!isLeft), rng: Math.random, ctx: 'resolveBodyPartKey' });
  if (c) return _CANON_TO_STORAGE[c];
  return 'chest';   // production fallback (경고는 normalize에서 기록됨)
}
function bleedRateForSeverity(sev) {
  // ORGANIC-BLEED-1 Phase0-2: legacy fallback(디버그/호환용). wound.bleedingProfile이 정상 생성되면 다음 tick부터 source-of-truth가 되어 이 값은 덮어써짐.
  //   wound 생성 실패 시에도 55/120 같은 대혈관급 값이 장시간 지속되지 않도록 즉시반응 수준으로 제한.
  switch (sev) {
    case 'micro':    return 1.0;
    case 'light':    return 5.0;
    case 'medium':   return 10.0;
    case 'severe':   return 16.0;
    case 'critical': return 22.0;
    default:         return 0;
  }
}
let _WOUND_ID_SEQ = 1;
const WOUND_SIZE_LABEL_KO = { micro:'초소형', small:'소형', medium:'중형', large:'대형', massive:'초대형' };
const WOUND_TYPE_LABEL_KO = {
  none:'상처 없음', blunt_trauma:'둔상', bruise:'타박상', abrasion:'찰과상',
  shallow_fragment:'얕은 파편상', deep_fragment:'깊은 파편상',
  penetrating_gunshot:'관통 총상', perforating_gunshot:'관통 총상',
  cavity_wound:'체강 관통상', junctional_wound:'접합부 출혈상',
  blunt_trauma_armor:'방탄 둔상', blast_or_crush:'폭압/압궤상',
};
const FIELD_CARE_LABEL_KO = { treatable:'현장처치 가능', controllable:'응급 억제 가능', limited:'현장처치 제한', field_unmanageable:'현장처치 불가' };
const _JUNCTIONAL_HINT = ['axilla','shoulderRoot','shoulder_root','groinHip','groin','inguinal','lowerNeck','neckBase','neck_base','armpit'];
const _VESSEL_CRIT_HINT = ['carotid','neckFront','neck_front','throat','heart','aorta','femoralArtery','femoral'];
function getMedicalProjectileMeta(ammo, ev) {
  const id = (ammo && ammo.id) || (ev && ev.ammoId) || '';
  const pj = (ammo && ammo.projectile) || {};
  const pelletCount = (ammo && ammo.pelletCount) || pj.pelletCount || 1;
  const projectileType = (ammo && ammo.projectileType) || pj.projectileType || null;
  const patternType = (ammo && ammo.patternType) || pj.patternType || null;
  const isShotgunPellet = pelletCount > 1 && projectileType === 'pellet';
  const isFlechette = /flechette/.test(id) || patternType === 'flechette_cluster' || pj.medicalProjectileClass === 'flechette_dart';
  const isBuckshot = /buck/.test(id) || pj.medicalProjectileClass === 'buckshot_pellet';
  if (isShotgunPellet && isFlechette) {
    return { isShotgunPellet:true, isFlechette:true, isBuckshot:false,
      effectiveDiameterMm: pj.effectiveDiameterMm || 1.5, medicalScalar: pj.pelletMedicalScalar || 0.22,
      projectileSizeClass:'sabot_subcaliber', maxEntryClass:'micro', maxInternalClass:'small', maxExitClass:'small' };
  }
  if (isShotgunPellet && isBuckshot) {
    return { isShotgunPellet:true, isFlechette:false, isBuckshot:true,
      effectiveDiameterMm: pj.effectiveDiameterMm || 8.4, medicalScalar: pj.pelletMedicalScalar || 0.55,
      projectileSizeClass:'pellet', maxEntryClass:'small', maxInternalClass:'medium', maxExitClass:'small' };
  }
  return { isShotgunPellet:false, isFlechette:false, isBuckshot:false,
    effectiveDiameterMm: null, medicalScalar:1.0, projectileSizeClass:null,
    maxEntryClass:null, maxInternalClass:null, maxExitClass:null };
}
const _WOUND_CLASS_ORDER = ['micro','small','medium','large','massive'];
function clampWoundClass(cls, maxCls) {
  if (!cls || !maxCls) return cls;
  const ci = _WOUND_CLASS_ORDER.indexOf(cls), mi = _WOUND_CLASS_ORDER.indexOf(maxCls);
  if (ci < 0 || mi < 0) return cls;
  return _WOUND_CLASS_ORDER[Math.min(ci, mi)];
}
function getShotgunPelletAcutePhysiologyMeta(ev, ammo) {
  const pm = getMedicalProjectileMeta(ammo, ev);
  if (!pm || !pm.isShotgunPellet) {
    return { isShotgunPellet:false, bodyDmgMul:1.0, shockMul:1.0, painMul:1.0, stressMul:1.0, stoppingMul:1.0 };
  }
  if (pm.isFlechette) {
    return { isShotgunPellet:true, isFlechette:true, isBuckshot:false,
      bodyDmgMul:0.25, shockMul:0.20, painMul:0.35, stressMul:0.30, stoppingMul:0.30,
      groupShockCeilingLimb:18, groupShockCeilingTorso:35, groupShockCeilingCritical:65,
      groupPainCeilingLimb:25, groupPainCeilingTorso:45 };
  }
  if (pm.isBuckshot) {
    return { isShotgunPellet:true, isFlechette:false, isBuckshot:true,
      bodyDmgMul:0.60, shockMul:0.55, painMul:0.70, stressMul:0.70, stoppingMul:0.75,
      groupShockCeilingLimb:35, groupShockCeilingTorso:70, groupShockCeilingCritical:90,
      groupPainCeilingLimb:45, groupPainCeilingTorso:75 };
  }
  return { isShotgunPellet:false, bodyDmgMul:1.0, shockMul:1.0, painMul:1.0, stressMul:1.0, stoppingMul:1.0 };
}
const _CALIBER_MM_TABLE = [
  // 인치식(점 시작) — 실제 탄자 직경(mm)
  [/^\.?300\s*(blk|blackout|whisper|aac)/i, 7.62],
  [/^\.?308/i, 7.82], [/7\.62\s*[x×]\s*51/i, 7.82], [/^\.?30-?06/i, 7.82], [/7\.62\s*[x×]\s*63/i, 7.82],
  [/^\.?338\s*(lapua|norma|lm)/i, 8.59], [/8\.6\s*[x×]/i, 8.59],
  [/^\.?300\s*(win|wm|prc|norma)/i, 7.82],
  [/^\.?223/i, 5.70], [/5\.56\s*[x×]/i, 5.70],
  [/^\.?556/i, 5.70],
  [/^\.?277|6\.8\s*[x×]/i, 7.00],
  [/^\.?45\s*acp/i, 11.5], [/^\.?40\s*s&?w/i, 10.2], [/^\.?357/i, 9.07], [/^\.?38\s/i, 9.07],
  [/^\.?50\s*(bmg|cal)/i, 12.95], [/12\.7\s*[x×]\s*99/i, 12.95], [/12\.7\s*[x×]\s*108/i, 12.98], [/12\.7\s*[x×]\s*55/i, 12.95],
  [/9\s*[x×]\s*19/i, 9.01], [/9\s*[x×]\s*21/i, 9.01], [/9\s*[x×]\s*39/i, 9.25],
  [/7\.62\s*[x×]\s*39/i, 7.85], [/7\.62\s*[x×]\s*54/i, 7.92],
  [/5\.45\s*[x×]/i, 5.60], [/5\.7\s*[x×]|5\.7\s*mm/i, 5.70], [/4\.6\s*[x×]/i, 4.65],
  [/9\.3\s*[x×]/i, 9.30], [/9\.5\s*[x×]/i, 9.50],
];
function _caliberStringToMm(caliberStr) {
  if (!caliberStr) return null;
  const s = String(caliberStr).trim();
  for (const [re, mm] of _CALIBER_MM_TABLE) { if (re.test(s)) return mm; }
  // metric 'A.Bx...mm' 또는 'A.Bmm' — 첫 토큰이 mm 구경 (점으로 시작하지 않을 때만 parseFloat 신뢰)
  if (!/^\s*\./.test(s)) {
    const m = s.match(/^(\d+(?:\.\d+)?)\s*(?:[x×]|mm|ga|$)/i);
    if (m) { const v = parseFloat(m[1]); if (!isNaN(v) && v >= 3 && v <= 30) return v; }
  }
  return null;   // 변환 실패 — 소비자가 기본값 결정
}
function getProjectileDiameterMm(ammo) {
  if (!ammo) return 7;
  // 1) 명시 필드 우선 (canonical)
  if (typeof ammo.projectileDiameterMm === 'number' && ammo.projectileDiameterMm > 0) return ammo.projectileDiameterMm;
  const pj = ammo.projectile;
  if (pj) {
    if (typeof pj.diameterMm === 'number' && pj.diameterMm > 0) return pj.diameterMm;
    if (typeof pj.effectiveDiameterMm === 'number' && pj.effectiveDiameterMm > 0) return pj.effectiveDiameterMm;
  }
  // 2) caliber 문자열 → mm 변환표
  const fromTable = _caliberStringToMm(ammo.caliber);
  if (fromTable != null) return fromTable;
  // 3) 기존 parser (metric만 안전) 4) 기본
  const legacy = parseFloat(String(ammo.caliber || ''));
  if (!isNaN(legacy) && legacy >= 3 && legacy <= 30) return legacy;   // 3mm 미만은 인치식 오파싱으로 간주, 배제
  return 7;
}
function _caliberMm(ammo) {
  // [0.39.2 Fix3] canonical 경로로 위임 — 점 시작 인치식 오파싱 방지
  return getProjectileDiameterMm(ammo);
}
function _woundSizeClassFromScore(s) {
  if (s < 14) return 'micro';
  if (s < 30) return 'small';
  if (s < 52) return 'medium';
  if (s < 78) return 'large';
  return 'massive';
}
function _zoneIsJunctional(zone) {
  if (!zone) return false;
  const z = String(zone).toLowerCase();
  return _JUNCTIONAL_HINT.some(h => z.indexOf(h.toLowerCase()) >= 0);
}
function _zoneIsVesselCritical(zone, partKey) {
  if (zone) { const z = String(zone).toLowerCase(); if (_VESSEL_CRIT_HINT.some(h => z.indexOf(h.toLowerCase()) >= 0)) return true; }
  return false;
}
function _normalizeResidualThreat(ev) {
  const ia = (ev && ev.impactAddress) || {};
  const ipkt = (ev && ev.impactPacket) || null;   // [0.39.1 Fix3] canonical impact packet 최우선
  const pkt = (ev && ev.residualThreatPacket) || ia.residualThreatPacket || (ev && ev.backerResult && ev.backerResult.residualThreatPacket) || null;
  const src = pkt || ia || {};
  const num = (v, d) => (typeof v === 'number' && !isNaN(v)) ? v : d;
  // [0.39.2 Fix2] residualPen 의미 보존: null/undefined/NaN=누락(fallback 허용), 0=실제 잔여 0(fallback 금지).
  //   Number.isFinite로 "값이 존재하는가"를 판별 — impactPacket이 명시적 0을 주면 그 0을 그대로 사용.
  const _finite = (v) => (typeof v === 'number' && Number.isFinite(v));
  const _rpRaw = (ipkt && _finite(ipkt.residualPen)) ? ipkt.residualPen
               : (_finite(src.residualPen)) ? src.residualPen
               : (_finite(ia.residualPen)) ? ia.residualPen
               : null;   // null = 데이터 누락 (소비자가 fallback 결정)
  const _rp = _rpRaw;   // 명시적 0 보존, 누락은 null
  const _om = (ipkt && typeof ipkt.overmatchMargin === 'number') ? ipkt.overmatchMargin : num(src.overmatchMargin, num(ia.overmatchMargin, 0));
  const _ri = (ipkt && typeof ipkt.residualIntegrity === 'number') ? ipkt.residualIntegrity : num(src.residualIntegrity, num(ia.residualIntegrity, 0.5));
  const _cd = (ipkt && typeof ipkt.continuationDepth === 'number') ? ipkt.continuationDepth : 0;
  return {
    residualPen: _rp,                              // null=누락, 0 이상=실제값
    residualPenPresent: (_rpRaw !== null),         // fallback 판단용 명시 플래그
    overmatchMargin: _om,
    residualIntegrity: _ri,
    continuationDepth: _cd,
    residualKind: (ipkt && ipkt.residualKind) || src.residualKind || ia.residualKind || null,
  };
}
function deriveWoundPenetrationState(ev) {
  const ar = ev.armorResult;
  if (ar === 'stopped' || ar === 'absorbed') return 'stopped_blunt';
  const rt = _normalizeResidualThreat(ev);
  // 2B-0-FINAL §1: 파편 분류 — 관통 파편은 fragmentPenetrated 누락이어도 관통 처리
  if (ev.sourceType === 'frag') {
    if (ar === 'penetrated') return (rt.residualPen > 12 || rt.overmatchMargin >= 6) ? 'deep' : 'shallow';
    if (ar === 'partial') return (ev.fragmentPenetrated || ev._shallowPenetration) ? 'shallow' : 'stopped_blunt';
    return ev.fragmentPenetrated ? 'shallow' : 'stopped_blunt';   // stopped — 막힌 파편
  }
  if (ar === 'penetrated') {
    const rk = rt.residualKind;
    if (!rk) return 'penetrating';        // 무방호/소프트 관통 — 하드플레이트 overmatch 정보 없음 → 전층 관통
    const om = rt.overmatchMargin;
    if (rk === 'intact_penetrator' && om >= 8) return 'through_and_through';
    if (om >= 10) return 'penetrating';
    if (om >= 3) return 'deep';
    return 'shallow';
  }
  return 'none';
}
function classifyWoundType(ev, penState) {
  const ar = ev.armorResult;
  const src = ev.sourceType;
  const stopped = (ar === 'stopped' || ar === 'absorbed');
  if (src === 'blast') return 'blast_or_crush';
  if (stopped) {
    // 비관통 — 둔상/타박/찰과만 (출혈 wound 아님)
    const blunt = ev.bluntTrauma || 0;
    if (blunt > 14) return 'blunt_trauma';
    if (blunt > 4) return 'bruise';
    return 'abrasion';
  }
  if (src === 'frag') {
    // 2B-0-FINAL §1: 관통 파편 = penetrated 또는 fragmentPenetrated 또는 partial+침투 → 파편상. 그 외(막힌 파편) → 타박.
    const penetrated = (ar === 'penetrated') || ev.fragmentPenetrated || (ar === 'partial' && (ev.fragmentPenetrated || ev._shallowPenetration));
    if (!penetrated) return 'bruise';      // 막힌 파편 — 출혈 아님
    return (penState === 'deep' || penState === 'penetrating' || penState === 'through_and_through') ? 'deep_fragment' : 'shallow_fragment';
  }
  // bullet penetrated
  if (penState === 'through_and_through') return 'perforating_gunshot';
  if (penState === 'penetrating' || penState === 'deep') {
    if (ev.partKey === 'chest' || ev.partKey === 'abdomen') return 'cavity_wound';
    if (_zoneIsJunctional(ev.anatomicalZone)) return 'junctional_wound';
    return 'penetrating_gunshot';
  }
  return 'penetrating_gunshot';
}
function computeWoundSize(ammo, ev, penState) {
  // SIDE-AMMO-1B-HOTFIX-5: 외부 12.7 micro fragment는 ammo.damage(본탄 160+)를 쓰지 않고 fragment 값으로만 산정 + sizeClass clamp
  if (ev.sourceType === 'frag' && ev.isFragment === true && !ev.internalBurst) {
    const ORDER = ['micro','small','medium','large','massive'];
    const capTo = (a, b) => ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(b))];
    const fs = ev.fragmentSize || 'small';
    const wd = ev.fragmentWoundDepth || 'shallow_fragment';
    const rawD = (ev.rawDamage != null ? ev.rawDamage : (ev.tissueDamage != null ? ev.tissueDamage : 5));
    const sizeCapBySize = (fs === 'large') ? 'large' : (fs === 'medium') ? 'medium' : 'small';
    let sizeCapByDepth;
    switch (wd) {
      case 'abrasion': case 'bruise': case 'superficial_fragment': case 'blunt_trauma_armor': sizeCapByDepth = 'small'; break;
      case 'shallow_fragment': sizeCapByDepth = 'medium'; break;
      case 'light_deep_fragment': sizeCapByDepth = (fs === 'large') ? 'large' : 'medium'; break;
      case 'deep_fragment': case 'penetrating_fragment': sizeCapByDepth = (fs === 'large') ? 'large' : 'medium'; break;
      default: sizeCapByDepth = 'small';
    }
    let baseClass = rawD >= 14 ? 'large' : rawD >= 7 ? 'medium' : rawD >= 3 ? 'small' : 'micro';
    let sizeClass = capTo(capTo(baseClass, sizeCapBySize), sizeCapByDepth);
    if (sizeClass === 'massive') sizeClass = 'large';   // external micro fragment massive 금지
    const score = sizeClass === 'large' ? 56 : sizeClass === 'medium' ? 36 : sizeClass === 'small' ? 18 : 7;
    const clusterEligible = (sizeClass === 'micro' || sizeClass === 'small' || sizeClass === 'medium') && /abrasion|bruise|superficial_fragment|shallow_fragment|light_deep_fragment/.test(wd);
    return {
      sizeClass, sizeScore: score,
      entrySizeClass: capTo(sizeClass, 'small'), entrySizeScore: +(score * 0.5).toFixed(1),
      internalSizeClass: sizeClass, internalSizeScore: +(score * 0.6).toFixed(1),
      channelScale: 0.5, penetrationDepthScore: 12,
      expansionScore: 0.3, fragmentationScore: 1,
      residualThreatScore: 0, boneRiskHint: 0,
      tissueDamageMul: +(0.7 + score / 80).toFixed(2),
      bleedingMul: +(0.6 + score / 70).toFixed(2),
      painMul: +(0.7 + score / 90).toFixed(2),
      uiLabel: WOUND_SIZE_LABEL_KO[sizeClass],
      microFragment: true, microFragmentClusterEligible: clusterEligible,
      fragmentSizeTier: fs, fragmentWoundDepthTier: wd,
    };
  }
  const ia = ev.impactAddress || {};
  const rt = _normalizeResidualThreat(ev);          // §3: 안정적 참조
  const prof = ev.ammoMedicalProfile || {};          // §4: 의료 성향 보조값
  const tdm = (typeof prof.tissueDamageMul === 'number' && !isNaN(prof.tissueDamageMul)) ? prof.tissueDamageMul : 1.0;
  const bsm = (typeof prof.bleedSeverityMul === 'number' && !isNaN(prof.bleedSeverityMul)) ? prof.bleedSeverityMul : 1.0;
  const stopped = (ev.armorResult === 'stopped' || ev.armorResult === 'absorbed');
  // SHOTGUN-MED-NORM-1 §9: 산탄 펠릿은 shell 구경(12ga) 대신 실제 펠릿/dart 직경으로 wound size 계산.
  const pelletMeta = getMedicalProjectileMeta(ammo, ev);
  const calMm = pelletMeta.effectiveDiameterMm || _caliberMm(ammo);
  const pen = (ammo && ammo.penetration) || 0;
  // ammo 내재 데미지를 주 동인으로. 단, fragment(내부burst 포함)는 본탄 damage가 아니라 fragment 값 사용
  // SIDE-HIT-ADDRESS-DAMAGE-ATTENUATION-1: bullet/penetrated 계열은 세부주소 woundMul 적용 (frag/산탄 중복 감쇠 금지)
  const _hapWoundMul = (ev.sourceType === 'frag' && ev.isFragment === true) ? 1.0 : ((ev.hitAddressWoundMul != null) ? ev.hitAddressWoundMul : 1.0);
  const dmg = ((ev.sourceType === 'frag' && ev.isFragment === true)
    ? (ev.rawDamage != null ? ev.rawDamage : (ev.tissueDamage != null ? ev.tissueDamage : 0))
    : Math.max((ammo && ammo.damage) || 0, (ev.rawDamage != null ? ev.rawDamage : 0))) * _hapWoundMul;
  const vel = (ammo && ammo.velocity) || 700;
  const beh = (ammo && ammo.barrierBehavior) || 'normal';
  // ════════════════════════════════════════════════════════════════════════════
  // [IMPACT-A Phase3] Kinetic Wound Size — canonical impact packet의 "실제" 충돌 kinetics 사용.
  //   ammo.velocity(프리셋 muzzle)가 아니라 impactVelocityMps(거리/장벽 감쇠 후)를 wound geometry에 반영.
  //   packet 없으면 kineticFallback=true → 기존 프리셋 vel로 legacy 계산 (AAR/debug 구분).
  //   에너지 double counting 금지: entry는 구경 지배, temporary cavity만 impact energy 사용(포화 곡선).
  // ════════════════════════════════════════════════════════════════════════════
  const _pkt = ev.impactPacket || null;
  const _hasKin = !!(_pkt && _pkt.kineticBasis && _pkt.impactVelocityMps != null && _pkt.impactVelocityMps > 0);
  const _kineticFallback = !_hasKin;
  // 실제 충돌속도/에너지/운동량 (packet 우선, 없으면 프리셋 fallback)
  const impactVel = _hasKin ? _pkt.impactVelocityMps : vel;
  const impactE = _hasKin ? (_pkt.impactEnergyJ || 0) : null;
  const energyRatioK = _hasKin ? (_pkt.energyRatio != null ? _pkt.energyRatio : 1) : 1;
  const impactMom = _hasKin ? (_pkt.impactMomentumNs || 0) : null;
  const projIntegrity = (_pkt && _pkt.residualIntegrity != null) ? _pkt.residualIntegrity : null;
  // 에너지 포화 곡선 — 절대에너지의 선형 증가 금지. temporary cavity 발현도만 완만히 반영.
  //   0J→0, ~1500J→~0.7, ~3500J→~1.0 (고에너지 소총탄이 자동 massive 되지 않도록).
  const _energySat = (impactE != null) ? Math.min(1.0, 1 - Math.exp(-impactE / 1400)) : null;
  // 운동량 보조 — 저속 중량탄(slug)이 낮은 velocity만으로 과소평가되지 않도록.
  const _momentumAssist = (impactMom != null) ? Math.min(1.0, impactMom / 12) : null;
  // [0.39.3 A-Closure] canonical projectile profile — apLike/heavySlow/fragLike를 단일 source에서 읽음.
  //   slow_penetrator 계열·sabot·armor_piercing override 전부 apLike로 인식 (exact 문자열 3개 비교 폐기).
  const _profile = getCanonicalProjectileProfile(ammo);
  const apLike = _profile.apLike;
  const fragLike = _profile.fragmentingLike || _profile.expandingLike;
  const residualPen = rt.residualPen;
  const residualPenPresent = !!rt.residualPenPresent;   // [0.39.2 Fix2] 명시적 0 vs 누락 구분
  const om = rt.overmatchMargin;
  const integrity = rt.residualIntegrity;

  // 입구 — 구경 지배, 확장(HP)↑, AP narrow
  let entry = calMm * 3.2;
  if (fragLike) entry *= 1.25;
  if (apLike) entry *= 0.72;
  if (ev.sourceType === 'frag') entry = 18 + dmg * 0.4;
  if (ev.sourceType === 'blast') entry = 40 + dmg * 0.3;
  // 내부 — [IMPACT-A Phase3] permanent cavity(구경/crush/파편) + temporary cavity(실제 impact energy) 분리.
  //   permanent: 유효직경·확장·파편·잔여관통 지배 (에너지 아님). temporary: 실제 impact energy 포화 곡선.
  //   기존 damage 기반 항은 rawDamage 호환 입력으로만 (energy와 중복 곱 금지).
  let internal = dmg * 0.45 + pen * 0.25;   // rawDamage/pen 호환 기반 (velocity 항 제거 — 아래 kinetic으로 대체)
  // permanent cavity 성분 — 구경·확장·파편·잔여관통 (에너지 비의존)
  let permanentCavity = calMm * 1.1 + (residualPen != null ? residualPen : 0) * 0.4;
  if (fragLike) permanentCavity *= 1.18;
  if (apLike) permanentCavity *= 0.82;   // AP: 좁은 permanent cavity
  // temporary cavity 성분 — 실제 impact energy 포화 (fallback: 프리셋 vel 기반 legacy 근사)
  // [0.39.3 A-Closure] 중량 아음속 판정 — canonical profile.heavySlow만 사용 (ID 정규식 재추측 폐기).
  //   'heavy'만 momentum crush 보조. pdw_light/standard/armor_piercing은 보너스 없음. slug는 별도 분기.
  const _subClass = _profile.subsonicClass;
  const _isSlug = /slug/i.test((_pkt && _pkt.projectileClass) || '') || /slug/i.test((ammo && ammo.id) || '');
  const _heavySlow = _profile.heavySlow;
  let temporaryCavity;
  if (_hasKin && _energySat != null) {
    // energy 포화 × terminal 발현 조건. 저속 권총탄은 낮은 energySat로 자동 억제.
    let termMul = 1.0;
    if (fragLike) termMul = 1.15;          // 파편/확장: temporary cavity 발현↑
    else if (apLike) termMul = 0.55;       // AP: 조직 통과, temporary cavity 작음 (좁고 깊음)
    if (_heavySlow) termMul = Math.min(termMul, 0.7);   // 중량 아음속: temporary cavity 과장 금지
    temporaryCavity = _energySat * 55 * termMul;
    // 운동량 보조 — 중량/저속탄: 낮은 velocity지만 momentum으로 permanent crush 보강 (temporary 과장 아님)
    if (_momentumAssist != null && _heavySlow) {
      permanentCavity += _momentumAssist * 14;   // permanent cavity/관통 과소평가 방지
    } else if (_momentumAssist != null && _isSlug) {
      permanentCavity += _momentumAssist * 12;
    }
  } else {
    // legacy fallback — 기존 프리셋 vel 공식 유지 (kineticFallback=true로 표시됨)
    temporaryCavity = Math.max(0, vel - 600) * 0.10;
  }
  internal += permanentCavity * 0.5 + temporaryCavity * 0.5;
  if (fragLike) internal *= 1.18;
  if (apLike) internal *= 0.92;
  if (ev.sourceType === 'blast') internal = 45 + dmg * 0.4;
  // §4: tissueDamageMul 보조 반영 (AP 낮음→좁고 깊음 유지, HP/deform 높음→내부↑) — 보수적 clamp
  const tdmMul = Math.max(0.82, Math.min(1.28, 0.9 + (tdm - 1) * 0.45));
  internal *= tdmMul;
  // SIDE-AMMO-1B §3-8: sabot 관통자는 wound channel이 좁다 (관통은 높아도 공동은 작음)
  const _sab = (typeof _sabotInfo === 'function') ? _sabotInfo(ammo) : null;
  if (_sab) { entry *= _sab.woundChannelMul; internal *= (0.5 + 0.5 * _sab.woundChannelMul); }
  // 깊이/채널 — [0.39.1 Fix3] residual threat 중심. 우선순위: residualPen > integrity > continuation > kinetics > ammo.penetration(fallback).
  //   같은 탄약이라도 실제 잔여위협(residualPen/integrity)이 낮아지면 깊이도 감소한다.
  let channel;
  if (_hasKin && residualPenPresent) {
    // [0.39.2 Fix2] residualPen이 명시적으로 존재(0 포함) → ammo.penetration fallback 금지. 실제 잔여값 지배.
    const _rpBase = Math.max(0, residualPen);   // 0이면 0 그대로 (프리셋 부활 없음)
    channel = Math.min(1.7, 0.30 + _rpBase * 0.022 + om * 0.015);
    // continuation depth(관통 지속) 보강, integrity 저하 시 감쇠
    if (rt.continuationDepth) channel = Math.min(1.8, channel + Math.min(0.3, rt.continuationDepth * 0.02));
    if (integrity != null && integrity < 0.6) channel *= (0.5 + integrity * 0.7);   // 발사체 파손/변형 → 얕아짐
    // momentum 보조 — 중량 저속탄이 residual만으로 과소평가되지 않게 소폭 하한 보정 (단, 잔여 0이면 하한도 낮게)
    if (_momentumAssist != null && _momentumAssist > 0.5 && _rpBase > 0) channel = Math.max(channel, 0.55 + _momentumAssist * 0.35);
  } else {
    // legacy fallback — residualPen 데이터 누락(null) 시에만 ammo.penetration 기준선 사용
    channel = Math.min(1.6, 0.4 + pen * 0.02 + om * 0.02);
  }
  // SHOTGUN-MED-NORM-1 §9: 산탄 펠릿 의료 보정 (slug 미적용 — isShotgunPellet일 때만)
  if (pelletMeta.isShotgunPellet) {
    entry *= Math.sqrt(pelletMeta.medicalScalar);
    internal *= pelletMeta.medicalScalar;
    if (pelletMeta.isFlechette) {
      // flechette: 좁고 깊은 puncture. 공동/사출구 과장 금지.
      entry *= 0.75; internal *= 0.65; channel = Math.min(channel, 0.95);
    }
    if (pelletMeta.isBuckshot) {
      // buckshot: 둥근 납 펠릿. 근거리 위험하나 소총탄급 cavity 아님.
      channel = Math.min(channel, 1.05);
    }
  }
  if (apLike) channel = Math.min(1.7, channel + 0.2);    // 좁고 깊음
  // 방호 감쇠
  if (stopped) { entry *= 0.18; internal *= 0.10; channel *= 0.4; }
  else if (penState === 'shallow') { entry *= 0.62; internal *= 0.45; }
  else if (penState === 'deep') { entry *= 0.85; internal *= 0.78; }

  let entryScore = Math.max(0, entry);
  let internalScore = Math.max(0, internal * channel);
  let sizeScore = entryScore * 0.4 + internalScore * 0.6;

  // 등급
  const bigCaliber = calMm >= 10;
  const blast = ev.sourceType === 'blast';
  const canMassive = bigCaliber || blast || (sizeScore >= 92);   // frag(내부burst 포함)는 massive 금지
  let sizeClass = _woundSizeClassFromScore(sizeScore);
  if (sizeClass === 'massive' && !canMassive) sizeClass = 'large';
  if (stopped && (sizeClass === 'large' || sizeClass === 'massive')) sizeClass = 'small';
  if (stopped && sizeClass === 'medium') sizeClass = 'small';
  let entrySizeClass = _woundSizeClassFromScore(entryScore);
  let internalSizeClass = _woundSizeClassFromScore(internalScore);
  if (stopped) { if (entrySizeClass === 'large' || entrySizeClass === 'massive') entrySizeClass = 'small'; if (internalSizeClass !== 'micro') internalSizeClass = 'small'; }
  // AP는 입구 작게, massive 금지(대구경/폭발 제외)
  if (apLike && !bigCaliber && (entrySizeClass === 'large' || entrySizeClass === 'massive')) entrySizeClass = 'medium';

  // §4: bleedSeverityMul → bleedingMul 보조 (clamp)
  const bsmMul = Math.max(0.8, Math.min(1.35, bsm));
  const fcChance = (typeof prof.fractureChance === 'number') ? prof.fractureChance : 0;
  let expansionScore = fragLike ? 1 : (apLike ? 0 : 0.5);
  let fragmentationScore = fragLike ? 1 : (integrity < 0.4 ? 0.6 : 0.2);
  // SHOTGUN-MED-NORM-1 §10: 산탄 펠릿 wound size class 상한 clamp (slug 미적용)
  if (pelletMeta.isShotgunPellet) {
    sizeClass = clampWoundClass(sizeClass, pelletMeta.maxInternalClass);
    entrySizeClass = clampWoundClass(entrySizeClass, pelletMeta.maxEntryClass);
    internalSizeClass = clampWoundClass(internalSizeClass, pelletMeta.maxInternalClass);
    if (pelletMeta.isFlechette) {
      sizeClass = clampWoundClass(sizeClass, 'small');
      entrySizeClass = clampWoundClass(entrySizeClass, 'micro');
      internalSizeClass = clampWoundClass(internalSizeClass, 'small');
      fragmentationScore = Math.min(fragmentationScore, 0.1);
      expansionScore = 0;
    }
  }
  return {
    sizeClass, sizeScore: +sizeScore.toFixed(1),
    entrySizeClass, entrySizeScore: +entryScore.toFixed(1),
    internalSizeClass, internalSizeScore: +internalScore.toFixed(1),
    channelScale: +channel.toFixed(2),
    penetrationDepthScore: +(channel * 50).toFixed(1),
    expansionScore,
    fragmentationScore,
    residualThreatScore: +((residualPen != null ? residualPen : 0)).toFixed(1),
    boneRiskHint: +Math.min(1, fcChance).toFixed(2),
    tissueDamageMul: +(0.7 + internalScore / 70).toFixed(2),
    bleedingMul: +((0.6 + sizeScore / 60) * bsmMul).toFixed(2),
    painMul: +(0.7 + sizeScore / 80).toFixed(2),
    uiLabel: WOUND_SIZE_LABEL_KO[sizeClass],
    // [IMPACT-A Phase3] additive kinetic 출력 (기존 소비자 비파괴 — 추가 필드)
    permanentCavityScore: +Math.max(0, permanentCavity).toFixed(1),
    temporaryCavityScore: +Math.max(0, temporaryCavity).toFixed(1),
    kineticBasis: _hasKin,
    kineticFallback: _kineticFallback,
    impactVelocityMps: _hasKin ? +impactVel.toFixed(1) : null,
    impactEnergyJ: (impactE != null) ? +impactE.toFixed(1) : null,
    impactMomentumNs: (impactMom != null) ? +impactMom.toFixed(3) : null,
    energyRatio: _hasKin ? +energyRatioK.toFixed(4) : null,
    momentumRatio: (_pkt && _pkt.momentumRatio != null) ? _pkt.momentumRatio : null,
    projectileIntegrity: (projIntegrity != null) ? +projIntegrity.toFixed(3) : null,
    // [0.39.3 A-Closure] canonical profile 추적 (additive, AAR/debug)
    subsonicClass: _profile.subsonicClass,
    terminalBehaviorClass: _profile.terminalBehaviorClass,
    apLike: _profile.apLike,
    heavySlow: _profile.heavySlow,
    profileFallbackUsed: _profile.fallbackUsed,
    profileFallbackReasons: _profile.fallbackReasons,
  };
}
function computeBleedingProfile(ammo, ev, woundType, woundSize, penState) {
  const partKey = ev.partKey;
  const zone = ev.anatomicalZone;
  const isLimb = (partKey === 'leftArm' || partKey === 'rightArm' || partKey === 'leftLeg' || partKey === 'rightLeg');
  const isCavityPart = (partKey === 'chest' || partKey === 'abdomen');
  const junctional = _zoneIsJunctional(zone);
  const vesselCrit = _zoneIsVesselCritical(zone, partKey);
  // 비출혈 유형
  if (woundType === 'bruise' || woundType === 'abrasion' || woundType === 'blunt_trauma' || woundType === 'blunt_trauma_armor' || woundType === 'none') {
    return { bleedingType:'none', baseExternal:0, baseInternal:0, currentExternal:0, currentInternal:0, rebleedRisk:0, tourniquetEligible:false, vesselRisk:0 };
  }
  const bmul = (woundSize && woundSize.bleedingMul) || 1.0;
  // 기본 출혈량 (severity → ml/s 근사)
  let baseRate = (ev.bleedRisk || 0) * 18 + (woundSize ? woundSize.sizeScore * 0.18 : 4);
  baseRate *= bmul;
  if (woundSize && woundSize.sizeClass === 'micro') baseRate = Math.min(baseRate, 0.8);
  baseRate = Math.max(0, baseRate);
  let bleedingType = 'external', ext = baseRate, intl = 0, tourniquetEligible = false, rebleed = 0.3;
  let vesselRisk = (ev.bleedRisk || 0);
  if (vesselCrit) vesselRisk = Math.max(vesselRisk, 0.9);

  if (junctional) {
    bleedingType = 'junctional';
    ext = baseRate * 1.1; tourniquetEligible = false; rebleed = 0.5;
  } else if (isCavityPart && (woundType === 'cavity_wound' || penState === 'penetrating' || penState === 'through_and_through' || penState === 'deep')) {
    bleedingType = 'cavity';
    ext = baseRate * 0.25; intl = baseRate * 1.1; tourniquetEligible = false; rebleed = 0.4;
  } else if (isCavityPart) {
    bleedingType = 'mixed';
    ext = baseRate * 0.4; intl = baseRate * 0.7; tourniquetEligible = false; rebleed = 0.35;
  } else if (isLimb) {
    bleedingType = 'external';
    ext = baseRate; tourniquetEligible = true; rebleed = 0.45;
  } else if (partKey === 'neck') {
    bleedingType = vesselCrit ? 'junctional' : 'external';
    ext = baseRate; tourniquetEligible = false; rebleed = 0.6;
  } else if (partKey === 'head') {
    bleedingType = 'external'; ext = baseRate * 0.7; intl = baseRate * 0.3; tourniquetEligible = false;
  }
  // AP narrow지만 vesselRisk 높으면 치명
  if (vesselRisk > 0.7) { ext *= 1.2; intl *= 1.2; }
  return {
    bleedingType, baseExternal:+ext.toFixed(2), baseInternal:+intl.toFixed(2),
    currentExternal:+ext.toFixed(2), currentInternal:+intl.toFixed(2),
    rebleedRisk:+rebleed.toFixed(2), tourniquetEligible, vesselRisk:+vesselRisk.toFixed(2),
  };
}
function computeFieldCare(ev, woundType, woundSize, bleedingProfile) {
  // 비출혈 둔상/타박/찰과는 현장처치 가능
  if (woundType === 'bruise' || woundType === 'abrasion' || woundType === 'blunt_trauma' || woundType === 'blunt_trauma_armor' || woundType === 'none') return 'treatable';
  if (bleedingProfile && bleedingProfile.bleedingType === 'none' && woundType !== 'cavity_wound') return 'treatable';
  const partKey = ev.partKey;
  const zone = ev.anatomicalZone;
  const isLimb = (partKey === 'leftArm' || partKey === 'rightArm' || partKey === 'leftLeg' || partKey === 'rightLeg');
  const vesselCrit = _zoneIsVesselCritical(zone, partKey);
  const size = woundSize ? woundSize.sizeClass : 'small';
  // 목/심장/대혈관 후보 — 현장처치 불가
  if (vesselCrit || (partKey === 'neck' && bleedingProfile.bleedingType === 'junctional')) return 'field_unmanageable';
  if (partKey === 'neck' && (size === 'large' || size === 'massive')) return 'field_unmanageable';
  // 체강 출혈
  if (bleedingProfile.bleedingType === 'cavity') {
    if (size === 'massive') return 'field_unmanageable';
    if (size === 'large') return 'limited';
    return 'limited';
  }
  // 사지 초대형 — 지혈대로 응급 억제 가능
  if (isLimb) {
    if (size === 'massive') return 'controllable';
    return 'treatable';
  }
  // 접합부
  if (bleedingProfile.bleedingType === 'junctional') return (size === 'massive') ? 'field_unmanageable' : 'limited';
  // 복부/흉부 일반
  if (partKey === 'chest' || partKey === 'abdomen') return (size === 'massive') ? 'field_unmanageable' : 'limited';
  if (woundType === 'bruise' || woundType === 'abrasion' || woundType === 'blunt_trauma') return 'treatable';
  return 'treatable';
}
function computeTreatmentProfile(ev, woundType, bleedingProfile) {
  const isLimb=['leftArm','rightArm','leftLeg','rightLeg'].includes(ev.partKey);
  return {pressureBandageEligible:true,tourniquetEligible:isLimb,bandageEligible:true,hemostaticEligible:true,packingEligible:true,splintRelevant:!!ev._fracture,pelvicBinderRelevant:ev.partKey==='abdomen',bodyPartTreatmentKey:ev.partKey,treatmentPriority:bleedingProfile.bleedingType==='none'?0:2,recommendedActions:[]};
}

function _woundShouldBleed(ev, penState) {
  if (ev.armorResult === 'penetrated') return true;
  if (ev.wasPenetrated) return true;
  if (penState === 'shallow' || penState === 'deep' || penState === 'penetrating' || penState === 'through_and_through') return true;
  if (ev.sourceType === 'frag' && ev.fragmentPenetrated) return true;
  // 막힌 파편(stopped + !fragmentPenetrated) → 출혈 없음
  return false;
}
const BODY_RESISTANCE = {
  head:      { cost:10, exitCost:5, cls:'rigid_high',   cavity:false },
  neck:      { cost:7,  exitCost:4, cls:'soft_vascular', cavity:false },
  chest:     { cost:14, exitCost:5, cls:'cavity_torso',  cavity:true  },
  abdomen:   { cost:12, exitCost:5, cls:'cavity_torso',  cavity:true  },
  left_arm:  { cost:7,  exitCost:3, cls:'limb_thin',     cavity:false },
  right_arm: { cost:7,  exitCost:3, cls:'limb_thin',     cavity:false },
  left_leg:  { cost:11, exitCost:5, cls:'limb_thick',    cavity:false },
  right_leg: { cost:11, exitCost:5, cls:'limb_thick',    cavity:false },
  legs:      { cost:11, exitCost:5, cls:'limb_thick',    cavity:false },
  arms:      { cost:7,  exitCost:3, cls:'limb_thin',     cavity:false },
};
function _projectileSizeClass(ammo, profile, ev) {
  if (ev && ev.sourceType === 'frag' && ev.isFragment) return 'micro_fragment';
  // SHOTGUN-MED-NORM-1 §11: 의료 메타의 forceProjectileSizeClass 우선 (flechette → sabot_subcaliber). buckshot slug 오분류 방지.
  const pelletMeta = getMedicalProjectileMeta(ammo, ev);
  if (pelletMeta.projectileSizeClass && (pelletMeta.isFlechette || pelletMeta.isBuckshot)) return pelletMeta.projectileSizeClass;
  const fam = (profile && profile.family) || '';
  const cal = (ammo && (ammo.caliberMm || ammo.caliber)) || null;
  const id = (ammo && ammo.id) || (ev && ev.ammoId) || '';
  if (/sabot|flechette/.test(fam) || /sabot|flechette/.test(id)) return 'sabot_subcaliber';
  if (/pdw|4_6|4x30|5_7|5x28/.test(id) || fam === 'pdw_penetrator' || fam === 'pdw_subsonic') return 'small_pdw';
  if (/pellet|buck/.test(id)) return 'pellet';
  if (/slug/.test(id)) return 'shotgun_slug';
  if (/anti_material|large_bore|12_7|127x|338|408|50bmg|50_bmg/.test(id) || fam === 'large_bore_ball' || /anti_material/.test(fam)) return (/ap|heiap|penetrator/.test(fam) ? 'anti_material' : 'large_bore');
  if (/pistol/.test(fam) || /^9mm|^45|^40sw|357|380/.test(id)) return 'pistol';
  // 소총탄 — 구경/탄종으로 intermediate vs full power
  if (/762x51|762x54|308|3006|762nato|m80|m118/.test(id)) return 'full_power_rifle';
  if (/556|545|762x39|300blk|68|grendel|223/.test(id)) return 'intermediate_rifle';
  if (cal != null) { if (cal >= 12) return 'large_bore'; if (cal >= 7) return 'full_power_rifle'; if (cal >= 5) return 'intermediate_rifle'; }
  return 'intermediate_rifle';
}
const _PROJ_SIZE_MODS = {
  micro_fragment:    { crush:0.5, cavity:0.3, bone:0.5, exit:0.3, retain:0.2, overpen:-0.3 },
  pellet:            { crush:0.8, cavity:0.5, bone:0.7, exit:0.6, retain:0.3, overpen:-0.2 },
  small_pdw:         { crush:0.7, cavity:0.7, bone:0.8, exit:0.8, retain:0.05, overpen:0.2 },
  sabot_subcaliber:  { crush:0.6, cavity:0.7, bone:0.85, exit:0.9, retain:0.02, overpen:0.35 },
  pistol:            { crush:1.0, cavity:0.7, bone:0.9, exit:0.9, retain:0.18, overpen:-0.1 },
  intermediate_rifle:{ crush:1.0, cavity:1.1, bone:1.0, exit:1.0, retain:0.06, overpen:0.15 },
  full_power_rifle:  { crush:1.15, cavity:1.35, bone:1.15, exit:1.15, retain:0.05, overpen:0.25 },
  large_bore:        { crush:1.5, cavity:1.4, bone:1.4, exit:1.3, retain:0.12, overpen:0.1 },
  shotgun_slug:      { crush:1.6, cavity:1.2, bone:1.5, exit:1.2, retain:0.2, overpen:-0.1 },
  anti_material:     { crush:1.3, cavity:1.5, bone:1.4, exit:1.4, retain:0.03, overpen:0.5 },
};
function _bodyTerminalMods(profile) {
  const fam = (profile && profile.family) || '';
  const ch = (profile && profile.woundChannel) || 'normal';
  let costMul = 1.0, exitMul = 1.0, retainBias = 0.0, channel = 'normal';
  if (/ap|penetrator|sabot|narrow/.test(fam) || ch === 'narrow') { costMul = 0.7; exitMul = 1.35; retainBias = -0.12; channel = 'narrow'; }
  else if (/expand/.test(fam) || ch === 'expanding') { costMul = 1.4; exitMul = 0.6; retainBias = 0.18; channel = 'expanding'; }
  else if (/frangible|fragmenting/.test(fam) || ch === 'fragmenting') { costMul = 1.5; exitMul = 0.4; retainBias = 0.22; channel = 'fragmenting'; }
  else if (/subsonic_heavy|crush/.test(fam) || ch === 'crushing') { costMul = 1.2; exitMul = 0.55; retainBias = 0.25; channel = 'crushing'; }
  else if (/controlled_fragment|barrier_blind/.test(fam)) { costMul = 1.2; exitMul = 0.75; retainBias = 0.1; channel = 'controlled'; }
  if (profile && profile.exitWoundMul != null) exitMul *= profile.exitWoundMul;
  return { costMul, exitMul, retainBias, channel, fam };
}
function normalizeMedicalImpactAddress(addr, ev) {
  addr = addr || {}; ev = ev || {};
  const full = addr.fullAddress || makeArmorAddressKey(addr) || '';
  const side = addr.side || addr.impactSide || '';
  const region = addr.region || '';
  let hitPart = addr.hitPart || ev.hitPart || ev.partKey || ev.location || '';
  hitPart = ({ leftArm:'left_arm', rightArm:'right_arm', leftLeg:'left_leg', rightLeg:'right_leg' })[hitPart] || hitPart;
  const zone = addr.zone || '', sub = addr.subZone || '';
  const out = {
    fullAddress: full, sourceAddress: full, region, hitPart, partKey: ev.partKey || hitPart, side, zone, subZone: sub,
    medicalZone: null, anatomicalZone: null, vascularRegion: null, organRegion: null, cavityRegion: null,
    junctionalRegion: null, limbRegion: null, headFaceRegion: null,
    airwayRisk: false, chestCavityRisk: false, abdominalCavityRisk: false, pelvicCavityRisk: false,
    junctionalBleedRisk: false, majorVesselRiskHint: false, neuroRisk: false, aliases: [],
  };
  const A = out.aliases;
  const isChest = hitPart === 'chest', isAbd = hitPart === 'abdomen', isNeck = hitPart === 'neck';
  const isArm = hitPart === 'left_arm' || hitPart === 'right_arm' || hitPart === 'arms';
  const isLeg = hitPart === 'left_leg' || hitPart === 'right_leg' || hitPart === 'legs';
  const isHead = hitPart === 'head', isFace = hitPart === 'face';
  // === 흉부/상체 ===
  if (isChest) {
    if (zone === 'axilla_gap' || /axilla/.test(zone) || /axilla/.test(sub)) {
      out.medicalZone = 'axilla'; out.anatomicalZone = 'axilla'; out.vascularRegion = 'axillary_subclavian';
      out.organRegion = 'lung_apex'; out.junctionalBleedRisk = true; out.chestCavityRisk = true; A.push('axillaGap','axilla_gap');
    } else if (zone === 'clavicle') {
      out.medicalZone = 'clavicle'; out.vascularRegion = 'subclavian'; out.organRegion = 'upper_thorax'; out.chestCavityRisk = true; A.push('clavicle');
    } else if (zone === 'supraclavicular') {
      out.medicalZone = 'supraclavicular'; out.vascularRegion = 'subclavian'; out.organRegion = 'thoracic_inlet';
      out.chestCavityRisk = true; out.junctionalBleedRisk = true; A.push('supraclavicular');
    } else if (zone === 'collar_line' || /collar_line/.test(zone)) {
      out.medicalZone = 'collar_line'; out.vascularRegion = 'subclavian'; out.organRegion = 'upper_thorax'; out.chestCavityRisk = true; A.push('collar_line','clavicle');
    } else if (/upper_lateral|lower_lateral/.test(zone)) {
      out.medicalZone = (zone === 'upper_lateral' ? 'lateral_chest_upper' : 'lateral_chest_lower'); out.organRegion = 'lung';
      out.cavityRegion = 'pleural'; out.chestCavityRisk = true; A.push('lateralThoraxGap','side');
    } else if (zone === 'side_core' || sub === 'side_plate_core') {
      out.medicalZone = 'lateral_chest'; out.organRegion = 'lung'; out.cavityRegion = 'pleural'; out.chestCavityRisk = true; A.push('side');
    } else {
      out.medicalZone = (zone || 'chest'); out.organRegion = 'thorax'; out.cavityRegion = 'pleural'; out.chestCavityRisk = true;
      if (zone === 'sternum_upper' || zone === 'upper') A.push('upperGap');
      if (zone === 'mid' || zone === 'lower') A.push('softCenter');
    }
  }
  // === 복부/골반/낭심 ===
  else if (isAbd) {
    if (zone === 'groin') {
      out.junctionalBleedRisk = true; out.vascularRegion = 'femoral_iliac';
      if (sub === 'groin_junctional') { out.medicalZone = 'groin_junctional'; out.junctionalRegion = 'inguinal'; out.majorVesselRiskHint = true; A.push('groin_junctional','groin_adjacent','pelvisGroinAdjacent'); }
      else { out.medicalZone = 'groin'; out.junctionalRegion = 'groin'; A.push('groin','groin_adjacent'); }
    } else if (zone === 'pelvis' || /pelvis/.test(zone)) {
      out.medicalZone = 'pelvis_upper'; out.vascularRegion = 'iliac'; out.cavityRegion = 'pelvic';
      out.pelvicCavityRisk = true; out.junctionalBleedRisk = true; A.push('pelvis','pelvis_upper');
    } else if (/upper_flank|lower_flank|flank/.test(zone)) {
      out.medicalZone = (zone === 'upper_flank' ? 'flank_upper' : 'flank_lower'); out.organRegion = 'kidney_or_solid_organ_side';
      out.cavityRegion = 'retroperitoneal'; out.abdominalCavityRisk = true; A.push('flankRegion');
    } else if (/kidney/.test(zone)) {
      out.medicalZone = 'kidney_region'; out.organRegion = 'kidney'; out.cavityRegion = 'retroperitoneal'; out.abdominalCavityRisk = true; A.push('kidneyRearRegion','kidney_left','kidney_right');
    } else {
      out.medicalZone = (zone || 'abdomen'); out.organRegion = (zone === 'upper' ? 'upper_abdomen_solid_organ' : 'abdomen');
      out.cavityRegion = 'peritoneal'; out.abdominalCavityRisk = true;
      if (zone === 'upper') A.push('upperEdge','upperAbdomenExposed');
      if (sub === 'groin_adjacent') { out.junctionalBleedRisk = true; A.push('groin_adjacent'); }
    }
  }
  // === 목 ===
  else if (isNeck) {
    out.medicalZone = (zone || 'neck'); out.vascularRegion = 'carotid_jugular'; out.junctionalBleedRisk = true; out.majorVesselRiskHint = true;
    out.airwayRisk = (zone === 'throat_upper' || zone === 'throat_lower' || zone === 'neck_base');
    out.neuroRisk = (side === 'rear' || zone === 'nape'); A.push('neck');
  }
  // === 다리(대퇴/서혜) ===
  else if (isLeg) {
    out.limbRegion = 'leg';
    if (zone === 'femoral_triangle') {
      out.medicalZone = 'femoral_triangle'; out.vascularRegion = 'femoral'; out.limbRegion = 'proximal_thigh';
      out.junctionalBleedRisk = true; out.majorVesselRiskHint = true; A.push('femoral_triangle','upperInnerThighProximal','innerThigh');
    } else if (zone === 'upper_thigh') {
      if (sub === 'proximal_inner') { out.medicalZone = 'proximal_inner_thigh'; out.vascularRegion = 'femoral_branch'; out.junctionalBleedRisk = 'possible'; out.limbRegion = 'proximal_thigh'; A.push('innerThigh','upperInnerThighProximal'); }
      else { out.medicalZone = 'proximal_thigh'; out.limbRegion = 'proximal_thigh'; A.push('proximal_thigh'); }
    } else if (zone === 'mid_thigh') { out.medicalZone = 'mid_thigh'; out.limbRegion = 'mid_thigh'; }
    else if (zone === 'knee') { out.medicalZone = 'knee'; out.limbRegion = 'knee'; }
    else if (zone === 'lower_leg') { out.medicalZone = 'lower_leg'; out.limbRegion = 'distal_leg'; }
    else { out.medicalZone = (zone || 'leg'); }
  }
  // === 팔/어깨/겨드랑이 ===
  else if (isArm) {
    out.limbRegion = 'arm';
    if (zone === 'axilla_gap') { out.medicalZone = 'axilla'; out.vascularRegion = 'axillary'; out.junctionalBleedRisk = true; out.majorVesselRiskHint = true; A.push('axillaGap','axilla_gap'); }
    else if (zone === 'shoulder') { out.medicalZone = 'shoulder'; out.limbRegion = 'shoulder'; A.push(sub||'shoulder'); }
    else if (zone === 'upper_arm') { out.medicalZone = 'upper_arm'; out.limbRegion = 'upper_arm'; if (sub === 'proximal_inner') { out.vascularRegion = 'brachial'; A.push('innerArm'); } }
    else if (zone === 'forearm') { out.medicalZone = 'forearm'; out.limbRegion = 'forearm'; }
    else { out.medicalZone = (zone || 'arm'); }
  }
  // === 머리(두개) ===
  else if (isHead) {
    out.neuroRisk = true;
    if (zone === 'forehead' || zone === 'crown_front') { out.medicalZone = 'forehead'; out.organRegion = 'skull_brain_frontal'; A.push('forehead'); }
    else if (zone === 'crown') { out.medicalZone = 'crown'; out.organRegion = 'skull_brain_vertex'; A.push('crown'); }
    else if (zone === 'temporal') { out.medicalZone = 'temporal'; out.organRegion = 'skull_brain_temporal'; A.push('temporal'); }
    else if (zone === 'occipital' || zone === 'nape_shell') { out.medicalZone = 'occipital'; out.organRegion = 'skull_brain_occipital'; A.push('occipital'); }
    else if (zone === 'ear') { out.medicalZone = 'ear'; out.organRegion = 'skull_base_temporal'; A.push('ear'); }
    else { out.medicalZone = (zone || 'head'); out.organRegion = 'skull_brain'; }
  }
  // === 얼굴(안면) ===
  else if (isFace) {
    out.headFaceRegion = (zone === 'upper' ? 'upper_face' : zone === 'mid' ? 'mid_face' : zone === 'lower' ? 'lower_face' : 'face');
    if (zone === 'upper') {
      if (sub === 'eyes') { out.medicalZone = 'eyes'; out.neuroRisk = 'possible'; A.push('eyes'); }
      else { out.medicalZone = 'brow'; out.neuroRisk = 'possible'; A.push('brow'); }
    } else if (zone === 'mid') { out.medicalZone = 'mid_face'; out.airwayRisk = 'possible'; A.push('nose','cheek'); }
    else if (zone === 'lower') { out.medicalZone = (sub === 'jaw' ? 'jaw' : 'mouth_jaw'); out.airwayRisk = true; A.push('jaw','mouth'); }
    else if (sub === 'cheek' || zone === 'cheek') { out.medicalZone = 'cheek'; out.airwayRisk = 'possible'; A.push('cheek'); }
    else { out.medicalZone = (zone || 'face'); }
  }
  else { out.medicalZone = (zone || hitPart || 'unknown'); }
  return out;
}
function classifyBleedingClass(depth, hitPart, ia, deep) {
  const zone = ia && ia.zone, sub = ia && ia.subZone, side = ia && (ia.impactSide || ia.side);
  const med = ia && ia.medical;   // SIDE-MEDICAL-TRAUMA-BRIDGE-1 §6: 결정형 의료주소 우선
  // 결정형 주소 기반 junctional/cavity 판정 (medAddr) — legacy 조건은 fallback
  const medJunctional = !!(med && (med.junctionalBleedRisk === true || med.majorVesselRiskHint === true
    || med.medicalZone === 'groin' || med.medicalZone === 'groin_junctional' || med.medicalZone === 'femoral_triangle'
    || med.medicalZone === 'supraclavicular' || med.medicalZone === 'axilla' || med.vascularRegion === 'femoral' || med.vascularRegion === 'femoral_iliac'));
  const medCavity = !!(med && (med.chestCavityRisk || med.abdominalCavityRisk || med.pelvicCavityRisk));
  const junctional = medJunctional
    || (hitPart === 'abdomen' && (zone === 'groin' || zone === 'pelvis' || sub === 'groin_adjacent'))
    || (hitPart === 'neck');
  if (depth === 'surface_only') return 'no_bleed_or_minor';
  if (depth === 'shallow_entry') return (hitPart === 'neck' || junctional) ? 'external_controllable_bleed' : 'superficial_bleed';
  // deep_penetration / near_exit_lodged / body_through_and_through
  // femoral_triangle / proximal_inner_thigh 는 사지라도 junctional 유지 (단순 muscle_bleed 금지)
  if (med && (med.medicalZone === 'femoral_triangle' || (med.medicalZone === 'proximal_inner_thigh' && deep) || (med.medicalZone === 'axilla'))) return 'junctional_bleed';
  if (hitPart === 'chest' || hitPart === 'abdomen') {
    if (junctional) return 'junctional_bleed';
    return 'cavity_internal_bleed';
  }
  if (junctional) return 'junctional_bleed';
  if (hitPart === 'neck') return 'junctional_bleed';
  // pelvis_upper deep (abdomen 외 경로로 온 경우)
  if (medCavity && deep && (hitPart === 'chest' || hitPart === 'abdomen')) return 'cavity_internal_bleed';
  // 사지
  if (hitPart === 'left_leg' || hitPart === 'right_leg' || hitPart === 'legs' || hitPart === 'left_arm' || hitPart === 'right_arm' || hitPart === 'arms') {
    return deep ? 'muscle_bleed' : 'external_controllable_bleed';
  }
  return 'external_controllable_bleed';
}
function buildOrganVesselCandidateMap(hitPart, ia, depth, deep, sizeClass, terminalFam, crushBias) {
  const candidates = [];
  const tags = new Set();
  // §6 깊이 게이트 — surface_only/shallow_entry는 장기·대혈관 후보 강하게 제한
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  const isShallow = (depth === 'shallow_entry');
  const through = (depth === 'body_through_and_through');
  const nearExit = (depth === 'near_exit_lodged');
  const zone = ia && ia.zone, sub = ia && ia.subZone, side = (ia && (ia.impactSide || ia.side)) || '';
  const limbLoc = ia && ia.limbLocation;
  // §7 탄종/크기 → severity 편향
  const fam = terminalFam || '';
  let sevBias = crushBias || 0;
  if (/expand|jhp|hollow/.test(fam) || sizeClass === 'large_bore' || sizeClass === 'shotgun_slug') sevBias += 1;
  if (sizeClass === 'anti_material') sevBias += 1;
  if (sizeClass === 'sabot_subcaliber' || /ap|penetrator|narrow/.test(fam)) sevBias -= 0.5;   // 좁고 깊음 — crush 낮음
  const microFrag = (sizeClass === 'micro_fragment' || sizeClass === 'small');
  const bumpSev = (base) => {
    const order = ['low','medium','high'];
    let i = order.indexOf(base); if (i < 0) i = 0;
    i = Math.max(0, Math.min(2, i + Math.round(sevBias)));
    return order[i];
  };
  const add = (id, label, type, confidence, severityHint, reason, source) => {
    candidates.push({ id, label, type, confidence, severityHint: bumpSev(severityHint), reason, source: source || 'trajectory', confirmed: false });
  };
  // === 깊이 부족: 표층/근육 후보만 ===
  if (!isDeep) {
    if (isShallow) {
      // SIDE-MED-2B-1A-HOTFIX-1 §3: chest/abdomen 표층 후보 id 구분 (라벨은 체벽/근육층, id는 부위별).
      if (hitPart === 'chest') add('chest_wall_candidate', '흉벽/근육층 후보', 'soft_tissue', 'low', 'low', 'shallow_entry', 'trajectory');
      else if (hitPart === 'abdomen') add('abdominal_wall_candidate', '복벽/근육층 후보', 'soft_tissue', 'low', 'low', 'shallow_entry', 'trajectory');
      else add('soft_tissue_candidate', '연조직 후보', 'soft_tissue', 'low', 'low', 'shallow_entry', 'trajectory');
      tags.add('hemostaticCandidate');
    }
    return _finishMap(candidates, tags);
  }
  // micro/small fragment는 deep이라도 장기/through 후보 남발 금지 — 보수적
  const fragConservative = microFrag && !through;

  if (hitPart === 'chest') {
    // §8.1 — 측면(lateral)은 subZone/zone이 명시적 측면일 때만. 그 외(정면/중앙, left-ish 포함)는 front/center.
    const isLateral = (sub === 'leftSideEdge' || sub === 'rightSideEdge' || sub === 'lateralThoraxGap'
                    || sub === 'axillaGap' || sub === 'armShoulderGap' || zone === 'side' || zone === 'axilla');
    if (isLateral) {
      add('lung_candidate', '폐 후보', 'organ', 'medium', 'medium', 'side_chest_deep', 'trajectory');
      add('rib_candidate', '늑골 후보', 'bone', 'medium', 'low', 'side_chest', 'trajectory');
      if (sub === 'axillaGap' || sub === 'armShoulderGap' || zone === 'axilla') add('axillary_vessel_candidate', '액와혈관 후보', 'vessel', 'low', 'medium', 'axilla_adjacent', 'impactAddress');
    } else if (side === 'rear' || zone === 'rear') {
      add('lung_candidate', '폐 후보', 'organ', 'medium', 'medium', 'rear_chest_deep', 'trajectory');
      add('rib_candidate', '늑골 후보', 'bone', 'medium', 'low', 'rear_chest', 'trajectory');
      if (deep) add('thoracic_vessel_candidate', '흉부혈관 후보', 'vessel', 'low', 'high', 'rear_chest_deep', 'trajectory');
      // heart는 rear에서 제한
    } else {
      // front/center (left-ish frontal 포함)
      add('lung_candidate', '폐 후보', 'organ', 'medium', 'medium', 'front_chest_deep', 'trajectory');
      add('rib_candidate', '늑골 후보', 'bone', 'low', 'low', 'front_chest', 'trajectory');
      add('pleural_space_candidate', '흉막강 후보', 'cavity', 'low', 'medium', 'penetrating_chest', 'trajectory');
      // heart는 center/upper/left-ish + high severity(또는 through/nearExit) 조건에서만 제한적으로
      const centerUpperLeft = (sub === 'softCenter' || sub === 'upperGap' || sub === 'plateCore' || /left/.test(side) || zone === 'upper' || zone === 'center');
      if (centerUpperLeft && (sevBias >= 1 || through || nearExit)) add('heart_candidate', '심장 후보', 'organ', 'low', 'high', 'central_thorax_high_energy', 'trajectory');
      if (deep) add('thoracic_vessel_candidate', '흉부혈관 후보', 'vessel', 'low', 'high', 'central_thorax_deep', 'trajectory');
    }

    if (sevBias >= 1 || through) tags.add('surgeryRequiredCandidate');
  }
  else if (hitPart === 'abdomen') {
    if (zone === 'upper' || sub === 'upperEdge' || sub === 'upperAbdomenExposed') {
      // §8.2 — 방향성
      if (/right/.test(side)) add('liver_candidate', '간 후보', 'organ', 'medium', 'high', 'right_upper_abdomen', 'trajectory');
      else if (/left/.test(side)) { add('spleen_candidate', '비장 후보', 'organ', 'medium', 'high', 'left_upper_abdomen', 'trajectory'); add('stomach_candidate', '위 후보', 'organ', 'low', 'medium', 'left_upper_abdomen', 'trajectory'); }
      else { add('stomach_candidate', '위 후보', 'organ', 'medium', 'medium', 'central_upper_abdomen', 'trajectory'); add('upper_gi_candidate', '상부위장관 후보', 'organ', 'low', 'medium', 'central_upper_abdomen', 'trajectory'); }
      if (deep) add('upper_abdominal_vessel_candidate', '상복부혈관 후보', 'vessel', 'low', 'high', 'upper_abdomen_deep', 'trajectory');
    }
    else if (zone === 'flank' || sub === 'flankRegion' || sub === 'kidneyRearRegion' || zone === 'side' || /flank/.test(side)) {
      // §8.3 flank
      if (deep || nearExit || through) { add('kidney_candidate', '신장 후보', 'organ', 'medium', 'high', 'flank_deep', 'trajectory'); add('retroperitoneal_bleed_candidate', '후복막출혈 후보', 'cavity', 'low', 'high', 'flank_deep', 'trajectory'); }
      add('flank_muscle_candidate', '측복부 근육 후보', 'soft_tissue', 'medium', 'low', 'flank', 'trajectory');
    }
    else if (zone === 'groin' || zone === 'pelvis' || sub === 'groin_adjacent' || sub === 'pelvisGroinAdjacent' || sub === 'pelvisSideGap' || sub === 'pelvisRearAdjacent') {
      // §8.4/§8.5 pelvis/groin
      add('pelvic_bleed_candidate', '골반출혈 후보', 'cavity', 'medium', 'high', 'pelvis_deep', 'trajectory');
      add('iliac_vessel_candidate', '장골혈관 후보', 'vessel', 'low', 'high', 'pelvis_deep', 'trajectory');
      if (sub === 'groin_adjacent') { add('femoral_vessel_candidate', '대퇴혈관 후보', 'vessel', 'low', 'high', 'groin_junctional', 'trajectory'); add('junctional_bleed_candidate', '접합부출혈 후보', 'cavity', 'medium', 'high', 'groin', 'trajectory'); tags.add('junctionalPressureCandidate'); tags.add('packingCandidate'); tags.add('hemostaticCandidate'); tags.add('tourniquetLimited'); }
      add('bladder_candidate', '방광 후보', 'organ', 'low', 'medium', 'pelvis', 'trajectory');
    }
    else {
      // lower/central abdomen
      add('bowel_candidate', '장 후보', 'organ', 'medium', 'medium', 'lower_abdomen_deep', 'trajectory');
      add('mesenteric_vessel_candidate', '장간막혈관 후보', 'vessel', 'low', 'high', 'lower_abdomen_deep', 'trajectory');
    }
    tags.add('abdominalDressingCandidate');
    if (sevBias >= 1 || through) tags.add('surgeryRequiredCandidate');
  }
  else if (hitPart === 'neck') {
    // §8.6
    add('carotid_candidate', '경동맥 후보', 'vessel', 'medium', 'high', 'neck_deep', 'trajectory');
    add('jugular_candidate', '경정맥 후보', 'vessel', 'medium', 'high', 'neck_deep', 'trajectory');
    if (side === 'front' || zone === 'front' || zone === 'anterior') add('airway_candidate', '기도 후보', 'airway', 'medium', 'high', 'anterior_neck', 'impactAddress');
    if (side === 'rear' || side === 'center' || through || sevBias >= 1) add('cervical_spine_candidate', '경추 후보', 'bone', 'low', 'high', 'neck_rear_or_through', 'trajectory');
    add('neck_junctional_bleed_candidate', '경부 접합부출혈 후보', 'cavity', 'medium', 'high', 'neck', 'trajectory');
    tags.add('hemostaticCandidate'); tags.add('packingCandidate'); tags.add('airwayConcernCandidate');
    tags.add('surgeryRequiredCandidate');
  }
  else if (hitPart === 'left_leg' || hitPart === 'right_leg' || hitPart === 'legs') {
    // §8.7 limbs — torso cavity와 구분, organ 후보 없음
    add('muscle_bleed_candidate', '근육출혈 후보', 'soft_tissue', 'medium', 'low', 'limb', 'trajectory');
    if (limbLoc === 'innerThigh' || limbLoc === 'thighProximal' || sub === 'groin_adjacent') {
      add('femoral_vessel_candidate', '대퇴혈관 후보', 'vessel', 'low', 'high', 'proximal_medial_thigh', 'trajectory');
      tags.add('junctionalPressureCandidate'); tags.add('tourniquetLimited');
    } else { tags.add('tourniquetCandidate'); }
    add('limb_bone_candidate', '사지 골절 후보', 'bone', 'low', 'medium', 'limb', 'trajectory');
    tags.add('pressureBandageCandidate'); tags.add('hemostaticCandidate');
    if ((ia && ia.boneRisk) || sevBias >= 1) tags.add('splintCandidate');
  }
  else if (hitPart === 'left_arm' || hitPart === 'right_arm' || hitPart === 'arms') {
    add('muscle_bleed_candidate', '근육출혈 후보', 'soft_tissue', 'medium', 'low', 'limb', 'trajectory');
    if (limbLoc === 'upperArmProximal' || limbLoc === 'axillaAdjacent') {
      add('axillary_brachial_candidate', '액와/상완혈관 후보', 'vessel', 'low', 'high', 'proximal_arm_axilla', 'trajectory');
      tags.add('junctionalPressureCandidate'); tags.add('tourniquetLimited');
    } else { tags.add('tourniquetCandidate'); }
    add('limb_bone_candidate', '사지 골절 후보', 'bone', 'low', 'medium', 'limb', 'trajectory');
    tags.add('pressureBandageCandidate'); tags.add('hemostaticCandidate');
  }
  else {
    // head 등 기타 — 보수적
    add('soft_tissue_candidate', '연조직 후보', 'soft_tissue', 'low', 'medium', hitPart, 'trajectory');
  }
  // fragment 보수화: micro/small fragment deep(비관통)이면 vessel/organ high confidence 강등
  if (fragConservative) {
    for (const c of candidates) {
      if ((c.type === 'organ' || c.type === 'vessel') && c.confidence === 'medium') c.confidence = 'low';
    }
  }
  // === SIDE-MEDICAL-TRAUMA-BRIDGE-1 §7: 결정형 의료주소(medAddr) 기반 후보 보강 (새 주소 대응) ===
  const med = ia && ia.medical;
  if (med) {
    const has = (id) => candidates.some(c => c.id === id);
    const addM = (id, label, type, conf, sev, reason) => { if (!has(id)) add(id, label, type, conf, sev, reason, 'impactAddress'); };
    const mz = med.medicalZone;
    // 겨드랑이/액와
    if (mz === 'axilla' || med.vascularRegion === 'axillary' || med.vascularRegion === 'axillary_subclavian') {
      addM('axillary_vessel_candidate', '액와혈관 후보', 'vessel', isDeep ? 'medium' : 'low', 'high', 'axilla_gap');
      if (med.chestCavityRisk && isDeep) { addM('lung_apex_candidate', '폐첨부 후보', 'organ', 'low', 'medium', 'axilla_deep'); addM('subclavian_vessel_candidate', '쇄골하혈관 후보', 'vessel', 'low', 'high', 'axilla_apex');  }
      tags.add('junctionalControlCandidate'); tags.add('hemostaticCandidate');
    }
    // 쇄골/쇄골상/칼라
    if (mz === 'clavicle' || mz === 'supraclavicular' || mz === 'collar_line') {
      addM('subclavian_vessel_candidate', '쇄골하혈관 후보', 'vessel', isDeep ? 'medium' : 'low', 'high', 'clavicle_region');
      addM('clavicle_candidate', '쇄골 후보', 'bone', 'medium', 'low', 'clavicle');
      if (mz === 'supraclavicular') addM('thoracic_inlet_candidate', '흉곽입구 후보', 'cavity', 'low', 'high', 'thoracic_inlet');
      if (isDeep && med.chestCavityRisk) { addM('upper_lung_candidate', '상폐엽 후보', 'organ', 'low', 'medium', 'clavicle_deep');  }
      if (mz === 'supraclavicular') tags.add('junctionalControlCandidate');
    }
    // 측흉부
    if (mz === 'lateral_chest_upper' || mz === 'lateral_chest_lower' || mz === 'lateral_chest') {
      addM('lung_candidate', '폐 후보', 'organ', 'medium', 'medium', 'lateral_chest'); addM('rib_candidate', '늑골 후보', 'bone', 'medium', 'low', 'lateral_chest');
      if (med.chestCavityRisk) addM('pleural_cavity_candidate', '흉막강 후보', 'cavity', isDeep ? 'medium' : 'low', 'high', 'pleural_space');
      if (isDeep && (sevBias >= 1 || through)) addM('thoracic_vessel_candidate', '흉부혈관 후보', 'vessel', 'low', 'high', 'lateral_chest_deep');

    }
    // SIDE-MEDICAL-ORGAN-BLEEDING-1 §2: 흉부 정면 중앙 — 폐/늑골/흉막강 + (매우 제한적) 심장 후보
    if (hitPart === 'chest' && (mz === 'upper' || mz === 'mid' || mz === 'lower' || med.organRegion === 'thorax')) {
      addM('lung_candidate', '폐 후보', 'organ', isDeep ? 'medium' : 'low', 'medium', 'anterior_chest');
      addM('rib_candidate', '늑골 후보', 'bone', 'medium', 'low', 'anterior_chest');
      if (med.chestCavityRisk) addM('pleural_cavity_candidate', '흉막강 후보', 'cavity', isDeep ? 'medium' : 'low', 'high', 'pleural_space');
      if ((mz === 'mid' || mz === 'lower' || mz === 'chest') && isDeep) addM('heart_candidate', '심장 후보', 'organ', 'low', 'high', 'central_chest_deep');
    }
    // 옆구리/신장/후복막
    if (mz === 'flank_upper' || mz === 'flank_lower' || mz === 'kidney_region' || med.cavityRegion === 'retroperitoneal') {
      addM('kidney_candidate', '신장 후보', 'organ', isDeep ? 'medium' : 'low', 'high', 'flank_kidney');
      if (isDeep) addM('retroperitoneal_bleed_candidate', '후복막출혈 후보', 'cavity', 'low', 'high', 'retroperitoneal');
      addM('flank_muscle_candidate', '측복부근육 후보', 'soft_tissue', 'low', 'low', 'flank');
    }
    // SIDE-MEDICAL-ORGAN-BLEEDING-1 §3: 복부 정면 실질/중공 장기 후보 (hitPart abdomen 한정 — 흉부 upper/mid/lower와 구분)
    if (hitPart === 'abdomen' && (mz === 'upper' || mz === 'mid' || mz === 'lower' || med.organRegion === 'upper_abdomen_solid_organ' || med.organRegion === 'abdomen')) {
      if (mz === 'upper' || med.organRegion === 'upper_abdomen_solid_organ') {
        // 상복부: 간/비장/위 (좌우 미확정 — 실질장기 후보 집합). isLeft로 편향.
        const _leftBias = (ia && (ia.side === 'left' || ia.impactSide === 'left')) || /left/.test(String((ia&&ia.fullAddress)||''));
        if (_leftBias) { addM('spleen_candidate', '비장 후보', 'organ', isDeep ? 'medium' : 'low', 'high', 'upper_abdomen_left'); addM('stomach_candidate', '위 후보', 'organ', 'low', 'medium', 'upper_abdomen'); }
        else { addM('liver_candidate', '간 후보', 'organ', isDeep ? 'medium' : 'low', 'high', 'upper_abdomen_right_center'); addM('stomach_candidate', '위 후보', 'organ', 'low', 'medium', 'upper_abdomen'); }
      }
      if (mz === 'mid' || mz === 'lower' || med.organRegion === 'abdomen') addM('bowel_candidate', '장(중공장기) 후보', 'organ', isDeep ? 'medium' : 'low', 'medium', 'mid_lower_abdomen');
      if (isDeep && (med.abdominalCavityRisk || through)) addM('abdominal_vessel_candidate', '복부대혈관 후보', 'vessel', 'low', 'high', 'abdomen_deep');
    }
    // 골반
    if (mz === 'pelvis_upper' || med.cavityRegion === 'pelvic') {
      addM('pelvic_bleed_candidate', '골반출혈 후보', 'cavity', isDeep ? 'medium' : 'low', 'high', 'pelvis');
      addM('iliac_vessel_candidate', '장골혈관 후보', 'vessel', 'low', 'high', 'pelvis_upper');
      addM('pelvic_bone_candidate', '골반골 후보', 'bone', 'medium', 'medium', 'pelvis');
      tags.add('pelvicControlCandidate'); tags.add('evacuationPriorityCandidate');
    }
    // 낭심/서혜부
    if (mz === 'groin' || mz === 'groin_junctional') {
      addM('femoral_vessel_candidate', '대퇴혈관 후보', 'vessel', isDeep ? 'medium' : 'low', 'high', 'groin');
      if (isDeep && (mz === 'groin_junctional' || med.majorVesselRiskHint)) addM('iliac_vessel_candidate', '장골혈관 후보', 'vessel', 'low', 'high', 'groin_junctional_deep');
      addM('junctional_hemorrhage_candidate', '접합부출혈 후보', 'cavity', 'low', 'high', 'groin_junctional');
      tags.add('junctionalControlCandidate'); tags.add('hemostaticCandidate'); tags.add('packingCandidate');
    }
    // 대퇴삼각(femoral_triangle)
    if (mz === 'femoral_triangle' || mz === 'proximal_inner_thigh') {
      addM('femoral_vessel_candidate', '대퇴혈관 후보', 'vessel', isDeep ? 'high' : 'medium', 'high', 'femoral_triangle');
      if (isDeep) addM('femur_candidate', '대퇴골 후보', 'bone', 'low', 'medium', 'proximal_thigh_deep');
      tags.add('junctionalControlCandidate'); tags.add('tourniquetCandidate'); tags.add('hemostaticCandidate');
    }
    // 얼굴
    if (mz === 'eyes') { addM('eye_candidate', '안구 후보', 'organ', 'medium', 'medium', 'eyes'); addM('orbital_bone_candidate', '안와골 후보', 'bone', 'low', 'low', 'orbital'); if (sevBias >= 1) addM('neuro_candidate', '신경/전두엽 후보', 'organ', 'low', 'high', 'orbital_deep'); }
    if (mz === 'mid_face' || mz === 'cheek' || mz === 'brow') { addM('facial_bleed_candidate', '안면출혈 후보', 'soft_tissue', 'medium', 'low', 'mid_face'); addM('facial_bone_candidate', '안면골 후보', 'bone', 'low', 'low', 'facial'); if (med.airwayRisk) tags.add('airwayRiskCandidate'); }
    if (mz === 'jaw' || mz === 'mouth_jaw') { addM('jaw_candidate', '하악골 후보', 'bone', 'medium', 'low', 'jaw'); addM('facial_bleed_candidate', '안면출혈 후보', 'soft_tissue', 'medium', 'medium', 'lower_face'); tags.add('airwayRiskCandidate'); tags.add('advancedAirwayRequiredCandidate'); }
    // 두개/뇌
    if (med.organRegion && /skull_brain/.test(med.organRegion)) {
      addM('skull_candidate', '두개골 후보', 'bone', 'medium', 'medium', 'skull');
      if (isDeep || sevBias >= 1) { addM('tbi_candidate', '외상성뇌손상 후보', 'organ', 'low', 'high', 'skull_deep'); addM('brain_region_candidate', '뇌 영역 후보', 'organ', 'low', 'high', med.medicalZone || 'brain'); }
      if (mz === 'temporal') addM('temporal_bone_candidate', '측두골 후보', 'bone', 'medium', 'medium', 'temporal');
      if (mz === 'occipital') addM('occipital_brain_candidate', '후두엽 후보', 'organ', 'low', 'high', 'occipital');
    }
    // 목 대혈관
    if (hitPart === 'neck' || med.vascularRegion === 'carotid_jugular') {
      addM('carotid_candidate', '경동맥 후보', 'vessel', isDeep ? 'medium' : 'low', 'high', 'neck');
      addM('jugular_candidate', '경정맥 후보', 'vessel', 'low', 'high', 'neck');
      tags.add('junctionalControlCandidate'); tags.add('hemostaticCandidate');
      if (med.airwayRisk) tags.add('airwayRiskCandidate');
    }
    // 내부출혈 체강은 지혈/드레싱으로 안 줄음 — surgery/transfusion 표식
    if ((med.chestCavityRisk || med.abdominalCavityRisk || med.pelvicCavityRisk) && isDeep) {
      tags.add('surgeryRequiredCandidate'); if (through || sevBias >= 1) tags.add('transfusionRequiredCandidate'); tags.add('evacuationPriorityCandidate');
    }
    if (med.majorVesselRiskHint && isDeep) { tags.add('vascularControlRequiredCandidate'); tags.add('surgeryRequiredCandidate'); }
  }
  return _finishMap(candidates, tags);
}
function _finishMap(candidates, tags) {
  const organStrings = [], vesselStrings = [];
  for (const c of candidates) {
    if (c.type === 'organ' || c.type === 'cavity' || c.type === 'airway') { if (!organStrings.includes(c.id)) organStrings.push(c.id); }
    if (c.type === 'vessel') { if (!vesselStrings.includes(c.id)) vesselStrings.push(c.id); }
  }
  return { candidates, organStrings, vesselStrings, treatmentTags: Array.from(tags) };
}
function _deriveTreatmentIndicationTags(candMap, bleedingClass, depth, majorVessel, hitPart, impactAddress) {
  const tags = new Set(candMap.treatmentTags || []);
  // SIDE-MED-2B-1A-HOTFIX-1 §1: tourniquetCandidate는 사지(arm/leg) 전용. torso/neck/junctional 금지.
  const isLimb = /arm|leg/.test(hitPart || '');
  // bleedingClass 기반 보정 — candidate와 정합
  if (bleedingClass === 'external_controllable_bleed') {
    tags.add('pressureBandageCandidate'); tags.add('hemostaticCandidate');
    if (isLimb) tags.add('tourniquetCandidate');   // 사지 외부출혈만 지혈대 후보
  }
  else if (bleedingClass === 'muscle_bleed') { tags.add('hemostaticCandidate'); tags.add('pressureBandageCandidate'); if (isLimb) tags.add('tourniquetCandidate'); }
  else if (bleedingClass === 'junctional_bleed') { tags.add('junctionalPressureCandidate'); tags.add('packingCandidate'); tags.add('hemostaticCandidate'); tags.add('tourniquetLimited'); }
  else if (bleedingClass === 'cavity_internal_bleed') {
    // cavity 내부출혈 — hemostatic/packing은 기본 무효(체벽 표층만 가능). 수술/후송 후보.
    tags.delete('hemostaticCandidate'); tags.delete('packingCandidate');
    tags.add('surgeryRequiredCandidate'); tags.add('evacuationPriority');
  }
  if (majorVessel) { tags.add('surgeryRequiredCandidate'); tags.add('evacuationPriority'); }
  // §1 안전장치 — 비사지(neck/chest/abdomen/pelvis/groin/axilla 등)에는 tourniquetCandidate가 절대 남지 않게.
  if (!isLimb && tags.has('tourniquetCandidate')) {
    tags.delete('tourniquetCandidate');
    if (bleedingClass === 'junctional_bleed' || candMap.candidates.some(c => /junctional/.test(c.id))) tags.add('tourniquetLimited');
  }
  // SIDE-MED-2B-1B §1: junctional-like 우선권 — tourniquetLimited/junctionalPressure 또는 junctional·femoral·axillary·groin·axilla 후보가
  //   있으면 tourniquetCandidate 제거(proximal-medial junctional 경로는 지혈대 부적합). tourniquetLimited로 둔다.
  const junctionalLike = tags.has('tourniquetLimited') || tags.has('junctionalPressureCandidate')
    || candMap.candidates.some(c => /junctional|femoral|axillary|groin|axilla|neck_junctional/.test(c.id));
  if (junctionalLike && tags.has('tourniquetCandidate')) {
    tags.delete('tourniquetCandidate');
    tags.add('tourniquetLimited');
  }
  return Array.from(tags);
}
function buildInternalBleedingModel(bt, bleedingClass, hitPart) {
  const depth = bt.woundDepthClass || 'surface_only';
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  const through = (depth === 'body_through_and_through');
  const nearExit = (depth === 'near_exit_lodged');
  const sc = bt.internalScores || {};
  const ref = (bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : 0.5;
  const size = bt.projectileSizeClass || '';
  const fam = bt.terminalEffectType || '';
  const cm = bt.candidateMap || [];
  const major = !!bt.majorVesselCandidate;
  const isLimb = /arm|leg/.test(hitPart || '');
  const microFrag = (size === 'micro_fragment' || size === 'small');

  // sourceType — bleedingClass + candidate 결합
  let sourceType = 'none';
  if (major) sourceType = 'major_vessel_candidate';
  else if (bleedingClass === 'cavity_internal_bleed') sourceType = 'cavity';
  else if (bleedingClass === 'junctional_bleed') sourceType = 'junctional';
  else if (bleedingClass === 'muscle_bleed') sourceType = 'muscle';
  else if (bleedingClass === 'external_controllable_bleed') sourceType = (cm.some(c => c.type === 'muscle' || c.id === 'muscle_bleed_candidate') ? 'muscle' : 'soft_tissue');
  else if (!isDeep) sourceType = (depth === 'surface_only') ? 'none' : 'soft_tissue';
  else sourceType = 'soft_tissue';

  // 위험도 점수 (0~1) — cavity/organ 위험은 체강 부위 한정(사지는 체강 내부출혈 위험 N/A)
  const cavityRisk = +(isLimb ? 0 : Math.min(1, (sourceType === 'cavity' ? 0.55 : 0) + (sc.temporaryCavityScore || 0) * 0.35 + (sc.bleedingSeverityScore || 0) * 0.2) * (isDeep ? 1 : 0.2)).toFixed(2);
  const junctionalRisk = +(Math.min(1, (sourceType === 'junctional' ? 0.6 : 0) + (cm.some(c => /junctional/.test(c.id)) ? 0.2 : 0)) * (isDeep ? 1 : 0.3)).toFixed(2);
  const majorVesselRisk = +(major ? Math.min(1, 0.55 + (sc.bleedingSeverityScore || 0) * 0.3 + (through || nearExit ? 0.1 : 0)) : (cm.some(c => c.type === 'vessel') ? 0.2 : 0)).toFixed(2);
  const organCandidateRisk = +(isLimb ? 0 : Math.min(1, cm.filter(c => c.type === 'organ').length * 0.18 + (sourceType === 'cavity' ? 0.25 : 0)) * (isDeep ? 1 : 0.2)).toFixed(2);

  // severity 등급 — 강화/약화 요인 종합
  let score = 0;
  if (depth === 'surface_only') score = 0.05;
  else if (depth === 'shallow_entry') score = 0.25;
  else if (depth === 'deep_penetration') score = 0.5;
  else if (depth === 'near_exit_lodged') score = 0.62;
  else if (depth === 'body_through_and_through') score = 0.68;
  score += (sc.bleedingSeverityScore || 0) * 0.25;
  score += cavityRisk * 0.25 + junctionalRisk * 0.2 + majorVesselRisk * 0.35 + organCandidateRisk * 0.15;
  score += ref * 0.1;
  if (/expand|jhp|hollow/.test(fam) || size === 'large_bore' || size === 'shotgun_slug' || size === 'anti_material') score += 0.12;
  // 약화
  if (!bt.bodyEntered) score = Math.min(score, 0.1);
  if (microFrag && !through) score *= 0.7;
  if (isLimb) score = Math.min(score, 0.6);   // 사지는 cavity 즉사급 아님
  if (depth === 'surface_only' || bt.skinEntryPassed === false) score = Math.min(score, 0.15);

  let severity;
  if (score < 0.18) severity = 'none';
  else if (score < 0.38) severity = 'low';
  else if (score < 0.62) severity = 'moderate';
  else if (score < 0.85) severity = 'severe';
  else severity = 'critical';
  // surface/shallow는 상한
  if (depth === 'surface_only') severity = (severity === 'none') ? 'none' : 'low';
  else if (depth === 'shallow_entry' && (severity === 'severe' || severity === 'critical')) severity = 'moderate';
  // major_vessel_candidate는 severe/critical 후보 허용 (단 confirmed 아님)

  // fieldCareLimit
  let fieldCareLimit;
  if (sourceType === 'cavity' || sourceType === 'major_vessel_candidate') fieldCareLimit = (severity === 'critical' || severity === 'severe') ? 'unmanageable' : 'limited';
  else if (sourceType === 'junctional') fieldCareLimit = 'limited';
  else if (sourceType === 'muscle') fieldCareLimit = (severity === 'severe' || severity === 'critical') ? 'limited' : 'controllable';
  else if (sourceType === 'soft_tissue') fieldCareLimit = 'treatable';
  else fieldCareLimit = 'treatable';

  const surgeryRequiredCandidate = (sourceType === 'cavity' || sourceType === 'major_vessel_candidate') && (severity === 'moderate' || severity === 'severe' || severity === 'critical');
  let evacuationPriority = 'low';
  if (severity === 'critical') evacuationPriority = 'urgent';
  else if (severity === 'severe') evacuationPriority = 'high';
  else if (severity === 'moderate') evacuationPriority = 'medium';

  const reason = `${depth}/${sourceType}` + (major ? '/majorVesselCand' : '');
  return { severity, sourceType, cavityRisk, junctionalRisk, majorVesselRisk, organCandidateRisk, fieldCareLimit, surgeryRequiredCandidate, evacuationPriority, reason, confirmed: false };
}
function buildOpenTorsoModel(bt, ibm, hitPart, woundSize) {
  if (hitPart !== 'abdomen') return null; // MO3: chest opening model removed
  const depth = bt.woundDepthClass || 'surface_only';
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  const through = (depth === 'body_through_and_through');
  const cm = bt.candidateMap || [];
  const size = (woundSize && woundSize.sizeClass) || '';
  const bigWound = (size === 'large' || size === 'massive');
  const sz = bt.projectileSizeClass || '';
  const highDisrupt = (sz === 'shotgun_slug' || sz === 'anti_material' || sz === 'large_bore' || /fragment|explos/.test(bt.terminalEffectType || ''));
  const ref = (bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : 0.5;
  if (!bt.bodyEntered || !isDeep) return { openTorsoWound:false, openAbdominalWound:false, abdominalWallDisruption:false, eviscerationRisk:false, eviscerationStatus:'none', contaminationRisk:0, dressingIndicated:false, abdominalDressingCandidate:false, reason:'surface/shallow' };
  const openTorsoWound = !!(bt.exitWoundPresent || bigWound || through || highDisrupt);
  const abdominalWallDisruption = (hitPart === 'abdomen') && (cm.some(c => c.id === 'abdominal_wall_candidate') || bigWound) && (ref > 0.5 || highDisrupt);
  const openAbdominalWound = (hitPart === 'abdomen') && (bigWound || through || abdominalWallDisruption || cm.some(c => c.id === 'abdominal_wall_candidate'));
  const bowelCand = cm.some(c => c.id === 'bowel_candidate' || c.id === 'mesenteric_vessel_candidate');
  let eviscerationRisk = openAbdominalWound && abdominalWallDisruption && bigWound && (through || bowelCand);
  let eviscerationStatus = eviscerationRisk ? (bigWound && through ? 'suspected' : 'candidate') : 'none';
  const contaminationRisk = +(Math.min(1, (openTorsoWound ? 0.3 : 0) + (bowelCand ? 0.35 : 0) + (bigWound ? 0.15 : 0))).toFixed(2);
  return {
    openTorsoWound, openAbdominalWound, abdominalWallDisruption,
    eviscerationRisk, eviscerationStatus, contaminationRisk,
    dressingIndicated: openAbdominalWound, abdominalDressingCandidate: openAbdominalWound,
    fieldCareLimit: (ibm && ibm.fieldCareLimit) || 'limited', reason: `${depth}${openTorsoWound ? '/open' : ''}`,
  };
}
function buildOrganInjuryModel(bt, ibm, hitPart) {
  const cm = bt.candidateMap || [];
  if (!cm.length) return { injuries:[], topCandidates:[], highestSeverity:'none', surgeryRequiredCandidate:false, evacuationPriority:'low', confirmedCount:0, suspectedCount:0, reason:'no_candidate' };
  const depth = bt.woundDepthClass || 'surface_only';
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  const through = (depth === 'body_through_and_through');
  const ref = (bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : 0.5;
  const highEnergy = ref > 0.6;
  const sevHigh = ibm && (ibm.severity === 'severe' || ibm.severity === 'critical');
  const retained = !!(bt.retainedProjectile || depth === 'near_exit_lodged');
  const injuries = [];
  let confirmedCount = 0, suspectedCount = 0;
  const ORGAN_MAP = { lung_candidate:'lung', heart_candidate:'heart_hook_only', liver_candidate:'liver', spleen_candidate:'spleen', kidney_candidate:'kidney', stomach_candidate:'stomach', bowel_candidate:'bowel', bladder_candidate:'bladder', pleural_space_candidate:'pleura', thoracic_vessel_candidate:'thoracic_vessel', upper_abdominal_vessel_candidate:'abdominal_vessel', mesenteric_vessel_candidate:'abdominal_vessel', iliac_vessel_candidate:'iliac_vessel', femoral_vessel_candidate:'femoral_vessel', axillary_vessel_candidate:'axillary_vessel', axillary_brachial_candidate:'axillary_vessel', carotid_candidate:'carotid_jugular', jugular_candidate:'carotid_jugular',
    airway_candidate:'airway', cervical_spine_candidate:'cervical_spine', pelvic_bleed_candidate:'pelvic_bleed', retroperitoneal_bleed_candidate:'retroperitoneal_bleed', limb_bone_candidate:'limb_bone', muscle_bleed_candidate:'muscle_bleed' };
  // §10: 장기/혈관별 기본 우선순위 (생리적 위험 베이스)
  const BASE_PRIORITY = { carotid_jugular:38, thoracic_vessel:34, femoral_vessel:34, iliac_vessel:30, heart_hook_only:30, airway:28, abdominal_vessel:28, axillary_vessel:26, pelvic_bleed:26, liver:26, lung:24, spleen:24, cervical_spine:24, kidney:20, retroperitoneal_bleed:20, pleura:16, bowel:16, stomach:14, bladder:12, limb_bone:10, muscle_bleed:8 };
  const heartNearby = cm.some(c => c.id === 'heart_candidate');
  const RISK_ORDER = ['none','low','moderate','high','massive'];
  const downRisk = (r) => RISK_ORDER[Math.max(0, RISK_ORDER.indexOf(r) - 1)];
  const upRisk = (r) => RISK_ORDER[Math.min(RISK_ORDER.length - 1, RISK_ORDER.indexOf(r) + 1)];
  for (const c of cm) {
    const organ = ORGAN_MAP[c.id]; if (!organ) continue;
    let status = 'candidate';
    if (isDeep && (c.confidence === 'medium' || c.confidence === 'high')) status = 'suspected';
    if ((through || highEnergy) && sevHigh && (c.confidence === 'medium' || c.confidence === 'high') && c.severityHint === 'high') status = 'likely';
    // confirmed_limited: 매우 엄격 (through + high energy + high severity + high confidence). 심장은 제외(hook only).
    if (organ !== 'heart_hook_only' && through && highEnergy && sevHigh && c.confidence === 'high' && c.severityHint === 'high' && bt.exitWoundPresent) status = 'confirmed_limited';
    // §11/§14: heart는 monitoring 단계 고정 — candidate 초과 승격 금지 (rhythm/확정은 후속 단계)
    if (organ === 'heart_hook_only' && status !== 'candidate') status = 'candidate';
    if (status === 'confirmed_limited') confirmedCount++;
    else if (status === 'suspected' || status === 'likely') suspectedCount++;
    // === §9 evidenceTags ===
    const evidenceTags = [];
    if (isDeep) evidenceTags.push('deep_penetration');
    if (through) evidenceTags.push('through_and_through');
    if (highEnergy) evidenceTags.push('high_residual_energy');
    if (retained) evidenceTags.push('retained_projectile');
    if (c.type === 'cavity') evidenceTags.push('cavity_track');
    if (hitPart === 'neck') evidenceTags.push('neck_track');
    if (organ === 'femoral_vessel' || organ === 'iliac_vessel' || organ === 'pelvic_bleed') evidenceTags.push(organ === 'femoral_vessel' ? 'junctional_track' : 'pelvis_track');
    if (organ === 'kidney' || organ === 'retroperitoneal_bleed') evidenceTags.push('flank_track');
    if (hitPart === 'chest' && heartNearby) evidenceTags.push('chest_central');
    if (organ === 'heart_hook_only') evidenceTags.push('heart_adjacent_track');
    // === §9/§10 bleedRisk ===
    let bleedRisk;
    if (c.type === 'vessel') bleedRisk = sevHigh ? 'massive' : 'high';
    else if (organ === 'pelvic_bleed' || organ === 'retroperitoneal_bleed') bleedRisk = sevHigh ? 'high' : 'moderate';
    else if (organ === 'liver' || organ === 'spleen') bleedRisk = sevHigh ? 'high' : 'moderate';
    else if (organ === 'lung' || organ === 'kidney') bleedRisk = 'moderate';
    else if (organ === 'bowel' || organ === 'stomach' || organ === 'bladder') bleedRisk = sevHigh ? 'moderate' : 'low';
    else if (organ === 'heart_hook_only') bleedRisk = 'high';
    else if (organ === 'airway' || organ === 'cervical_spine') bleedRisk = 'low';
    else bleedRisk = 'low';
    if (status === 'candidate') bleedRisk = downRisk(bleedRisk);
    if (through && (organ === 'lung' || organ === 'thoracic_vessel')) bleedRisk = upRisk(bleedRisk);   // §10.1
    // === §9/§10 functionRisk ===
    let functionRisk = 'low';
    if (organ === 'airway') functionRisk = isDeep ? 'critical' : 'high';
    else if (organ === 'cervical_spine') functionRisk = through ? 'critical' : 'high';
    else if (organ === 'lung') functionRisk = sevHigh ? 'high' : 'moderate';
    else if (organ === 'carotid_jugular' || organ === 'heart_hook_only') functionRisk = 'high';
    else if (organ === 'limb_bone') functionRisk = 'high';
    else if (c.type === 'vessel' || c.type === 'organ') functionRisk = 'moderate';
    // === §9/§10 priorityScore + 부위별 보정 ===
    let pScore = (BASE_PRIORITY[organ] != null ? BASE_PRIORITY[organ] : 12)
      + (status === 'suspected' ? 12 : status === 'likely' ? 22 : status === 'confirmed_limited' ? 30 : 0)
      + (sevHigh ? 10 : 0) + (through ? 6 : 0)
      + (c.confidence === 'high' ? 8 : c.confidence === 'medium' ? 4 : 0);
    if (hitPart === 'chest' && heartNearby && isDeep && highEnergy) {           // §10.1 central chest
      if (organ === 'thoracic_vessel') pScore += 14;
      if (organ === 'heart_hook_only') pScore += 10;
    }
    if (organ === 'femoral_vessel' && isDeep) pScore += 18;                      // §10.3 groin/thigh — junctional 임상 1순위
    if ((organ === 'iliac_vessel' || organ === 'pelvic_bleed') && isDeep) pScore += 8;
    if (organ === 'carotid_jugular' && isDeep) pScore += 12;                     // §10.4 deep neck
    pScore = Math.max(0, Math.min(100, Math.round(pScore)));
    const clinicalPriority = pScore >= 75 ? 'critical' : pScore >= 55 ? 'high' : pScore >= 35 ? 'moderate' : 'low';
    injuries.push({
      organ, status, injuryScore: Math.round((c.confidence === 'high' ? 60 : c.confidence === 'medium' ? 40 : 20) + (sevHigh ? 20 : 0) + (through ? 10 : 0)),
      priorityScore: pScore, clinicalPriority, bleedRisk, functionRisk, evidenceTags,
      sourceRegion: hitPart || null, trajectoryReason: c.reason || '',
      fieldCareLimit: (c.type === 'vessel' || c.type === 'organ' || c.type === 'cavity') ? 'limited' : 'treatable',
      monitorOnly: organ === 'heart_hook_only',
      bleedingContribution: +(c.type === 'vessel' ? 0.6 : c.type === 'organ' ? 0.4 : 0.2).toFixed(2),
      functionLoss: +(organ === 'lung' && sevHigh ? 0.4 : 0.1).toFixed(2),
      contaminationRisk: +((organ === 'bowel' || organ === 'stomach') ? 0.5 : 0.1).toFixed(2),
      fieldTreatable: (c.type === 'vessel' || c.type === 'organ' || c.type === 'cavity') ? false : 'limited',
      surgeryRequiredCandidate: (c.type === 'organ' || c.type === 'vessel' || c.type === 'cavity') && (status !== 'candidate'),
      reason: c.reason || '', confirmedBy: through ? 'through_path' : (highEnergy ? 'high_energy' : 'candidateMap'), confirmed: status === 'confirmed_limited',
    });
  }
  // §9: 생리적 우선순위 정렬 + 상위 후보 (UI/AAR 표시용 — 확정 표현 금지)
  injuries.sort((a, b) => b.priorityScore - a.priorityScore);
  const _seenOrgan = new Set();
  const topCandidates = [];
  for (const i of injuries) {
    if (_seenOrgan.has(i.organ)) continue;
    _seenOrgan.add(i.organ);
    topCandidates.push({ organ: i.organ, status: i.status, clinicalPriority: i.clinicalPriority, bleedRisk: i.bleedRisk, monitorOnly: !!i.monitorOnly });
    if (topCandidates.length >= 4) break;
  }
  const sevOrder = ['none','candidate','suspected','likely','confirmed_limited'];
  let highestSeverity = 'none';
  for (const inj of injuries) if (sevOrder.indexOf(inj.status) > sevOrder.indexOf(highestSeverity)) highestSeverity = inj.status;
  const surgeryRequiredCandidate = injuries.some(i => i.surgeryRequiredCandidate);
  let evacuationPriority = (ibm && ibm.evacuationPriority) || 'low';
  return { injuries, topCandidates, highestSeverity, surgeryRequiredCandidate, evacuationPriority, confirmedCount, suspectedCount, reason: `${depth}/${injuries.length}inj` };
}
function buildHemorrhageControlModel(bt, ibm, bleedingProfile, hitPart, woundSize) {
  const bp = bleedingProfile || {};
  const isLimb = /arm|leg/.test(hitPart || '');
  const ext = bp.currentExternal || 0;
  const sourceType = (ibm && ibm.sourceType) || 'soft_tissue';
  const sev = (ibm && ibm.severity) || 'none';
  const sevHigh = (sev === 'severe' || sev === 'critical');
  // hemorrhageType
  let hemorrhageType = 'limb_external';
  if (sourceType === 'major_vessel_candidate') hemorrhageType = 'major_vessel_candidate';
  else if (sourceType === 'cavity') hemorrhageType = 'cavity_internal';
  else if (sourceType === 'junctional') hemorrhageType = 'junctional';
  else if (!isLimb && (hitPart === 'chest' || hitPart === 'abdomen' || hitPart === 'neck')) hemorrhageType = 'torso_external';
  else hemorrhageType = 'limb_external';
  // SIDE-MED-2C-HOTFIX-1 §5: woundSize 정상 판정 (object.sizeClass / string / bt.woundSize fallback)
  const sizeClass = (woundSize && woundSize.sizeClass) || (typeof woundSize === 'string' ? woundSize : null) || (typeof bt.woundSize === 'string' ? bt.woundSize : (bt.woundSize && bt.woundSize.sizeClass)) || null;
  const bigWound = (sizeClass === 'large' || sizeClass === 'massive');
  // isMassiveHemorrhage — bigWound는 active external bleeding과 함께일 때만
  const isMassiveHemorrhage = (ext >= 12)
    || (sourceType === 'major_vessel_candidate')
    || (sourceType === 'junctional' && sevHigh)
    || (sevHigh && (hemorrhageType === 'limb_external' || hemorrhageType === 'junctional'))
    || (bigWound && ext > 6 && hemorrhageType !== 'cavity_internal');
  // controllableBy + treatmentEffectLimit
  let controllableBy = [], treatmentEffectLimit = 'full_control_possible';
  if (hemorrhageType === 'limb_external') {
    controllableBy = ['tourniquet','pressure_bandage','hemostatic'];
    treatmentEffectLimit = sevHigh ? 'partial_control_only' : 'full_control_possible';
  } else if (hemorrhageType === 'junctional') {
    controllableBy = ['junctional_pressure','packing','hemostatic'];
    treatmentEffectLimit = sevHigh ? 'partial_control_only' : 'temporary_stabilization';
    if (sev === 'critical') treatmentEffectLimit = 'not_field_controllable';
  } else if (hemorrhageType === 'torso_external') {
    controllableBy = ['pressure_bandage','hemostatic','packing'];
    treatmentEffectLimit = 'partial_control_only';
  } else if (hemorrhageType === 'cavity_internal') {
    controllableBy = ['not_field_controllable'];
    treatmentEffectLimit = 'not_field_controllable';
  } else if (hemorrhageType === 'major_vessel_candidate') {
    controllableBy = isLimb ? ['tourniquet'] : ['not_field_controllable'];
    treatmentEffectLimit = isLimb ? 'partial_control_only' : 'not_field_controllable';
  }
  let controlUrgency = 'none';
  if (isMassiveHemorrhage) controlUrgency = (sev === 'critical') ? 'immediate' : (sevHigh ? 'high' : 'medium');
  else if (ext > 4) controlUrgency = 'low';
  return { isMassiveHemorrhage, hemorrhageType, controllableBy, controlUrgency, treatmentEffectLimit };
}
function buildBodyTrajectoryContext(unit, ev, penState) {
  const ammo = (ev.ammoId && typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[ev.ammoId] : null;
  // [0.39.5 §2] canonical projectile profile 우선 — packet.projectileProfile → event.projectileProfile → canonical builder.
  //   raw ammo.terminalProfile은 canonical 생성 자체가 불가능할 때만(legacy) 사용. raw를 consumer가 직접 우선하지 않는다.
  const _canonProfile = (ev.impactPacket && ev.impactPacket.projectileProfile)
    || ev.projectileProfile
    || ((typeof getCanonicalProjectileProfile === 'function' && ammo) ? getCanonicalProjectileProfile(ammo) : null);
  // terminal family는 canonical terminalBehaviorClass에서 파생(mutation-proof). per-ammo tuning multiplier는 raw에서(밸런스 보존).
  //   raw terminalProfile은 canonical이 전무할 때만 통째로 사용.
  const _rawTP = (ammo && ammo.terminalProfile) || (ev.ammoId && typeof AMMO_TERMINAL_PROFILE !== 'undefined' ? AMMO_TERMINAL_PROFILE[ev.ammoId] : null) || null;
  const profile = _canonProfile
    ? { family: _canonProfile.terminalBehaviorClass, _fromCanonical: true,
        apLike: _canonProfile.apLike, heavySlow: _canonProfile.heavySlow, barrierBlind: _canonProfile.barrierBlind,
        fragmentingLike: _canonProfile.fragmentingLike, expandingLike: _canonProfile.expandingLike,
        subsonicClass: _canonProfile.subsonicClass, diameterMm: _canonProfile.diameterMm, massG: _canonProfile.massG,
        // per-ammo tuning (raw) — family는 canonical이 override하므로 raw family 변조에 불변
        woundChannel: _rawTP ? _rawTP.woundChannel : undefined,
        tissueCrushMul: _rawTP ? _rawTP.tissueCrushMul : undefined,
        temporaryCavityMul: _rawTP ? _rawTP.temporaryCavityMul : undefined,
        boneBreakMul: _rawTP ? _rawTP.boneBreakMul : undefined,
        exitWoundMul: _rawTP ? _rawTP.exitWoundMul : undefined,
        retainedProjectileChance: _rawTP ? _rawTP.retainedProjectileChance : undefined,
        overpenetrationTendency: _rawTP ? _rawTP.overpenetrationTendency : undefined,
        yawTendency: _rawTP ? _rawTP.yawTendency : undefined,
        fragmentationTendency: _rawTP ? _rawTP.fragmentationTendency : undefined,
        armorAfterEffect: _rawTP ? _rawTP.armorAfterEffect : undefined }
    : _rawTP;
  const ia = ev.impactAddress || {};
  if (ia && !ia.medical) { try { ia.medical = normalizeMedicalImpactAddress(ia, ev); } catch (e) {} }   // SIDE-MEDICAL-TRAUMA-BRIDGE-1 §5
  const hitPart = ev.hitPart || ia.hitPart || 'chest';
  const isFrag = (ev.sourceType === 'frag' && ev.isFragment === true);
  const stopped = (ev.armorResult === 'stopped' || ev.armorResult === 'absorbed' || ev.armorResult === 'deflected');
  const br = BODY_RESISTANCE[hitPart] || BODY_RESISTANCE.chest;
  const mods = _bodyTerminalMods(profile);
  const eac = ev._entryArmorContext || (ev.armorHitResult && ev.armorHitResult.entryArmorContext) || null;
  // 인체 진입 전 관통력 — [0.39.3 A-Closure] canonical residual 우선(impactPacket → eac → impactAddress).
  //   명시적 residualPen 0은 penBefore=0으로 보존 — ammo.penetration fallback으로 부활 금지.
  let penBefore;
  const _crt = (typeof _normalizeResidualThreat === 'function') ? _normalizeResidualThreat(ev) : null;
  if (isFrag) penBefore = (ev.penetration != null) ? ev.penetration : 4;
  else if (eac && (eac.entryArmorResult === 'hard_block' || eac.entryArmorResult === 'soft_block' || eac.entryArmorResult === 'hard_pen_soft_block')) {
    penBefore = 0;   // 방호 정지 또는 hard관통-backer정지 → 인체 진입 위협 없음(둔상은 별도)
  }
  else if (stopped) penBefore = 0;
  else if (_crt && _crt.residualPenPresent) penBefore = Math.max(0, _crt.residualPen);   // canonical 실제 잔여값(명시적 0 포함) 지배
  else if (eac && eac.residualThreatPacket && eac.residualThreatPacket.residualPen != null) penBefore = eac.residualThreatPacket.residualPen;
  else if (eac && eac.entryPenAfterArmor != null) penBefore = eac.entryPenAfterArmor;
  else {
    // 데이터 누락(residualPenPresent=false)일 때만 legacy fallback
    const base = (ammo && ammo.penetration != null) ? ammo.penetration : (ev.penetration != null ? ev.penetration : 12);
    const hadArmor = !!(ia.armorLayer || (ev.armorHitResult && ev.armorHitResult.protectionType && ev.armorHitResult.protectionType !== 'none'));
    penBefore = base * (hadArmor ? 0.65 : 1.0);
  }
  const cost = br.cost * mods.costMul;
  const skinEntry = 3;
  let depth, bodyEntered = false, deepTissue = false, exitWound = false, retained = false, nearExit = false, bttt = false;
  if (penBefore < skinEntry) { depth = 'surface_only'; }
  else {
    bodyEntered = true;
    const penAfter0 = penBefore - cost;
    if (penAfter0 <= 0) {
      if (penBefore < cost * 0.5) { depth = 'shallow_entry'; }
      else { depth = 'deep_penetration'; deepTissue = true; }
      retained = true;
    } else if (penAfter0 < br.exitCost) { depth = 'near_exit_lodged'; deepTissue = true; nearExit = true; retained = true; }
    else { depth = 'body_through_and_through'; deepTissue = true; exitWound = true; bttt = true; }
  }
  // 파편 보수화 — size별 상한
  if (isFrag) {
    const fs = ev.fragmentSize || 'small';
    if (fs === 'small' && (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through')) { depth = 'shallow_entry'; deepTissue = false; exitWound = false; bttt = false; nearExit = false; retained = true; }
    else if (fs === 'medium' && (depth === 'near_exit_lodged' || depth === 'body_through_and_through')) { depth = 'deep_penetration'; exitWound = false; bttt = false; nearExit = false; retained = true; }
    else if (fs === 'large' && depth === 'body_through_and_through') { depth = 'near_exit_lodged'; exitWound = false; bttt = false; nearExit = true; retained = true; }   // large도 사출구 거의 금지
  }
  const penAfterBody = bttt ? Math.max(0, penBefore - cost) : 0;
  // retained 확률 보정 (terminal retainBias) — near_exit/shallow/deep에서만 의미
  if (retained && profile && profile.retainedProjectileChance != null) {
    const rc = Math.min(0.95, Math.max(0.02, profile.retainedProjectileChance + mods.retainBias + (nearExit ? 0.3 : 0)));
    if (depth === 'deep_penetration' && Math.random() > rc) retained = false;   // 깊은 관통은 일부 미잔류(조직 통과)
  }
  // 후면 방호구 (인체 완전관통 시) — entry 맥락 기반 후보 선택 + 실제 판정 + 내구도 (resolveRearArmorInteraction)
  const isTorso = (hitPart === 'chest' || hitPart === 'abdomen');
  const isLimb = (hitPart === 'left_arm' || hitPart === 'right_arm' || hitPart === 'arms' || hitPart === 'left_leg' || hitPart === 'right_leg' || hitPart === 'legs');
  const entryAspect = (eac && eac.entryAspect) || ia.impactSide || 'front';
  let rear = { candidate:'none', rearArmorResult:null, penAfter:0, armorValue:0 };
  let rearInteraction = null;
  let targetTtt = false, limbTtt = false, continueRaycast = false, contPacket = null;
  if (bttt && !isFrag && isTorso) {
    rearInteraction = resolveRearArmorInteraction({ unit, hitPart, entryAspect, entryArmorContext: eac, penAfterBody, ammo, weapon: null });
    rear = rearInteraction;
    const rr = rearInteraction.rearArmorResult;
    if (rr === 'rear_armor_penetrated') targetTtt = (rearInteraction.penAfter >= 6);
    else if (rr === 'no_rear_armor') targetTtt = (penAfterBody >= 6);
    // 후면 방호구 정지면 targetTtt=false, continuation 금지
    if ((rr === 'no_rear_armor' || rr === 'rear_armor_penetrated') && rearInteraction.penAfter >= 6) continueRaycast = true;
  } else if (bttt && !isFrag && isLimb) {
    rear = { candidate:'none', rearArmorResult:'not_applicable_limb', penAfter:penAfterBody, armorValue:0 };
    limbTtt = (penAfterBody >= 6);
    if (penAfterBody >= 6) continueRaycast = true;
  } else if (bttt && !isFrag) {
    rear = { candidate:'none', rearArmorResult:'no_rear_armor', penAfter:penAfterBody, armorValue:0 };
  } else if (isFrag && bttt) {
    rear = { candidate:'none', rearArmorResult:'not_applicable_fragment', penAfter:0, armorValue:0 };
  }
  const _rearResult = rear.rearArmorResult || rear.result || null;
  if (continueRaycast) {
    contPacket = {
      originalAmmoId: ev.ammoId || null, sourceType: ev.sourceType || 'bullet',
      residualPen: +(rear.penAfter||0).toFixed(1), residualDamage: +((ev.rawDamage || 0) * 0.4).toFixed(1),
      velocityMul: 0.5, residualBleedMul: 0.55,
      yawState: mods.channel === 'expanding' ? 'destabilized' : 'stable',
      deformationState: /expand/.test(mods.fam) ? 'expanded' : 'intact',
      fragmentationState: /frangible|fragmenting/.test(mods.fam) ? 'fragmented' : 'none',
      exitedFromBody: true, exitedFromRearArmor: (_rearResult === 'rear_armor_penetrated'), exitedFromLimb: isLimb,
      previousTargetId: unit.id, continuationDepth: ((ev._continuationDepth || 0) + 1),
      // [0.39.6 §8-2] canonical projectile profile을 2차 표적까지 유지 (secondary continuation이 재추측하지 않도록)
      projectileProfile: _canonProfile ? {
        massG: _canonProfile.massG, diameterMm: _canonProfile.diameterMm, subsonicClass: _canonProfile.subsonicClass,
        armorThreatClass: _canonProfile.armorThreatClass, terminalBehaviorClass: _canonProfile.terminalBehaviorClass,
        apLike: _canonProfile.apLike, barrierBlind: _canonProfile.barrierBlind, heavySlow: _canonProfile.heavySlow,
      } : null,
    };
  }
  const bleedingClass = classifyBleedingClass(depth, hitPart, ia, deepTissue);
  // === HOTFIX-1: 잔여 탄속/에너지 (관통력과 역할 분리) ===
  const vNow = (ev._shotVelocity != null) ? ev._shotVelocity : null;
  const vInit = (ev._shotInitialVelocity != null && ev._shotInitialVelocity > 0) ? ev._shotInitialVelocity : null;
  let velocityRatio = (vNow != null && vInit != null) ? Math.max(0, Math.min(1, vNow / vInit)) : (isFrag ? 0.4 : 0.85);
  const residualEnergyFactor = +(velocityRatio * velocityRatio).toFixed(3);   // 에너지 ~ v²
  // === HOTFIX-1: projectileSizeClass + 내부 스코어 ===
  const sizeClass = _projectileSizeClass(ammo, profile, ev);
  const szMod = _PROJ_SIZE_MODS[sizeClass] || _PROJ_SIZE_MODS.intermediate_rifle;
  const crushMul = (profile && profile.tissueCrushMul != null) ? profile.tissueCrushMul : 1.0;
  // SIDE-MED-2B-1A: 정밀 후보 지도 (projectileSizeClass/terminal/crush 반영). 기존 문자열 hint는 map에서 파생.
  //   sizeClass/crushMul 정의 이후에 호출 (TDZ 방지).
  // PRECARDIAC-1: terminalFam에 woundChannel 합성 — JHP/expanding의 sevBias+1 의도 복원 (heart 후보 §10 표시 가능성)
  const candMap = buildOrganVesselCandidateMap(hitPart, ia, depth, deepTissue, sizeClass, ((mods.fam || '') + ' ' + (mods.channel || '')), (crushMul - 1));
  const hints = { organ: candMap.organStrings, vessel: candMap.vesselStrings };
  // major_vessel_candidate 승격 (후보 단계 — confirmed 아님)
  let majorVessel = false;
  if (hints.vessel.some(v => /carotid|femoral|iliac|axillary|aort|thoracic|abdominal_vessel/.test(v)) && (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through')) majorVessel = true;
  const cavityMul = (profile && profile.temporaryCavityMul != null) ? profile.temporaryCavityMul : 1.0;
  const boneMul = (profile && profile.boneBreakMul != null) ? profile.boneBreakMul : 1.0;
  const depthScoreMap = { surface_only:0.1, shallow_entry:0.35, deep_penetration:0.7, near_exit_lodged:0.85, body_through_and_through:1.0 };
  const penetrationDepthScore = depthScoreMap[depth] != null ? depthScoreMap[depth] : 0.5;
  const crushDamageScore = +(crushMul * szMod.crush * (deepTissue ? 1.0 : 0.5)).toFixed(2);
  // temporary cavity는 잔여에너지에 강하게 의존 (저속탄 과장 금지)
  const temporaryCavityScore = +(cavityMul * szMod.cavity * residualEnergyFactor * (deepTissue ? 1.0 : 0.4)).toFixed(2);
  const boneRiskScore = +(boneMul * szMod.bone * (deepTissue ? 1.0 : 0.4)).toFixed(2);
  const bleedSevBase = { no_bleed_or_minor:0.1, superficial_bleed:0.3, external_controllable_bleed:0.5, muscle_bleed:0.65, junctional_bleed:0.8, cavity_internal_bleed:0.85, major_vessel_candidate:1.0 };
  let bleedingSeverityScore = +(((bleedSevBase[bleedingClass] != null ? bleedSevBase[bleedingClass] : 0.4) * (0.7 + crushMul * 0.3)) * (majorVessel ? 1.15 : 1.0)).toFixed(2);
  bleedingSeverityScore = Math.min(1.2, bleedingSeverityScore);
  const shockContributionScore = +(temporaryCavityScore * 0.5 + (br.cavity ? 0.3 : 0.1) + (bleedingClass === 'cavity_internal_bleed' ? 0.2 : 0)).toFixed(2);
  // 잔여 위협 packet에 탄속/에너지 반영
  if (contPacket) { contPacket.residualVelocity = vNow != null ? Math.round(vNow * 0.5) : null; contPacket.velocityMul = +(0.4 + velocityRatio * 0.3).toFixed(2); contPacket.residualEnergyFactor = +(residualEnergyFactor * 0.4).toFixed(3); contPacket.projectileSizeClass = sizeClass; }
  // === HOTFIX-2 §3: 사출구 크기 등급 (생성 여부와 분리, 내부보다 크지 않게, AP/sabot 작게) ===
  let exitSizeClass = null, exitSizeScore = 0;
  const exitMulP = (profile && profile.exitWoundMul != null) ? profile.exitWoundMul : szMod.exit;
  if (exitWound) {
    const internalScore = depthScoreMap[depth] || 0.7;
    // 사출구 점수 = 잔여에너지 × exitMul × sizeClass exit성향
    let exScore = (0.35 + residualEnergyFactor * 0.5) * exitMulP * szMod.exit;
    // expand/large_bore/full_power는 사출구↑, AP/sabot은 억제
    if (/expand/.test(mods.fam) || sizeClass === 'large_bore' || sizeClass === 'shotgun_slug') exScore *= 1.25;
    if (sizeClass === 'sabot_subcaliber' || sizeClass === 'anti_material' || /ap|penetrator|narrow/.test(mods.fam)) exScore *= 0.7;
    const ORDER = ['micro','small','medium','large'];
    let cls = exScore < 0.35 ? 'micro' : exScore < 0.6 ? 'small' : exScore < 0.95 ? 'medium' : 'large';
    // 내부 상처보다 크지 않게 clamp
    const intCls = depth === 'body_through_and_through' ? 'large' : depth === 'deep_penetration' ? 'medium' : 'small';
    if (ORDER.indexOf(cls) > ORDER.indexOf(intCls)) cls = intCls;
    if (cls === 'micro' && exitWound) cls = 'small';   // 사출구 있으면 최소 small
    exitSizeClass = cls; exitSizeScore = +(exScore).toFixed(2);
    // SHOTGUN-MED-NORM-1 §12: 산탄 펠릿 사출구 clamp (slug 미적용)
    const _pelletMeta = getMedicalProjectileMeta(ammo, ev);
    if (_pelletMeta.isShotgunPellet) {
      exitSizeClass = clampWoundClass(exitSizeClass, _pelletMeta.maxExitClass);
      if (_pelletMeta.isFlechette) { exitSizeClass = clampWoundClass(exitSizeClass, 'small'); exitSizeScore = Math.min(exitSizeScore, 0.45); }
      if (_pelletMeta.isBuckshot) { exitSizeClass = clampWoundClass(exitSizeClass, 'small'); exitSizeScore = Math.min(exitSizeScore, 0.55); }
    }
  }
  const _EXIT_KO = { micro:'미세', small:'소형', medium:'중형', large:'대형' };
  const exitWoundLabel = exitWound ? (_EXIT_KO[exitSizeClass] || exitSizeClass) : (retained ? '체내 잔류' : '없음');
  return {
    sourceType: ev.sourceType || 'bullet', ammoId: ev.ammoId || null,
    terminalEffectType: mods.fam || null, woundChannelType: mods.channel,
    impactAddress: ia, entryAddress: ia, exitAddress: exitWound ? Object.assign({}, ia, { _exit:true }) : null,
    hitPart, hitDirection: ia.impactSide || ia.side || null,
    bodyPartResistanceKey: hitPart, bodyResistanceClass: br.cls,
    projectilePenBeforeBody: +penBefore.toFixed(1), bodyPenetrationCost: +cost.toFixed(1), projectilePenAfterBody: +penAfterBody.toFixed(1),
    skinEntryPassed: penBefore >= skinEntry, bodyEntered, deepTissueReached: deepTissue,
    woundDepthClass: depth, bodyThroughAndThrough: bttt,
    nearExitLodged: nearExit, retainedProjectile: retained, retainedLocation: retained ? (nearExit ? 'near_exit_subcutaneous' : 'internal_track') : null,
    exitWound,
    rearArmorChecked: (bttt && isTorso), rearArmorCandidate: rear.candidate, rearArmorResult: _rearResult,
    rearArmorCandidateLayer: rear.candidateLayer || null, rearArmorCandidateReason: rear.candidateReason || null,
    rearArmorValue: rear.armorValue || 0, rearArmorMaterial: rear.material || null, rearDurabilitySlotKey: rear.durabilitySlotKey || null,
    rearArmorInteraction: rearInteraction || null, exitAspect: (rear.exitAspect) || (rearInteraction && rearInteraction.exitAspect) || null,
    projectilePenBeforeRearArmor: bttt ? +penAfterBody.toFixed(1) : 0, projectilePenAfterRearArmor: +(rear.penAfter || 0).toFixed(1),
    retainedInRearArmor: (_rearResult === 'stopped_by_rear_plate' || _rearResult === 'stopped_by_rear_soft'),
    targetThroughAndThrough: targetTtt, limbThroughAndThrough: limbTtt, continueRaycast, continuationThreatPacket: contPacket,
    exitWoundPresent: exitWound, exitSizeClass, exitSizeScore, exitWoundMul: +exitMulP.toFixed(2), exitWoundLabel,
    bleedingClass, organCandidateHints: hints.organ, vesselCandidateHints: hints.vessel, majorVesselCandidate: majorVessel,
    normalizedMedicalAddress: ia.medical || null,
    // SIDE-MED-2B-1A: 정밀 후보 지도(구조화) + 처치 적응증 태그 (candidate 단계 — confirmed 아님)
    candidateMap: candMap.candidates,
    treatmentIndicationTags: _deriveTreatmentIndicationTags(candMap, bleedingClass, depth, majorVessel, hitPart, ia),
    // entry 방호 맥락 (의료/탄도 메타)
    entryArmorContext: eac, entryLayerClass: eac && eac.entryLayerClass, entryLayerSlot: eac && eac.entryLayerSlot,
    entryArmorResult: eac && eac.entryArmorResult, entryPenAfterArmor: eac && eac.entryPenAfterArmor,
    // HOTFIX-1: 탄 크기 / 잔여 탄속·에너지 / 내부 스코어
    projectileSizeClass: sizeClass, velocityRatio: +velocityRatio.toFixed(3), residualEnergyFactor,
    internalScores: { penetrationDepthScore, crushDamageScore, temporaryCavityScore, boneRiskScore, bleedingSeverityScore, shockContributionScore },
    futureOrganHook: true, futureVesselHook: true, futureMedicalHook: true,
  };
}
const _WOUND_DEPTH_KO = { surface_only:'표면 손상', shallow_entry:'얕은 침투', deep_penetration:'깊은 관통', near_exit_lodged:'관통 직전 체내 잔류', body_through_and_through:'인체 완전관통' };
const _BLEED_CLASS_KO = { no_bleed_or_minor:'출혈 없음/경미', superficial_bleed:'표재성 출혈', external_controllable_bleed:'외부 통제가능 출혈', muscle_bleed:'근육층 출혈', junctional_bleed:'접합부 출혈', cavity_internal_bleed:'체강 내부출혈 후보', major_vessel_candidate:'대혈관 후보' };
const _REAR_RESULT_KO = { stopped_by_rear_soft:'후면 소프트아머 정지', stopped_by_rear_plate:'후면 플레이트 정지', retained_in_rear_armor:'후면 방호구 잔류', rear_armor_penetrated:'후면 방호구 관통', rear_armor_deflected:'후면 편향', no_rear_armor:'후면 방호구 없음', target_through_and_through:'표적 완전관통', not_applicable_limb:'사지(후면 방호 해당없음)', not_applicable_fragment:'파편(후면 방호 해당없음)' };
function entryArmorSummaryLabel(bt) {
  const eac = bt && bt.entryArmorContext;
  if (!eac) return '비방호';
  const r = eac.entryArmorResult;
  const cls = eac.entryLayerClass;
  if (r === 'unprotected_hit') return '비방호';
  if (r === 'hard_block') return '전면 하드 방호 저지';
  if (r === 'soft_block') return '전면 소프트 방호 저지';
  if (r === 'hard_pen_soft_block') return '전면 하드 관통 · 백커 저지';
  if (r === 'penetrated') return cls === 'hard' ? '전면 하드 방호 관통' : cls === 'soft' ? '전면 소프트 관통' : '관통';
  if (r === 'deflected') return '전면 방호 편향';
  if (r === 'ricocheted') return '전면 방호 도탄';
  return cls === 'none' ? '비방호' : '전면 방호';
}
function rearArmorSummaryLabel(bt) {
  if (!bt || !bt.rearArmorChecked) return '';
  const rr = bt.rearArmorResult;
  if (!rr || rr === 'no_rear_armor') return '후면 방호구 없음';
  return _REAR_RESULT_KO[rr] || rr;
}
function continuationSummaryLabel(bt) {
  if (!bt) return '';
  if (bt.continueRaycast) return '후속 탄도 생성';
  if (bt.targetThroughAndThrough) return '표적 완전관통';
  if (bt.rearArmorResult === 'stopped_by_rear_plate' || bt.rearArmorResult === 'stopped_by_rear_soft') return '후속 탄도 없음(후면 방호 정지)';
  if (bt.retainedProjectile) return '후속 탄도 없음(체내 잔류)';
  return '후속 탄도 없음';
}
function bodyTrajectorySummaryLabel(bt) {
  if (!bt) return '';
  const parts = [];
  let path = _WOUND_DEPTH_KO[bt.woundDepthClass] || bt.woundDepthClass;
  if (bt.exitWoundPresent) path += ' / 사출구 ' + (bt.exitWoundLabel || '있음'); else if (bt.retainedProjectile) path += ' / 체내 잔류'; else path += ' / 사출구 없음';
  parts.push('상처 경로: ' + path);
  if (bt.rearArmorChecked && bt.rearArmorResult && bt.rearArmorResult !== 'no_rear_armor') parts.push('후면: ' + (_REAR_RESULT_KO[bt.rearArmorResult] || bt.rearArmorResult));
  if (bt.continueRaycast) parts.push('후속 탄도 생성(잔여위협)');
  // 탄자 등급 + 내부 피해 경향 (debug/detail)
  const SZ_KO = { micro_fragment:'미세 파편', pellet:'펠릿', small_pdw:'소형 PDW', sabot_subcaliber:'사보 관통자', pistol:'권총탄', intermediate_rifle:'중간형 소총탄', full_power_rifle:'풀파워 소총탄', large_bore:'대구경', shotgun_slug:'슬러그', anti_material:'대물탄' };
  if (bt.projectileSizeClass) parts.push('탄자 등급: ' + (SZ_KO[bt.projectileSizeClass] || bt.projectileSizeClass));
  const sc = bt.internalScores;
  if (sc) { const lo=(v)=>v<0.5?'낮음':v<0.9?'중간':'높음'; parts.push('내부 피해: crush ' + lo(sc.crushDamageScore) + ' / cavity ' + lo(sc.temporaryCavityScore)); }
  parts.push('출혈 분류: ' + ((bt.majorVesselCandidate ? _BLEED_CLASS_KO.major_vessel_candidate + ' / ' : '') + (_BLEED_CLASS_KO[bt.bleedingClass] || bt.bleedingClass)));
  if (bt.vesselCandidateHints && bt.vesselCandidateHints.length) parts.push('혈관 후보: ' + bt.vesselCandidateHints.join(', '));
  return parts.join(' · ');
}
function buildPhysiologicInjuryModel(w, bt, unit) {
  const empty = { physiologicInjuries: [], physiologicSeverity: 0, physiologicTags: [], physiologicEffectProfile: null };
  if (!w || !bt || !bt.bodyEntered) return empty;
  const depth = bt.woundDepthClass || 'surface_only';
  // 깊이 게이트 — 표면/얕은 진입은 깊은 장기/혈관 확정 금지
  if (depth === 'surface_only' || depth === 'shallow_entry') return empty;
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  if (!isDeep || !bt.deepTissueReached) return empty;
  const through = (depth === 'body_through_and_through');
  const nearExit = (depth === 'near_exit_lodged');
  const ref = (bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : 0.5;
  const sc = bt.internalScores || {};
  const tempCavity = sc.temporaryCavityScore || 0;
  const crush = sc.crushDamageScore || 0;
  const fam = (bt.terminalEffectType || '') + ' ' + (bt.woundChannelType || '');
  const size = bt.projectileSizeClass || '';
  const microFrag = (size === 'micro_fragment' || size === 'small');
  const retained = !!bt.retainedProjectile;
  const expanding = /expand|jhp|hollow/.test(fam);
  const fragmenting = /fragment|frangible/.test(fam);
  const highEnergyAmmo = expanding || fragmenting || size === 'large_bore' || size === 'shotgun_slug' || size === 'anti_material' || size === 'full_power_rifle';
  const cm = bt.candidateMap || [];
  const oim = w.organInjuryModel || null;
  const ibm = w.internalBleedingModel || null;
  const ia = bt.impactAddress || {};
  const addr = ((ia.zone||'') + ' ' + (ia.subZone||'') + ' ' + (ia.impactSide||ia.side||'') + ' ' + (ia.limbLocation||'') + ' ' + (ia.anatomicalZone||'')).toLowerCase();
  const hitPart = bt.hitPart || w.partKey || '';
  const isLimb = /arm|leg/.test(hitPart);
  const matchAny = (re) => re.test(addr);

  // 공통 승격 게이트 강도 (0~1.2)
  let gate = 0;
  if (isDeep) gate += 0.40;
  if (through) gate += 0.20; else if (nearExit) gate += 0.10;
  if (ref >= 0.6) gate += 0.20; else if (ref >= 0.35) gate += 0.10;
  if (tempCavity >= 0.9) gate += 0.08;
  if (crush >= 0.9) gate += 0.05;
  if (retained) gate += 0.05;            // 강화: 잔류
  if (highEnergyAmmo) gate += 0.08;      // 강화: 고에너지/팽창/파편
  if (bt._coverPenetratedDestabilized) gate += 0.05;   // 강화: 관통-cover 후 불안정화(선택적 hook)
  if (matchAny(/proximal|medial|central|upper/)) gate += 0.04;   // 강화: 근위/내측/중심
  if (microFrag && !through) gate -= 0.28;   // 감쇠: 미세 파편
  if (bt.armorResult === 'stopped' || bt.armorResult === 'absorbed') gate -= 0.6;   // 감쇠: 방호 정지
  // SIDE-HIT-ADDRESS-DAMAGE-ATTENUATION-1 §3-D: 세부주소 physiologyMul을 승격 gate에 약하게 반영 (critical/vascular는 1.0 → 무영향)
  const _hapPhys = (ia && ia.hitAddressDamageProfile && ia.hitAddressDamageProfile.physiologyMul != null) ? ia.hitAddressDamageProfile.physiologyMul
                 : ((w.damageAttenuationProfile && w.damageAttenuationProfile.physiologyMul != null) ? w.damageAttenuationProfile.physiologyMul : 1.0);
  gate *= (0.85 + _hapPhys * 0.15);
  gate = Math.max(0, Math.min(1.2, gate));

  const injuries = [];
  const tags = new Set();
  const addInj = (id, organ, type, severity, source, effects) => {
    injuries.push({ id, organ, type, severity: +Math.max(0, Math.min(1, severity)).toFixed(2), source, effects, confirmed: true, confirmedLevel: 'confirmed_physiologic' });
  };

  // ===== 5. 실질장기 출혈 루프 =====
  if (oim && oim.injuries) {
    const seen = new Set();
    for (const inj of oim.injuries) {
      if (!(inj.organ === 'liver' || inj.organ === 'spleen' || inj.organ === 'kidney' || inj.organ === 'retroperitoneal_bleed')) continue;
      if (seen.has(inj.organ)) continue;
      const strong = (inj.status === 'confirmed_limited') || (inj.status === 'likely' && gate >= 0.55) || (inj.status === 'suspected' && gate >= 0.80 && highEnergyAmmo);
      if (!strong) continue;
      seen.add(inj.organ);
      const kidneyDamp = (inj.organ === 'kidney') ? 0.78 : 1.0;   // kidney는 즉시 대량출혈 약간 낮게
      const sev = Math.min(1, (0.40 + ref*0.25 + (through?0.12:0) + (highEnergyAmmo?0.12:0)) * kidneyDamp);
      const solidStrong = (inj.organ === 'liver' || inj.organ === 'spleen');   // spleen/liver 고에너지 internal 가중 큼
      addInj(inj.organ + '_laceration', inj.organ, 'solid_organ_injury', sev, 'organInjuryModel', {
        internalBleedBoost: +((solidStrong ? 0.11 : 0.06) * (1 + (highEnergyAmmo?0.45:0)) * kidneyDamp).toFixed(3),
        shockBoost: +(0.03 + sev*0.05).toFixed(3),
      });
      tags.add('PHYS-SOLID-ORGAN'); tags.add('SURGERY-REQ');
    }
  }

  // ===== 6. 대혈관 출혈 루프 (매우 강력 → 보수적) =====
  if (oim && oim.injuries) {
    const seen = new Set();
    for (const inj of oim.injuries) {
      const vesselSet = ['femoral_vessel','iliac_vessel','carotid_jugular','thoracic_vessel','axillary_vessel','abdominal_vessel'];
      if (vesselSet.indexOf(inj.organ) < 0) continue;
      if (seen.has(inj.organ)) continue;
      // 부위별 주소 일치
      let addrOk = true;
      if (inj.organ === 'femoral_vessel') addrOk = matchAny(/groin|thigh|femoral|inguinal|proximal|pelvis|lower_?abdomen|medial/) && !matchAny(/distal|lower_?leg|foot|knee|calf/);
      else if (inj.organ === 'iliac_vessel' || inj.organ === 'abdominal_vessel') addrOk = matchAny(/pelvis|lower_?abdomen|groin|iliac|central|upper_?abdomen|flank/);
      else if (inj.organ === 'carotid_jugular') addrOk = (hitPart === 'neck') || matchAny(/neck|carotid|jugular|cervical/);
      else if (inj.organ === 'thoracic_vessel') addrOk = (hitPart === 'chest') || matchAny(/center|central|upper|plate_?core|thorax/);
      else if (inj.organ === 'axillary_vessel') addrOk = matchAny(/axilla|armshoulder|shoulder|subclavian/);
      // 사지 원위부 femoral 확정 금지
      if (isLimb && inj.organ === 'femoral_vessel' && matchAny(/distal|lower_?leg|foot|knee|calf/)) addrOk = false;
      const strong = addrOk && bt.deepTissueReached && ((inj.status === 'confirmed_limited') || (inj.status === 'likely' && gate >= 0.70));
      if (!strong) continue;
      seen.add(inj.organ);
      const sev = Math.min(1, 0.55 + ref*0.25 + (through?0.10:0));
      const internalVessel = (inj.organ === 'thoracic_vessel' || inj.organ === 'iliac_vessel' || inj.organ === 'abdominal_vessel');
      const eff = { majorVesselMul: +(1.6 + sev*0.6).toFixed(2), shockBoost: +(0.06 + sev*0.08).toFixed(3), preArrestBoost: +(0.04 + sev*0.06).toFixed(3) };
      if (internalVessel) eff.internalBleedBoost = +(0.14 * (1 + sev)).toFixed(3);
      else eff.externalBleedBoost = +(0.12 * (1 + sev)).toFixed(3);
      let injId, label;
      if (inj.organ === 'femoral_vessel') injId = 'femoral_artery_injury';
      else if (inj.organ === 'iliac_vessel') injId = 'iliac_vessel_injury';
      else if (inj.organ === 'carotid_jugular') injId = 'carotid_jugular_injury';
      else if (inj.organ === 'thoracic_vessel') injId = 'thoracic_great_vessel_injury';
      else if (inj.organ === 'axillary_vessel') injId = 'axillary_subclavian_injury';
      else injId = inj.organ + '_injury';
      addInj(injId, inj.organ, 'major_vessel_injury', sev, 'organInjuryModel', eff);
      tags.add('PHYS-MAJOR-VESSEL'); tags.add('EVAC-URGENT'); tags.add('SURGERY-REQ');
    }
  }

  // ===== 7. 심장 리듬 위험 연결 (확정 손상 아님 — risk 강화 전용) =====
  const heartAdjacent = cm.some(c => c.id === 'heart_candidate') || (oim && oim.injuries && oim.injuries.some(i => i.organ === 'heart_hook_only'));
  const thoracicVesselPhys = injuries.some(i => i.organ === 'thoracic_vessel');
  if ((heartAdjacent && hitPart === 'chest' && bt.deepTissueReached && gate >= 0.60) || thoracicVesselPhys) {
    const riskBoost = Math.min(0.6, 0.15 + (heartAdjacent?0.15:0) + (thoracicVesselPhys?0.20:0) + ref*0.10);
    injuries.push({ id:'cardiac_rhythm_risk', organ:'heart', type:'cardiac_rhythm_risk', severity:+riskBoost.toFixed(2), source:'preCardiacRisk',
      effects:{ rhythmRiskBoost:+riskBoost.toFixed(3), perfusingRhythmPenalty:+(riskBoost*0.3).toFixed(3) }, confirmed:false, confirmedLevel:'risk_only' });
    tags.add('PHYS-CARDIAC-RISK');
  }

  if (!injuries.length) return empty;
  // 종합 severity
  const confirmedInj = injuries.filter(i => i.confirmedLevel === 'confirmed_physiologic');
  const physiologicSeverity = +Math.min(1, (injuries.reduce((s,i)=> s + (i.confirmedLevel==='confirmed_physiologic' ? i.severity : i.severity*0.3), 0) / Math.max(1, injuries.length)) + confirmedInj.length*0.05).toFixed(2);
  // effect profile 집계 + clamp (중복 가중 방지)
  const prof = { breathingDrain:0, oxygenDrain:0, internalBleedBoost:0, externalBleedBoost:0, majorVesselMul:1.0, shockBoost:0, preArrestBoost:0, rhythmRiskBoost:0, perfusingRhythmPenalty:0 };
  for (const i of injuries) {
    const e = i.effects || {};
    prof.breathingDrain += e.breathingDrain||0;
    prof.oxygenDrain += e.oxygenDrain||0;
    prof.internalBleedBoost += e.internalBleedBoost||0;
    prof.externalBleedBoost += e.externalBleedBoost||0;
    if (e.majorVesselMul) prof.majorVesselMul = Math.max(prof.majorVesselMul, e.majorVesselMul);
    prof.shockBoost += e.shockBoost||0;
    prof.preArrestBoost += e.preArrestBoost||0;
    prof.rhythmRiskBoost += e.rhythmRiskBoost||0;
    prof.perfusingRhythmPenalty += e.perfusingRhythmPenalty||0;
  }
  prof.breathingDrain = +Math.min(0.25, prof.breathingDrain).toFixed(3);
  prof.oxygenDrain = +Math.min(0.18, prof.oxygenDrain).toFixed(3);
  prof.internalBleedBoost = +Math.min(0.50, prof.internalBleedBoost).toFixed(3);
  prof.externalBleedBoost = +Math.min(0.40, prof.externalBleedBoost).toFixed(3);
  prof.majorVesselMul = +Math.min(2.6, prof.majorVesselMul).toFixed(2);
  prof.shockBoost = +Math.min(0.30, prof.shockBoost).toFixed(3);
  prof.preArrestBoost = +Math.min(0.30, prof.preArrestBoost).toFixed(3);
  prof.rhythmRiskBoost = +Math.min(0.60, prof.rhythmRiskBoost).toFixed(3);
  prof.perfusingRhythmPenalty = +Math.min(0.30, prof.perfusingRhythmPenalty).toFixed(3);
  return { physiologicInjuries: injuries, physiologicSeverity, physiologicTags: Array.from(tags), physiologicEffectProfile: prof };
}
function buildConfirmedInjuryModel(wound, bt, candidateMap, med) {
  const out = { confirmed: [], probable: [], candidates: [], ruledOut: [], severity: 'none', confidence: 0.0, reasonTags: [] };
  const cands = Array.isArray(candidateMap) ? candidateMap : ((candidateMap && candidateMap.candidates) || []);
  const candIds = cands.map(c => c.id);
  out.candidates = candIds.slice();
  if (!bt) return out;
  // SIDE-MEDICAL-ORGAN-BLEEDING-HOTFIX-1 §1: bodyTrajectory 실제 깊이 필드는 woundDepthClass. bt.depth는 undefined였음(deep 판정 실패).
  const depth = bt.woundDepthClass || bt.depthClass || bt.depth || 'surface_only';
  const bodyEntered = !!bt.bodyEntered;
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  const through = (depth === 'body_through_and_through' || bt.bodyThroughAndThrough === true);
  const resid = (bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : 0.5;
  const penetrationState = wound && wound.penetrationState;
  const armorStopped = !!(wound && (wound.armorResult === 'stopped' || wound.armorResult === 'absorbed')) || (bt.armorResult === 'stopped') || penetrationState === 'stopped_by_armor';
  const bluntOnly = !bodyEntered && !!(wound && (wound.bluntTrauma || 0) > 0);
  const projClass = String((wound && (wound.projectileClass || wound.woundType)) || bt.projectileClass || '');
  const isRifleAP = /rifle|ap\b|armor_pierc|steel_core|m2ap|m993|mk211|apfsds/i.test(projClass) || resid >= 0.7;
  const sizeClass = String((wound && (wound.woundSizeClass || (wound.woundSize && wound.woundSize.sizeClass))) || bt.woundSizeClass || bt.projectileSizeClass || '');
  const bigWound = /large|massive/.test(sizeClass);
  const mz = (med && med.medicalZone) || '';
  const org = (med && med.organRegion) || '';
  const cav = (med && med.cavityRegion) || '';
  const vasc = (med && med.vascularRegion) || '';
  const junc = (med && med.junctionalRegion) || '';
  const hf = (med && med.headFaceRegion) || '';
  const majorVesselHint = !!(med && med.majorVesselRiskHint) || !!(wound && wound.majorVesselCandidate);
  const chestCav = !!(med && med.chestCavityRisk), abdCav = !!(med && med.abdominalCavityRisk), pelvCav = !!(med && med.pelvicCavityRisk);
  const physCrit = !!(wound && (wound.physiologicSeverity === 'critical'));
  const has = (frag) => cands.some(c => c.id.indexOf(frag) >= 0);

  // === 승격 금지 게이트: bodyEntered false / armor stopped / surface / shallow / 매우 낮은 잔여에너지 / 둔상 only / ricochet(체내 미진입) ===
  const blockReason = !bodyEntered ? 'no_body_entry'
    : armorStopped ? 'armor_stopped'
    : (depth === 'surface_only') ? 'surface_only'
    : (depth === 'shallow_entry') ? 'shallow_entry'
    : (resid < 0.12) ? 'very_low_residual_energy'
    : bluntOnly ? 'blunt_trauma_only'
    : (bt.ricochet && !bodyEntered) ? 'ricochet_no_entry'
    : null;
  if (blockReason) {
    out.reasonTags.push(blockReason);
    out.ruledOut = candIds.filter(id => /injury|fracture|bleeding|compromise/.test(id));
    out.severity = bigWound ? 'minor' : 'minor';
    out.confidence = 0.1;
    return out;
  }

  const addC = (id, tag) => { if (out.confirmed.indexOf(id) < 0) out.confirmed.push(id); if (tag) out.reasonTags.push(tag); };
  const addP = (id, tag) => { if (out.probable.indexOf(id) < 0 && out.confirmed.indexOf(id) < 0) out.probable.push(id); if (tag) out.reasonTags.push(tag); };
  const addCand = (id) => { if (out.candidates.indexOf(id) < 0) out.candidates.push(id); };

  // === §2 흉부 ===
  const isChestZone = chestCav || /chest|thorax|lung|clavicle|supraclavicular|axilla|lateral_chest|collar/.test(mz + ' ' + org + ' ' + vasc);
  if (isChestZone) {
    if (has('lung_candidate') && chestCav && isDeep) addC('lung_injury_confirmed', 'chest_deep_lung');
    else if (has('lung_candidate') || has('lung_apex') || has('upper_lung')) addP('lung_injury_probable', 'lung_candidate');
    if (has('subclavian_vessel_candidate') || /clavicle|supraclavicular|collar/.test(mz) || vasc === 'subclavian') addP('subclavian_vessel_injury_probable', 'subclavian');
    if (has('axillary_vessel_candidate') || mz === 'axilla' || /axillary/.test(vasc)) addP('axillary_vessel_injury_probable', 'axillary');
    // 심장: 매우 제한적. center chest + deep + high energy + 급격한 생리악화에서만 confirmed.
    if (has('heart_candidate') && /mid|lower|chest|center/.test(mz) && through && isRifleAP && physCrit) addC('heart_injury_confirmed', 'heart_center_deep_collapse');
    else {
      // CLEANUP HOTFIX 4: heart_injury_probable 축소 — center/left anterior + 고잔여에너지/rifle + through·nearExit·deep central 동반.
      //   단순 deep chest만으로는 뜨지 않음. physiologic collapse는 가중(필수 아님).
      const _heartCentral = /center|mid|left/.test(mz) || /central|left_anterior/.test(org);
      const _heartHighEnergy = (resid >= 0.6) || isRifleAP;
      const _heartDeepCentral = through || depth === 'near_exit_lodged' || (isDeep && _heartCentral);
      if (has('heart_candidate') && chestCav && _heartCentral && _heartHighEnergy && _heartDeepCentral) addP('heart_injury_probable', 'heart_candidate');
      else if (has('heart_candidate')) addCand('heart_candidate');   // 조건 미충족 → 후보로만 유지
    }
  }

  // === §3 복부 (probable 중심, 확정 지양) ===
  const isAbdZone = abdCav || /abdomen|liver|spleen|stomach|bowel|kidney|flank|retroperitoneal|peritoneal/.test(mz + ' ' + org + ' ' + cav);
  if (isAbdZone) {
    if (has('liver_candidate') || has('spleen_candidate') || has('stomach_candidate')) addP('solid_organ_injury_probable', 'solid_organ');
    if (has('bowel_candidate')) addP('hollow_viscus_injury_probable', 'hollow_viscus');
    if (has('kidney_candidate') || /kidney/.test(mz + ' ' + org)) addP('kidney_injury_probable', 'kidney');
    if (has('retroperitoneal_bleed_candidate') || cav === 'retroperitoneal') addP('retroperitoneal_bleeding_probable', 'retroperitoneal');
    if (has('abdominal_vessel_candidate') || (abdCav && isDeep && (bigWound || isRifleAP || through))) addP('abdominal_internal_bleeding_probable', 'abd_internal');
  }

  // === §4 골반/서혜부/대퇴삼각 ===
  const isPelvicJunc = /pelvis|groin|femoral|iliac/.test(mz + ' ' + junc + ' ' + vasc) || pelvCav;
  if (isPelvicJunc) {
    if (has('junctional_hemorrhage_candidate') || mz === 'groin_junctional' || junc === 'inguinal') addP('junctional_hemorrhage_probable', 'junctional');
    if (has('femoral_vessel_candidate') || mz === 'femoral_triangle' || /femoral/.test(vasc)) addP('femoral_vessel_injury_probable', 'femoral');
    if (has('iliac_vessel_candidate') || (mz === 'pelvis_upper' && isDeep) || vasc === 'iliac') addP('iliac_vessel_injury_probable', 'iliac');
    if (pelvCav || mz === 'pelvis_upper' || has('pelvic_bleed_candidate')) addP('pelvic_bleeding_probable', 'pelvic');
    if (has('pelvic_bone_candidate')) addCand('pelvic_bone_injury_candidate');
  }

  // === §5 두부/얼굴/기도 (헬멧/바이저 정지는 위 게이트에서 이미 차단됨 — 여기선 penetrated만) ===
  const isHeadZone = /skull|head|forehead|crown|temporal|occipital|brain/.test(mz + ' ' + hf + ' ' + org);
  if (isHeadZone) {
    if (has('skull_candidate') || /forehead|temporal|occipital|crown/.test(mz)) addP('skull_fracture_probable', 'skull');
    if (has('tbi_candidate') || has('brain_region') || (isDeep && bodyEntered)) addP('tbi_probable', 'tbi');
  }
  if (/eye|orbital/.test(mz + ' ' + hf) || has('eye_candidate')) {
    addP('eye_injury_probable', 'eye');
  }
  const isFaceLower = /jaw|mouth|face|nose|cheek|mid_face/.test(mz + ' ' + hf);
  if (isFaceLower) {
    // CLEANUP HOTFIX 3: airway_compromise_probable은 jaw/mouth 계열 또는 airwayRisk===true(possible 제외) 또는 생리악화 동반 시만.
    //   nose/cheek/mid_face(airwayRisk:'possible')는 후보 수준 — probable로 승격 안 함.
    const _airwayStrong = has('jaw_candidate') || /jaw|mouth|lower_face|mouth_jaw/.test(mz) || (med && med.airwayRisk === true);
    const _airwayPhys = physCrit || (wound && wound.physiologicSeverity === 'severe') || (med && med.consciousnessImpaired);
    if (_airwayStrong || (_airwayPhys && med && med.airwayRisk)) addP('airway_compromise_probable', 'airway');
    else if (med && med.airwayRisk === 'possible') addCand('airway_risk_candidate');
    if (has('facial_bone_candidate') || /jaw|cheek|nose|mid_face/.test(mz)) addP('facial_bone_injury_probable', 'facial_bone');
  }

  // === severity / confidence 산정 ===
  const nC = out.confirmed.length, nP = out.probable.length;
  if (nC > 0) {
    const lethal = out.confirmed.some(i => /heart|lung_injury|open_chest/.test(i));
    out.severity = (lethal || nC >= 2) ? 'critical' : 'severe';
    out.confidence = Math.min(0.92, 0.6 + 0.1 * nC);
  } else if (nP > 0) {
    out.severity = (nP >= 2 || majorVesselHint) ? 'severe' : 'moderate';
    out.confidence = Math.min(0.6, 0.28 + 0.08 * nP);
  } else {
    out.severity = bigWound ? 'moderate' : 'minor';
    out.confidence = 0.2;
  }
  out.reasonTags = Array.from(new Set(out.reasonTags));
  out.summary = _confirmedInjurySummary(out);
  return out;
}
function _confirmedInjurySummary(m) {
  const parts = [];
  if (m.confirmed.length) parts.push('확정: ' + m.confirmed.join(', '));
  if (m.probable.length) parts.push('강한의심: ' + m.probable.join(', '));
  if (!parts.length) parts.push('확정/강한의심 없음 (후보 ' + m.candidates.length + ')');
  return parts.join(' | ');
}
function classifyInternalBleedingCategory() {
  return {category:'wound_bleeding',fieldControllability:'controllable',evacBias:'routine',note:'MO3 상처당 단일 출혈; 모든 부위 처치 가능'};
}

const _VESSEL_NAMED_RE = /femoral|brachial|axillary|subclavian|iliac|carotid|aorta|popliteal|jugular/;
const _VESSEL_MAJOR_RE = /femoral|brachial|axillary|subclavian|iliac|carotid|aorta/;
function buildVascularEvidence(w) {
  const bp = w.bleedingProfile || {};
  const conf = (w.confirmedInjuries || []).slice();
  const prob = (w.probableInjuries || []).slice();
  const cand = (w.candidateInjuries || []).slice();
  const physio = (w.physiologicInjuries || []).map(i => (i && i.type) || '').filter(Boolean);
  const vHints = (w.vesselCandidateHints || []).slice();
  const majorCandidate = !!w.majorVesselCandidate;
  const riskPercent = Math.max(0, Math.min(100, Math.round((bp.vesselRisk || 0) * 100)));

  const confirmedVessels = conf.filter(i => /vessel/.test(i) || _VESSEL_NAMED_RE.test(i))
    .concat(physio.filter(i => i === 'major_vessel_injury'));
  const probableVessels = prob.filter(i => /vessel/.test(i) || _VESSEL_NAMED_RE.test(i));
  const suspectedVessels = cand.filter(i => /vessel/.test(i) || _VESSEL_NAMED_RE.test(i)).concat(vHints);

  let level = 'none', vesselClass = 'none', source = 'risk_percent', evidenceStrength = 0;
  if (confirmedVessels.length) {
    level = 'confirmed'; source = 'confirmed_injury'; evidenceStrength = 1.0;
    vesselClass = confirmedVessels.some(i => _VESSEL_MAJOR_RE.test(i)) ? 'major_named' : 'named_branch';
  } else if (probableVessels.length) {
    level = 'probable'; source = 'probable_injury'; evidenceStrength = 0.65;
    vesselClass = probableVessels.some(i => _VESSEL_MAJOR_RE.test(i)) ? 'major_named'
                : probableVessels.some(i => _VESSEL_NAMED_RE.test(i)) ? 'named_branch' : 'small_branch';
  } else if (suspectedVessels.length || majorCandidate) {
    level = 'candidate'; source = 'candidate_map'; evidenceStrength = 0.35;
    vesselClass = (majorCandidate || suspectedVessels.some(i => _VESSEL_MAJOR_RE.test(i))) ? 'named_branch' : 'small_branch';
  } else if (riskPercent >= 60) {
    level = 'risk_only'; source = 'risk_percent'; evidenceStrength = 0.18; vesselClass = 'small_branch';
  } else if (riskPercent >= 25) {
    level = 'risk_only'; source = 'risk_percent'; evidenceStrength = 0.10; vesselClass = 'capillary_muscle';
  } else {
    vesselClass = (riskPercent > 5) ? 'capillary_muscle' : 'none';
  }
  const majorVessel = (vesselClass === 'major_named') && (level === 'probable' || level === 'confirmed');
  const selfTamponadePossible = !(level === 'confirmed' || (level === 'probable' && vesselClass === 'major_named'));
  const evidenceTags = [];
  if (majorVessel) evidenceTags.push('major_vessel_' + level);
  if (level === 'risk_only') evidenceTags.push('vascular_risk_only');
  return {
    riskPercent, level, vesselClass,
    suspectedVessels, probableVessels, confirmedVessels,
    evidenceStrength: +evidenceStrength.toFixed(2), majorVessel, selfTamponadePossible,
    evidenceTags, source,
  };
}
const _BONE_ZONE_MAP = [
  [/skull|crown|forehead|occipital|temporal|cranium/, 'skull', 'extreme'],
  [/jaw|mandible|maxilla|face_lower|mouth/, 'jaw', 'high'],
  [/spine|vertebra|cervical|lumbar|thoracic_spine/, 'spine', 'extreme'],
  [/clavicle|collarbone/, 'clavicle', 'high'],
  [/rib|thorax_wall|costal/, 'rib', 'high'],
  [/pelvis|pelvic|hip|sacrum/, 'pelvis', 'high'],
  [/humerus|upper_arm_bone|shoulder_joint/, 'humerus', 'medium'],
  [/radius|ulna|forearm/, 'radius_ulna', 'medium'],
  [/femur|thigh_bone|femoral_shaft/, 'femur', 'medium'],
  [/tibia|fibula|shin|lower_leg/, 'tibia_fibula', 'medium'],
];
function buildFractureEvidence(unit, ev, woundSize, bt, med) {
  const prof = getAmmoMedicalProfile((ev.ammoId && typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[ev.ammoId] : null);
  const baseChance = (typeof prof.fractureChance === 'number') ? prof.fractureChance : 0.08;
  const partKey = ev.partKey;
  const zoneStr = ((ev.anatomicalZone || '') + ' ' + ((med && med.medicalZone) || '') + ' ' + ((bt && bt.hitZone) || '') + ' ' + ((ev.impactAddress && ev.impactAddress.fullAddress) || '')).toLowerCase();
  // boneZone/boneRisk 결정
  let boneZone = null, boneRisk = 'none';
  for (const [re, zone, risk] of _BONE_ZONE_MAP) { if (re.test(zoneStr)) { boneZone = zone; boneRisk = risk; break; } }
  // 사지 근육 중심부는 낮게, shaft/joint 명시면 상승
  const isLimb = (partKey === 'leftArm' || partKey === 'rightArm' || partKey === 'leftLeg' || partKey === 'rightLeg');
  const boneAdjacent = /shaft|proximal|distal|joint|bone|condyle|epiphysis/.test(zoneStr);
  if (!boneZone && isLimb) {
    // 팔/다리 근육 중심 — 뼈 경로 불명확
    boneZone = (partKey === 'leftArm' || partKey === 'rightArm') ? 'humerus' : 'femur';
    boneRisk = boneAdjacent ? 'high' : 'low';
  }
  if (boneAdjacent && (boneRisk === 'low' || boneRisk === 'medium')) boneRisk = (boneRisk === 'low') ? 'medium' : 'high';
  // trajectory가 뼈 통과/깊은 경로면 상승
  const deep = !!(bt && (bt.penetrationState === 'through_and_through' || bt.penetrationState === 'deep' || bt.deepTrajectory));
  const resid = (bt && bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : (ev.residualEnergyFactor || 0.5);
  const riskMul = ({ none: 0.0, low: 0.6, medium: 1.6, high: 3.2, extreme: 5.0 })[boneRisk];
  const energyMul = 0.7 + Math.max(0, Math.min(1.2, resid)) * 0.9;
  const penMul = (ev.armorResult === 'penetrated' || ev.sourceType === 'frag') ? 1.15 : 0.6;
  const crossMul = deep ? 1.35 : 1.0;
  const backfaceMul = (ev.armorResult === 'stopped' || ev.armorResult === 'absorbed') ? (0.8 + (prof.bluntTraumaMul || 1) * 0.3) : 1.0;
  let finalChance = baseChance * riskMul * energyMul * penMul * crossMul * backfaceMul;
  finalChance = Math.max(0, Math.min(0.9, finalChance));
  const occurred = (riskMul > 0) && (Math.random() < finalChance);
  // fractureType — 에너지/severity 기반
  let fractureType = 'none';
  if (occurred) {
    const sizeClass = (woundSize && woundSize.sizeClass) || 'small';
    const heavy = (resid >= 0.7) || sizeClass === 'large' || sizeClass === 'massive';
    if (boneRisk === 'extreme' && heavy) fractureType = 'shattered';
    else if (heavy && (boneRisk === 'high' || boneRisk === 'extreme')) fractureType = 'comminuted';
    else if (heavy || boneRisk === 'high') fractureType = 'displaced';
    else if (resid >= 0.4) fractureType = 'simple';
    else fractureType = 'hairline';
  }
  const _fragSevMap = { none: 0, hairline: 0.05, simple: 0.15, displaced: 0.35, comminuted: 0.6, shattered: 0.85 };
  const boneFragmentSeverity = _fragSevMap[fractureType] || 0;
  const _bleedBonusMap = { none: 1.0, hairline: 1.07, simple: 1.15, displaced: 1.30, comminuted: 1.55, shattered: 1.80 };
  const bleedBonusMul = _bleedBonusMap[fractureType] || 1.0;
  const vascularRiskBonus = ({ none: 0, hairline: 0.0, simple: 0.03, displaced: 0.08, comminuted: 0.18, shattered: 0.30 })[fractureType] || 0;
  const evidenceTags = [];
  if (occurred) { evidenceTags.push('fracture_' + fractureType); if (boneZone) evidenceTags.push('bone_' + boneZone); }
  return {
    occurred, fractureType, boneRisk, boneZone,
    finalChance: +finalChance.toFixed(3), baseChance: +baseChance.toFixed(3), multiplier: +(riskMul * energyMul * penMul * crossMul * backfaceMul).toFixed(2),
    boneFragmentSeverity: +boneFragmentSeverity.toFixed(2), vascularRiskBonus: +vascularRiskBonus.toFixed(2), bleedBonusMul: +bleedBonusMul.toFixed(2),
    evidenceTags,
  };
}
function ensurePartDestructionModel(unit) {
  if (!unit || !unit.medical) return null;
  const m = unit.medical;
  if (!m.partDestruction) m.partDestruction = _makeAllPartDestruction();
  else for (const k of BODY_PART_KEYS) { if (!m.partDestruction[k]) m.partDestruction[k] = makeDefaultPartDestruction(k); }
  return m.partDestruction;
}
function getPartDestruction(unit, partKey) {
  const pd = ensurePartDestructionModel(unit);
  if (!pd || !partKey) return null;
  if (!pd[partKey]) pd[partKey] = makeDefaultPartDestruction(partKey);
  return pd[partKey];
}
function computePartDestructionContribution(wound, ev, ctx) {
  const ws = wound.woundSize || {};
  const fe = wound.fractureEvidence || {};
  const bt = wound.bodyTrajectory || {};
  const bodyDmg = Math.max(0, ctx.bodyDmg || 0);
  const part = ctx.bodyPart || {};
  const partMax = Math.max(1, part.maxHp || 60);
  // [B-STAGE 7.2] 한 탄의 에너지가 body damage/상처/exit/골절/탄체에서 무제한 중복 가산되지 않도록
  //   하위 점수 그룹(연부조직 / 골 / 탄체·발원)별 soft ceiling을 둔다. 전체를 하나의 hard clamp로 누르지 않는다.
  let tissue = 0;
  tissue += Math.min(0.25, (bodyDmg / partMax) * 0.55);
  const sizeClass = ws.sizeClass || 'small';
  if (sizeClass === 'micro') tissue += 0.005;
  else if (sizeClass === 'small') tissue += 0.025;
  else if (sizeClass === 'medium') tissue += 0.07;
  else if (sizeClass === 'large') tissue += 0.16;
  else if (sizeClass === 'massive') tissue += 0.32;
  const exitPresent = ws.exitWoundPresent || wound.exitWoundPresent || (bt && bt.exitWound);
  const exitClass = ws.exitSizeClass || wound.exitSizeClass || (bt && bt.exitSizeClass);
  if (exitPresent) tissue += 0.04;
  if (exitClass === 'large') tissue += 0.08;
  if (exitClass === 'massive') tissue += 0.16;
  tissue += Math.min(0.12, (ws.fragmentationScore || 0) * 0.08);
  tissue += Math.min(0.10, (ws.expansionScore || 0) * 0.06);
  const TISSUE_CEILING = 0.45;
  tissue = Math.min(TISSUE_CEILING, tissue);

  let bone = 0;
  if (fe.occurred) {
    const ft = fe.fractureType || 'simple';
    if (ft === 'hairline') bone += 0.025;
    else if (ft === 'simple') bone += 0.06;
    else if (ft === 'displaced') bone += 0.12;
    else if (ft === 'comminuted') bone += 0.22;
    else if (ft === 'shattered') bone += 0.35;
  }
  bone = Math.min(0.35, bone);

  let projMod = 0;
  const proj = (bt.projectileSizeClass || '') + '';
  if (proj === 'shotgun_slug' || /slug/.test(proj)) projMod += 0.14;
  if (proj === 'anti_material' || /anti_material|127|50bmg/.test(proj)) projMod += 0.28;
  if (proj === 'large_bore' || /large_bore/.test(proj)) projMod += 0.12;
  // source 문자열 단독 가산은 실제 파괴 규모(큰 상처)가 동반될 때만 (작은 파편 자동 가산 금지)
  if (/blast|frag/.test(ctx.sourceType || '') && (sizeClass === 'large' || sizeClass === 'massive')) projMod += 0.08;
  projMod = Math.min(0.30, projMod);

  return Math.max(0, Math.min(1.2, tissue + bone + projMod));
}
function _shotgunDestructionContributionMul(ammoId, isFlechette, isBuckshot) {
  if (isFlechette) return 0.28;
  if (isBuckshot) return 0.55;
  return 1.0;
}
function _localClusterState(score) {
  return score >= 0.75 ? 'catastrophic' : score >= 0.45 ? 'severe' : score >= 0.20 ? 'moderate' : 'minor';
}
function reinforceVascularEvidenceWithPartDestruction(unit, w) {
  if (!unit || !unit.medical || !w || !w.vascularEvidence) return w && w.vascularEvidence;
  const pd = unit.medical.partDestruction && unit.medical.partDestruction[w.partKey];
  if (!pd) return w.vascularEvidence;
  const ve = w.vascularEvidence;
  const RANK = { none:0, risk_only:1, candidate:2, probable:3, confirmed:4 };
  const fl = pd._flags || {};
  const bump = (target) => { if ((RANK[ve.level] || 0) < (RANK[target] || 0) && (RANK[target] || 0) <= RANK.probable) ve.level = target; };
  if (pd.state === 'mangled' && fl.vesselAdjacent && fl.deepTrajectory && ve.level === 'candidate') bump('probable');
  if (pd.state === 'destroyed' && fl.vesselAdjacent && (fl.worstFx === 'comminuted' || fl.worstFx === 'shattered')) bump('probable');
  if (pd.state === 'traumatic_amputation' && fl.isLimb && !fl.distalCluster) {
    bump('probable');
    if (ve.level === 'probable' && (ve.vesselClass === 'none' || ve.vesselClass == null || ve.vesselClass === 'capillary_muscle' || ve.vesselClass === 'small_branch')) ve.vesselClass = 'major_named';
  }
  if (pd.evidenceTags && pd.evidenceTags.length) {
    ve.evidenceTags = ve.evidenceTags || [];
    for (const t of pd.evidenceTags) if (ve.evidenceTags.indexOf(t) < 0) ve.evidenceTags.push(t);
  }
  return ve;
}
function updatePartDestructionFromWound(unit, wound, ev, ctx) {
  if (!unit || !unit.medical || !wound) return null;
  const partKey = ctx.partKey || wound.partKey;
  if (!partKey) return null;
  const pd = getPartDestruction(unit, partKey);
  // PART-DESTRUCTION-POST-WOUND-SYNC-1 §3: 이미 contribution 반영된 wound면 재가산 없이 final refresh만 (중복 방지)
  if (pd && pd.sourceWoundIds && pd.sourceWoundIds.indexOf(wound.id) >= 0) {
    refreshPartDestructionState(unit, partKey, { wound, ev, ctx });
    applyPartDestructionEffects(unit, partKey);
    return { contribution: 0, partDestructionContribution: 0, alreadyApplied: true, cumulativeTraumaScore: pd.cumulativeTraumaScore,
      partDestructionStateBefore: pd.state, partDestructionStateAfter: pd.state, localClusterKey: null, localClusterState: null,
      dominantClusterKey: pd.dominantClusterKey || null, dominantClusterState: pd.dominantClusterState || null,
      dominantClusterScore: pd.dominantClusterScore || 0, evidenceTier: pd.evidenceTier || 'minor',
      destructionTags: pd.evidenceTags ? pd.evidenceTags.slice() : [], gateReasons: (pd.gateReasons || []).slice() };
  }
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  const partDestructionStateBefore = pd.state;   // [B-STAGE 12.1] AAR 판정 기록용
  const ammoId = wound.shotgunAmmoId || wound.ammoId || ev.ammoId || '';
  const isFlechette = /flechette/.test(ammoId);
  const isBuckshot = /buck/.test(ammoId);
  const gid = ctx.pelletGroupId || wound.pelletGroupId || null;

  let contribution = computePartDestructionContribution(wound, ev, ctx);
  // 산탄 단발 보정
  if (ctx.shotgunPellet || wound.shotgunPellet) contribution *= _shotgunDestructionContributionMul(ammoId, isFlechette, isBuckshot);

  // localCluster 누적 (addressClusterKey 단위)
  const addressClusterKey = (typeof normalizeWoundAddressCluster === 'function')
    ? normalizeWoundAddressCluster(partKey, wound.normalizedMedicalAddress || wound.impactAddress || ev.impactAddress || 'generic')
    : partKey;
  if (!pd.localClusters[addressClusterKey]) pd.localClusters[addressClusterKey] = { traumaScore: 0, woundIds: [], clusterIds: [], lastHitTime: now, state: 'minor', hits: 0, highEnergyHits: 0, largeWoundCount: 0 };
  const lc = pd.localClusters[addressClusterKey];
  if (lc.hits == null) { lc.hits = (lc.woundIds || []).length; lc.highEnergyHits = 0; lc.largeWoundCount = 0; }   // 구버전 저장 호환
  if (lc.woundIds.indexOf(wound.id) < 0) lc.woundIds.push(wound.id);
  if (wound.treatmentClusterId && lc.clusterIds.indexOf(wound.treatmentClusterId) < 0) lc.clusterIds.push(wound.treatmentClusterId);

  // 산탄 group destruction soft ceiling (같은 partKey + 같은 gid)
  if (gid && (isFlechette || isBuckshot)) {
    pd._shotgunGroupContrib = pd._shotgunGroupContrib || {};
    const gkey = gid;
    const prev = pd._shotgunGroupContrib[gkey] || 0;
    const isLimb = _LIMB_PART_KEYS.indexOf(partKey) >= 0;
    let ceiling;
    if (isFlechette) ceiling = isLimb ? 0.24 : 0.32;
    else ceiling = isLimb ? 0.48 : 0.65;
    // major vessel confirmed / shattered fracture는 ceiling 완화
    const ve = wound.vascularEvidence || {}; const fe = wound.fractureEvidence || {};
    if ((ve.level === 'confirmed' && ve.vesselClass === 'major_named') || fe.fractureType === 'shattered') ceiling *= 1.4;
    const room = Math.max(0, ceiling - prev);
    contribution = Math.min(contribution, room);
    pd._shotgunGroupContrib[gkey] = prev + contribution;
  }

  lc.traumaScore = +(lc.traumaScore + contribution).toFixed(3);
  lc.lastHitTime = now;
  lc.state = _localClusterState(lc.traumaScore);
  // [B-STAGE] 반복 고에너지 타격 / 같은 cluster 대형 상처 누적 — 극단 상태 게이트 입력
  lc.hits = (lc.hits || 0) + 1;
  if (contribution >= 0.30 && !(ctx.shotgunPellet || wound.shotgunPellet)) lc.highEnergyHits = (lc.highEnergyHits || 0) + 1;
  { const _wsz = (wound.woundSize || {}).sizeClass; if (_wsz === 'large' || _wsz === 'massive') lc.largeWoundCount = (lc.largeWoundCount || 0) + 1; }

  // 누적/급성 외상 갱신
  pd.acuteTraumaScore = +contribution.toFixed(3);
  pd.cumulativeTraumaScore = +(pd.cumulativeTraumaScore + contribution).toFixed(3);
  pd.traumaScore = pd.cumulativeTraumaScore;
  if (pd.sourceWoundIds.indexOf(wound.id) < 0) pd.sourceWoundIds.push(wound.id);
  if (wound.treatmentClusterId && pd.sourceClusterIds.indexOf(wound.treatmentClusterId) < 0) pd.sourceClusterIds.push(wound.treatmentClusterId);
  if (contribution >= 0.16) pd.lastMajorHitAt = now;
  pd.lastUpdatedAt = now;

  // 상태/효과 갱신
  refreshPartDestructionState(unit, partKey, { wound, ev, ctx });
  applyPartDestructionEffects(unit, partKey);

  // wound snapshot (source-of-truth 아님)
  const snap = {
    contribution: +contribution.toFixed(3),
    partDestructionContribution: +contribution.toFixed(3),
    cumulativeTraumaScore: pd.cumulativeTraumaScore,
    partDestructionStateBefore,
    partDestructionStateAfter: pd.state,
    localClusterKey: addressClusterKey,
    localClusterState: lc.state,
    dominantClusterKey: pd.dominantClusterKey || null,
    dominantClusterState: pd.dominantClusterState || null,
    dominantClusterScore: pd.dominantClusterScore || 0,
    evidenceTier: pd.evidenceTier || 'minor',
    destructionTags: pd.evidenceTags.slice(),
    gateReasons: (pd.gateReasons || []).slice(),
  };
  return snap;
}
const PD_STATE_RANK_LIMB = { intact:0, damaged:1, impaired:2, mangled:3, destroyed:4, partial_traumatic_loss:5, traumatic_amputation:6 };
const PD_STATE_RANK_NON_LIMB = { intact:0, damaged:1, impaired:2, mangled:3, destroyed:4, catastrophic_non_limb:5 };
const PD_LIMB_ONLY_STATES = ['partial_traumatic_loss', 'traumatic_amputation'];
const PD_NON_LIMB_ONLY_STATES = ['catastrophic_non_limb'];
const PD_DISABLED_STATES = ['destroyed', 'partial_traumatic_loss', 'traumatic_amputation', 'catastrophic_non_limb'];
const PD_ALL_STATES = ['intact','damaged','impaired','mangled','destroyed','partial_traumatic_loss','traumatic_amputation','catastrophic_non_limb'];
function getPartDestructionStateRank(state, isLimb) {
  const table = isLimb ? PD_STATE_RANK_LIMB : PD_STATE_RANK_NON_LIMB;
  const r = table[state];
  return (r == null) ? 0 : r;
}
const PD_DISTAL_CLUSTER_RE   = /^(hand_wrist|foot_ankle|forearm|lower_leg)$/;
const PD_PROXIMAL_CLUSTER_RE = /^(upper_arm|thigh|groin_junctional|axilla_shoulder_gap)$/;
const PD_FX_RANK = { none:0, hairline:1, simple:2, displaced:3, comminuted:4, shattered:5 };
function _pdProjectileEvidenceClass(w) {
  const bt = w.bodyTrajectory || {};
  const proj = ((bt.projectileSizeClass || '') + '').toLowerCase();
  const ammoId = ((w.ammoId || '') + '').toLowerCase();
  if (/anti_material/.test(proj) || /^127x(99|108)/.test(ammoId) || /50bmg/.test(ammoId)) return 'anti_material';
  if (/slug/.test(proj) || /slug/.test(ammoId)) return 'slug';
  if (/large_bore/.test(proj)) return 'large_bore';
  if (w.shotgunPellet) return 'pellet';
  if ((w.sourceType || '') === 'frag') return 'fragment';
  if ((w.sourceType || '') === 'blast') return 'blast';
  return 'standard';
}
function buildPartDestructionEvidence(unit, partKey, pd) {
  const m = (unit && unit.medical) || {};
  const part = (m.bodyParts && m.bodyParts[partKey]) || {};
  const isLimb = _LIMB_PART_KEYS.indexOf(partKey) >= 0;
  const hpRatio = (part.maxHp > 0) ? Math.max(0, Math.min(1, part.hp / part.maxHp)) : 1;
  const cumulativeTraumaScore = pd.cumulativeTraumaScore || 0;
  const wounds = (m.wounds || []).filter(w => w && w.partKey === partKey && pd.sourceWoundIds.indexOf(w.id) >= 0);

  // ── dominant cluster: traumaScore 최대. 동점 → 최근 hit time → wound count → 안정 key 순 (랜덤 금지) ──
  let dominantClusterKey = null, dom = null;
  const clusterKeys = Object.keys(pd.localClusters || {}).sort();
  for (const k of clusterKeys) {
    const c = pd.localClusters[k]; if (!c) continue;
    if (!dom) { dom = c; dominantClusterKey = k; continue; }
    const a = c.traumaScore || 0, b = dom.traumaScore || 0;
    let better = false;
    if (a > b) better = true;
    else if (a === b) {
      const at = c.lastHitTime || 0, bt2 = dom.lastHitTime || 0;
      if (at > bt2) better = true;
      else if (at === bt2) {
        const aw = (c.woundIds || []).length, bw = (dom.woundIds || []).length;
        if (aw > bw) better = true;   // 이후 동점이면 이미 정렬된 key 순서가 유지된다
      }
    }
    if (better) { dom = c; dominantClusterKey = k; }
  }
  const dominantClusterScore = dom ? +(dom.traumaScore || 0).toFixed(3) : 0;
  const dominantClusterState = dom ? (dom.state || 'minor') : 'none';
  const dominantClusterWoundCount = dom ? (dom.woundIds || []).length : 0;
  const dominantClusterHits = dom ? (dom.hits || dominantClusterWoundCount) : 0;
  const dominantClusterHighEnergyHits = dom ? (dom.highEnergyHits || 0) : 0;
  const dominantClusterLargeWoundCount = dom ? (dom.largeWoundCount || 0) : 0;
  const distributedClusterCount = clusterKeys.filter(k => (pd.localClusters[k].traumaScore || 0) > 0.02).length;
  const localConcentrationRatio = cumulativeTraumaScore > 0.0001
    ? Math.max(0, Math.min(1, dominantClusterScore / cumulativeTraumaScore)) : 0;
  const dominantClusterIsDistal   = !!(dominantClusterKey && PD_DISTAL_CLUSTER_RE.test(dominantClusterKey));
  const dominantClusterIsProximal = !!(dominantClusterKey && PD_PROXIMAL_CLUSTER_RE.test(dominantClusterKey));

  // ── wound 파생 증거 (부위 전체) + dominant cluster 한정 증거 ──
  const domWoundIds = dom ? (dom.woundIds || []) : [];
  let worstFractureType = 'none', hasLargeWound = false, hasMassiveWound = false, hasLargeExit = false, hasMassiveExit = false;
  let deepTrajectoryCount = 0, throughAndThroughCount = 0, vesselAdjacent = false, vascularEvidenceLevel = 'none';
  let catastrophicProjectileEvidence = false, blastDestructionEvidence = false, largeFragmentEvidence = false;
  let domWorstFractureType = 'none', domHasLarge = false, domHasMassive = false, domCatastrophicSource = false;
  const VE_RANK = { none:0, risk_only:1, candidate:2, probable:3, confirmed:4 };
  const projectileEvidenceClasses = {};
  let severeWoundCount = 0;
  for (const w of wounds) {
    const fe = w.fractureEvidence || {}, ws = w.woundSize || {}, bt = w.bodyTrajectory || {}, ve = w.vascularEvidence || {};
    const inDom = domWoundIds.indexOf(w.id) >= 0;
    const pcls = _pdProjectileEvidenceClass(w);
    projectileEvidenceClasses[pcls] = (projectileEvidenceClasses[pcls] || 0) + 1;
    // 펠릿 단발 골절은 상태 승격 근거로 쓰지 않는다 (기존 규칙 유지)
    const fxCounts = fe.occurred && !w.shotgunPellet;
    if (fxCounts && (PD_FX_RANK[fe.fractureType] || 0) > (PD_FX_RANK[worstFractureType] || 0)) worstFractureType = fe.fractureType;
    if (fxCounts && inDom && (PD_FX_RANK[fe.fractureType] || 0) > (PD_FX_RANK[domWorstFractureType] || 0)) domWorstFractureType = fe.fractureType;
    const big = (ws.sizeClass === 'large' || ws.sizeClass === 'massive');
    const huge = (ws.sizeClass === 'massive');
    if (ws.sizeClass === 'large') hasLargeWound = true;
    if (huge) hasMassiveWound = true;
    if (ws.exitSizeClass === 'large') hasLargeExit = true;
    if (ws.exitSizeClass === 'massive') hasMassiveExit = true;
    if (inDom && big) domHasLarge = true;
    if (inDom && huge) domHasMassive = true;
    const deep = (bt.woundDepthClass === 'deep' || bt.deepTissueReached || bt.penetrationState === 'deep');
    if (deep) deepTrajectoryCount++;
    if (bt.bodyThroughAndThrough || bt.targetThroughAndThrough) throughAndThroughCount++;
    const bp = w.bleedingProfile || {};
    if ((bp.sustainedExternal || 0) >= 8 || big) severeWoundCount++;
    if ((VE_RANK[ve.level] || 0) > (VE_RANK[vascularEvidenceLevel] || 0)) vascularEvidenceLevel = ve.level || 'none';
    if (_VESSEL_NAMED_RE.test((((w.normalizedMedicalAddress && w.normalizedMedicalAddress.vascularRegion) || '') + ' ' + (w.anatomicalZone || '')))) vesselAdjacent = true;
    // ── 실제 파괴 증거만 catastrophic으로 인정 (source 문자열·탄약 이름 단독 금지) ──
    let woundCatastrophic = false;
    if (pcls === 'anti_material' && big && (deep || bt.bodyThroughAndThrough)) woundCatastrophic = true;
    else if (pcls === 'slug' && huge) woundCatastrophic = true;
    else if (pcls === 'large_bore' && huge && deep) woundCatastrophic = true;
    if (pcls === 'fragment' && big && deep) { largeFragmentEvidence = true; woundCatastrophic = true; }
    if (pcls === 'blast' && (huge || (big && (fe.fractureType === 'shattered' || fe.fractureType === 'comminuted')))) { blastDestructionEvidence = true; woundCatastrophic = true; }
    if (woundCatastrophic) { catastrophicProjectileEvidence = true; if (inDom) domCatastrophicSource = true; }
  }
  const comminutedEvidence = (PD_FX_RANK[worstFractureType] >= PD_FX_RANK.comminuted);
  const shatteredEvidence  = (worstFractureType === 'shattered');
  const domComminuted = (PD_FX_RANK[domWorstFractureType] >= PD_FX_RANK.comminuted);
  const domShattered  = (domWorstFractureType === 'shattered');

  // ── evidence tier ──
  let evidenceTier = 'minor';
  if (dominantClusterState === 'moderate' || hasLargeWound || (PD_FX_RANK[worstFractureType] >= PD_FX_RANK.displaced)) evidenceTier = 'moderate';
  if (dominantClusterState === 'severe' || comminutedEvidence || (hasLargeWound && hasLargeExit)) evidenceTier = 'severe';
  if (dominantClusterState === 'catastrophic' || shatteredEvidence || catastrophicProjectileEvidence || hasMassiveWound) evidenceTier = 'catastrophic';

  const evidenceTags = [];
  if (dominantClusterKey) evidenceTags.push('dominant:' + dominantClusterKey + ':' + dominantClusterState);
  if (comminutedEvidence) evidenceTags.push('fx_' + worstFractureType);
  if (hasMassiveWound) evidenceTags.push('massive_wound');
  else if (hasLargeWound) evidenceTags.push('large_wound');
  if (catastrophicProjectileEvidence) evidenceTags.push('catastrophic_projectile');
  if (blastDestructionEvidence) evidenceTags.push('blast_destruction');
  if (largeFragmentEvidence) evidenceTags.push('large_fragment');
  if (localConcentrationRatio >= 0.6) evidenceTags.push('concentrated'); else if (distributedClusterCount >= 2) evidenceTags.push('distributed');

  return {
    partKey, isLimb, hpRatio: +hpRatio.toFixed(3),
    woundCount: wounds.length, severeWoundCount,
    acuteTraumaScore: pd.acuteTraumaScore || 0, cumulativeTraumaScore,
    dominantClusterKey, dominantClusterScore, dominantClusterState, dominantClusterWoundCount,
    dominantClusterHits, dominantClusterHighEnergyHits, dominantClusterLargeWoundCount,
    dominantClusterIsDistal, dominantClusterIsProximal,
    distributedClusterCount, localConcentrationRatio: +localConcentrationRatio.toFixed(3),
    worstFractureType, worstFractureRank: PD_FX_RANK[worstFractureType] || 0,
    comminutedEvidence, shatteredEvidence,
    dominantWorstFractureType: domWorstFractureType, dominantComminuted: domComminuted, dominantShattered: domShattered,
    dominantHasLargeWound: domHasLarge, dominantHasMassiveWound: domHasMassive, dominantCatastrophicSource: domCatastrophicSource,
    hasLargeWound, hasMassiveWound, hasLargeExit, hasMassiveExit,
    deepTrajectoryCount, throughAndThroughCount,
    projectileEvidenceClasses, catastrophicProjectileEvidence, blastDestructionEvidence, largeFragmentEvidence,
    vesselAdjacent, vascularEvidenceLevel,
    evidenceTier, evidenceTags, gateReasons: [],
  };
}
function refreshPartDestructionState(unit, partKey, extra) {
  const pd = getPartDestruction(unit, partKey);
  if (!pd) return null;
  const m = unit.medical;
  const part = (m.bodyParts && m.bodyParts[partKey]) || {};
  const ev = buildPartDestructionEvidence(unit, partKey, pd);
  pd.evidence = ev;
  const isLimb = ev.isLimb, hpRatio = ev.hpRatio, cts = ev.cumulativeTraumaScore;
  const isTorsoVital = (partKey === 'chest' || partKey === 'abdomen');
  const isHeadNeck = (partKey === 'head' || partKey === 'neck');
  const gate = [];

  // ── 일반 상태: 누적 외상 + HP + 골절 (기존 의미 유지) ──
  let state = 'intact';
  if (!(cts < 0.10 && hpRatio > 0.85)) state = 'damaged';
  if (cts >= 0.28 || hpRatio <= 0.40 || ev.worstFractureRank >= PD_FX_RANK.displaced
      || ev.dominantClusterState === 'moderate' || ev.dominantClusterState === 'severe' || ev.dominantClusterState === 'catastrophic') {
    state = 'impaired'; gate.push('impaired:trauma_or_fracture_or_cluster');
  }

  // ── mangled: 국소 구조 증거 필수 (단발 연부조직 관통으로 진입 금지) ──
  const mangledEvidence =
       ev.dominantClusterState === 'catastrophic'
    || ev.dominantComminuted || ev.dominantShattered
    || ev.dominantClusterLargeWoundCount >= 2
    || ev.dominantClusterHighEnergyHits >= 2
    || (ev.catastrophicProjectileEvidence && (ev.hasLargeWound || ev.hasMassiveWound));
  const mangledSupport = (cts >= 0.50 || hpRatio <= 0.22);
  if (mangledEvidence && mangledSupport) { state = 'mangled'; gate.push('mangled:local_structural_evidence'); }

  // ── destroyed: 구조적 파괴 증거 필수. HP 0은 기능상실이지 자동 구조파괴가 아니다 ──
  const destroyedEvidence =
       ev.dominantClusterState === 'catastrophic'
    || (ev.shatteredEvidence && (ev.hasLargeWound || ev.hasMassiveWound))
    || ev.dominantClusterHighEnergyHits >= 3
    || (ev.catastrophicProjectileEvidence && (ev.hasMassiveWound || (ev.hasLargeWound && ev.comminutedEvidence)));
  const destroyedSupport = (cts >= 0.82 || hpRatio <= 0.05);
  if (destroyedEvidence && destroyedSupport) { state = 'destroyed'; gate.push('destroyed:structural_collapse'); }

  // HP 소진은 기능상실만 표시 (라벨 승격 금지)
  const disabledByHp = (part.hp != null && part.hp <= 0);
  if (disabledByHp && state !== 'destroyed') gate.push('hp_depleted:functional_loss_only');

  // ── 사지 전용 극단 상태 — dominant cluster 집중 + 파괴 증거 필수, 분산 총합 금지 ──
  if (isLimb) {
    const concentrated = ev.localConcentrationRatio >= 0.6;
    const strongSource = ev.dominantCatastrophicSource || ev.dominantShattered;
    if (state === 'destroyed' && concentrated && ev.dominantClusterIsDistal
        && ev.dominantClusterState === 'catastrophic' && cts >= 0.95
        && (ev.hasLargeWound || ev.hasMassiveWound || ev.shatteredEvidence || ev.catastrophicProjectileEvidence)) {
      state = 'partial_traumatic_loss'; gate.push('partial_loss:distal_catastrophic_cluster');
    }
    // [8.7] "매우 높은 local destruction" — dominant cluster의 실제 국소 파괴량이 기준.
    //   단일 직격만으로는 도달하지 않고, 같은 지점의 파괴가 실제로 누적되어야 승격한다.
    const PD_AMPUTATION_LOCAL_DESTRUCTION = 1.70;
    if (concentrated && ev.dominantClusterState === 'catastrophic'
        && ev.dominantClusterScore >= PD_AMPUTATION_LOCAL_DESTRUCTION && cts >= 1.20
        && (strongSource || (ev.shatteredEvidence && ev.hasMassiveWound))) {
      state = 'traumatic_amputation'; gate.push('amputation:catastrophic_local_destruction');
    }
  } else {
    // 비사지: limb-only 상태 사용 금지 → catastrophic_non_limb
    // [8.8] 점수 누적만으로는 부족 — massive disruption / catastrophic source / shattered / 반복 고에너지 국소 붕괴 필요
    const nonLimbStructural = ev.hasMassiveWound || ev.catastrophicProjectileEvidence || ev.shatteredEvidence
      || (ev.dominantClusterState === 'catastrophic' && ev.dominantClusterHighEnergyHits >= 2);
    if (state === 'destroyed' && (isTorsoVital || isHeadNeck) && nonLimbStructural && cts >= 0.90) {
      state = 'catastrophic_non_limb'; gate.push('catastrophic_non_limb:critical_structure');
    }
  }

  // ── 단조성: 임무 중 상태는 역행하지 않는다 (처치로 하락 금지) ──
  const prevState = pd.state || 'intact';
  if (getPartDestructionStateRank(prevState, isLimb) > getPartDestructionStateRank(state, isLimb)) {
    gate.push('monotonic:kept_' + prevState);
    state = prevState;
  }

  pd.state = state;
  pd.functionalCap = PART_DESTRUCTION_FUNCTIONAL_CAP[state] != null ? PART_DESTRUCTION_FUNCTIONAL_CAP[state] : 1.0;
  pd.destructionRisk = Math.max(0, Math.min(1, cts / 0.82));
  pd.traumaticLossRisk = isLimb ? Math.max(0, Math.min(1, (cts - 0.6) / 0.6)) : 0;
  // additive 기능상실 사유 (기존 저장구조 비파괴)
  pd.disabledByHp = disabledByHp;
  pd.disabledByDestruction = PD_DISABLED_STATES.indexOf(state) >= 0;
  pd.functionalLossReason = pd.disabledByDestruction ? 'structural_destruction' : (disabledByHp ? 'hp_depleted' : null);

  const tags = ev.evidenceTags.slice();
  if (state !== 'intact') tags.push('part_' + state);
  const bleedBonusByState = { intact:1.0, damaged:1.03, impaired:1.10, mangled:1.32, destroyed:1.50, partial_traumatic_loss:1.55, traumatic_amputation:1.65, catastrophic_non_limb:1.45 };
  pd.bleedBonusMul = bleedBonusByState[state] || 1.0;
  // 혈관 위험 보정 — confirmed 승격은 금지, proximal dominant cluster에서만 강한 보정
  let vBonus = 0;
  if (state === 'mangled' && ev.vesselAdjacent && ev.deepTrajectoryCount > 0) { vBonus = 0.10; tags.push('mangled_vessel_adjacent'); }
  if (state === 'destroyed' && ev.vesselAdjacent && ev.comminutedEvidence) { vBonus = 0.15; tags.push('part_destruction_vascular_risk'); }
  if (state === 'partial_traumatic_loss' && isLimb && ev.dominantClusterIsProximal) { vBonus = 0.15; tags.push('traumatic_loss_vessel_candidate'); }
  if (state === 'traumatic_amputation' && isLimb && ev.dominantClusterIsProximal) { vBonus = 0.20; tags.push('proximal_limb_major_vessel_probable'); }
  pd.vascularRiskBonus = vBonus;
  pd.evidenceTags = tags;
  pd.evidenceTier = ev.evidenceTier;
  pd.gateReasons = gate;
  ev.gateReasons = gate;
  pd.dominantClusterKey = ev.dominantClusterKey;
  pd.dominantClusterScore = ev.dominantClusterScore;
  pd.dominantClusterState = ev.dominantClusterState;
  pd.distributedClusterCount = ev.distributedClusterCount;
  pd.localConcentrationRatio = ev.localConcentrationRatio;
  pd.worstFractureType = ev.worstFractureType;
  // legacy _flags 유지 (기존 consumer 호환) — dominant cluster 기준으로 정정
  pd._flags = { worstFx: ev.worstFractureType, hasLarge: ev.hasLargeWound, hasMassive: ev.hasMassiveWound,
    catastrophicEvidence: ev.catastrophicProjectileEvidence, distalCluster: ev.dominantClusterIsDistal,
    proximalCluster: ev.dominantClusterIsProximal, majorVesselConfirmed: (ev.vascularEvidenceLevel === 'confirmed'),
    deepTrajectory: ev.deepTrajectoryCount > 0, vesselAdjacent: ev.vesselAdjacent, isLimb, severeWoundCount: ev.severeWoundCount };
  return pd;
}
function applyPartDestructionEffects(unit, partKey) {
  const pd = getPartDestruction(unit, partKey);
  if (!pd) return;
  const part = unit.medical.bodyParts && unit.medical.bodyParts[partKey];
  if (!part) return;
  part.destructionState = pd.state;
  part.destructionFunctionalCap = pd.functionalCap;
  part.destructionRisk = pd.destructionRisk;
  part.traumaticLossRisk = pd.traumaticLossRisk;
  // [B-STAGE 10.2] disabled 계약 — destroyed / partial_traumatic_loss / traumatic_amputation / catastrophic_non_limb
  part.destructionDisabledReason = pd.functionalLossReason || null;
  if (PD_DISABLED_STATES.indexOf(pd.state) >= 0) part.disabled = true;
  recomputeBodyPartFunctionRatio(part, pd);
}
function finalizeBleedingProfileWithEvidence(w) {
  // PHASE 3-H invariant: wound별 finalization 횟수 추적 (논리적 1회)
  if (w && w.bleedingProfile) w.bleedingProfile._finalizationCount = (w.bleedingProfile._finalizationCount || 0) + 1;
  const bp = w.bleedingProfile;
  if (!bp || bp.bleedingType === 'none') return;
  const ve = w.vascularEvidence || { level: 'none', vesselClass: 'none', majorVessel: false };
  const fe = w.fractureEvidence || { occurred: false, bleedBonusMul: 1.0, boneFragmentSeverity: 0, fractureType: 'none' };
  const ws = w.woundSize || {};
  const sizeClass = ws.sizeClass || 'small';
  const bigExit = (ws.exitSizeClass === 'large' || ws.exitSizeClass === 'massive');
  const bigCavity = (sizeClass === 'large' || sizeClass === 'massive');
  const isCavity = (bp.bleedingType === 'cavity' || bp.bleedingType === 'mixed');
  const isJunctional = (bp.bleedingType === 'junctional');

  // seed 값 (computeBleedingProfile + 이후 severity 보정 결과)를 raw potential로 사용
  // PART-DESTRUCTION-POST-WOUND-SYNC-1 §5: finalize가 두 번 호출돼도 seed 증폭 누적 방지 — 최초 seed 보존 후 항상 원본 기준 재계산.
  if (bp._prePartDestructionFinalize == null) {
    bp._prePartDestructionFinalize = { currentExternal: Math.max(0, bp.currentExternal || 0), currentInternal: Math.max(0, bp.currentInternal || 0) };
  }
  const seedExt = Math.max(0, bp._prePartDestructionFinalize.currentExternal || 0);
  const seedInt = Math.max(0, bp._prePartDestructionFinalize.currentInternal || 0);
  const fragBonus = (ws.fragmentationScore ? ws.fragmentationScore * 0.15 : 0);
  const fractureBleedMul = fe.occurred ? fe.bleedBonusMul : 1.0;

  // bleedPotential 기록 (탄종/형상 차이 보존)
  w.bleedPotential = {
    tissueBleedPotential: +(seedExt * fractureBleedMul).toFixed(2),
    vascularBleedPotential: +(seedExt * ve.evidenceStrength).toFixed(2),
    cavityBleedPotential: +(seedInt * fractureBleedMul).toFixed(2),
    entrySeverity: +(ws.entrySizeScore || 0).toFixed(2), exitSeverity: +(ws.exitSizeScore || 0).toFixed(2),
    permanentCavitySeverity: +(ws.sizeScore || 0).toFixed(2), temporaryCavitySeverity: +(ws.tempCavityScore || 0).toFixed(2),
    fragmentationSeverity: +(ws.fragmentationScore || 0).toFixed(2), crushSeverity: 0,
    boneFragmentSeverity: fe.boneFragmentSeverity,
    initialSpikeExternal: 0, initialSpikeInternal: 0, sustainedExternalRaw: 0, sustainedInternalRaw: 0,
    evidenceLimited: (ve.level === 'none' || ve.level === 'risk_only' || ve.level === 'candidate'),
    notes: [],
  };

  // === soft ceiling (sustainedExternal 상한) — vascularEvidence + geometry ===
  let softCeiling;
  if (ve.level === 'confirmed' && ve.vesselClass === 'major_named') softCeiling = 30;
  else if (ve.level === 'probable' && ve.vesselClass === 'major_named') softCeiling = 15;
  else if (ve.level === 'probable' && ve.vesselClass === 'named_branch') softCeiling = 11.5;
  else if (ve.level === 'probable') softCeiling = 9;                        // small_branch probable
  else if (ve.level === 'candidate') softCeiling = (bigExit || bigCavity) ? 8.5 : 7;
  else if (ve.level === 'risk_only') softCeiling = 6.5;
  else softCeiling = 4.5;                                                    // soft tissue / muscle only
  // 골절 comminuted/shattered는 ceiling 소폭 상향
  if (fe.occurred && (fe.fractureType === 'comminuted' || fe.fractureType === 'shattered')) softCeiling += 1.5;

  const evidenceLeakFactor = ({ none: 0.10, risk_only: 0.12, candidate: 0.20, probable: 0.50, confirmed: 1.0 })[ve.level] != null
    ? ({ none: 0.10, risk_only: 0.12, candidate: 0.20, probable: 0.50, confirmed: 1.0 })[ve.level] : 0.10;

  // rawExternal = tissue + vascular + fracture + frag
  const rawExternal = (seedExt * fractureBleedMul) + (seedExt * ve.evidenceStrength * 0.6) + fragBonus;
  let sustainedExternal = rawExternal;
  if (rawExternal > softCeiling) sustainedExternal = softCeiling + (rawExternal - softCeiling) * evidenceLeakFactor;
  // cavity/junctional 흐름 특성 유지
  if (isCavity) sustainedExternal = Math.min(sustainedExternal, bp.currentExternal * 1.1 || sustainedExternal);

  // initial spike — geometry 주도(seed 자체). 증폭하지 않음: peak는 seed, sustained만 evidence로 낮춤.
  let initialExternal = Math.max(sustainedExternal, rawExternal);

  // internal (cavity)
  const rawInternal = seedInt * fractureBleedMul;
  let sustainedInternal = rawInternal;
  let internalCeiling;
  if (ve.level === 'confirmed') internalCeiling = 30;
  else if (ve.level === 'probable') internalCeiling = 16;
  else if (ve.level === 'candidate') internalCeiling = 10;
  else internalCeiling = isCavity ? 8 : 5;
  if (rawInternal > internalCeiling) sustainedInternal = internalCeiling + (rawInternal - internalCeiling) * evidenceLeakFactor;
  let initialInternal = Math.max(sustainedInternal, rawInternal);

  // majorVesselLocked — confirmed major, 또는 확정 major organ (physiologic)
  const physioMajor = (w.physiologicInjuries || []).some(i => i && (i.type === 'major_vessel_injury' || (i.type === 'solid_organ_injury' && i.severity === 'critical')));
  const majorVesselLocked = !!((ve.level === 'confirmed' && ve.vesselClass === 'major_named') || physioMajor);

  // PART-DESTRUCTION-1 Phase6 §11: sustained 증폭은 major vessel lock일 때만 (아니면 vascularEvidence 기반 그대로 — 절단이 자동 대량출혈 되지 않음)
  if (majorVesselLocked) {
    const pde = w.partDestructionEvidence;
    const st = (pde && pde.partDestructionStateAfter) || null;
    if (st && st !== 'intact' && st !== 'damaged') {
      const sustBonus = { impaired:1.05, mangled:1.20, destroyed:1.30, partial_traumatic_loss:1.35, traumatic_amputation:1.5, catastrophic_non_limb:1.3 };
      sustainedExternal *= (sustBonus[st] || 1.0);
    }
  }

  // 자연 감소 target — locked면 sustained 유지, 아니면 조금 더 낮게
  const nonLockedFloorMul = isCavity ? 0.6 : (isJunctional ? 0.7 : 0.55);
  const naturalReductionTargetExternal = majorVesselLocked ? sustainedExternal : Math.max(0, sustainedExternal * nonLockedFloorMul);
  const naturalReductionTargetInternal = majorVesselLocked ? sustainedInternal
    : (isCavity && (ve.level === 'probable' || ve.level === 'confirmed')) ? sustainedInternal : Math.max(0, sustainedInternal * 0.6);

  // 자연 감소 속도 — 큰 사출구/파편/골절/junctional/cavity는 느림
  let selfReductionRate = 0.25;   // ml/s per s 근사
  if (bigExit || bigCavity) selfReductionRate *= 0.6;
  if (fe.occurred && fe.boneFragmentSeverity > 0.4) selfReductionRate *= 0.6;
  if (isJunctional) selfReductionRate *= 0.7;
  if (isCavity) selfReductionRate *= 0.5;
  if (majorVesselLocked) selfReductionRate = 0;

  // PART-DESTRUCTION-1 Phase6 §11: partDestruction bleedBonus — initial은 상태별 증폭, sustained는 major vessel evidence로 제한.
  //   traumatic_amputation이라도 sustained 자동 30ml/s 금지 (majorVesselLocked / proximal evidence 있을 때만 sustained 증폭)
  {
    const pde = w.partDestructionEvidence;
    const st = (pde && pde.partDestructionStateAfter) || null;
    if (st && st !== 'intact' && st !== 'damaged') {
      const initBonus = { impaired:1.08, mangled:1.30, destroyed:1.50, partial_traumatic_loss:1.9, traumatic_amputation:2.4, catastrophic_non_limb:1.45 };
      initialExternal *= (initBonus[st] || 1.0);
    }
  }
  bp.initialExternal = +initialExternal.toFixed(2);
  bp.initialInternal = +initialInternal.toFixed(2);
  bp.sustainedExternal = +sustainedExternal.toFixed(2);
  bp.sustainedInternal = +sustainedInternal.toFixed(2);
  bp.baseExternal = bp.initialExternal;
  bp.baseInternal = bp.initialInternal;
  bp.currentExternal = bp.initialExternal;   // 시작은 initial spike
  bp.currentInternal = bp.initialInternal;
  bp.naturalReductionTargetExternal = +naturalReductionTargetExternal.toFixed(2);
  bp.naturalReductionTargetInternal = +naturalReductionTargetInternal.toFixed(2);
  bp.selfReductionRate = +selfReductionRate.toFixed(3);
  bp.clottingFactor = majorVesselLocked ? 0.0 : (isCavity ? 0.3 : 0.6);
  bp.majorVesselLocked = majorVesselLocked;
  bp.vesselRisk = bp.vesselRisk != null ? bp.vesselRisk : 0;
  bp.softCeiling = +softCeiling.toFixed(1);
  bp.evidenceLeakFactor = evidenceLeakFactor;
  bp.bleedDynamicsTags = (bp.bleedDynamicsTags || []).concat(ve.evidenceTags || []).concat(fe.occurred ? ['fracture_bleed'] : []);
  w.bleedPotential.initialSpikeExternal = bp.initialExternal;
  w.bleedPotential.initialSpikeInternal = bp.initialInternal;
  w.bleedPotential.sustainedExternalRaw = +sustainedExternal.toFixed(2);
  w.bleedPotential.sustainedInternalRaw = +sustainedInternal.toFixed(2);
}
function normalizeShotgunPelletGroupBleeding(unit, pelletGroupId) {
  if (!unit || !unit.medical || !unit.medical.wounds || !pelletGroupId) return;
  const group = unit.medical.wounds.filter(w => w && w.pelletGroupId === pelletGroupId && w.bleedingProfile);
  if (group.length <= 1) return;
  const ammoId = group[0].shotgunAmmoId || group[0].ammoId || '';
  const isFlechette = /flechette/.test(ammoId);
  const isBuckshot = /buck/.test(ammoId);
  const RANK = { none:0, risk_only:1, candidate:2, probable:3, confirmed:4 };
  let bestLevel = 'none', confirmedMajor = false, probableMajor = false;
  for (const w of group) {
    const ve = w.vascularEvidence || {};
    if ((RANK[ve.level] || 0) > (RANK[bestLevel] || 0)) bestLevel = ve.level || bestLevel;
    if (ve.level === 'confirmed' && ve.vesselClass === 'major_named') confirmedMajor = true;
    if (ve.level === 'probable' && ve.vesselClass === 'major_named') probableMajor = true;
  }
  let sustainedCeiling, initialCeiling;
  if (isFlechette) {
    sustainedCeiling = confirmedMajor ? 30 : probableMajor ? 16 : bestLevel === 'candidate' ? 8 : 5.5;
    initialCeiling   = confirmedMajor ? 45 : probableMajor ? 26 : bestLevel === 'candidate' ? 16 : 10;
  } else if (isBuckshot) {
    sustainedCeiling = confirmedMajor ? 38 : probableMajor ? 22 : bestLevel === 'candidate' ? 14 : 10;
    initialCeiling   = confirmedMajor ? 55 : probableMajor ? 34 : bestLevel === 'candidate' ? 30 : 22;
  } else {
    return;   // buckshot/flechette 외 산탄은 governor 미적용
  }
  // idempotent: 원본값을 최초 1회만 저장, 이후 항상 원본 기준 재-scale
  for (const w of group) {
    const bp = w.bleedingProfile;
    if (!bp) continue;
    if (!bp._preShotgunGroupExternal) {
      bp._preShotgunGroupExternal = {
        sustainedExternal: bp.sustainedExternal || 0,
        initialExternal: (bp.initialExternal != null ? bp.initialExternal : (bp.currentExternal || 0)),
        currentExternal: bp.currentExternal || 0,
        naturalReductionTargetExternal: (bp.naturalReductionTargetExternal != null ? bp.naturalReductionTargetExternal : null),
      };
    }
  }
  const sumSustained = group.reduce((s, w) => s + Math.max(0, w.bleedingProfile._preShotgunGroupExternal.sustainedExternal || 0), 0);
  const sumInitial   = group.reduce((s, w) => s + Math.max(0, w.bleedingProfile._preShotgunGroupExternal.initialExternal || 0), 0);
  const sustainedScale = sumSustained > sustainedCeiling ? sustainedCeiling / Math.max(0.01, sumSustained) : 1;
  const initialScale   = sumInitial   > initialCeiling   ? initialCeiling   / Math.max(0.01, sumInitial)   : 1;
  for (const w of group) {
    const bp = w.bleedingProfile;
    if (!bp) continue;
    const orig = bp._preShotgunGroupExternal;
    // major vessel confirmed + locked wound은 완전히 죽이지 않음 (scale 하한 0.75)
    const sScale = (confirmedMajor && bp.majorVesselLocked) ? Math.max(sustainedScale, 0.75) : sustainedScale;
    const iScale = (confirmedMajor && bp.majorVesselLocked) ? Math.max(initialScale, 0.75)   : initialScale;
    bp.sustainedExternal = +(Math.max(0, orig.sustainedExternal) * sScale).toFixed(2);
    bp.initialExternal   = +(Math.max(0, orig.initialExternal)   * iScale).toFixed(2);
    bp.currentExternal   = +(Math.max(0, orig.currentExternal)   * iScale).toFixed(2);
    if (orig.naturalReductionTargetExternal != null) {
      bp.naturalReductionTargetExternal = +(orig.naturalReductionTargetExternal * sScale).toFixed(2);
    }
    bp.shotgunGroupScale = { sustainedScale:+sScale.toFixed(3), initialScale:+iScale.toFixed(3),
      groupSustainedCeiling:sustainedCeiling, groupInitialCeiling:initialCeiling };
  }
}
function normalizeShotgunPelletGroupPhysiology(unit, pelletGroupId) {
  if (!unit || !unit.medical || !unit.medical.wounds || !pelletGroupId) return;
  const m = unit.medical;
  const group = unit.medical.wounds.filter(w => w && w.pelletGroupId === pelletGroupId && w.immediatePhysiology);
  if (group.length <= 1) return;
  const ammoId = group[0].shotgunAmmoId || group[0].ammoId || '';
  const isFlechette = /flechette/.test(ammoId);
  const isBuckshot = /buck/.test(ammoId);
  if (!isFlechette && !isBuckshot) return;
  m._shotgunPhysiologyGroups = m._shotgunPhysiologyGroups || {};
  const prev = m._shotgunPhysiologyGroups[pelletGroupId];

  let torsoHits = 0, limbHits = 0, headNeckHits = 0;
  let maxVascularLevel = 'none', majorConfirmed = false, thoracicCritical = false, cnsCritical = false;
  const RANK = { none:0, risk_only:1, candidate:2, probable:3, confirmed:4 };
  for (const w of group) {
    const part = (w.partKey || (w.immediatePhysiology && w.immediatePhysiology.partKey) || '').toLowerCase();
    if (/chest|abdomen/.test(part)) torsoHits++;
    else if (/head|neck/.test(part)) headNeckHits++;
    else limbHits++;
    const ve = w.vascularEvidence || {};
    if ((RANK[ve.level] || 0) > (RANK[maxVascularLevel] || 0)) maxVascularLevel = ve.level || maxVascularLevel;
    if (ve.level === 'confirmed' && ve.vesselClass === 'major_named') majorConfirmed = true;
    const cim = w.confirmedInjuryModel || {};
    const confirmed = (cim.confirmed || []).concat(cim.physiologic || []);
    if (confirmed.some(x => /heart|thoracic_catastrophic/.test(String(x)))) thoracicCritical = true;
    if (confirmed.some(x => /brain|spinal|cranial|cns/.test(String(x)))) cnsCritical = true;
  }
  let shockCeiling, painCeiling;
  if (isFlechette) {
    if (cnsCritical || thoracicCritical || majorConfirmed) shockCeiling = 75;
    else if (torsoHits >= 6) shockCeiling = 38;
    else shockCeiling = 22;
    painCeiling = torsoHits >= 6 ? 45 : 30;
  } else {   // buckshot
    if (cnsCritical || thoracicCritical || majorConfirmed) shockCeiling = 95;
    else if (torsoHits >= 5) shockCeiling = 75;
    else if (torsoHits >= 2) shockCeiling = 55;
    else shockCeiling = 38;
    painCeiling = torsoHits >= 5 ? 80 : 55;
  }
  // [IMPACT-A Phase2] 산탄 cluster governor — acute load(stopping)와 pain만 상한한다.
  //   physiological shock(m.shock)는 직접 더하거나 빼지 않는다 — 다수 pellet이 급성 stopping/pain을 무한 누적하지 않도록만 제한.
  const sumAcuteLoad = group.reduce((s, w) => s + Math.max(0, (w.immediatePhysiology && w.immediatePhysiology.acuteResponseLoad) || 0), 0);
  const sumPain  = group.reduce((s, w) => s + Math.max(0, (w.immediatePhysiology && w.immediatePhysiology.painAdd) || 0), 0);
  // pain delta 기반 idempotency (volley 끝 호출로 정확히 수렴). m.shock는 건드리지 않음.
  const preCallPain = m.pain;
  const targetPainReduce  = Math.max(0, sumPain - painCeiling);
  const alreadyPain  = (prev && prev.painReduced) || 0;
  const dPain  = targetPainReduce - alreadyPain;
  if (dPain > 0)  m.pain = Math.max(Math.min(painCeiling, preCallPain), m.pain - dPain);
  // acute load 상한 (stopping governor용 — combatState/stagger 소비)
  const acuteLoadCeiling = shockCeiling;   // 동일 부위가중 상한 재사용 (acute 부하 기준)
  m._acuteResponseLoad = Math.min(m._acuteResponseLoad || 0, acuteLoadCeiling);
  m._shotgunPhysiologyGroups[pelletGroupId] = {
    applied:true, ammoId, pelletHits:group.length, torsoHits, limbHits, headNeckHits,
    sumAcuteLoad:+sumAcuteLoad.toFixed(2), sumPain:+sumPain.toFixed(2), acuteLoadCeiling, painCeiling,
    shockReduced:0, painReduced:+targetPainReduce.toFixed(2),   // shockReduced=0 (physiological shock 미조작)
  };
  if (typeof recalcMedicalSummary === 'function') recalcMedicalSummary(unit);
  if (typeof syncLegacyCombatState === 'function') syncLegacyCombatState(unit);
}
function buildWoundDescriptor(unit, ev) {
  const ammo = (ev.ammoId && typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[ev.ammoId] : null;
  const penState = deriveWoundPenetrationState(ev);
  const woundType = classifyWoundType(ev, penState);
  // 경미한 둔상/찰과는 의미있는 경우만 기록 (abrasion + 매우 약함 → debug hint only)
  const stopped = (ev.armorResult === 'stopped' || ev.armorResult === 'absorbed');
  const blunt = ev.bluntTrauma || 0;
  if (stopped && woundType === 'abrasion' && blunt < 2) return null;        // 무의미 — debug hint only
  const woundSize = computeWoundSize(ammo, ev, penState);
  let bleeding = computeBleedingProfile(ammo, ev, woundType, woundSize, penState);
  // §17 안전장치 — 출혈 조건 미충족이면 외출혈 wound 금지
  if (!_woundShouldBleed(ev, penState)) {
    bleeding = { bleedingType:'none', baseExternal:0, baseInternal:0, currentExternal:0, currentInternal:0, rebleedRisk:0, tourniquetEligible:false, vesselRisk:0 };
  }
  const fieldCare = computeFieldCare(ev, woundType, woundSize, bleeding);
  const treatmentProfile = computeTreatmentProfile(ev, woundType, bleeding, fieldCare);
  const ia = ev.impactAddress || {};
  const w = {
    id: 'w' + (_WOUND_ID_SEQ++),
    createdAt: (typeof GAME !== 'undefined' && GAME.gameTime) || 0,
    bodyPart: ev.partKey, partKey: ev.partKey,
    location: ev.hitZone || null, anatomicalZone: ev.anatomicalZone || (ia.anatomicalZone) || null,
    impactAddress: ia,
    sourceType: ev.sourceType, ammoId: ev.ammoId || null, weaponId: ev.weaponId || null,
    armorResult: ev.armorResult, protectionLayer: ia.protectionLayer || ia.armorLayer || null,
    // SIDE-ARMOR-2C §5: coverage 추적 (AAR/wound detail)
    impactAddressFull: ia.fullAddress || null,
    coverageSource: ev.coverageSource || (ev.armorHitResult && ev.armorHitResult.coverageSource) || null,
    selectedLayerType: ev.selectedLayerType || (ev.armorHitResult && ev.armorHitResult.selectedLayerType) || null,
    durabilityOwnerId: ev.durabilityOwnerId || (ev.armorHitResult && ev.armorHitResult.durabilityOwnerId) || null,
    woundType, penetrationState: penState,
    woundMechanism: ev.sourceType, woundChannel: woundSize.channelScale,
    // SHOTGUN-MED-NORM-1 §13: 산탄 pellet 그룹 메타 (aggregate governor용)
    shotgunPellet: !!ev.shotgunPellet, pelletGroupId: ev.pelletGroupId || null, pelletIndex: ev.pelletIndex,
    pelletCount: ev.pelletCount, shotgunAmmoId: ev.shotgunAmmoId || ev.ammoId || null, shotgunPatternType: ev.shotgunPatternType || null,
    immediatePhysiology: ev._immediatePhysiology || null,
    severity: woundSize.sizeScore,
    woundSize, fieldCare: { fieldCareClass: fieldCare },
    bleedingProfile: bleeding,
    tissueProfile: { tissueDamageMul: woundSize.tissueDamageMul, vesselRisk: bleeding.vesselRisk, boneRisk: ev._fracture ? 1 : 0, organCandidates: ev.organCandidates || [] },
    painProfile: { painMul: woundSize.painMul },
    treatmentProfile,
    treatmentState: { bandaged:false, pressureBandaged:false, hemostaticApplied:false, packed:false, stabilized:false, treatmentQuality:0, lastTreatedAt:null, treatedBy:null,
      pressureBandageAppliedAt:null, pressureBandageInitialMul:null, pressureBandageTargetMul:null, pressureBandageStabilization:0 },
  };
  // SIDE-MED-2B-1A: bodyTrajectory scaffold 연결 (요약 + 출혈분류 + 후보 hint, 기존 수치 불변)
  try {
    const bt = buildBodyTrajectoryContext(unit, ev, penState);
    w.bodyTrajectory = bt;
    w.bleedingClass = bt.bleedingClass;
    w.bodyTrajectoryLabel = bodyTrajectorySummaryLabel(bt);
    w.organCandidateHints = bt.organCandidateHints;
    w.vesselCandidateHints = bt.vesselCandidateHints;
    w.majorVesselCandidate = bt.majorVesselCandidate;
    // SIDE-MED-2B-1A: 정밀 후보 지도 + 처치 적응증 태그 (candidate 단계 — UI/AAR/다음 처치 패치가 읽음)
    w.candidateMap = bt.candidateMap || [];
    w.treatmentIndicationTags = bt.treatmentIndicationTags || [];
    // SIDE-MEDICAL-TRAUMA-BRIDGE-1 §9: 결정형 의료주소 표준 필드 저장 (기존 필드 유지, 추가만)
    const _med = bt.normalizedMedicalAddress || (ia && ia.medical) || null;
    if (_med) {
      w.normalizedMedicalAddress = _med;
      w.medicalZone = _med.medicalZone; w.vascularRegion = _med.vascularRegion; w.organRegion = _med.organRegion;
      w.cavityRegion = _med.cavityRegion; w.junctionalRegion = _med.junctionalRegion; w.headFaceRegion = _med.headFaceRegion;
      w.airwayRisk = _med.airwayRisk; w.neuroRisk = _med.neuroRisk;
    }
    const _tags = w.treatmentIndicationTags || [];
    w.evacuationPriorityCandidate = _tags.indexOf('evacuationPriority') >= 0 || _tags.indexOf('evacuationPriorityCandidate') >= 0;
    w.surgeryRequiredCandidate = _tags.indexOf('surgeryRequiredCandidate') >= 0;
    w.transfusionRequiredCandidate = _tags.indexOf('transfusionRequiredCandidate') >= 0;
    // HOTFIX-2 §3: 사출구 크기 (의료 UI 입구/내부/사출구 표시용)
    w.exitWoundPresent = bt.exitWoundPresent;
    w.exitSizeClass = bt.exitSizeClass;
    w.exitWoundLabel = bt.exitWoundLabel;
    if (w.woundSize) { w.woundSize.exitSizeClass = bt.exitSizeClass; w.woundSize.exitSizeScore = bt.exitSizeScore; w.woundSize.exitWoundPresent = bt.exitWoundPresent; }
    // SIDE-MED-BALLISTIC-2C-1 §15: entry/rear 메타 + 요약 연결 (다음 의료 패치가 읽음)
    w.entryArmorContext = bt.entryArmorContext || null;
    w.rearArmorInteraction = bt.rearArmorInteraction || null;
    w.entryArmorSummary = entryArmorSummaryLabel(bt);
    w.rearArmorSummary = rearArmorSummaryLabel(bt);
    w.continuationSummary = continuationSummaryLabel(bt);
  } catch (e) { w.bodyTrajectory = null; }
  // SIDE-MED-2B-1B §3/§6: Internal Bleeding Severity Model 생성 + severity 기반 보수 보정 (clamp 필수, source-of-truth 유지)
  try {
    const bt = w.bodyTrajectory;
    if (bt && w.bleedingProfile && bt.internalScores) {
      const ibm = buildInternalBleedingModel(bt, bt.bleedingClass, bt.hitPart || w.partKey);
      w.internalBleedingModel = ibm;
      // §7: severity 기반 처치 적응증 태그 보강 (기존 태그에 추가만)
      const tagSet = new Set(w.treatmentIndicationTags || []);
      if (ibm.surgeryRequiredCandidate) tagSet.add('surgeryRequiredCandidate');
      if (ibm.evacuationPriority === 'high' || ibm.evacuationPriority === 'urgent') tagSet.add('evacuationPriority');
      if (ibm.fieldCareLimit === 'limited') tagSet.add('fieldCareLimited');
      if (ibm.fieldCareLimit === 'unmanageable') tagSet.add('fieldCareUnmanageable');
      w.treatmentIndicationTags = Array.from(tagSet);

      // §6 bleedingProfile 보수 보정 — severity별 internal multiplier (clamp). 기존 bleedingSeverityScore mul도 유지.
      const bp = w.bleedingProfile;
      const sev = bt.internalScores.bleedingSeverityScore;     // 0.1~1.2
      const baseMul = Math.max(0.7, Math.min(1.4, 0.7 + sev * 0.6));
      // severity → internal 보정 배율 (low≈1, moderate 1.05~1.15, severe 1.15~1.30, critical 1.35~1.45)
      const sevIntMul = ({ none: 1.0, low: 1.0, moderate: 1.12, severe: 1.25, critical: 1.4 })[ibm.severity] || 1.0;
      if (bp.bleedingType !== 'none') {
        if (bp.currentExternal != null) bp.currentExternal = +(bp.currentExternal * baseMul).toFixed(2);
        if (bp.baseExternal != null) bp.baseExternal = +(bp.baseExternal * baseMul).toFixed(2);
        // 내부출혈은 cavity/major_vessel_candidate sourceType일 때만 severity 가중 (사지/표층 제외). 반드시 clamp.
        if ((ibm.sourceType === 'cavity' || ibm.sourceType === 'major_vessel_candidate') && bp.currentInternal != null) {
          bp.currentInternal = +Math.min(bp.currentInternal * 1.6, bp.currentInternal * sevIntMul).toFixed(2);
          if (bp.baseInternal != null) bp.baseInternal = +Math.min(bp.baseInternal * 1.6, bp.baseInternal * sevIntMul).toFixed(2);
        }
        // junctional은 external 소폭 가중 (접근 가능한 출혈)
        else if (ibm.sourceType === 'junctional' && bp.currentExternal != null) {
          bp.currentExternal = +(bp.currentExternal * Math.min(1.2, sevIntMul)).toFixed(2);
        }
      }
    }
  } catch (e) {}
  // SIDE-MED-2C: 추가 외상 모델 생성 (null-safe). 모두 candidate/risk 단계 — confirmed 남발 금지.
  try {
    const bt = w.bodyTrajectory;
    if (bt) {
      const ibm = w.internalBleedingModel || null;
      const hp = bt.hitPart || w.partKey;
      w.openTorsoModel = buildOpenTorsoModel(bt, ibm, hp, w.woundSize);
      w.organInjuryModel = buildOrganInjuryModel(bt, ibm, hp);
      w.hemorrhageControlModel = buildHemorrhageControlModel(bt, ibm, w.bleedingProfile, hp, w.woundSize);
      // §16/§14 태그 보강: open chest/abd → chestSeal/abdominalDressing candidate
      const tagSet = new Set(w.treatmentIndicationTags || []);
      if (w.openTorsoModel && w.openTorsoModel.abdominalDressingCandidate) tagSet.add('abdominalDressingCandidate');
      if (w.organInjuryModel && w.organInjuryModel.surgeryRequiredCandidate) tagSet.add('surgeryRequiredCandidate');
      w.treatmentIndicationTags = Array.from(tagSet);
    }
  } catch (e) {}
  // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1: confirmed_physiologic 레이어 (1회 계산, tick은 읽기 전용)
  try {
    const bt = w.bodyTrajectory;
    const pim = buildPhysiologicInjuryModel(w, bt, unit);
    w.physiologicInjuryModel = pim;
    w.physiologicInjuries = pim.physiologicInjuries;
    w.physiologicSeverity = pim.physiologicSeverity;
    w.physiologicTags = pim.physiologicTags;
    w.physiologicEffectProfile = pim.physiologicEffectProfile;
    if (pim.physiologicTags && pim.physiologicTags.length) {
      const tagSet = new Set(w.treatmentIndicationTags || []);
      for (const t of pim.physiologicTags) tagSet.add(t);
      if (pim.physiologicInjuries.some(i => i.type === 'major_vessel_injury' || i.type === 'solid_organ_injury')) tagSet.add('surgeryRequiredCandidate');
      w.treatmentIndicationTags = Array.from(tagSet);
    }
  } catch (e) { w.physiologicInjuries = []; w.physiologicEffectProfile = null; }
  // === SIDE-MEDICAL-ORGAN-BLEEDING-1 §1-§8: 확정/강한의심 손상 모델 + 내부출혈 분류 + 처치태그 + 저장 ===
  try {
    const bt = w.bodyTrajectory;
    const med = w.normalizedMedicalAddress || (w.impactAddress && w.impactAddress.medical) || null;
    const cim = buildConfirmedInjuryModel(w, bt, w.candidateMap, med);
    w.confirmedInjuryModel = cim;
    w.confirmedInjuries = cim.confirmed;
    w.probableInjuries = cim.probable;
    w.candidateInjuries = cim.candidates;
    // §6 내부출혈 분류
    const ibc = classifyInternalBleedingCategory(cim, med, bt, w.internalBleedingModel, w.bleedingClass);
    w.internalBleedingCategory = ibc.category;
    w.fieldControllability = ibc.fieldControllability;
    if (w.internalBleedingModel) { w.internalBleedingModel.category = ibc.category; w.internalBleedingModel.fieldControllability = ibc.fieldControllability; w.internalBleedingModel.categoryNote = ibc.note; }
    // §7 treatmentIndicationTags 보강 (표시/후송 판단용 — 실제 회복 로직 없음)
    const tagSet = new Set(w.treatmentIndicationTags || []);
    if (cim.confirmed.length) tagSet.add('confirmedInjury');
    if (cim.probable.some(i => /organ|lung|kidney|solid_organ|hollow_viscus|heart/.test(i))) tagSet.add('probableOrganInjury');
    if (cim.probable.concat(cim.confirmed).some(i => /vessel|subclavian|axillary|femoral|iliac|thoracic_vessel|abdominal_internal/.test(i))) tagSet.add('probableMajorVesselInjury');
    if (ibc.category === 'thoracic_internal') tagSet.add('thoracicInternalBleed');
    if (ibc.category === 'abdominal_internal') tagSet.add('abdominalInternalBleed');
    if (ibc.category === 'retroperitoneal_internal') tagSet.add('retroperitonealBleed');
    if (ibc.category === 'pelvic_internal') tagSet.add('pelvicInternalBleed');
    if (ibc.category === 'junctional_limited_control') tagSet.add('junctionalHemorrhage');
    if (ibc.category === 'airway_compromise' || cim.probable.indexOf('airway_compromise_probable') >= 0) tagSet.add('airwayCompromise');
    if (ibc.category === 'cranial_neuro' || cim.probable.some(i => /tbi|skull/.test(i))) tagSet.add('neuroTraumaCandidate');
    // 후송/수술/수혈/혈관통제 표식 (표시 전용)
    if (cim.confirmed.length || cim.severity === 'severe' || cim.severity === 'critical' || /internal|junctional|neuro|airway/.test(ibc.category)) tagSet.add('definitiveCareRequired');
    if (cim.confirmed.some(i => /heart/.test(i)) || cim.probable.some(i => /organ|vessel|solid_organ|hollow_viscus|abdominal_internal/.test(i))) tagSet.add('surgeryRequiredCandidate');
    if (cim.severity === 'severe' || cim.severity === 'critical' || /internal/.test(ibc.category) || tagSet.has('probableMajorVesselInjury')) tagSet.add('transfusionRequiredCandidate');
    if (tagSet.has('probableMajorVesselInjury') || /junctional|pelvic|thoracic|abdominal|retroperitoneal/.test(ibc.category)) tagSet.add('vascularControlRequiredCandidate');
    w.treatmentIndicationTags = Array.from(tagSet);
    // §8 저장 필드 (표시 전용 — 실제 회복 로직 없음)
    w.definitiveCareReasonTags = cim.reasonTags;
    w.surgeryRequiredCandidate = tagSet.has('surgeryRequiredCandidate');
    w.transfusionRequiredCandidate = tagSet.has('transfusionRequiredCandidate');
    w.vascularControlRequiredCandidate = tagSet.has('vascularControlRequiredCandidate');
  } catch (e) { w.confirmedInjuryModel = null; w.confirmedInjuries = []; w.probableInjuries = []; }
  // SIDE-HIT-ADDRESS-DAMAGE-ATTENUATION-1: 감쇠 프로파일 기록 (UI/AAR/debug용 — 원본 추적 보존)
  w.damageAttenuationProfile = ev.hitAddressDamageProfile || (ia.hitAddressDamageProfile) || null;
  w.originalRawDamage = (ev.originalRawDamage != null) ? ev.originalRawDamage : (ev.rawDamage != null ? ev.rawDamage : null);
  w.effectiveRawDamage = (ev.effectiveRawDamage != null) ? ev.effectiveRawDamage : (ev.rawDamage != null ? ev.rawDamage : null);
  if (w.woundSize && w.damageAttenuationProfile) w.woundSize.damageAttenuationMul = w.damageAttenuationProfile.woundMul;
  // SIDE-FRAGMENT-MASS-ENERGY-BRIDGE-1: 파편 에너지/질량 메타 보존 (AAR/의료 UI/debug)
  if (ev.fragmentEnergyMeta || ev.fragmentEnergyJ != null) {
    const fm = ev.fragmentEnergyMeta || {};
    w.fragmentEnergyMeta = ev.fragmentEnergyMeta || null;
    w.fragmentMassG = (ev.fragmentMassG != null) ? ev.fragmentMassG : (fm.fragmentMassG != null ? fm.fragmentMassG : null);
    w.fragmentVelocityMps = (ev.fragmentVelocityMps != null) ? ev.fragmentVelocityMps : (fm.fragmentVelocityMps != null ? fm.fragmentVelocityMps : null);
    w.fragmentEnergyJ = (ev.fragmentEnergyJ != null) ? ev.fragmentEnergyJ : (fm.fragmentEnergyJ != null ? fm.fragmentEnergyJ : null);
    w.fragmentEnergyClass = (ev.fragmentEnergyClass != null) ? ev.fragmentEnergyClass : (fm.fragmentEnergyClass != null ? fm.fragmentEnergyClass : null);
    w.fragmentSource = fm.fragmentSource || ev.fragmentSource || null;
    w.fragmentContext = fm.fragmentContext || ev.fragmentContext || null;
    w.fragmentTier = fm.fragmentTier || null;
    w.spallClass = ev.spallClass || fm.spallClass || null;
    w.parentAmmoId = fm.parentAmmoId || ev.ammoId || null;
    w.sourceMassBudgetG = fm.sourceMassBudgetG != null ? fm.sourceMassBudgetG : null;
    w.sourceGeneratedMassTotalG = fm.sourceGeneratedMassTotalG != null ? fm.sourceGeneratedMassTotalG : null;
    w.energyBasedDamage = fm.energyBasedDamage != null ? fm.energyBasedDamage : null;
    w.energyBasedPenetration = fm.energyBasedPenetration != null ? fm.energyBasedPenetration : null;
    w.equivalentDamage = fm.equivalentDamage != null ? fm.equivalentDamage : null;
    w.equivalentPenetration = fm.equivalentPenetration != null ? fm.equivalentPenetration : null;
    w.fragmentEnergyDamageBridge = !!fm.fragmentEnergyDamageBridge;
    // SIDE-FRAGMENT-CLUSTER-TRAIT-MATERIAL-SPALL-1: 파편 성격 계수 + 스폴 재질 보존
    w.fragmentShapeFactor = (fm.fragmentShapeFactor != null) ? fm.fragmentShapeFactor : (ev.fragmentShapeFactor != null ? ev.fragmentShapeFactor : null);
    w.fragmentStabilityFactor = (fm.fragmentStabilityFactor != null) ? fm.fragmentStabilityFactor : (ev.fragmentStabilityFactor != null ? ev.fragmentStabilityFactor : null);
    w.fragmentSharpness = (fm.fragmentSharpness != null) ? fm.fragmentSharpness : (ev.fragmentSharpness != null ? ev.fragmentSharpness : null);
    w.fragmentDragFactor = (fm.fragmentDragFactor != null) ? fm.fragmentDragFactor : (ev.fragmentDragFactor != null ? ev.fragmentDragFactor : null);
    w.fragmentTumblingChance = (fm.fragmentTumblingChance != null) ? fm.fragmentTumblingChance : (ev.fragmentTumblingChance != null ? ev.fragmentTumblingChance : null);
    w.spallMaterialType = fm.spallMaterialType || ev.spallMaterialType || null;
  }
  // === ORGANIC-BLEED-1 Phase 1/2: vascularEvidence + fractureEvidence + bleedingProfile finalize ===
  //   (모든 후보/probable/confirmed/trajectory/medicalAddress 계산 이후 — evidence gate 적용)
  try {
    const _med = w.normalizedMedicalAddress || (w.impactAddress && w.impactAddress.medical) || null;
    w.fractureEvidence = buildFractureEvidence(unit, ev, w.woundSize, w.bodyTrajectory, _med);
    // 골절 → wound + bodyParts fracture 반영 (기존 UI/기능저하 호환)
    if (w.fractureEvidence.occurred) {
      w._fracture = true;
      if (w.tissueProfile) w.tissueProfile.boneRisk = 1;
      // PHASE 3-B: draft는 unit 상태를 변경하지 않는다 — bodyPart 골절 반영은 commit 후 D단계(applyFractureEvidenceToBodyPart).
      // 부위별 특수 (rib→흉부 내부/hemothorax, jaw→airway, pelvic→pelvic, skull→tbi) — 태그/후보만, confirmed 아님
      const _fz = w.fractureEvidence.boneZone;
      const tagSet = new Set(w.treatmentIndicationTags || []);
      if (_fz === 'rib') tagSet.add('thoracicInternalRiskCandidate');
      if (_fz === 'jaw') { w.airwayRisk = (w.airwayRisk === true) ? true : (w.airwayRisk || 'possible'); }
      if (_fz === 'pelvis') tagSet.add('pelvicInternalRiskCandidate');
      if (_fz === 'skull') tagSet.add('neuroTraumaCandidate');
      w.treatmentIndicationTags = Array.from(tagSet);
    }
    // 골절 vascularRiskBonus → bleedingProfile.vesselRisk 소폭 상승 (candidate 승격 근거)
    if (w.fractureEvidence.occurred && w.bleedingProfile && w.fractureEvidence.vascularRiskBonus > 0) {
      w.bleedingProfile.vesselRisk = Math.min(1, (w.bleedingProfile.vesselRisk || 0) + w.fractureEvidence.vascularRiskBonus);
    }
    // PART-DESTRUCTION-POST-WOUND-SYNC-1 §1: buildWoundDescriptor에서는 partDestruction 최종 갱신하지 않고 seed만 저장.
    //   (wound가 unit.medical.wounds에 push되기 전이라 large/massive/shattered/cluster가 판정에 안 잡힘 → recordWoundFromDamageEvent에서 최종 갱신)
    w._pendingPartDestructionCtx = {
      bodyDmg: (ev._immediatePhysiology && Number.isFinite(ev._immediatePhysiology.bodyDmg)) ? ev._immediatePhysiology.bodyDmg : 0,
      partKey: w.partKey, pelletGroupId: w.pelletGroupId || null, shotgunPellet: !!w.shotgunPellet,
      sourceType: w.sourceType, armorResult: w.armorResult,
    };
    // vascularEvidence — 골절 반영된 vesselRisk 이후 계산 (partDestruction 보강은 recordWound 이후)
    w.vascularEvidence = buildVascularEvidence(w);
    // §8 승격: fracture(comminuted/shattered) + vessel-adjacent + deep → candidate→probable
    const fe = w.fractureEvidence;
    if (fe.occurred && (fe.fractureType === 'comminuted' || fe.fractureType === 'shattered')) {
      const ve = w.vascularEvidence;
      const deep = !!(w.bodyTrajectory && (w.bodyTrajectory.penetrationState === 'through_and_through' || w.bodyTrajectory.penetrationState === 'deep'));
      const vesselAdjacent = _VESSEL_NAMED_RE.test(((w.normalizedMedicalAddress && w.normalizedMedicalAddress.vascularRegion) || '') + ' ' + (w.anatomicalZone || ''));
      if (ve.level === 'candidate' && vesselAdjacent && deep) {
        ve.level = 'probable'; ve.evidenceStrength = Math.max(ve.evidenceStrength, 0.55);
        ve.source = 'fracture_adjacent'; ve.evidenceTags.push('fracture_vessel_promoted');
        // ORGANIC-BLEED-CLEANUP-1 §4: 승격 시 배열/vesselClass 보강 (confirmed로는 올리지 않음)
        if (ve.vesselClass === 'none' || ve.vesselClass === 'capillary_muscle') ve.vesselClass = 'small_branch';
        else if (ve.vesselClass === 'small_branch') ve.vesselClass = 'named_branch';
        if (!ve.probableVessels) ve.probableVessels = [];
        if (!ve.probableVessels.some(v => /vessel/.test(v))) ve.probableVessels.push('vessel_injury_probable');
        if (w.probableInjuries && !w.probableInjuries.some(i => /vessel/.test(i))) w.probableInjuries.push('vessel_injury_probable');
      }
    }
    // PHASE 3-B: bleeding finalize/fieldCare/treatmentProfile/tissue 동기화는 commit 후 H/I단계에서 1회 수행 (이중 finalize 제거).
  } catch (e) {
    _woundPipelineError('B_draft', { eventId: ev && ev.eventId, unitId: unit && unit.id, woundId: w && w.id, partKey: w && w.partKey }, e);
    if (!w.vascularEvidence) w.vascularEvidence = { level: 'none', vesselClass: 'none', riskPercent: 0, majorVessel: false };
    if (!w.fractureEvidence) w.fractureEvidence = { occurred: false };
  }
  w.uiLabels = buildWoundUiLabels(w);
  return w;
}
function normalizeWoundAddressCluster(partKey, addr) {
  const pk = (partKey || '').toLowerCase();
  const a = (typeof addr === 'string' ? addr : (addr && (addr.fullAddress || addr.vascularRegion || addr.medicalZone || addr.anatomicalZone || addr.zone)) || '').toLowerCase();
  const s = pk + ' ' + a;
  if (/groin|inguinal|junction/.test(s)) return 'groin_junctional';
  if (/axilla|armpit|shoulder_root|shoulderroot|supraclavic/.test(s)) return 'axilla_shoulder_gap';
  if (/neck|throat|cervical/.test(s)) return 'neck';
  if (/skull|cranial|crown|occipital|temporal|forehead/.test(s)) return 'head_cranial';
  if (/head|face|jaw|mouth|nose|cheek/.test(s)) return 'head_face';
  if (/sternum|xiphoid/.test(s)) return 'sternum_center';
  if (/chest|thorax|rib/.test(s)) { if (/left/.test(s)) return 'chest_left'; if (/right/.test(s)) return 'chest_right'; return 'chest_center'; }
  if (/abdomen|belly|stomach|flank/.test(s)) return /upper|epigast/.test(s) ? 'abdomen_upper' : 'abdomen_lower';
  if (/forearm|radius|ulna/.test(s)) return 'forearm';
  if (/hand|wrist/.test(s)) return 'hand_wrist';
  if (/upper_arm|humerus|arm/.test(s) && /arm/.test(pk)) return 'upper_arm';
  if (/thigh|femur/.test(s)) return 'thigh';
  if (/shin|tibia|fibula|lower_leg|calf/.test(s)) return 'lower_leg';
  if (/foot|ankle/.test(s)) return 'foot_ankle';
  // fallback — partKey 기반 generic
  return pk || 'generic';
}
function getWoundClusterKey(unit, wound, ev) {
  const partKey = wound.partKey || ev.hitPart || 'unknown';
  const addr = wound.normalizedMedicalAddress || wound.impactAddress || ev.impactAddress || 'generic';
  const addressClusterKey = normalizeWoundAddressCluster(partKey, addr);
  const uid = (unit && unit.id) || 'unit';
  const gid = wound.pelletGroupId || ev.pelletGroupId;
  // 산탄: 같은 volley + 같은 partKey면 하나의 cluster (미세주소 노이즈로 갈라지지 않게 — 전완 다중천공 = cluster 1개)
  if (gid) return ['cluster', 'shotgun', uid, gid, partKey].join('_');
  return ['cluster', 'area', uid, partKey, addressClusterKey].join('_');
}
function computeWoundClusterTreatmentCost(cluster, wounds) {
  let cost = 1;
  const count = wounds.length;
  const isFlechette = cluster.type === 'flechette_pattern';
  const isShotgun = cluster.type === 'shotgun_pattern';
  const isJunctional = /groin|axilla|neck|supraclavic/.test(cluster.addressClusterKey || '');
  let severeCount = 0, largeCount = 0, majorLocked = false;
  for (const w of wounds) {
    const ws = w.woundSize || {}, bp = w.bleedingProfile || {}, ve = w.vascularEvidence || {};
    if (/large|massive/.test(ws.sizeClass || '')) largeCount++;
    if ((bp.currentExternal || 0) >= 8 || (bp.sustainedExternal || 0) >= 8) severeCount++;
    if (bp.majorVesselLocked || ve.level === 'confirmed') majorLocked = true;
  }
  if (isFlechette) { cost = 1; if (count > 10) cost += 1; if (severeCount >= 2) cost += 1; }
  else if (isShotgun) { cost = 1; if (count >= 4) cost += 1; if (count >= 7) cost += 1; if (largeCount > 0) cost += 1; }
  else { cost = Math.max(1, Math.ceil(count * 0.65)); }
  if (isJunctional) cost += 1;
  if (majorLocked) cost += 1;
  return Math.max(1, Math.min(5, cost));
}
function refreshWoundCluster(unit, clusterId) {
  if (!unit || !unit.medical || !unit.medical.woundClusters || !clusterId) return null;
  const m = unit.medical;
  const cl = m.woundClusters[clusterId];
  if (!cl) return null;
  const wounds = (cl.sourceWoundIds || []).map(id => m.wounds.find(w => w && w.id === id)).filter(Boolean);
  cl.woundCount = wounds.length;
  const RANK = { none:0, risk_only:1, candidate:2, probable:3, confirmed:4 };
  const agg = { currentExternal:0, currentInternal:0, sustainedExternal:0, sustainedInternal:0, initialExternal:0, initialInternal:0 };
  let maxVL = 'none', majorLocked = false, hasFx = false; const fxTypes = new Set();
  for (const w of wounds) {
    const bp = w.bleedingProfile || {}, ve = w.vascularEvidence || {};
    agg.currentExternal += Math.max(0, bp.currentExternal || 0);
    agg.currentInternal += Math.max(0, bp.currentInternal || 0);
    agg.sustainedExternal += Math.max(0, bp.sustainedExternal || 0);
    agg.sustainedInternal += Math.max(0, bp.sustainedInternal || 0);
    agg.initialExternal += Math.max(0, bp.initialExternal || 0);
    agg.initialInternal += Math.max(0, bp.initialInternal || 0);
    if ((RANK[ve.level] || 0) > (RANK[maxVL] || 0)) maxVL = ve.level || maxVL;
    if (bp.majorVesselLocked || (ve.level === 'confirmed' && ve.vesselClass === 'major_named')) majorLocked = true;
    if (w.fractureEvidence && w.fractureEvidence.occurred) { hasFx = true; if (w.fractureEvidence.fractureType) fxTypes.add(w.fractureEvidence.fractureType); }
  }
  for (const k of Object.keys(agg)) agg[k] = +agg[k].toFixed(2);
  cl.aggregateBleeding = agg;
  cl.maxVascularEvidenceLevel = maxVL;
  cl.hasMajorVesselLocked = majorLocked;
  cl.hasFracture = hasFx; cl.fractureTypes = Array.from(fxTypes);
  cl.clusterSeverity = majorLocked ? 'critical' : (agg.sustainedExternal >= 12 || agg.currentExternal >= 20) ? 'severe'
                     : (agg.sustainedExternal >= 5 || agg.currentExternal >= 8) ? 'moderate' : 'minor';
  cl.treatmentSurfaceCost = computeWoundClusterTreatmentCost(cl, wounds);
  cl.recommendedBandageUnits = cl.treatmentSurfaceCost;
  cl.hemostaticUnits = (/groin|axilla|neck/.test(cl.addressClusterKey || '') || majorLocked || maxVL === 'probable' || maxVL === 'confirmed')
    ? Math.max(1, Math.ceil(cl.treatmentSurfaceCost * 0.5)) : 0;
  // ── 대형 PHASE 4: cluster 집계 처치상태는 "개별 wound.treatmentState에서 파생되는 캐시"다. ──
  //   cluster 단독 상태 변경 금지 — 처치는 항상 개별 wound에 적용 후 여기서 재도출된다.
  const tcs = cl.treatmentClusterState = cl.treatmentClusterState || {};
  let _treated = 0, _pressure = 0, _packed = 0, _needs = 0, _activeBleed = 0;
  const _eligibleRemaining = [];
  // [HOTFIX 마감] 처치 종류를 분리 집계 — 압박(외부출혈 통제) vs 일반 붕대 마감 vs 지혈거즈 vs 패킹.
  let _pressureCtl = 0, _plainBandaged = 0, _hemostatic = 0;
  for (const w of wounds) {
    const ts = w.treatmentState || {};
    const bp2 = w.bleedingProfile || {};
    const tp = w.treatmentProfile || {};
    const eff = (w._effExternal != null) ? w._effExternal : (bp2.currentExternal || 0);
    const done = !!(ts.pressureBandaged || ts.bandageApplied || ts.packed || ts.hemostaticApplied);
    if (done) _treated++;
    if (ts.pressureBandaged) _pressureCtl++;          // 압박붕대 = 외부출혈 압박 통제
    if (ts.bandageApplied) _plainBandaged++;          // 일반 붕대 = 마감/고정 (압박의 호환 bandaged와 분리)
    if (ts.hemostaticApplied) _hemostatic++;
    if (ts.packed) _packed++;
    if (eff > 0.5) _activeBleed++;
    const cavityOnly = (bp2.bleedingType === 'cavity' || bp2.bleedingType === 'internal');
    if (!done && !cavityOnly && (tp.pressureBandageEligible || tp.bandageEligible)) { _needs++; _eligibleRemaining.push(w); }
  }
  tcs.treatedCount = _treated;
  tcs.untreatedEligible = _needs;
  tcs.activeBleedingCount = _activeBleed;
  // summary 분리 카운트 (child 실제 상태와 일치)
  tcs.pressureControlledCount = _pressureCtl;
  tcs.plainBandagedCount = _plainBandaged;
  tcs.hemostaticCount = _hemostatic;
  tcs.packedCount = _packed;
  // derived state — 압박/패킹/지혈은 "통제", 일반 붕대만 있으면 "secured(마감)". 일반붕대 단독 → pressure_controlled 금지.
  const _controlled = (_pressureCtl > 0 || _packed > 0 || _hemostatic > 0);
  tcs.derivedState = (tcs.reopened && _needs > 0) ? 'reopened'
    : (_treated === 0 && _needs > 0) ? 'untreated'
    : (_treated > 0 && _needs > 0) ? 'partially_treated'
    : (_controlled && _activeBleed > 0) ? 'rebleeding'
    : (_packed > 0) ? 'packed'
    : (_pressureCtl > 0) ? 'pressure_controlled'
    : (_plainBandaged > 0) ? 'secured'                        // 일반 붕대만 → 마감(secured), 압박통제 아님
    : (_activeBleed === 0) ? 'secured' : 'untreated';
  if (_needs === 0 && _activeBleed === 0 && tcs.reopened) tcs.reopened = false;   // 재처치 완료 시 reopen 해제
  // 남은 필요 처치량 — "미처치 eligible" 기준으로만 재계산 (이미 처치된 상처에 이중 지출 금지)
  cl.remainingBandageUnits = _eligibleRemaining.length ? computeWoundClusterTreatmentCost(cl, _eligibleRemaining) : 0;
  return cl;
}
function assignWoundToTreatmentCluster(unit, w, ev) {
  if (!unit || !unit.medical || !w) return null;
  const m = unit.medical;
  if (!m.woundClusters) m.woundClusters = {};
  const clusterId = getWoundClusterKey(unit, w, ev);
  const partKey = w.partKey || ev.hitPart || 'unknown';
  const addressClusterKey = normalizeWoundAddressCluster(partKey, w.normalizedMedicalAddress || w.impactAddress || ev.impactAddress || 'generic');
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  const gid = w.pelletGroupId || ev.pelletGroupId || null;
  const ammoId = w.shotgunAmmoId || w.ammoId || ev.ammoId || null;
  const isFlechette = /flechette/.test(ammoId || '');
  const isBuckshot = /buck/.test(ammoId || '');
  // SAME-AREA-CLUSTER-ACTIVE-GEN-1: 비산탄 same-area cluster는 active generation을 추적해 8s window 내 후속 피격이
  //   방금 만든 세대(_g1)에 합류하게 한다. base clusterId만 보면 _g2/_g3가 매번 생기던 문제 수정.
  //   산탄(pelletGroupId 있음)은 기존 pelletGroupId 기준 그대로.
  let _effClusterId = clusterId;
  if (!gid) {
    const WINDOW_S = 8;
    m._activeWoundClusterGen = m._activeWoundClusterGen || {};
    const isClusterClosedForMerge = (cl2) => {
      if (!cl2) return false;
      const ts = cl2.treatmentClusterState || {};
      return !!(ts.packed || ts.tourniquetApplied || ts.closed) || cl2.clusterSeverity === 'critical';
    };
    const activeId = m._activeWoundClusterGen[clusterId];
    const active = activeId ? m.woundClusters[activeId] : null;
    if (active) {
      const stale = (active.lastHitTime != null) && ((now - active.lastHitTime) > WINDOW_S);
      const closed = isClusterClosedForMerge(active);
      if (!stale && !closed) {
        _effClusterId = active.id;
      } else {
        m._woundClusterGen = m._woundClusterGen || {};
        m._woundClusterGen[clusterId] = (m._woundClusterGen[clusterId] || 0) + 1;
        _effClusterId = clusterId + '_g' + m._woundClusterGen[clusterId];
        m._activeWoundClusterGen[clusterId] = _effClusterId;
      }
    } else {
      const base = m.woundClusters[clusterId];
      if (base) {
        const stale = (base.lastHitTime != null) && ((now - base.lastHitTime) > WINDOW_S);
        const closed = isClusterClosedForMerge(base);
        if (!stale && !closed) {
          _effClusterId = base.id;
          m._activeWoundClusterGen[clusterId] = base.id;
        } else {
          m._woundClusterGen = m._woundClusterGen || {};
          m._woundClusterGen[clusterId] = (m._woundClusterGen[clusterId] || 0) + 1;
          _effClusterId = clusterId + '_g' + m._woundClusterGen[clusterId];
          m._activeWoundClusterGen[clusterId] = _effClusterId;
        }
      } else {
        _effClusterId = clusterId;
        m._activeWoundClusterGen[clusterId] = _effClusterId;
      }
    }
  }
  let cl = m.woundClusters[_effClusterId];
  // WOUND-CLUSTER-REFRESH-1 §5: 이미 치료된 cluster에 나중에 새 wound(다른 volley/시점) → reopen/rebleed.
  //   같은 shotgun volley의 순차 펠릿(같은 gid)은 reopen 아님.
  const wasExisting = !!cl;
  const wasTreated = cl && cl.treatmentClusterState &&
    (cl.treatmentClusterState.bandaged || cl.treatmentClusterState.pressureApplied || cl.treatmentClusterState.packed);
  const sameVolley = gid && cl && cl.pelletGroupId === gid;
  if (wasExisting && wasTreated && !sameVolley && cl.lastHitTime != null && (now - cl.lastHitTime) > 0.25) {
    cl.treatmentClusterState.reopened = true;
    cl.treatmentClusterState.rebleedAfterTreatment = true;
    cl.treatmentClusterState.bandaged = false;
    cl.treatmentClusterState.pressureApplied = false;
    cl.notes = cl.notes || [];
    cl.notes.push('new_wound_reopened_cluster');
  }
  if (!cl) {
    let type = 'single';
    // 대형 PHASE 5: slug는 단일 발사체 — 펠릿 패턴 cluster에서 제외 (governor 제외 규칙과 일치)
    if (gid) type = isFlechette ? 'flechette_pattern' : (/slug/.test(ammoId || '') ? 'single' : 'shotgun_pattern');
    else if (/groin|axilla|neck/.test(addressClusterKey)) type = 'junctional_cluster';
    cl = m.woundClusters[_effClusterId] = {
      id: _effClusterId, type, partKey, normalizedAddress: (w.normalizedMedicalAddress && (w.normalizedMedicalAddress.fullAddress || w.normalizedMedicalAddress)) || null,
      addressClusterKey, sourceWoundIds: [], pelletGroupId: gid, shotgunAmmoId: ammoId, pelletCount: w.pelletCount || 0, woundCount: 0,
      firstHitTime: now, lastHitTime: now, clusterSeverity: 'minor',
      aggregateBleeding: { currentExternal:0, currentInternal:0, sustainedExternal:0, sustainedInternal:0, initialExternal:0, initialInternal:0 },
      maxVascularEvidenceLevel: 'none', hasMajorVesselLocked: false, hasFracture: false, fractureTypes: [],
      treatmentSurfaceCost: 1, recommendedBandageUnits: 1, hemostaticUnits: 0,
      treatmentClusterState: { bandaged:false, pressureApplied:false, packed:false, tourniquetApplied:false, lastTreatmentTime:0, treatmentQuality:0 },
      notes: [],
    };
  }
  // same_area_multi_hit 승격 (비산탄 + 같은 부위 반복)
  if (!gid && cl.type === 'single' && cl.sourceWoundIds.length >= 1) cl.type = 'same_area_multi_hit';
  if (cl.sourceWoundIds.indexOf(w.id) < 0) cl.sourceWoundIds.push(w.id);
  cl.lastHitTime = now;
  cl.pelletCount = Math.max(cl.pelletCount || 0, w.pelletCount || 0);
  w.treatmentClusterId = cl.id;
  return refreshWoundCluster(unit, cl.id);
}
function _woundPipelineError(stage, info, err) {
  const rec = Object.assign({ pipeline:'wound', stage, error: err && (err.message || String(err)), t: (typeof GAME !== 'undefined' && GAME.gameTime) || 0 }, info || {});
  if (typeof GAME !== 'undefined') {
    GAME._pipelineErrors = GAME._pipelineErrors || [];
    if (GAME._pipelineErrors.length < 300) GAME._pipelineErrors.push(rec);
    if (GAME.debugStrictPipeline) { const e2 = new Error('WOUND_PIPELINE_ERROR [' + stage + '] ' + rec.error); e2._pipeline = rec; throw e2; }
  }
  return rec;
}
function _markMedicalInconsistent(unit, stage, info) {
  if (!unit || !unit.medical) return;
  unit.medical._inconsistent = unit.medical._inconsistent || [];
  if (unit.medical._inconsistent.length < 50) unit.medical._inconsistent.push(Object.assign({ stage, t: (typeof GAME !== 'undefined' && GAME.gameTime) || 0 }, info || {}));
}
function validateWoundPipelineInvariants(unit, opts) {
  const errs = [];
  const m = unit && unit.medical; if (!m) return errs;
  const push = (k, msg) => errs.push({ k, msg });
  const ids = new Set();
  for (const w of (m.wounds || [])) {
    if (!w) continue;
    if (ids.has(w.id)) push('wound', '중복 wound id: ' + w.id);
    ids.add(w.id);
    if (w.partKey && !_STORAGE_TO_CANON[w.partKey]) push('partKey', '비정규 wound.partKey: ' + w.partKey);
    if (w.treatmentClusterId && !(m.woundClusters && m.woundClusters[w.treatmentClusterId])) push('cluster', 'wound가 없는 cluster 참조: ' + w.treatmentClusterId);
    if (w.bleedingProfile && (w.bleedingProfile._finalizationCount || 0) > 1) push('bleeding', 'finalization ' + w.bleedingProfile._finalizationCount + '회: ' + w.id);
    if (w.bleedingProfile && (w.bleedingProfile._finalizationCount || 0) === 0) push('bleeding', 'finalize 미실행: ' + w.id);
  }
  for (const cid in (m.woundClusters || {})) {
    const c = m.woundClusters[cid]; if (!c) continue;
    const resolved = (c.sourceWoundIds || []).map(id => (m.wounds || []).find(x => x && x.id === id)).filter(Boolean);
    if ((c.sourceWoundIds || []).length !== resolved.length) push('cluster', 'dangling sourceWoundIds: ' + cid);
    if (c.woundCount !== resolved.length) push('cluster', 'woundCount 불일치: ' + cid + ' ' + c.woundCount + '!=' + resolved.length);
    if (resolved.length === 0) push('cluster', '빈 active cluster: ' + cid);
    for (const w of resolved) if (w.partKey !== c.partKey) push('cluster', 'cluster/부위 불일치: ' + cid + ' ' + w.partKey + '!=' + c.partKey);
    if (c.pelletGroupId) for (const w of resolved) if (w.pelletGroupId !== c.pelletGroupId) push('cluster', 'pelletGroupId 불일치: ' + cid);
  }
  if (m.partDestruction) for (const pk in m.partDestruction) {
    const pd = m.partDestruction[pk]; if (!pd) continue;
    for (const id of (pd.sourceWoundIds || [])) if (!ids.has(id)) push('partDestruction', 'dangling wound ref: ' + pk + '/' + id);
    for (const cid of (pd.sourceClusterIds || [])) if (!(m.woundClusters && m.woundClusters[cid])) push('partDestruction', 'dangling cluster ref: ' + pk + '/' + cid);
  }
  if (errs.length && typeof GAME !== 'undefined' && GAME.debugStrictPipeline && !(opts && opts.noThrow)) {
    const e = new Error('WOUND_INVARIANT_FAIL: ' + errs.map(x => x.k + ':' + x.msg).slice(0, 5).join(' | ')); e._invariants = errs; throw e;
  }
  return errs;
}
function applyFractureEvidenceToBodyPart(unit, w) {
  const fe = w && w.fractureEvidence;
  if (!fe || !fe.occurred) return;
  const _p = getMedicalBodyPart(unit && unit.medical, w.partKey);
  if (!_p) return;
  if (!_p.fracture) _p.fracture = true;
  _p.fractureType = fe.fractureType;
  _p.boneZone = fe.boneZone;
  recomputeBodyPartFunctionRatio(_p, unit.medical.partDestruction && unit.medical.partDestruction[w.partKey]);
}
function processWoundEvent(unit, ev) {
  if (!unit || !unit.medical) return null;
  const m = unit.medical;
  if (!m.wounds) m.wounds = [];
  // A. 입력 정규화 + 중복 event guard
  if (ev && ev._woundEventProcessed) return ev._woundEventProcessedWound || null;
  const ctx = {
    eventId: (ev && ev.eventId != null) ? ev.eventId : ((typeof GAME !== 'undefined') ? (GAME._woundEventSeq = (GAME._woundEventSeq || 0) + 1) : null),
    unitId: unit.id, stage: 'A_normalize',
    canonicalPartKey: normalizeAnatomicalPartKey(ev && ev.partKey, { ctx: 'processWoundEvent' }),
    partKey: ev && ev.partKey, pelletGroupId: (ev && ev.pelletGroupId) || null,
    woundId: null, clusterId: null,
  };
  // B. 순수 wound draft (unit 상태 변경 없음)
  ctx.stage = 'B_draft';
  const w = buildWoundDescriptor(unit, ev);
  if (!w) return null;
  ctx.woundId = w.id;
  // C. 단일 commit
  ctx.stage = 'C_commit';
  if (w.id != null && m.wounds.some(x => x && x.id === w.id)) {
    _woundPipelineError('C_commit', ctx, new Error('duplicate wound commit: ' + w.id));
    return w;
  }
  m.wounds.push(w);
  if (ev) { ev._woundEventProcessed = true; ev._woundEventProcessedWound = w; }
  try {
    // D. 골절 → bodyPart 동기화 (기능률 갱신 포함)
    ctx.stage = 'D_fracture_sync';
    applyFractureEvidenceToBodyPart(unit, w);
    // E. treatment cluster 연결
    ctx.stage = 'E_cluster_assign';
    const cluster = assignWoundToTreatmentCluster(unit, w, ev);
    if (cluster) { w.treatmentClusterId = cluster.id; ctx.clusterId = cluster.id; }
    // F. 누적외상 / partDestruction (wound + cluster 등록 이후에만)
    ctx.stage = 'F_partDestruction';
    const _seed = w._pendingPartDestructionCtx || {};
    const bodyDmgForDestruction = Number.isFinite(_seed.bodyDmg) ? _seed.bodyDmg
      : ((ev && ev._immediatePhysiology && Number.isFinite(ev._immediatePhysiology.bodyDmg)) ? ev._immediatePhysiology.bodyDmg : 0);
    w.partDestructionEvidence = updatePartDestructionFromWound(unit, w, ev, {
      bodyDmg: bodyDmgForDestruction, partKey: w.partKey, bodyPart: getMedicalBodyPart(m, w.partKey),
      pelletGroupId: w.pelletGroupId || null, shotgunPellet: !!w.shotgunPellet, sourceType: w.sourceType, armorResult: w.armorResult,
    });
    // G. vascular evidence 최종 보강 (fracture/partDestruction만으로 confirmed 금지 — helper 원칙)
    ctx.stage = 'G_vascular_final';
    reinforceVascularEvidenceWithPartDestruction(unit, w);
    // H. bleeding 단일 finalization
    ctx.stage = 'H_bleeding_finalize';
    if (w.bleedingProfile) finalizeBleedingProfileWithEvidence(w);
    // I. 후속 의료 모델 — 최종 evidence 기준 fieldCare / treatmentProfile / tissue 동기화
    ctx.stage = 'I_post_models';
    if (w.bleedingProfile) {
      w.bleedingProfile.tourniquetEligible = w.bleedingProfile.tourniquetEligible && (w.bleedingProfile.bleedingType === 'external' || w.bleedingProfile.bleedingType === 'junctional');
      if (typeof computeFieldCare === 'function') {
        const _fc = computeFieldCare(ev, w.woundType, w.woundSize, w.bleedingProfile);
        w.fieldCare = { fieldCareClass: _fc };
        if (typeof computeTreatmentProfile === 'function') w.treatmentProfile = computeTreatmentProfile(ev, w.woundType, w.bleedingProfile, _fc);
      }
    }
    if (w.tissueProfile) {
      w.tissueProfile.vesselRisk = w.bleedingProfile ? w.bleedingProfile.vesselRisk : w.tissueProfile.vesselRisk;
      w.tissueProfile.boneRisk = (w.fractureEvidence && w.fractureEvidence.occurred) ? 1 : w.tissueProfile.boneRisk;
    }
    // J. shotgun group governor (idempotent, finalize 이후 — 과거 결과 위 반복 곱셈 금지)
    ctx.stage = 'J_shotgun_governor';
    if (w.pelletGroupId) { normalizeShotgunPelletGroupBleeding(unit, w.pelletGroupId); normalizeShotgunPelletGroupPhysiology(unit, w.pelletGroupId); }
    // K. woundCluster 최종 refresh
    ctx.stage = 'K_cluster_refresh';
    if (w.treatmentClusterId && typeof refreshWoundCluster === 'function') refreshWoundCluster(unit, w.treatmentClusterId);
  } catch (e) {
    if (!e || !e._pipeline) _woundPipelineError(ctx.stage, ctx, e);
    _markMedicalInconsistent(unit, ctx.stage, { woundId: w.id, clusterId: ctx.clusterId, eventId: ctx.eventId, error: e && e.message });
    if (typeof GAME !== 'undefined' && GAME.debugStrictPipeline) throw e;
  }
  // L. pruning + 참조 정리 (모든 계산과 cluster refresh 이후 마지막)
  try {
    ctx.stage = 'L_prune';
    const removedWoundIds = _pruneWoundsWithRemovedIds(m.wounds, 60, w && w.id);
    if (removedWoundIds && removedWoundIds.length) cleanupPrunedWoundReferences(unit, removedWoundIds);
  } catch (e) {
    if (!e || !e._pipeline) _woundPipelineError('L_prune', ctx, e);
    _markMedicalInconsistent(unit, 'L_prune', { error: e && e.message });
    if (typeof GAME !== 'undefined' && GAME.debugStrictPipeline) throw e;
  }
  // M. invariant 검증 (debug/strict)
  if (typeof GAME !== 'undefined' && GAME.debugStrictPipeline) { ctx.stage = 'M_invariants'; validateWoundPipelineInvariants(unit); }
  return w;
}
function recordWoundFromDamageEvent(unit, ev) { return processWoundEvent(unit, ev); }
function _pruneWoundsWithRemovedIds(arr, cap, protectId) {
  const removed = [];
  while (arr.length > cap) {
    let removeIdx = -1, worstScore = Infinity;
    for (let i = 0; i < arr.length; i++) {
      const w = arr[i];
      if (protectId != null && w && w.id === protectId) continue;   // 새 wound 보호
      const bp = w.bleedingProfile || {};
      // 낮을수록 먼저 제거 (경미/안정/무출혈 우선). 치명·미처치 출혈은 보존.
      let score = 0;
      score += (bp.currentExternal || 0) * 2 + (bp.currentInternal || 0) * 2.5;
      score += (bp.sustainedExternal || 0) * 1.5;
      if (bp.majorVesselLocked) score += 100;
      if (w.severity) score += (w.severity || 0) * 0.2;
      const st = w.treatmentState || {};
      const untreated = !(st.bandaged || st.packed || st.tourniquetApplied || st.hemostaticApplied);
      if (untreated && (bp.currentExternal || 0) > 0) score += 30;   // 미처치 출혈 보존
      const pds = w.partDestructionEvidence && w.partDestructionEvidence.partDestructionStateAfter;
      if (pds && pds !== 'intact' && pds !== 'damaged') score += 40;   // 부위파괴 근거 wound 보존
      if (score < worstScore) { worstScore = score; removeIdx = i; }
    }
    if (removeIdx < 0) break;   // 모두 보호됨
    const rem = arr.splice(removeIdx, 1)[0];
    if (rem && rem.id != null) removed.push(rem.id);
  }
  return removed;
}
function cleanupPrunedWoundReferences(unit, removedIds) {
  if (!unit || !unit.medical || !removedIds || !removedIds.length) return;
  const m = unit.medical;
  const rmSet = new Set(removedIds);
  const touchedClusters = new Set();
  const touchedParts = new Set();
  // woundClusters.sourceWoundIds
  if (m.woundClusters) {
    for (const cid in m.woundClusters) {
      const cl = m.woundClusters[cid];
      if (!cl || !cl.sourceWoundIds) continue;
      const before = cl.sourceWoundIds.length;
      cl.sourceWoundIds = cl.sourceWoundIds.filter(id => !rmSet.has(id));
      if (cl.sourceWoundIds.length !== before) touchedClusters.add(cid);
    }
  }
  // partDestruction.sourceWoundIds + localClusters[*].woundIds
  if (m.partDestruction) {
    for (const pk in m.partDestruction) {
      const pd = m.partDestruction[pk];
      if (!pd) continue;
      let touched = false;
      if (pd.sourceWoundIds) {
        const before = pd.sourceWoundIds.length;
        pd.sourceWoundIds = pd.sourceWoundIds.filter(id => !rmSet.has(id));
        if (pd.sourceWoundIds.length !== before) touched = true;
      }
      if (pd.localClusters) {
        for (const lk in pd.localClusters) {
          const lc = pd.localClusters[lk];
          if (lc && lc.woundIds) {
            const before = lc.woundIds.length;
            lc.woundIds = lc.woundIds.filter(id => !rmSet.has(id));
            if (lc.woundIds.length !== before) touched = true;
          }
        }
      }
      if (touched) touchedParts.add(pk);
    }
  }
  // 참조 정리된 cluster / part 재계산
  for (const cid of touchedClusters) { if (typeof refreshWoundCluster === 'function') refreshWoundCluster(unit, cid); }
  for (const pk of touchedParts) {
    if (typeof refreshPartDestructionState === 'function') refreshPartDestructionState(unit, pk, {});
    if (typeof applyPartDestructionEffects === 'function') applyPartDestructionEffects(unit, pk);
  }
  // 대형 PHASE 3-L: 빈 active cluster 삭제 + 관련 참조(_activeGen/partDestruction.sourceClusterIds/localCluster.clusterIds) 정리.
  //   pruning은 기록 압축 — cumulativeTraumaScore/partDestruction state/functionalCap은 유지된다.
  const deletedClusters = [];
  if (m.woundClusters) for (const cid of Object.keys(m.woundClusters)) {
    const cl = m.woundClusters[cid];
    if (cl && (!cl.sourceWoundIds || cl.sourceWoundIds.length === 0)) { deletedClusters.push(cid); delete m.woundClusters[cid]; }
  }
  if (deletedClusters.length) {
    const dset = new Set(deletedClusters);
    if (m._activeWoundClusterGen) for (const base of Object.keys(m._activeWoundClusterGen)) { if (dset.has(m._activeWoundClusterGen[base])) delete m._activeWoundClusterGen[base]; }
    if (m.partDestruction) for (const pk in m.partDestruction) {
      const pd = m.partDestruction[pk]; if (!pd) continue;
      if (pd.sourceClusterIds) pd.sourceClusterIds = pd.sourceClusterIds.filter(id => !dset.has(id));
      if (pd.localClusters) for (const lk in pd.localClusters) { const lc = pd.localClusters[lk]; if (lc && lc.clusterIds) lc.clusterIds = lc.clusterIds.filter(id => !dset.has(id)); }
    }
  }
}
function _bleedLabelKo(wound) {
  const bp = wound.bleedingProfile;
  if (!bp || bp.bleedingType === 'none') return '출혈 없음';
  const ts = wound.treatmentState || {};
  // 지혈대 억제 우선
  if (wound._tourniquetSuppressed) return '지혈대 억제';
  // 압박붕대 안정화 상태
  if (ts.pressureBandaged) {
    const eff = (wound._effExternal != null) ? wound._effExternal : bp.currentExternal;
    const stab = ts.pressureBandageStabilization || 0;
    if (bp.bleedingType === 'cavity') return '체강출혈(외부 억제)';
    if (eff < 0.4) return '출혈 거의 중단';
    if (bp.bleedingType === 'junctional' || wound.woundSize.sizeClass === 'large' || wound.woundSize.sizeClass === 'massive') {
      return stab > 0.6 ? '잔여 출혈 지속 / 후속 처치 필요' : '출혈 크게 억제';
    }
    if (stab < 0.35) return '출혈 크게 억제';
    return '출혈 감소 중';
  }
  const ext = (wound._effExternal != null) ? wound._effExternal : (bp.currentExternal || 0);
  if (bp.bleedingType === 'cavity') return '체강출혈';
  if (bp.bleedingType === 'junctional') return '접합부 출혈';
  if (bp.bleedingType === 'internal') return '내부출혈 의심';
  if (ext > 18) return '치명적 출혈';
  if (ext > 8) return '출혈 중';
  if (ext > 0.5) return '약한 출혈';
  return '출혈 없음';
}
function _treatLabelKo(wound) {
  const ts = wound.treatmentState || {};
  if (wound._tourniquetSuppressed && !ts.pressureBandaged && !ts.packed && !ts.hemostaticApplied) return '지혈대 억제 / 추가처치 필요';
  // SIDE-MED-2C-HOTFIX-1 §10: 적용된 처치 조합 표시 (placeholder 문구 제거)
  const applied = [];
  if (ts.packed) applied.push('패킹');
  if (ts.hemostaticApplied) applied.push('지혈거즈');
  if (ts.junctionalPressureApplied) applied.push('접합부압박');
  if (ts.pressureBandaged) applied.push('압박붕대');
  if (ts.abdominalDressed) applied.push('복부드레싱');
  if (applied.length >= 3) return '복합 처치';
  if (applied.length) return applied.join('+');
  if (ts.bandaged) return '붕대됨';
  if (ts.stabilized) return '안정';
  if (wound.bleedingProfile && wound.bleedingProfile.bleedingType === 'none') return '안정';
  return '미처치';
}
function buildWoundUiLabels(wound) {
  const sizeLabel = WOUND_SIZE_LABEL_KO[wound.woundSize.sizeClass] || '소형';
  const typeLabel = WOUND_TYPE_LABEL_KO[wound.woundType] || '상처';
  // HOTFIX-2 §4: 입구 / 내부 / 사출구 채널 라벨
  const ws = wound.woundSize || {};
  const SZ = (c) => WOUND_SIZE_LABEL_KO[c] || (c ? c : '—');
  const entryKo = SZ(ws.entrySizeClass || ws.sizeClass);
  const internalKo = SZ(ws.internalSizeClass || ws.sizeClass);
  let exitKo;
  if (wound.exitWoundPresent && wound.exitSizeClass) exitKo = SZ(wound.exitSizeClass);
  else if (wound.bodyTrajectory && wound.bodyTrajectory.retainedProjectile) exitKo = '체내 잔류';
  else exitKo = '없음';
  const channelLabel = `${entryKo} / ${internalKo} / ${exitKo}`;
  return {
    sizeLabel, typeLabel,
    combinedLabel: `${sizeLabel} / ${typeLabel}`,
    channelLabel,
    locationLabel: woundLocationLabelKo(wound),
    bleedingLabel: _bleedLabelKo(wound),
    treatmentLabel: _treatLabelKo(wound),
    fieldCareLabel: FIELD_CARE_LABEL_KO[wound.fieldCare.fieldCareClass] || '현장처치 가능',
    severityLabel: sizeLabel,
  };
}
function woundLocationLabelKo(wound) {
  const partKo = (typeof BODY_PART_KOR !== 'undefined' && BODY_PART_KOR[_medicalPartToLegacy(wound.partKey)]) || _woundPartKo(wound.partKey);
  const z = wound.location || wound.anatomicalZone;
  return z ? `${partKo}` : partKo;
}
function _woundPartKo(pk) {
  return ({ head:'머리', neck:'목', chest:'가슴', abdomen:'복부', leftArm:'좌상지', rightArm:'우상지', leftLeg:'좌하지', rightLeg:'우하지' })[pk] || pk;
}
function _medicalPartToLegacy(pk) {
  return ({ leftArm:'left_arm', rightArm:'right_arm', leftLeg:'left_leg', rightLeg:'right_leg' })[pk] || pk;
}
function ensureBodyPartTreatments(m) {
  if (!m.bodyPartTreatments) m.bodyPartTreatments = {};
  return m.bodyPartTreatments;
}
function buildBleedingPulseModel(unit, w, bp, extMul) {
  const m = unit.medical, hd = m.hemodynamics || {};
  const MAP = (hd.map != null) ? hd.map : 75, PP = (hd.pulsePressure != null) ? hd.pulsePressure : 40, HR = m.heartRate || 75;
  const vtone = (hd.vascularTone != null) ? hd.vascularTone : 1.0;
  const isJunctional = bp.bleedingType === 'junctional';
  const isCavity = bp.bleedingType === 'cavity';
  let majorVessel = false, arterial = false;
  const oim = w.organInjuryModel;
  if (oim && oim.injuries) for (const inj of oim.injuries) {
    if (/vessel|carotid_jugular/.test(inj.organ) && (inj.bleedRisk === 'high' || inj.bleedRisk === 'massive')) {
      if (inj.bleedRisk === 'massive') majorVessel = true;
      arterial = true;
    }
  }
  if (bp.tourniquetEligible && (bp.vesselRisk || 0) > 0.4) arterial = true;
  // §8.3 heartRate 영향 — 성격별 상한 clamp (soft 8%/venous-limb 12%/arterial·junctional 20%/major 25%)
  const hrCap = majorVessel ? 0.25 : (arterial || isJunctional) ? 0.20 : bp.tourniquetEligible ? 0.12 : 0.08;
  const hrNorm = clamp01((HR - 75) / 95);
  const heartRateInfluence = hrNorm * hrCap;
  // §8.2 pulsePressure 영향 — arterial/junctional 큼, venous/soft 작음
  const ppNorm = clamp01((PP - 40) / 40);
  const ppCap = (majorVessel || arterial || isJunctional) ? 0.18 : 0.05;
  const pulsePressureInfluence = ppNorm * ppCap;
  // §8.1 MAP 보정 — 높으면 분출↑, 낮으면 분출↓(상태는 나쁨, 치료 아님)
  const pressureModifier = clampMed(1 + ((MAP - 75) / 75) * 0.25, 0.6, 1.25);
  // §8.4 혈관수축 — 말초 external 일부 감소, cavity/major vessel은 큰 효과 없음
  let vascularToneModifier = 1.0;
  if (!isCavity && !majorVessel) vascularToneModifier = clampMed(1 - Math.max(0, vtone - 1.0) * 0.25, 0.8, 1.0);
  const pulseModifier = 1 + heartRateInfluence + pulsePressureInfluence;
  const extPulse = clampMed(pressureModifier * pulseModifier * vascularToneModifier, 0.5, 1.6);
  const intPulse = isCavity ? clampMed(pressureModifier, 0.7, 1.2) : clampMed(pressureModifier * (1 + pulsePressureInfluence * 0.5), 0.7, 1.3);
  const tags = [];
  if (arterial) tags.push('arterial_pulse');
  if (isJunctional) tags.push('junctional_pulse');
  if (heartRateInfluence > 0.1) tags.push('tachy_bleed');
  if (MAP < 60) tags.push('low_map_low_flow');
  if (vascularToneModifier < 0.95) tags.push('vasoconstriction_partial');
  if (isCavity) tags.push('cavity_uncontrolled');
  if (extMul != null && extMul <= 0.2 && bp.tourniquetEligible) tags.push('tourniquet_control');
  else if (extMul != null && extMul <= 0.35) tags.push('packing_control');
  const hcm = w.hemorrhageControlModel;
  if (hcm && (hcm.treatmentEffectLimit === 'not_field_controllable' || hcm.hemorrhageType === 'cavity_internal')) tags.push('field_care_limited');
  w.bleedingPulseModel = {
    pressureModifier: +pressureModifier.toFixed(3), pulseModifier: +pulseModifier.toFixed(3),
    vascularToneModifier: +vascularToneModifier.toFixed(3), heartRateInfluence: +heartRateInfluence.toFixed(3),
    pulsePressureInfluence: +pulsePressureInfluence.toFixed(3), treatmentSuppression: extMul != null ? +(1 - extMul).toFixed(3) : 0,
    tags,
  };
  return { extPulse, intPulse };
}
function updateMedicalBleedingWoundBased(unit, dt) {
  const m = unit.medical;
  ensureBodyPartTreatments(m);
  // 부위별 합산
  const partExt = {}, partInt = {};
  for (const k of BODY_PART_KEYS) { partExt[k] = 0; partInt[k] = 0; }
  for (const w of m.wounds) {
    const bp = w.bleedingProfile;
    if (!bp) continue;
    const pk = w.partKey;
    const ts = w.treatmentState || {};
    // ORGANIC-BLEED-1 Phase1 §6: 자연 지혈 — 대혈관/major organ confirmed(majorVesselLocked)가 아니면 sustained/naturalReductionTarget 쪽으로 서서히 감소.
    //   자연 감소는 완치가 아님(wound 유지, 재출혈 위험 유지). 움직임/shock/낮은 처치품질은 감소를 늦추거나 멈춤.
    const _locked = !!bp.majorVesselLocked;
    const _moving = !!(unit.isMoving || unit.beingDragged || unit._draggeeId);
    if (!_locked) {
      const _targetExt = (bp.naturalReductionTargetExternal != null) ? bp.naturalReductionTargetExternal
                       : (bp.sustainedExternal != null ? bp.sustainedExternal : bp.currentExternal);
      const _targetInt = (bp.naturalReductionTargetInternal != null) ? bp.naturalReductionTargetInternal
                       : (bp.sustainedInternal != null ? bp.sustainedInternal : bp.currentInternal);
      let _rate = (bp.selfReductionRate != null ? bp.selfReductionRate : 0.2);
      if (_moving) _rate *= 0.35;                                  // 움직임 → 감소 둔화
      if (m.shockState === 'decompensated' || (m.map != null && m.map < 55)) _rate *= 0.5;   // shock → 둔화
      // external: target 쪽으로 접근 (초과분만)
      if (bp.currentExternal != null && bp.currentExternal > _targetExt) {
        bp.currentExternal = Math.max(_targetExt, bp.currentExternal - _rate * dt);
      }
      // internal: cavity major는 위 target이 sustained라 거의 안 내려감. 그 외는 완만히.
      if (bp.currentInternal != null && bp.currentInternal > _targetInt) {
        const _intRate = _rate * 0.6;
        bp.currentInternal = Math.max(_targetInt, bp.currentInternal - _intRate * dt);
      }
    } else {
      // majorVesselLocked — 자연 감소 거의 없음 (아주 약한 clot만, external 극소량)
      if (bp.currentExternal != null && bp.bleedingType === 'external' && bp.currentExternal > (bp.sustainedExternal || 0)) {
        bp.currentExternal = Math.max(bp.sustainedExternal || 0, bp.currentExternal - 0.03 * dt);
      }
    }
    // legacy 미세 출혈 자연 지혈 (evidence 없는 아주 작은 외출혈)
    if (bp.currentExternal > 0 && bp.currentExternal < 2.0 && bp.naturalReductionTargetExternal == null) {
      bp.currentExternal = Math.max(0, bp.currentExternal - 0.02 * dt);
    }
    // === SIDE-MED-2C §25: 처치 modifier (외출혈) — 조합 보너스 포함, 체강 내부출혈은 현장처치로 감소 금지 ===
    let extMul = 1.0;
    const bleedT = bp.bleedingType;
    const isCavityBleed = (bleedT === 'cavity');
    const isJunctional = (bleedT === 'junctional');
    // hemostatic — external/muscle/junctional 접근 가능 성분 감소 (cavity 본체엔 외부 성분만)
    const hemoEff = ts.hemostaticApplied && (ts.hemostaticEffective !== false);
    // packing — junctional/deep muscle channel
    const packEff = ts.packed && (ts.packingEffective !== false);
    if (packEff && hemoEff) extMul *= 0.09;            // 조합: 패킹+지혈거즈 최강
    else if (packEff) extMul *= 0.14;
    else if (hemoEff) extMul *= 0.20;
    // pressure bandage — 단독/조합. packed/hemostatic 이후 추가 안정화
    if (ts.pressureBandaged) {
      ts.pressureBandageStabilization = Math.min(1, (ts.pressureBandageStabilization || 0) + dt * 0.06);
      const initMul = (ts.pressureBandageInitialMul != null) ? ts.pressureBandageInitialMul : 0.15;
      const tgtMul = (ts.pressureBandageTargetMul != null) ? ts.pressureBandageTargetMul : 0.03;
      const stab = ts.pressureBandageStabilization;
      let pbMul = (initMul + (tgtMul - initMul) * stab);
      if (packEff || hemoEff) pbMul *= 0.6;            // 조합 시 추가 감소
      if (isJunctional) pbMul = Math.min(1, pbMul * 1.8);   // 접합부 단독 효과 제한
      extMul *= pbMul;
    }
    else if (ts.bandaged && !packEff && !hemoEff) extMul *= 0.30;
    // junctional pressure — 접합부 외부 성분 일시 감소 (quality/유지 반영, 단독 완전정지 금지)
    if (ts.junctionalPressureApplied && isJunctional) {
      const jq = ts.junctionalPressureQuality || 0.6;
      const jpMul = ts.junctionalPressureMaintained ? (0.45 - jq * 0.2) : (0.7 - jq * 0.1);
      extMul *= Math.max(0.3, jpMul);                  // 단독으론 30% 바닥 (잔여 유지)
    }
    // abdominal dressing — external oozing 소폭만 (내부 무효)
    if (ts.abdominalDressed) extMul *= 0.85;
    // 부위 전체 지혈대 — limb external/muscle 강하게, junctional/cavity 제한/무효
    const bpt = m.bodyPartTreatments[pk];
    let tqSup = false;
    if (bpt && bpt.tourniquet) {
      const tq = bpt.tourniquet;
      if (bp.tourniquetEligible) {
        const eff = (tq.quality === 'good') ? 0.90 : (tq.quality === 'poor') ? 0.62 : 0.85;
        extMul *= (1 - eff);
        tqSup = true;
      } else if (isJunctional) {
        extMul *= 0.85;   // 접합부 — 지혈대 효과 낮음
      }
      // cavity/torso는 지혈대 무효 (multiplier 미적용)
    }
    w._tourniquetSuppressed = tqSup;
    // severe/critical / field_unmanageable wound는 잔여 출혈 바닥 유지 (완전 0 금지)
    const ibmW = w.internalBleedingModel;
    const hcm = w.hemorrhageControlModel;
    let extFloorMul = 0;
    if (hcm && (hcm.treatmentEffectLimit === 'partial_control_only')) extFloorMul = 0.12;
    else if (hcm && hcm.treatmentEffectLimit === 'temporary_stabilization') extFloorMul = 0.18;
    else if (hcm && hcm.treatmentEffectLimit === 'not_field_controllable') extFloorMul = 0.3;
    if (extFloorMul > 0) extMul = Math.max(extMul, extFloorMul);
    let effExt = bp.currentExternal * extMul;
    // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §8: confirmed_physiologic 외부 대혈관/장기 → external 가중 (처치 비례 감소 유지, clamp)
    {
      const pep = w.physiologicEffectProfile;
      if (pep && ((pep.externalBleedBoost || 0) > 0 || (pep.majorVesselMul || 1) > 1)) {
        let physExtMul = 1 + (pep.externalBleedBoost || 0) + Math.max(0, (pep.majorVesselMul || 1) - 1) * 0.6;
        effExt *= Math.min(2.4, physExtMul);
      }
    }
    let effInt = bp.currentInternal;
    // === PRECARDIAC-1 §4.1/§6: 장기/혈관 후보·혈흉 위험 기반 내부출혈 진행 보정 ===
    //   확정 파열이 아니라 "위험 보정"이다. bleedingProfile 원본은 불변, 합산 clamp ×1.35.
    //   처치는 이 값을 절대 줄이지 못한다 (위험 증가 전용 — cavity field-care 불변 원칙과 별개 축).
    if (effInt > 0) {
      let intRiskMul = 1.0;
      const oimW = w.organInjuryModel;
      if (oimW && oimW.injuries) {
        for (const inj of oimW.injuries) {
          const solid = (inj.organ === 'liver' || inj.organ === 'spleen' || inj.organ === 'kidney' || inj.organ === 'retroperitoneal_bleed' || inj.organ === 'pelvic_bleed');
          const vessel = /vessel|carotid_jugular/.test(inj.organ);
          if (!(solid || vessel)) continue;
          if (!(inj.bleedRisk === 'high' || inj.bleedRisk === 'massive')) continue;
          if (inj.status === 'confirmed_limited') intRiskMul *= 1.18;        // §6.1: confirmed_limited만 조금 더
          else if (inj.status === 'likely') intRiskMul *= 1.10;
          else if (inj.status === 'suspected' && vessel) intRiskMul *= 1.05; // 혈관 의심은 소폭
        }
      }
      // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §8: confirmed_physiologic internal 가중 (중복 clamp — major/organ이면 상한 상향)
      let intCap = 1.35, physIntMul = 1.0;
      const pep = w.physiologicEffectProfile;
      if (pep) {
        physIntMul = 1 + (pep.internalBleedBoost || 0) + Math.max(0, (pep.majorVesselMul || 1) - 1) * 0.4;
        const hasMajorOrOrgan = (w.physiologicInjuries || []).some(i => i.confirmedLevel === 'confirmed_physiologic' && (i.type === 'major_vessel_injury' || i.type === 'solid_organ_injury'));
        if (hasMajorOrOrgan) intCap = ((pep.majorVesselMul || 1) > 1.5) ? 2.0 : 1.7;
      }
      effInt *= Math.min(intCap, intRiskMul * physIntMul);
    }
    // === CARDIAC-1R §8: 박동성 보정 — effective rate에 MAP/HR/pulsePressure/혈관수축 제한 반영 ===
    const _beforeExt = effExt, _beforeInt = effInt;
    const pulse = buildBleedingPulseModel(unit, w, bp, extMul);
    effExt *= pulse.extPulse;
    effInt *= pulse.intPulse;   // cavity는 MAP 영향만 — 현장처치로는 불변(extMul/effInt 분리), chestseal/abdominal 무관
    // FIELD-STAB-1 §10/§11: pelvic_binder / junctional_control → 해당 wound EXTERNAL bleed만 제한적 완화.
    //   internal cavity bleed(effInt)는 절대 줄이지 않는다 (source-of-truth / 후송·수술 필요).
    const _fsm = unit.medical.fieldStabilizationModel;
    if (_fsm) {
      if (_fsm.pelvicControl && _fsm.pelvicControl.active && _woundIsPelvicRegion(w)) effExt *= _fsm.pelvicControl.pelvicBleedModifier;
      if (_fsm.junctionalControl && _fsm.junctionalControl.active && _woundIsJunctionalRegion(w)) effExt *= (1 - _fsm.junctionalControl.pulseSuppression);
      // RESIDUAL HOTFIX 4: pelvic_binder → pelvic_internal의 pulse amplification만 매우 약하게(≤~8%) 완화.
      //   effInt 기저는 직접 줄이지 않음(내부출혈 source 유지) · definitiveCare/surgery/vascular markers 불변 · 출혈 제거 아님(악화만 약하게 늦춤).
      if (_fsm.pelvicControl && _fsm.pelvicControl.active && (w.internalBleedingCategory === 'pelvic_internal') && _woundIsPelvicRegion(w)) {
        const _ip = pulse.intPulse;
        if (_ip > 1.0) { effInt *= ((1 + (_ip - 1) * 0.92) / _ip); }   // 박동 증폭 초과분의 ~8%만 완화
      }
    }
    if (w.bleedingPulseModel) {
      w.bleedingPulseModel.effectiveExternalBeforeClamp = +_beforeExt.toFixed(3);
      w.bleedingPulseModel.effectiveInternalBeforeClamp = +_beforeInt.toFixed(3);
      w.bleedingPulseModel.effectiveExternalAfterClamp = +Math.max(0, effExt).toFixed(3);
      w.bleedingPulseModel.effectiveInternalAfterClamp = +Math.max(0, effInt).toFixed(3);
    }
    // SIDE-MED-2C §25: 체강 내부출혈(effInt)은 현장처치(hemostatic/packing/pressure/abdominal/chestseal)로 감소시키지 않는다 — source-of-truth/수술·후송 필요.
    //   (이전의 packed+cavity 내부 감소는 directive 위반이므로 제거)
    w._effExternal = +Math.max(0, effExt).toFixed(3);     // §2: UI 라벨이 최신 effective rate 참조
    w._effInternal = +Math.max(0, effInt).toFixed(3);
    w._extMul = +extMul.toFixed(3);
    partExt[pk] = (partExt[pk] || 0) + Math.max(0, effExt);
    partInt[pk] = (partInt[pk] || 0) + Math.max(0, effInt);
  }
  let totalExt = 0, totalInt = 0;
  for (const k of BODY_PART_KEYS) {
    const p = m.bodyParts[k];
    if (!p) continue;
    p.externalBleedRate = +(partExt[k] || 0).toFixed(3);
    p.internalBleedRate = +(partInt[k] || 0).toFixed(3);
    // legacy 호환 — bandage/tourniquet boolean 동기화
    const bpt = m.bodyPartTreatments[k];
    p.tourniquetApplied = !!(bpt && bpt.tourniquet);
    totalExt += p.externalBleedRate;
    totalInt += p.internalBleedRate;
  }
  if (isNaN(totalExt)) totalExt = 0; if (isNaN(totalInt)) totalInt = 0;
  m.externalBleedRate = Math.max(0, totalExt);
  m.internalBleedRate = Math.max(0, totalInt);
  const totalBleed = m.externalBleedRate + m.internalBleedRate;
  if (totalBleed > 0) m.bloodMl = Math.max(0, m.bloodMl - totalBleed * dt);
}
function _woundUrgency(w) {
  const bp = w.bleedingProfile || {};
  let s = 0;
  if (bp.bleedingType === 'cavity' || bp.bleedingType === 'junctional') s += 1000;
  const eff = (w._effExternal != null) ? w._effExternal : (bp.currentExternal || 0);
  if (eff > 18) s += 900;
  if (w.fieldCare && w.fieldCare.fieldCareClass === 'field_unmanageable') s += 800;
  if (w.woundSize && w.woundSize.sizeClass === 'massive') s += 400;
  if (w._tourniquetSuppressed && !(w.treatmentState && w.treatmentState.pressureBandaged)) s += 300;
  if (w.woundSize && w.woundSize.sizeClass === 'large') s += 200;
  if (w.woundSize && w.woundSize.sizeClass === 'medium') s += 100;
  const ts = w.treatmentState || {};
  const treated = ts.pressureBandaged || ts.packed || ts.hemostaticApplied || ts.stabilized;
  if (!treated && bp.bleedingType !== 'none') s += 60;
  if (w.woundType === 'bruise' || w.woundType === 'abrasion' || (w.woundSize && w.woundSize.sizeClass === 'micro')) s -= 50;
  s += eff;
  return s;
}
function getPartWounds(unit, partKey) {
  if (!unit.medical || !unit.medical.wounds) return [];
  return unit.medical.wounds.filter(w => w.partKey === partKey);
}
function _normalizeWoundAddressClusterKey(key, w) {
  if (!key) return (w && w.partKey) || 'na';
  const k = key.toString();
  const kl = k.toLowerCase();
  if (/thigh/.test(kl)) return 'thigh';
  if (/upperarm/.test(kl)) return 'upper_arm';
  if (/forearm/.test(kl)) return 'forearm';
  if (/lowerleg|shin|calf/.test(kl)) return 'lower_leg';
  if (/foot|ankle/.test(kl)) return 'foot_ankle';
  if (/hand|wrist|palm/.test(kl)) return 'hand_wrist';
  if (/axilla|shouldergap|armshouldergap/.test(kl)) return 'axilla_shoulder_gap';
  if (/groin|inguinal|femoraltriangle|femoral/.test(kl)) return 'groin_junctional';
  if (/lateralthorax|sidewrap|sideedge|lateralgap|flank/.test(kl)) return 'lateral_thorax';
  if (/neck|throat/.test(kl)) return 'neck';
  if (/face|jaw|cheek|eye|orbital|nasal|brow|mouth|nose/.test(kl)) return 'face';
  if (/knee/.test(kl)) return 'knee';
  if (/elbow/.test(kl)) return 'elbow';
  if (/shoulder/.test(kl)) return 'shoulder';
  if (/skull|cranial|temporal|parietal|occipital|frontal/.test(kl)) return 'skull';
  return k;
}
function _woundAddressClusterKey(w) {
  const ia = w.impactAddress || {};
  const raw = ia.limbLocation || ia.subZone || ia.softLocation || ia.edgeLocation || ia.exposedLocation || ia.coverageZone || ia.zone || ia.anatomicalZone || w.partKey || 'na';
  return _normalizeWoundAddressClusterKey(raw, w);
}
const _NORM_ADDR_KO = { thigh:'허벅지', upper_arm:'상완', forearm:'전완', lower_leg:'하퇴', foot_ankle:'발/발목', hand_wrist:'손/손목',
  lateral_thorax:'측흉부', axilla_shoulder_gap:'겨드랑이/어깨', groin_junctional:'서혜부', neck:'경부', face:'안면', knee:'무릎', shoulder:'어깨', elbow:'팔꿈치', skull:'두개부' };
function _addressClusterKeyLabel(key) {
  if (!key) return '';
  if (_NORM_ADDR_KO[key]) return _NORM_ADDR_KO[key];
  if (typeof IA_LABELS === 'undefined') return key;
  return (IA_LABELS.limbLocation && IA_LABELS.limbLocation[key]) || (IA_LABELS.softLocation && IA_LABELS.softLocation[key])
      || (IA_LABELS.edgeLocation && IA_LABELS.edgeLocation[key]) || (IA_LABELS.coverageZone && IA_LABELS.coverageZone[key])
      || (IA_LABELS.anatomicalZone && IA_LABELS.anatomicalZone[key]) || (IA_LABELS.exposedLocation && IA_LABELS.exposedLocation[key]) || key;
}
function getClusterWounds(med, partKey, clusterId) {
  if (!med || !med.wounds) return [];
  const cl = med.woundClusters && med.woundClusters[clusterId];
  if (!cl) return [];
  const set = new Set(cl.sourceWoundIds || []);
  return med.wounds.filter(w => w && set.has(w.id) && (!partKey || w.partKey === partKey));
}
function _clusterRepLabel(ws, cl) {
  if (cl && cl.type === 'shotgun_pattern') return `산탄 펠릿 군집 ×${ws.length}`;
  if (cl && cl.type === 'flechette_pattern') return `플레셰트 군집 ×${ws.length}`;
  const w0 = ws[0];
  const isMinor = (w0.woundType === 'abrasion' || w0.woundType === 'bruise' || w0.woundType === 'blunt_trauma');
  const kindLabel = (cl && cl.type === 'same_area_multi_hit' && !/frag|spall|debris/.test(w0.sourceType || '')) ? '동일부위 다발상'
                  : isMinor ? (WOUND_TYPE_LABEL_KO[w0.woundType] || '경상') : '파편상';
  let micro = 0, small = 0, medium = 0;
  for (const w of ws) { const s = (w.woundSize ? w.woundSize.sizeClass : 'small'); if (s === 'medium') medium++; else if (s === 'small') small++; else micro++; }
  const parts = [];
  if (medium) parts.push(`중형 ${medium}`);
  if (small) parts.push(`소형 ${small}`);
  if (micro) parts.push(`초소형 ${micro}`);
  return `${kindLabel} 군집 ×${ws.length}` + (parts.length ? ` (${parts.join('·')})` : '');
}
function _clusterBleedSummary(ws) {
  let bleedCount = 0, supp = 0, totalExt = 0, severe = 0;
  for (const w of ws) {
    const eff = (w._effExternal != null) ? w._effExternal : ((w.bleedingProfile || {}).currentExternal || 0);
    if (w._tourniquetSuppressed) supp++;
    if (eff > 0.5) { bleedCount++; totalExt += eff; }
    if (eff > 8) severe++;
  }
  let label;
  if (bleedCount === 0) label = '출혈 없음';
  else if (totalExt / Math.max(1, bleedCount) > 8) label = `출혈 중 ${bleedCount}건`;
  else label = `약한 출혈 ${bleedCount}건`;
  if (supp > 0) label += ' · 지혈대 억제 포함';
  return { label, bleedCount, totalExt: +totalExt.toFixed(2), severe };
}
function _clusterTreatSummary(ws) {
  let treated = 0;
  for (const w of ws) { const ts = w.treatmentState || {}; if (ts.pressureBandaged || ts.stabilized || ts.bandaged) treated++; }
  const elig = ws.filter(w => (w.treatmentProfile && w.treatmentProfile.pressureBandageEligible) && !((w.treatmentState || {}).pressureBandaged)).length;
  let label;
  if (treated === 0) label = elig > 0 ? '미처치 · 일괄 압박붕대 가능' : '미처치';
  else if (treated >= ws.length) label = '안정';
  else label = `일부 처치됨 (${treated}/${ws.length})` + (elig > 0 ? ' · 추가처치 필요' : '');
  return { label, treated, eligible: elig };
}
function _buildSingleRow(w) {
  w.uiLabels = buildWoundUiLabels(w);                  // §2: 최신화
  return { type:'single', woundId: w.id, wound: w, urgencyScore: _woundUrgency(w) };
}
function _buildClusterRow(clusterId, ws, cl) {
  const bs = _clusterBleedSummary(ws);
  const tr = _clusterTreatSummary(ws);
  // fieldCare 요약
  let fc = 'treatable';
  for (const w of ws) { if (((w.fieldCare || {}).fieldCareClass) === 'controllable') fc = 'controllable'; }
  // 클러스터 urgency = 최대 개별 urgency * 0.6 (개별 치명보다 아래)
  let maxU = 0; for (const w of ws) maxU = Math.max(maxU, _woundUrgency(w));
  const urgency = (bs.bleedCount > 0 ? 40 : 5) + Math.min(50, maxU * 0.3);
  // SIDE-FRAGMENT-WOUND-CLUSTER-ADDRESS-1: 크기 분포 + 최대 fragmentEnergyJ / equivalentDamage + 세부위치
  let micro = 0, small = 0, medium = 0, maxEnergy = 0, maxEqDmg = 0, maxSharp = 0; const _spMats = {};
  for (const w of ws) {
    const s = (w.woundSize ? w.woundSize.sizeClass : 'small');
    if (s === 'medium') medium++; else if (s === 'small') small++; else micro++;
    if (w.fragmentEnergyJ != null && w.fragmentEnergyJ > maxEnergy) maxEnergy = w.fragmentEnergyJ;
    if (w.equivalentDamage != null && w.equivalentDamage > maxEqDmg) maxEqDmg = w.equivalentDamage;
    if (w.fragmentSharpness != null && w.fragmentSharpness > maxSharp) maxSharp = w.fragmentSharpness;
    if (w.spallMaterialType) _spMats[w.spallMaterialType] = 1;
  }
  const addrKey = _woundAddressClusterKey(ws[0]);
  const addrLabel = _addressClusterKeyLabel(addrKey);
  const partLabel = (typeof BODY_PART_KOR !== 'undefined' && BODY_PART_KOR[_medicalPartToLegacy(ws[0].partKey)]) || _woundPartKo(ws[0].partKey);
  const locLabel = partLabel + (addrLabel && addrLabel !== partLabel && addrLabel !== addrKey ? ` ${addrLabel}` : '');
  const _tcs = (cl && cl.treatmentClusterState) || {};
  return {
    type:'cluster', groupId: clusterId, wounds: ws, count: ws.length,
    clusterType: (cl && cl.type) || 'same_area_multi_hit',
    clusterRef: cl || null,
    aggregateBleeding: (cl && cl.aggregateBleeding) || null,
    clusterSeverity: (cl && cl.clusterSeverity) || 'minor',
    maxVascularEvidenceLevel: (cl && cl.maxVascularEvidenceLevel) || 'none',
    hasFracture: !!(cl && cl.hasFracture), fractureTypes: (cl && cl.fractureTypes) || [],
    treatmentSurfaceCost: (cl && cl.treatmentSurfaceCost) || 1,
    recommendedBandageUnits: (cl && cl.recommendedBandageUnits) || 1,
    remainingBandageUnits: (cl && cl.remainingBandageUnits != null) ? cl.remainingBandageUnits : ((cl && cl.recommendedBandageUnits) || 1),
    hemostaticUnits: (cl && cl.hemostaticUnits) || 0,
    clusterTreatmentState: _tcs.derivedState || 'untreated',
    clusterReopened: !!_tcs.reopened,
    representativeLabel: _clusterRepLabel(ws, cl),
    representativeLocation: locLabel,
    addressClusterKey: addrKey, addressLabel: addrLabel,
    sizeBreakdown: { micro, small, medium },
    maxFragmentEnergyJ: maxEnergy > 0 ? +maxEnergy.toFixed(1) : null,
    maxEquivalentDamage: maxEqDmg > 0 ? +maxEqDmg.toFixed(1) : null,
    maxFragmentSharpness: maxSharp > 0 ? +maxSharp.toFixed(2) : null,
    spallMaterialTypes: Object.keys(_spMats),
    bleedingSummary: bs.label, totalExternal: bs.totalExt,
    treatmentSummary: tr.label, treatedCount: tr.treated, eligibleCount: tr.eligible,
    fieldCareSummary: FIELD_CARE_LABEL_KO[fc] || '현장처치 가능', fieldCareClass: fc,
    urgencyScore: urgency,
  };
}
function buildWoundDisplayRows(target, partKey) {
  const med = target && target.medical;
  const all = getPartWounds(target, partKey);
  const rows = [];
  const used = new Set();
  const clusters = (med && med.woundClusters) || {};
  for (const cid of Object.keys(clusters)) {
    const cl = clusters[cid];
    if (!cl || cl.partKey !== partKey) continue;
    const ws = getClusterWounds(med, partKey, cid);
    if (!ws.length) continue;
    const fragish = ws.every(w => /frag|spall|debris|blast_fragment/.test(w.sourceType || ''));
    const collapse = (cl.type === 'shotgun_pattern' || cl.type === 'flechette_pattern')
                  || (ws.length >= 2 && (cl.type === 'same_area_multi_hit' || cl.type === 'junctional_cluster' || fragish));
    if (!collapse) continue;
    for (const w of ws) used.add(w.id);
    rows.push(_buildClusterRow(cid, ws, cl));
  }
  for (const w of all) { if (!used.has(w.id)) rows.push(_buildSingleRow(w)); }
  rows.sort((a, b) => b.urgencyScore - a.urgencyScore);
  return rows;
}
function validateWoundUiProjection(target) {
  const errs = [];
  const med = target && target.medical; if (!med) return errs;
  for (const pk of Object.keys(med.bodyParts || {})) {
    const rows = buildWoundDisplayRows(target, pk);
    const seen = new Map();
    for (const r of rows) {
      if (r.type === 'cluster') {
        if (!(med.woundClusters && med.woundClusters[r.groupId])) errs.push({ k:'ui', msg:'가짜 cluster id: ' + r.groupId });
        if (med.woundClusters && med.woundClusters[r.groupId] && med.woundClusters[r.groupId].woundCount !== r.count) errs.push({ k:'ui', msg:'child 수 불일치: ' + r.groupId });
        for (const w of r.wounds) seen.set(w.id, (seen.get(w.id) || 0) + 1);
      } else seen.set(r.woundId, (seen.get(r.woundId) || 0) + 1);
    }
    const partWounds = getPartWounds(target, pk);
    for (const w of partWounds) {
      const n = seen.get(w.id) || 0;
      if (n !== 1) errs.push({ k:'ui', msg:`wound ${w.id} ${pk} 표현 ${n}회 (정확히 1회여야)` });
    }
  }
  return errs;
}
function recomputeBodyPartFunctionRatio(part, partDestruction) {
  if (!part) return 1;
  let ratio = (part.maxHp > 0) ? (part.hp / part.maxHp) : 0;
  ratio = Math.max(0, Math.min(1, ratio));
  if (part.fracture) {
    const ft = part.fractureType || 'simple';
    let fractureMul = 0.5;
    if (ft === 'hairline') fractureMul = 0.75;
    else if (ft === 'simple') fractureMul = 0.55;
    else if (ft === 'displaced') fractureMul = 0.40;
    else if (ft === 'comminuted') fractureMul = 0.28;
    else if (ft === 'shattered') fractureMul = 0.18;
    ratio *= fractureMul;
  }
  // PART-DESTRUCTION-1 Phase5 §9: 부위파괴 기능 상한 적용 (인자 우선, 없으면 part에 복사된 값 사용)
  const cap = (partDestruction && partDestruction.functionalCap != null) ? partDestruction.functionalCap
            : (part.destructionFunctionalCap != null ? part.destructionFunctionalCap : null);
  if (cap != null) ratio = Math.min(ratio, cap);
  const st = (partDestruction && partDestruction.state) || part.destructionState;
  // [B-STAGE 10.2] 최종 상태는 cap 이하로 강제하고 disabled 계약을 지킨다.
  if (st && PD_DISABLED_STATES.indexOf(st) >= 0) {
    const stCap = PART_DESTRUCTION_FUNCTIONAL_CAP[st];
    ratio = Math.min(ratio, stCap != null ? stCap : 0);
    part.disabled = true;
  } else if (st === 'mangled') ratio = Math.min(ratio, 0.20);
  else if (st === 'impaired') ratio = Math.min(ratio, 0.60);
  // HP 소진은 기능상실(구조적 파괴 라벨과 별개)
  if (part.hp <= 0) { ratio = 0; part.disabled = true; }
  part.functionRatio = +ratio.toFixed(3);
  return part.functionRatio;
}
function computeAcuteImpactResponse(ev, partKey, sourceType, bodyDmg, pelletAcute) {
  const dmg = Math.max(0, bodyDmg || 0);
  const penetrated = (ev.armorResult === 'penetrated');
  // 급성 강도 — 부위별 가중(놀람/동작중단), physiological과 무관.
  let stoppingIntensity = dmg * 0.5;
  if (partKey === 'chest' || partKey === 'abdomen') stoppingIntensity *= 1.4;
  else if (partKey === 'head' || partKey === 'neck') stoppingIntensity *= 1.3;
  if (sourceType === 'blast') stoppingIntensity += 8;
  const painImpulse = dmg * 1.0 + (penetrated ? 4 : 0);
  const suppressionImpulse = Math.min(30, dmg * 0.6 + (sourceType === 'blast' ? 10 : 0));
  const aimDisruption = Math.min(1.0, dmg * 0.02 + (penetrated ? 0.15 : 0.05));
  const fireInterruptChance = Math.min(0.95, 0.3 + dmg * 0.02);
  // stagger/knockdown — 큰 급성 충격 시 짧게 (생리학적 downed와 구분)
  const staggerIntensity = (dmg >= 25 || (penetrated && (partKey === 'chest' || partKey === 'head'))) ? Math.min(1.0, dmg * 0.02) : 0;
  const knockdownDuration = staggerIntensity > 0 ? Math.min(1.5, 0.4 + staggerIntensity * 0.8) : 0;
  // 산탄 펠릿 급성 보정 (physiological shock 아님 — stopping/pain load만)
  let sMul = 1.0, pMul = 1.0;
  if (pelletAcute && pelletAcute.isShotgunPellet) {
    sMul = (pelletAcute.shockMul != null) ? pelletAcute.shockMul : 1.0;
    pMul = (pelletAcute.painMul != null) ? pelletAcute.painMul : 1.0;
  }
  return {
    stoppingIntensity: +(stoppingIntensity * sMul).toFixed(2),
    stoppingDuration: +Math.min(1.2, 0.2 + stoppingIntensity * 0.02).toFixed(3),
    fireInterruptChance: +fireInterruptChance.toFixed(3),
    aimDisruption: +aimDisruption.toFixed(3),
    suppressionImpulse: +suppressionImpulse.toFixed(2),
    painImpulse: +(painImpulse * pMul).toFixed(2),
    staggerIntensity: +staggerIntensity.toFixed(3),
    knockdownDuration: +knockdownDuration.toFixed(3),
    postureDisruption: staggerIntensity > 0.4,
    transientNeurologicDisruption: (partKey === 'head' && penetrated) ? 40 : (partKey === 'neck' && penetrated ? 20 : 0),
    stressStimulus: +Math.min(1.0, dmg * 0.015 + (penetrated ? 0.2 : 0.05)).toFixed(3),
  };
}
function applyDamageEvent(unit, ev) {
  if (!unit || !unit.medical || unit.isDead) return;
  const m = unit.medical;
  ev = ev || {};
  const sourceType = ev.sourceType || 'bullet';
  const armorResultRaw = ev.armorResult || 'penetrated';   // 원본 (deflected/ricocheted 보존)
  let armorResult = armorResultRaw;
  // === 2A-1 일관성: deflected/ricocheted는 관통 아님 — 처리상으로는 stopped (둔상만)
  //   _lastDamageEvent에는 armorResultRaw를 별도 보존해 AAR/debug 일관성 유지
  if (armorResult === 'deflected' || armorResult === 'ricocheted') armorResult = 'stopped';
  const partKey = resolveBodyPartKey(ev.hitPart, ev.isLeft);
  const part = m.bodyParts[partKey];
  // SHOTGUN-PHYS-CLUSTER-1 Phase2 §4: 산탄 펠릿 즉시 생리 보정 (펠릿당 shock/pain/bodyDmg 과누적 방지)
  const _acuteAmmo = (ev.ammoId && typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[ev.ammoId] : null;
  const pelletAcute = getShotgunPelletAcutePhysiologyMeta(ev, _acuteAmmo);
  if (!part) return;

  // === 1) 부위 HP 감소 ===
  let bodyDmg = 0;
  if (armorResult === 'stopped') {
    // armor stopped — direct tissue damage 거의 없음, blunt trauma 위주
    const blunt = (ev.bluntTrauma != null) ? ev.bluntTrauma : Math.max(1, (ev.rawDamage || 0) * 0.10);
    bodyDmg = blunt * 0.5;
  } else if (armorResult === 'absorbed') {
    bodyDmg = (ev.bluntTrauma || 0) * 0.3;
  } else {
    // penetrated — tissueDamage 또는 rawDamage * tissueMul
    const tMul = (ev.ammoMedicalProfile && ev.ammoMedicalProfile.tissueDamageMul) || 1.0;
    bodyDmg = (ev.tissueDamage != null) ? ev.tissueDamage : (ev.rawDamage || 0) * tMul;
    // 사지는 부위 HP는 많이 깎이지만 생명 영향은 낮음
    if (partKey === 'leftArm' || partKey === 'rightArm' || partKey === 'leftLeg' || partKey === 'rightLeg') {
      bodyDmg *= 1.0;   // 그대로
    }
  }
  bodyDmg = Math.max(0, bodyDmg);
  if (pelletAcute.isShotgunPellet) bodyDmg *= pelletAcute.bodyDmgMul;   // 산탄 펠릿 즉시 조직손상 보정
  part.hp = Math.max(0, part.hp - bodyDmg);

  // === 2) 출혈 — external (사지/목/노출) vs internal (흉부/복부) ===
  let bleedAdded = 0;
  let internalBleedAdded = 0;
  // 2A-6.4 마감: 막힌 탄/막힌 파편(stopped 계열)은 관통상 출혈 생성 금지 (안전장치만 추가, 기존 frag 출혈은 유지).
  // SIDE-MED-BASELINE-1 §3/§4: 아래 bodyParts bleedRate 가산은 '피격 즉시 반응 / legacy fallback'이다.
  //   recordWoundFromDamageEvent로 wound가 생기면 다음 tick부터 wound.bleedingProfile이 source-of-truth가 되어
  //   updateMedicalBleedingWoundBased가 bodyParts 값을 '=' 대입으로 덮어쓴다(이중 적용 아님). wound 없을 때만 이 값이 지속된다.
  const _stoppedFamily = (armorResult === 'stopped' || armorResult === 'absorbed');
  if ((armorResult === 'penetrated' || sourceType === 'frag') && !_stoppedFamily) {
    // 부위별 외부/내부 출혈 분리
    const isLimbOrNeck = (partKey === 'leftArm' || partKey === 'rightArm'
                       || partKey === 'leftLeg' || partKey === 'rightLeg' || partKey === 'neck');
    const isTorso = (partKey === 'chest' || partKey === 'abdomen');
    // 출혈 등급 결정 — bleedRisk 우선, 없으면 rawDamage 기반
    let sev = 'light';
    const risk = ev.bleedRisk || 0;
    if (risk > 0.8 || bodyDmg > 30) sev = 'severe';
    else if (risk > 0.5 || bodyDmg > 18) sev = 'medium';
    else if (risk > 0.25 || bodyDmg > 8) sev = 'light';
    else sev = 'micro';
    const rate = bleedRateForSeverity(sev);
    if (isTorso) {
      // 흉부/복부 — 외부 30% / 내부 70%
      part.externalBleedRate += rate * 0.3;
      part.internalBleedRate += rate * 0.7;
      bleedAdded = rate * 0.3;
      internalBleedAdded = rate * 0.7;
    } else if (isLimbOrNeck) {
      part.externalBleedRate += rate;
      bleedAdded = rate;
    } else if (partKey === 'head') {
      // 머리 — 외부 60% / 내부 40%
      part.externalBleedRate += rate * 0.6;
      part.internalBleedRate += rate * 0.4;
      bleedAdded = rate * 0.6;
      internalBleedAdded = rate * 0.4;
    }
  } else if (sourceType === 'blast') {
    // 폭압 — 내부 손상 위주
    if (partKey === 'chest' || partKey === 'abdomen' || partKey === 'head') {
      part.internalBleedRate += 3.0;
      internalBleedAdded = 3.0;
    }
  }

  // === 3) Pain ===
  const painAdd = (ev.painAmount != null) ? ev.painAmount : (bodyDmg * 1.2 + (armorResult === 'stopped' ? 5 : 0));
  const painAddEff = pelletAcute.isShotgunPellet ? painAdd * pelletAcute.painMul : painAdd;
  part.pain += painAddEff * 0.6;
  m.pain = Math.min(100, m.pain + painAddEff);

  // === 4) Acute Impact Response (급성 피격반응) — [IMPACT-A Phase2] ===
  //   피격 직후의 놀람/동작중단/자세붕괴/신경학적 충격은 physiological shock와 분리한다.
  //   medical.shock / bloodMl / BP / perfusion / oxygen / compensation을 직접 건드리지 않는다.
  //   physiological shock는 오직 시간경과 출혈·저관류(updatePainShockConsciousness)에서만 상승한다.
  const acute = computeAcuteImpactResponse(ev, partKey, sourceType, bodyDmg, pelletAcute);
  m._acuteResponse = acute;   // 추적 가능한 단일 급성반응 결과
  // [0.39.1 Fix1] acute response를 실제 전투상태에 연결 (source-of-truth). medical.shock는 여전히 미조작.
  //   중복 방지: 이 유닛은 legacy applyStopping 블록을 건너뛴다(_acuteHandledThisHit 플래그).
  {
    // stoppingDuration → stoppingTimer
    if (acute.stoppingDuration > 0) unit.stoppingTimer = Math.max(unit.stoppingTimer || 0, acute.stoppingDuration);
    // aimDisruption → aimTimer 감소 (조준 방해)
    if (acute.aimDisruption > 0) unit.aimTimer = Math.max(0, (unit.aimTimer || 0) - acute.aimDisruption * 0.6);
    // suppressionImpulse → suppression
    if (acute.suppressionImpulse > 0) unit.suppression = Math.min(100, (unit.suppression || 0) + acute.suppressionImpulse);
    // fireInterruptChance → shotQueue 중단 (진행 중 사격 묶음)
    if (unit.shotQueue && acute.fireInterruptChance > 0 && Math.random() < acute.fireInterruptChance) {
      unit.shotQueue = null;
      unit._lastStoppedFire = true;
    }
    // [0.39.2 Fix1] postureDisruption/knockdownDuration → unit.impactKnockdownTimer (단일 source-of-truth).
    //   실제 자세·이동·사격 게이트에서 소비된다(canFire/movement/stance). stoppingTimer와 중복 적용 안 함.
    if (acute.postureDisruption && acute.knockdownDuration > 0) {
      unit.impactKnockdownTimer = Math.max(unit.impactKnockdownTimer || 0, acute.knockdownDuration);
      unit._knockdownStanceApplied = false;   // tick에서 강제 prone 진입 처리
    }
    unit._acuteHandledThisHit = true;   // applyOutcome legacy stopping 중복 방지
  }
  // 급성 → knockdown alias 유지 (compatibility만; unit.impactKnockdownTimer가 실제 source-of-truth)
  m.impactKnockdownTimer = unit.impactKnockdownTimer || 0;
  // 산탄 cluster governor용 급성 부하 (physiological shock 아님)
  if (pelletAcute.isShotgunPellet) {
    m._acuteResponseLoad = (m._acuteResponseLoad || 0) + acute.stoppingIntensity;
  }

  // MO3: no generic chest/lung respiratory penalty. Preserve the unrelated head-blast response.
  if (sourceType === 'blast' && partKey === 'head') m.breathingEfficiency = Math.max(30, m.breathingEfficiency - 15);

  // === 6) Consciousness — head/neck 직접 신경학적 손상 (medical.shock 경유 금지) ===
  //   [IMPACT-A Phase2] 실제 관통 + head/neck 구조 손상 근거가 있을 때만 즉각 의식저하(transientNeurologicDisruption).
  //   generic torso shock 공식을 head/neck에 적용하지 않는다. 즉사·영구 의식상실은 기존 치명 손상 근거 유지.
  if (partKey === 'head' && armorResult === 'penetrated') {
    m.consciousness = Math.max(0, m.consciousness - 40);
    m.transientNeurologicDisruption = Math.max(m.transientNeurologicDisruption || 0, 40);
    if (part.hp <= 0) {
      m.consciousness = 0;
      m.deathReason = 'head_critical';
    }
  } else if (partKey === 'neck' && armorResult === 'penetrated') {
    m.consciousness = Math.max(20, m.consciousness - 20);
    m.transientNeurologicDisruption = Math.max(m.transientNeurologicDisruption || 0, 20);
  }
  // (기존의 "m.shock>80 → consciousness" 즉시감소 제거 — 의식은 physiological 경로(updatePainShockConsciousness)에서 처리)

  // === 7) Fracture / functionRatio ===
  //   복부(abdomen)는 골격이 없는 연부조직이므로 골절 발생 X — 내부장기 손상은 internalBleedRate로 표현
  //   ORGANIC-BLEED-CLEANUP-1 §1: medical wound 생성 유닛은 buildFractureEvidence()가 fracture source-of-truth.
  //     legacy 랜덤 판정은 wound descriptor 비활성/실패 fallback으로만 실행 (중복 방지).
  const canFracture = (partKey !== 'abdomen');
  const _useLegacyFracture = (ev.disableWoundDescriptor === true) || (ev._woundDescriptorFailed === true);
  if (_useLegacyFracture) {
    if (canFracture && armorResult === 'penetrated' && bodyDmg > 15) {
      if (Math.random() < 0.3) part.fracture = true;
    } else if (canFracture && sourceType === 'blast' && bodyDmg > 8) {
      if (Math.random() < 0.4) part.fracture = true;
    }
  }
  // functionRatio = hp/maxHp + fracture penalty (FRACTURE-FUNC-SYNC-1: 골절 타입별 helper)
  recomputeBodyPartFunctionRatio(part);

  // === 8) 디버그 로그 ===
  m._lastDamageEvent = {
    sourceType, partKey, hitPart: ev.hitPart,
    armorResult,          // 처리용 (stopped/penetrated/absorbed)
    armorResultRaw,       // 원본 (deflected/ricocheted 보존 — AAR/debug 일관성)
    rawDamage: ev.rawDamage, bodyDmg, bleedAdded, internalBleedAdded,
    painAdd, shockAdd: 0, acuteResponseLoad: (acute ? acute.stoppingIntensity : 0), stoppingLoad: (acute ? acute.stoppingIntensity : 0), painLoad: (acute ? acute.painImpulse : 0), partHpAfter: part.hp,
    impactAddress: ev.impactAddress || null,
    // SIDE-HIT-ADDRESS-DEBUG-1A §1-A: 피격주소 감쇠 추적 필드 복사 (debug/AAR/의료 UI)
    hitAddressDamageProfile: ev.hitAddressDamageProfile || (ev.impactAddress && ev.impactAddress.hitAddressDamageProfile) || null,
    hitAddressDamageMul: (ev.hitAddressDamageMul != null) ? ev.hitAddressDamageMul : null,
    hitAddressWoundMul: (ev.hitAddressWoundMul != null) ? ev.hitAddressWoundMul : null,
    hitAddressPhysiologyMul: (ev.hitAddressPhysiologyMul != null) ? ev.hitAddressPhysiologyMul : null,
    originalRawDamage: (ev.originalRawDamage != null) ? ev.originalRawDamage : null,
    effectiveRawDamage: (ev.effectiveRawDamage != null) ? ev.effectiveRawDamage : null,
    // SIDE-FRAGMENT-MASS-ENERGY-BRIDGE-1: 파편 에너지 추적
    fragmentMassG: (ev.fragmentMassG != null) ? ev.fragmentMassG : null,
    fragmentVelocityMps: (ev.fragmentVelocityMps != null) ? ev.fragmentVelocityMps : null,
    fragmentEnergyJ: (ev.fragmentEnergyJ != null) ? ev.fragmentEnergyJ : null,
    fragmentEnergyClass: (ev.fragmentEnergyClass != null) ? ev.fragmentEnergyClass : null,
    fragmentEnergyMeta: ev.fragmentEnergyMeta || null,
    // SIDE-ARMOR-2C §5: coverage 추적
    armorHitResult: ev.armorHitResult || null,
    impactAddressFull: (ev.impactAddress && ev.impactAddress.fullAddress) || null,
    selectedLayerType: ev.selectedLayerType || (ev.armorHitResult && ev.armorHitResult.selectedLayerType) || null,
    coverageSource: ev.coverageSource || (ev.armorHitResult && ev.armorHitResult.coverageSource) || null,
    durabilityOwnerId: ev.durabilityOwnerId || (ev.armorHitResult && ev.armorHitResult.durabilityOwnerId) || null,
    fallbackUsed: (ev.armorHitResult && ev.armorHitResult.fallbackUsed) || false,
    time: GAME.gameTime || 0,
  };
  if (GAME.debugBallistic) {
    console.log('[DamageEvent]', m._lastDamageEvent);
  }

  // === 2B-0: woundDescriptor 생성/기록 (상처 단위 레이어) ===
  m._currentEventWound = null;   // HOTFIX-2 §1: 이번 피격에서 생성된 wound만 추적
  try {
    ev.partKey = partKey;
    ev.anatomicalZone = ev.anatomicalZone || (ev.impactAddress && (ev.impactAddress.anatomicalZone || ev.impactAddress.coverageZone)) || null;
    ev._fracture = !!part.fracture;
    ev.wasPenetrated = (armorResult === 'penetrated');
    // SHOTGUN-PHYS-CLUSTER-1 Phase3 §6: 즉시 생리값을 wound 생성 전에 기록 (buildWoundDescriptor가 복사)
    ev._immediatePhysiology = {
      bodyDmg, painAdd: painAddEff, shockAdd: 0,   // [IMPACT-A Phase2] deprecated — 산탄 governor는 physiological shock 미조작
      acuteResponseLoad: (acute ? acute.stoppingIntensity : 0), painLoad: (acute ? acute.painImpulse : 0), stoppingLoad: (acute ? acute.stoppingIntensity : 0),
      partKey, hitPart: ev.hitPart,
      pelletGroupId: ev.pelletGroupId || null, shotgunPellet: !!ev.shotgunPellet, ammoId: ev.ammoId || null,
    };
    const w = recordWoundFromDamageEvent(unit, ev);
    if (w) { m._lastWound = w; m._currentEventWound = w; }
  } catch (e) { if (GAME.debugBallistic) console.warn('[wound] 생성 실패:', e && e.message); }

  // === 9) summary 즉시 갱신 + legacy sync ===
  // 1.5단계 — stressResponse 즉시 자극 (injuryDrive 트리거)
  if (m.stressResponse) {
    m.stressResponse.timeSinceLastDamage = 0;
    m.stressResponse.timeSinceLastThreat = 0;
    // 부상 자극 — 큰 피해/관통/심부위는 더 강한 자극
    const partImpact = (partKey === 'head' || partKey === 'chest' || partKey === 'neck') ? 1.5 : 1.0;
    const dmgImpact = Math.min(1, bodyDmg / 25);
    const penImpact = (armorResult === 'penetrated') ? 1.0 : 0.4;
    let stim = dmgImpact * penImpact * partImpact;
    if (pelletAcute.isShotgunPellet) stim *= pelletAcute.stressMul;   // 산탄 펠릿 즉시 stress 자극 보정
    m.stressResponse.injuryDrive = Math.min(1, m.stressResponse.injuryDrive + stim * 0.5);
    // 큰 피해는 즉시 adrenaline spike
    if (stim > 0.4) {
      m.stressResponse.adrenaline = Math.min(1, m.stressResponse.adrenaline + stim * 0.3);
      m.stressResponse.combatArousal = Math.min(1, m.stressResponse.combatArousal + stim * 0.4);
    }
  }
  recalcMedicalSummary(unit);
  syncLegacyCombatState(unit);
}
function tickMedical(unit, dt) {
  if (!unit.medical || unit.isDead) return;
  ensureMedicalExtensions(unit);
  // [IMPACT-A Phase2] 급성 반응 타이머 자연 감쇠 (physiological과 독립)
  const _m = unit.medical;
  // [0.39.2 Fix1] impactKnockdownTimer 감소는 unit tick(updateUnit)이 소유 — 여기선 감소하지 않음(이중 감소 방지). alias만 동기화됨.
  if (_m.transientNeurologicDisruption > 0) _m.transientNeurologicDisruption = Math.max(0, _m.transientNeurologicDisruption - 30 * dt);
  if (_m._acuteResponseLoad > 0) _m._acuteResponseLoad = Math.max(0, _m._acuteResponseLoad - 40 * dt);
  // 단계별 — 순서 중요 (출혈 → 저혈량 → stress → hormonal → hemodynamics → vitals → pain/shock/conscious → multipliers)
  updateMedicalBleeding(unit, dt);
              // SIDE-MED-2C §26: 흉부 외상/기흉 진행 (호흡 효율 영향)
  updateSystemicHypoxiaDamage(unit, dt);
  updateStressResponse(unit, dt);
  updateHormonalCompensation(unit, dt);
  updateHemodynamics(unit, dt);
  updateVitalsFromHemodynamics(unit, dt);
  updatePainShockConsciousness(unit, dt);
  updateMedicalPerformanceMultipliers(unit, dt);
  buildTcccAssessment(unit);   // SIDE-MED-2C §4: care phase / MARCH / airway·exposure hook 갱신
  buildPreCardiacRisk(unit);   // PRECARDIAC-1 §10: 다음 cardiac 단계 입력 flag (rhythm/사망 판정에 미사용)
  buildCardiacRhythmModel(unit, dt);   // CARDIAC-1R §10: 리듬 후보 상태 (preCardiacRisk 이후 — 최신 입력)
  updateFieldStabilization(unit, dt);  // FIELD-STAB-1 §8~§12,§18: 원인 완화 action candidate/degradation/modifier
  buildEvacuationModel(unit);          // FIELD-STAB-1 §13: 후송 우선순위/definitive care 표시 (직접 치료효과 없음)
  // 9) lifeStatus 종합
  recalcMedicalSummary(unit);
  syncLegacyCombatState(unit);
}
function getTcccCarePhase(unit, treater, tacticalCtx) {
  const supp = (unit.suppression || 0);
  const underFire = (tacticalCtx && tacticalCtx.underFire) || supp > 45 || !!(unit._recentIncomingFire && (GAME.gameTime || 0) - unit._recentIncomingFire < 5);
  if (underFire) return 'under_fire';
  const m = unit.medical;
  let urgent = false;
  if (m && m.wounds) for (const w of m.wounds) {
    if ((w.internalBleedingModel && (w.internalBleedingModel.evacuationPriority === 'high' || w.internalBleedingModel.evacuationPriority === 'urgent'))
      || (w.organInjuryModel && w.organInjuryModel.surgeryRequiredCandidate)) { urgent = true; break; }
  }
  if (urgent) return 'evacuation_pending';
  return 'tactical_field_care';
}
function _woundIsPelvicRegion(w) {
  // SIDE-MEDICAL-ORGAN-BLEEDING-HOTFIX-1 §3: 새 normalizedMedicalAddress / internalBleedingCategory / treatmentIndicationTags 우선.
  const med = w.normalizedMedicalAddress || (w.bodyTrajectory && w.bodyTrajectory.normalizedMedicalAddress) || null;
  const tags = w.treatmentIndicationTags || [];
  const prob = w.probableInjuries || [];
  const cands = (w.candidateInjuries || []).concat((w.candidateMap || []).map(c => (c && c.id) || ''));
  if (w.internalBleedingCategory === 'pelvic_internal') return true;
  if (tags.indexOf('pelvicInternalBleed') >= 0 || tags.indexOf('pelvicControlCandidate') >= 0) return true;
  if (med && (med.medicalZone === 'pelvis_upper' || med.cavityRegion === 'pelvic' || med.vascularRegion === 'iliac')) return true;
  if (prob.indexOf('iliac_vessel_injury_probable') >= 0 || prob.indexOf('pelvic_bleeding_probable') >= 0) return true;
  if (cands.some(id => id === 'pelvic_bleed_candidate' || id === 'iliac_vessel_candidate' || id === 'pelvic_bone_candidate')) return true;
  // fallback: legacy organInjuryModel / bleedingProfile (새 주소 조건이 없을 때만 — abdomen cavity만으로 과판정 금지)
  const pk = w.partKey || '';
  if (pk === 'abdomen' || pk === 'leftLeg' || pk === 'rightLeg') {
    const oim = w.organInjuryModel;
    if (oim && oim.injuries) for (const inj of oim.injuries) {
      if (/pelvic|retroperitoneal|femoral|iliac/.test(inj.organ)) return true;
    }
  }
  return false;
}
function _woundIsJunctionalRegion(w) {
  // SIDE-MEDICAL-ORGAN-BLEEDING-HOTFIX-1 §4: 새 주소/분류/태그 우선. femoral_triangle/groin_junctional/axilla/supraclavicular를 놓치지 않음.
  const med = w.normalizedMedicalAddress || (w.bodyTrajectory && w.bodyTrajectory.normalizedMedicalAddress) || null;
  const tags = w.treatmentIndicationTags || [];
  const prob = w.probableInjuries || [];
  if (w.internalBleedingCategory === 'junctional_limited_control') return true;
  if (tags.indexOf('junctionalHemorrhage') >= 0 || tags.indexOf('junctionalControlCandidate') >= 0 || tags.indexOf('probableMajorVesselInjury') >= 0) return true;
  if (med) {
    const mz = med.medicalZone || '';
    if (mz === 'groin' || mz === 'groin_junctional' || mz === 'femoral_triangle' || mz === 'axilla' || mz === 'supraclavicular') return true;
    if (med.junctionalBleedRisk === true || med.majorVesselRiskHint === true) return true;
    const vr = med.vascularRegion || '';
    if (vr === 'femoral' || vr === 'femoral_iliac' || vr === 'iliac' || vr === 'axillary_subclavian' || vr === 'subclavian') return true;
  }
  if (prob.some(id => id === 'femoral_vessel_injury_probable' || id === 'iliac_vessel_injury_probable' || id === 'axillary_vessel_injury_probable' || id === 'subclavian_vessel_injury_probable' || id === 'junctional_hemorrhage_probable')) return true;
  // fallback: legacy bleedingProfile / bleedingPulseModel
  const pk = w.partKey || '';
  if (pk === 'neck' || pk === 'leftArm' || pk === 'rightArm' || pk === 'leftLeg' || pk === 'rightLeg' || pk === 'abdomen') {
    const bp = w.bleedingProfile || {};
    if (bp.bleedingType === 'junctional') return true;
    const bpm = w.bleedingPulseModel;
    if (bpm && bpm.tags && (bpm.tags.indexOf('arterial_pulse') >= 0 || bpm.tags.indexOf('junctional_pulse') >= 0)) return true;
  }
  return false;
}
function updateFieldStabilization(unit, dt) {
  const m = unit.medical; if (!m) return;
  const fs = ensureFieldStabilizationModel(unit);
  const hd = m.hemodynamics || {};
  const pcr = m.preCardiacRisk || {};
  const sr = m.stressResponse || {};
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  fs.lastUpdateTime = now;
  const o2 = (hd.oxygenDelivery != null) ? hd.oxygenDelivery : 1.0;
  const moving = !!(unit.isMoving || (unit.movePath && unit.movePath.length) || unit.beingDragged);
  const severeHypo = (hd.hypovolemiaSeverity === 'severe' || hd.hypovolemiaSeverity === 'critical');

  // ---- AIRWAY ----
  const aw = fs.airwaySupport;
  aw.candidate = (m.consciousness < 60 || m.breathingEfficiency < 75 || o2 < 0.7) && !unit.isDead;
  aw.obstructionRisk = clamp01((60 - m.consciousness) / 60 * 0.6 + (sr.panic || 0) * 0.3);
  if (aw.active) {
    // recurrence: unconscious 악화/이동 시 위험 증가
    aw.recurrenceRisk = clamp01(aw.recurrenceRisk + (moving ? 0.04 : -0.02) * dt + (m.consciousness < 25 ? 0.03 : 0) * dt);
    if (aw.recurrenceRisk > 0.85) { aw.active = false; aw.failureReason = 'airway_lost_recurrence'; }
    // 효과 강도 — quality 기반, 단 severe chest/blood loss면 제한
    let eff = aw.quality;
    if (severeHypo) eff *= 0.6;
    aw.effectStrength = clampMed(eff * (1 - aw.recurrenceRisk * 0.5), 0, 0.95);
    aw.oxygenDeliveryModifier = 1.0 + aw.effectStrength * 0.08;   // 최대 ~1.076 (제한적)
    aw.artifactReduction = aw.effectStrength * 0.12;
    aw.breathingDisciplineSupport = aw.effectStrength * 0.1;
    aw.tags = ['airway_active']; if (severeHypo) aw.tags.push('limited_hypovolemia');
  } else { aw.oxygenDeliveryModifier = 1.0; aw.artifactReduction = 0; aw.breathingDisciplineSupport = 0; aw.effectStrength = 0; }

  // ---- PELVIC / JUNCTIONAL (wound 기반) ----
  let pelvicCand = false, junctionalCand = false;
  if (m.wounds) for (const w of m.wounds) {
    if (_woundIsPelvicRegion(w)) pelvicCand = true;
    if (_woundIsJunctionalRegion(w)) junctionalCand = true;
  }
  const pc = fs.pelvicControl;
  pc.candidate = pelvicCand && !unit.isDead;
  if (pc.active) {
    pc.recurrenceRisk = clamp01(pc.recurrenceRisk + (moving ? 0.04 : -0.01) * dt);
    const eff = clampMed(pc.quality * (1 - pc.recurrenceRisk * 0.4), 0, 0.95);
    pc.effectStrength = eff;
    pc.pelvicBleedModifier = clampMed(1.0 - eff * 0.15, 0.85, 1.0);   // 0.85~1.0 제한적 (cavity 완전제어 금지)
    pc.mobilityPenalty = 0.2;
    pc.evacuationPriorityBoost = 1;
    pc.tags = ['pelvic_binder_active', 'cavity_uncontrolled'];
  } else { pc.pelvicBleedModifier = 1.0; pc.mobilityPenalty = 0; pc.evacuationPriorityBoost = 0; pc.effectStrength = 0; }

  const jc = fs.junctionalControl;
  jc.candidate = junctionalCand && !unit.isDead;
  if (jc.active) {
    jc.recurrenceRisk = clamp01(jc.recurrenceRisk + (moving ? 0.06 : -0.01) * dt);
    const eff = clampMed(jc.quality * (1 - jc.recurrenceRisk * 0.5), 0, 0.95);
    jc.effectStrength = eff;
    jc.pulseSuppression = eff * 0.4;                       // bleedingPulse extPulse 억제 (최대 ~0.38)
    jc.tags = ['junctional_control_active']; if (jc.recurrenceRisk > 0.5) jc.tags.push('recurrence_if_moved');
  } else { jc.pulseSuppression = 0; jc.effectStrength = 0; }

  // ---- CIRCULATION SUPPORT (field limited placeholder) ----
  const cs = fs.circulationSupport;
  cs.candidate = (severeHypo || hd.poorPerfusion || (hd.map != null && hd.map < 65)) && !unit.isDead;
  cs.transfusionRequired = (hd.hypovolemiaSeverity === 'critical' || m.bloodMl < 2200);
  cs.definitiveCareRequired = cs.transfusionRequired;
  if (cs.active) {
    // uncontrolled bleeding이면 효과가 빠르게 사라짐
    const uncontrolled = (m.internalBleedRate > 4) || (m.externalBleedRate > 8);
    cs.effectStrength = clampMed((cs.fieldLimited ? 0.4 : 0.7) * cs.quality * (uncontrolled ? 0.4 : 1.0), 0, 0.8);
    cs.mapSupportModifier = 1.0 + cs.effectStrength * 0.06;        // 매우 제한적
    cs.perfusionSupportModifier = 1.0 + cs.effectStrength * 0.05;
    cs.tags = ['circulation_field_limited']; if (uncontrolled) cs.tags.push('uncontrolled_bleeding_limits'); if (cs.transfusionRequired) cs.tags.push('transfusion_required');
  } else { cs.mapSupportModifier = 1.0; cs.perfusionSupportModifier = 1.0; cs.effectStrength = 0; }
}
function buildEvacuationModel(unit) {
  const m = unit.medical; if (!m) return null;
  const hd = m.hemodynamics || {};
  const pcr = m.preCardiacRisk || {};
  const crm = m.cardiacRhythmModel || {};
  const fs = m.fieldStabilizationModel || {};
  const tags = [];
  let surgeryRequired = false, transfusionRequired = false, airwayAdvancedRequired = false, vascularControlRequired = false;
  // 원인 수집
  if (m.internalBleedRate > 3) { tags.push('uncontrolled_internal_bleeding'); surgeryRequired = true; }
  if (hd.hypovolemiaSeverity === 'severe' || hd.hypovolemiaSeverity === 'critical') { tags.push('severe_hypovolemia'); transfusionRequired = true; }
  if ((hd.oxygenDelivery != null && hd.oxygenDelivery < 0.5)) { tags.push('low_oxygen_delivery'); }
  if (pcr.thoracicVesselRisk) { tags.push('thoracic_vessel_risk'); vascularControlRequired = true; surgeryRequired = true; }
  if (fs.pelvicControl && fs.pelvicControl.candidate) { tags.push('pelvic_bleeding_candidate'); }
  if (pcr.heartAdjacentTrack) { tags.push('heart_adjacent_track'); }
  if (crm.rhythmClass === 'unstable' || crm.rhythmClass === 'peri_arrest_candidate' || crm.rhythmClass === 'arrest_candidate') { tags.push('unstable_rhythm_candidate'); }
  if (m.consciousness < 25) { tags.push('airway_at_risk'); airwayAdvancedRequired = true; }
  // SIDE-MEDICAL-ORGAN-BLEEDING-HOTFIX-1 §6: wound별 수술/수혈/혈관통제/내부출혈 표식을 전신 후송 판단에 반영 (표식만 — 실제 회복 로직 없음)
  let confirmedPresent = false, probableSerious = false, woundFieldUncontrollable = false;
  if (Array.isArray(m.wounds)) for (const w of m.wounds) {
    if (!w) continue;
    if (w.surgeryRequiredCandidate) { surgeryRequired = true; if (tags.indexOf('wound_surgery_candidate') < 0) tags.push('wound_surgery_candidate'); }
    if (w.transfusionRequiredCandidate) { transfusionRequired = true; if (tags.indexOf('wound_transfusion_candidate') < 0) tags.push('wound_transfusion_candidate'); }
    if (w.vascularControlRequiredCandidate) { vascularControlRequired = true; surgeryRequired = true; if (tags.indexOf('vascular_control_required') < 0) tags.push('vascular_control_required'); }
    const cat = w.internalBleedingCategory;
    if (cat === 'thoracic_internal' || cat === 'abdominal_internal' || cat === 'retroperitoneal_internal' || cat === 'pelvic_internal') { surgeryRequired = true; if (tags.indexOf(cat) < 0) tags.push(cat); }
    if (cat === 'junctional_limited_control') { vascularControlRequired = true; if (tags.indexOf('junctional_limited_control') < 0) tags.push('junctional_limited_control'); }
    const fc = w.fieldControllability;
    if (fc === 'uncontrollable_field' || fc === 'chest_limited' || fc === 'pelvic_binder_partial') { woundFieldUncontrollable = true; if (tags.indexOf('field_uncontrollable') < 0) tags.push('field_uncontrollable'); }
    if ((w.confirmedInjuries && w.confirmedInjuries.length) || (w.confirmedInjuryModel && w.confirmedInjuryModel.confirmed && w.confirmedInjuryModel.confirmed.length)) confirmedPresent = true;
    const prob = (w.probableInjuries && w.probableInjuries.length ? w.probableInjuries : (w.confirmedInjuryModel && w.confirmedInjuryModel.probable) || []);
    if (prob.some(i => /vessel|organ|pelvic|retroperitoneal/.test(i))) probableSerious = true;
  }
  if (confirmedPresent && tags.indexOf('confirmed_injury_present') < 0) tags.push('confirmed_injury_present');
  if (probableSerious && tags.indexOf('probable_serious_injury') < 0) tags.push('probable_serious_injury');
  if (transfusionRequired) tags.push('transfusion_required');
  if (surgeryRequired) tags.push('surgery_required');
  // priority 산정
  let priority = 'none';
  const crit = (hd.hypovolemiaSeverity === 'critical') || (hd.oxygenDelivery != null && hd.oxygenDelivery < 0.4) || crm.rhythmClass === 'arrest_candidate' || crm.rhythmClass === 'peri_arrest_candidate';
  const urgent = (hd.hypovolemiaSeverity === 'severe') || m.internalBleedRate > 3 || pcr.thoracicVesselRisk || crm.rhythmClass === 'unstable';
  if (crit) priority = 'immediate';
  else if (urgent) priority = 'urgent';
  else if (tags.length > 0) priority = 'priority';
  else if (m.lifeStatus < 70 || (m.externalBleedRate + m.internalBleedRate) > 1) priority = 'monitor';
  const definitiveCareRequired = (surgeryRequired || transfusionRequired || vascularControlRequired || airwayAdvancedRequired || woundFieldUncontrollable);
  const prevPriority = (m.evacuationModel && m.evacuationModel.evacuationPriority) || 'none';
  m.evacuationModel = {
    evacuationPriority: priority, definitiveCareRequired, surgeryRequired, transfusionRequired,
    airwayAdvancedRequired, vascularControlRequired, reasonTags: tags,
    lastUpdated: (typeof GAME !== 'undefined' && GAME.gameTime) || 0,
  };
  if (fs) { fs.evacuationPriority = priority; fs.definitiveCareRequired = definitiveCareRequired; }
  // HOTFIX: 우선순위 상승 시 1회만 로그 (high-water latch — 임계값 근처 진동으로 매 tick 반복되지 않게)
  const order = { none:0, monitor:1, priority:2, urgent:3, immediate:4 };
  const hw = m._evacLoggedPriority || 0;
  if (order[priority] > hw && order[priority] >= 3 && typeof log === 'function') {
    log(`[${unit.name}] 후송 우선순위: ${priority === 'immediate' ? '최우선' : '긴급'} — ${tags.slice(0, 2).join(', ')} (현장처치 한계)`, 'warn');
    m._evacLoggedPriority = order[priority];
  }
  return m.evacuationModel;
}
function buildCardiacRhythmModel(unit, dt) {
  const m = unit.medical; if (!m) return null;
  const hd = m.hemodynamics || {};
  const sr = m.stressResponse || {};
  const pcr = m.preCardiacRisk || {};
  const prev = m.cardiacRhythmModel || null;
  const cp = getUnitComposureProfile(unit);
  const HR = m.heartRate || 75;
  const MAP = (hd.map != null) ? hd.map : 75;
  const PP = (hd.pulsePressure != null) ? hd.pulsePressure : 40;
  const perf = (hd.tissuePerfusion != null) ? hd.tissuePerfusion : 1.0;
  const o2 = (hd.oxygenDelivery != null) ? hd.oxygenDelivery : 1.0;
  const hypo = hd.hypovolemiaSeverity || 'none';
  const exh = hd.compensationExhaustion || 0;
  const cons = m.consciousness != null ? m.consciousness : 100;
  const shock = m.shock || 0;
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;

  // === §12 riskScore 합성 (0~1) ===
  let raw = 0;
  if (hypo === 'severe') raw += 0.18; else if (hypo === 'critical') raw += 0.34;
  raw += clamp01(0.6 - perf) * 0.50;
  raw += clamp01(0.6 - o2) * 0.62;
  if (MAP < 50) raw += 0.18; else if (MAP < 65) raw += 0.08;
  if (PP < 20) raw += 0.10;
  if (hd.decompensatingShock) raw += 0.15;
  raw += exh * 0.12;
  if (hd.preArrestRisk) raw += 0.18;
  if (pcr.arrestRiskHint) raw += 0.12;
  if (pcr.thoracicVesselRisk) raw += 0.08;
  if (pcr.heartAdjacentTrack) raw += 0.10;
  // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §7: confirmed_physiologic 장기/혈관/흉부 → rhythm risk 입력 강화 (보수적 가중)
  raw += (pcr.physiologicRhythmRisk || 0) * 0.30;
  raw += (pcr.physiologicPreArrestBoost || 0) * 0.25;
  if (cons < 20) raw += 0.10;
  if (shock > 80) raw += 0.08;
  if (HR > 170) raw += 0.08; if (HR < 40) raw += 0.12;
  // 완화 — 저산소/출혈을 없애지는 못함(작게)
  raw -= clamp01(o2 - 0.8) * 0.15;
  raw -= clamp01((MAP - 80) / 40) * 0.08;
  if (hd.compensatedShock && !hd.decompensatingShock) raw -= 0.05;
  raw -= cp.composure * 0.04;
  raw -= (1 - (sr.panic || 0)) * 0.02;
  let riskTarget = clamp01(raw);
  // smoothing — critical hemorrhage/severe hypoxia는 빠르게 상승 허용
  let riskScore = prev ? prev.riskScore : 0;
  const riskRise = (riskTarget > riskScore) ? Math.min(1, dt * 0.8) : Math.min(1, dt * 0.4);
  riskScore = clamp01(riskScore + (riskTarget - riskScore) * riskRise);

  // === 누적 시간 추적 (불안정/심실 자극 dwell — 후보 승격 게이트) ===
  let ventTime = prev ? (prev._ventTime || 0) : 0;
  let unstableTime = prev ? (prev._unstableTime || 0) : 0;
  let periArrestTime = prev ? (prev._periArrestTime || 0) : 0;

  const heartElectricalThreat = !!(pcr.heartAdjacentTrack || pcr.thoracicVesselRisk);
  const severeHypoxia = o2 < 0.42;
  const verySevereHypoxia = o2 < 0.32;
  const deathAdjacent = (m.lifeStatus != null && m.lifeStatus < 12) || (m.bloodMl < 1200);
  // 이 hemodynamics 모델은 빈사에도 MAP/perf가 완전 붕괴하지 않으므로(보상), arrest zone은
  //   death-adjacency + 심한 저산소(또는 낮은 MAP)로 판정한다. 전기활동 소실은 극단 지표로 분리.
  const lowMap = MAP < 52;
  const lowPerf = perf < 0.45;
  const arrestZone = deathAdjacent && (verySevereHypoxia || (lowMap && lowPerf));
  const electricalGone = (m.lifeStatus != null && m.lifeStatus <= 2) || (m.bloodMl < 1000) || (o2 < 0.20);

  // === §13 상태 전이 (보수적, 심각도 높은 것부터 게이트) ===
  let rhythm = 'normal_sinus';
  let transitionReason = '';

  // 심실 자극 조건 (V후보 전 단계)
  const ventIrritable = heartElectricalThreat && (severeHypoxia || hd.decompensatingShock) && riskScore > 0.55;
  if (ventIrritable || (unstableTime > 6 && heartElectricalThreat && riskScore > 0.6)) {
    ventTime += dt;
  } else {
    ventTime = Math.max(0, ventTime - dt * 0.6);
  }

  if (arrestZone && electricalGone) {
    rhythm = 'asystole_candidate'; transitionReason = 'death_adjacent_no_electrical';
    periArrestTime += dt;
  } else if (verySevereHypoxia && shock > 85 && riskScore > 0.85 && ventTime > 5 && (pcr.heartAdjacentTrack || hd.preArrestRisk)) {
    rhythm = 'vfib_candidate'; transitionReason = 'ventricular_chaos_candidate';
    periArrestTime += dt;
  } else if (severeHypoxia && lowMap && riskScore > 0.78 && ventTime > 4 && heartElectricalThreat) {
    rhythm = 'vtach_candidate'; transitionReason = 'wide_fast_candidate';
    periArrestTime += dt * 0.5;
  } else if (arrestZone) {
    rhythm = 'pea_candidate'; transitionReason = 'organized_no_perfusion';
    periArrestTime += dt;
  } else if (ventTime > 2.5 && riskScore > 0.62) {
    rhythm = 'ventricular_irritability'; transitionReason = 'ectopy_candidate';
    periArrestTime = Math.max(0, periArrestTime - dt);
  } else if (m.heartRate < 50 && (hypo === 'severe' || hypo === 'critical') && hd.poorPerfusion && o2 < 0.5 && exh > 0.5) {
    rhythm = 'unstable_bradycardia'; transitionReason = 'late_shock_brady';
    unstableTime += dt; periArrestTime = Math.max(0, periArrestTime - dt * 0.5);
  } else if (m.heartRate > 150 && hd.poorPerfusion && (o2 < 0.5 || hd.decompensatingShock)) {
    rhythm = 'unstable_tachycardia'; transitionReason = 'decomp_tachy';
    unstableTime += dt; periArrestTime = Math.max(0, periArrestTime - dt * 0.5);
  } else if ((m.heartRate < 55 || (severeHypoxia && m.heartRate < 75)) && (severeHypoxia || hd.decompensatingShock || cons < 25 || exh > 0.6)) {
    rhythm = 'sinus_bradycardia'; transitionReason = 'hypoxic_brady';
    unstableTime = Math.max(0, unstableTime - dt); periArrestTime = Math.max(0, periArrestTime - dt);
  } else if (m.heartRate > 100 && (sr.sympatheticTone > 0.4 || sr.adrenaline > 0.4 || hd.compensatedShock || hypo !== 'none' || (sr.panic || 0) > 0.4 || (sr.suppressionDrive || 0) > 0.4 || (sr.combatArousal || 0) > 0.3)) {
    rhythm = 'sinus_tachycardia'; transitionReason = 'compensatory_tachy';
    unstableTime = Math.max(0, unstableTime - dt); periArrestTime = Math.max(0, periArrestTime - dt);
  } else {
    rhythm = 'normal_sinus'; transitionReason = 'stable';
    unstableTime = Math.max(0, unstableTime - dt * 1.5); ventTime = Math.max(0, ventTime - dt); periArrestTime = Math.max(0, periArrestTime - dt * 1.5);
  }

  // === 파생 속성 ===
  const RCLASS = {
    normal_sinus: 'normal', sinus_tachycardia: 'compensatory', sinus_bradycardia: 'compensatory',
    unstable_tachycardia: 'unstable', unstable_bradycardia: 'unstable', ventricular_irritability: 'unstable',
    vtach_candidate: 'peri_arrest_candidate', vfib_candidate: 'peri_arrest_candidate',
    pea_candidate: 'arrest_candidate', asystole_candidate: 'arrest_candidate',
  };
  const rhythmClass = RCLASS[rhythm] || 'normal';
  const ECGPAT = {
    normal_sinus: 'pqrst_normal', sinus_tachycardia: 'pqrst_fast', sinus_bradycardia: 'pqrst_slow',
    unstable_tachycardia: 'pqrst_fast_irregular', unstable_bradycardia: 'pqrst_slow_irregular',
    ventricular_irritability: 'pqrst_ectopy', vtach_candidate: 'wide_fast', vfib_candidate: 'chaotic',
    pea_candidate: 'organized_low_perfusion', asystole_candidate: 'flatline',
  };
  const ecgPattern = ECGPAT[rhythm] || 'pqrst_normal';
  // perfusing — pea/asystole는 false, vfib 후보 false, vtach 후보는 조건부
  let perfusing = true;
  if (rhythm === 'pea_candidate' || rhythm === 'asystole_candidate' || rhythm === 'vfib_candidate') perfusing = false;
  else if (rhythm === 'vtach_candidate') perfusing = (MAP >= 50 && perf >= 0.35);
  const electricalActivityPresent = (rhythm !== 'asystole_candidate');
  // shockableHint — vfib true, pulseless vtach만 true, pea/asystole/그외 false
  let shockableHint = false, nonShockableReason = null;
  if (rhythm === 'vfib_candidate') shockableHint = true;
  else if (rhythm === 'vtach_candidate' && !perfusing) shockableHint = true;
  else if (rhythm === 'pea_candidate') nonShockableReason = 'pulseless_electrical_activity';
  else if (rhythm === 'asystole_candidate') nonShockableReason = 'no_electrical_activity';
  // perfusingRhythmFactor — 다음 tick hemodynamics에 약한 feedback (보수적)
  let perfusingRhythmFactor = 1.0;
  if (rhythmClass === 'unstable') perfusingRhythmFactor = 0.92;
  else if (rhythm === 'vtach_candidate') perfusingRhythmFactor = perfusing ? 0.78 : 0.55;
  else if (rhythm === 'vfib_candidate') perfusingRhythmFactor = 0.30;
  else if (rhythm === 'pea_candidate') perfusingRhythmFactor = 0.25;
  else if (rhythm === 'asystole_candidate') perfusingRhythmFactor = 0.12;
  // SIDE-MED-PHYS-HOTFIX-1A §2-D: confirmed_physiologic perfusingRhythmPenalty — 리듬 효율만 약하게 제한 (rhythmClass 강제 금지)
  if (pcr && (pcr.physiologicPerfusingPenalty || 0) > 0) {
    perfusingRhythmFactor = Math.max(0.25, Math.min(1.0, perfusingRhythmFactor - (pcr.physiologicPerfusingPenalty || 0) * 0.45));
  }
  // severity / stability
  const severity = (rhythmClass === 'arrest_candidate') ? 'critical' : (rhythmClass === 'peri_arrest_candidate') ? 'severe' : (rhythmClass === 'unstable') ? 'moderate' : (rhythm === 'normal_sinus' ? 'none' : 'mild');
  const stability = clamp01(1 - riskScore);
  // triggerTags
  const triggerTags = [];
  if (hypo === 'severe' || hypo === 'critical') triggerTags.push('hypovolemia');
  if (o2 < 0.55) triggerTags.push('hypoxia');
  if (hd.decompensatingShock) triggerTags.push('decompensating_shock');
  if (pcr.heartAdjacentTrack) triggerTags.push('heart_adjacent');
  if (pcr.thoracicVesselRisk) triggerTags.push('thoracic_vessel');
  if ((sr.panic || 0) > 0.5) triggerTags.push('panic');
  if (sr.combatArousal > 0.5) triggerTags.push('combat_arousal');

  const timeInRhythm = (prev && prev.rhythm === rhythm) ? ((prev.timeInRhythm || 0) + dt) : 0;
  const transitioned = !prev || prev.rhythm !== rhythm;

  m.cardiacRhythmModel = {
    rhythm, rhythmClass, severity, stability: +stability.toFixed(3),
    shockableHint, nonShockableReason, perfusing, rateHint: Math.round(HR),
    ecgPattern, riskScore: +riskScore.toFixed(3), triggerTags,
    lastUpdateTime: now, timeInRhythm: +timeInRhythm.toFixed(2), transitionReason,
    candidateOnly: true, heartRateState: m._heartRateState || 'calm',
    composureInfluence: +cp.composure.toFixed(2), perfusingRhythmFactor: +perfusingRhythmFactor.toFixed(3),
    electricalActivityPresent, resuscitationCandidate: (shockableHint || rhythmClass === 'arrest_candidate'),
    rhythmTreatmentLocked: (rhythmClass === 'peri_arrest_candidate' || rhythmClass === 'arrest_candidate'),
    _ventTime: +ventTime.toFixed(2), _unstableTime: +unstableTime.toFixed(2), _periArrestTime: +periArrestTime.toFixed(2),
    _transitioned: transitioned,
  };
  // CARDIAC-1R §20: 전이 시에만 AAR 로그 (스팸 방지) — 불안정 이상 등급 진입만.
  if (transitioned && typeof log === 'function' && (rhythmClass === 'unstable' || rhythmClass === 'peri_arrest_candidate' || rhythmClass === 'arrest_candidate')) {
    const RKO = { unstable_tachycardia:'불안정 빈맥', unstable_bradycardia:'불안정 서맥', ventricular_irritability:'심실 자극 후보', vtach_candidate:'심실빈맥 후보', vfib_candidate:'심실세동 후보', pea_candidate:'무맥성 전기활동 후보', asystole_candidate:'무수축 후보' };
    const reason = pcr.heartAdjacentTrack ? '심장 인접 궤적' : (o2 < 0.5 ? '저산소' : hd.decompensatingShock ? '보상 붕괴' : '관류 저하');
    log(`[${unit.name}] 심장 리듬: ${RKO[rhythm] || rhythm} — ${reason} (리듬 모델, 소생 처치 미구현)`, rhythmClass === 'arrest_candidate' ? 'warn' : 'info');
  }
  return m.cardiacRhythmModel;
}
function buildPreCardiacRisk(unit) {
  const m = unit.medical; if (!m) return null;
  const hd = m.hemodynamics || {};
  let heartAdjacent = false, thoracicVessel = false;
  let physRhythmRisk = 0, physPerfPenalty = 0, physPreArrest = 0;
  if (m.wounds) for (const w of m.wounds) {
    const oim = w.organInjuryModel;
    if (oim && oim.injuries) for (const inj of oim.injuries) {
      if (inj.organ === 'heart_hook_only') heartAdjacent = true;
      if (inj.organ === 'thoracic_vessel' && (inj.status === 'suspected' || inj.status === 'likely' || inj.status === 'confirmed_limited')) thoracicVessel = true;
    }
    // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §7/§8: confirmed_physiologic rhythm risk 입력 강화 (확정 손상 아님)
    const pep = w.physiologicEffectProfile;
    if (pep) {
      physRhythmRisk = Math.max(physRhythmRisk, pep.rhythmRiskBoost || 0);
      physPerfPenalty = Math.max(physPerfPenalty, pep.perfusingRhythmPenalty || 0);
      physPreArrest = Math.max(physPreArrest, pep.preArrestBoost || 0);
    }
  }
  m.preCardiacRisk = {
    hypovolemiaSeverity: hd.hypovolemiaSeverity || 'none',
    decompensatingShock: !!hd.decompensatingShock,
    poorPerfusion: !!hd.poorPerfusion,
    lowOxygenDelivery: (hd.oxygenDelivery != null) ? hd.oxygenDelivery < 0.55 : false,
    thoracicVesselRisk: thoracicVessel,
    physiologicRhythmRisk: +physRhythmRisk.toFixed(3),
    physiologicPerfusingPenalty: +physPerfPenalty.toFixed(3),
    physiologicPreArrestBoost: +physPreArrest.toFixed(3),
    heartAdjacentTrack: heartAdjacent,
    cardiacInjuryCandidateOnly: true,                      // 확정 심장손상 없음 — 후보/감시 단계
    rhythmModelReadySignal: !!(hd.cardiacRhythmReadySignal),
    arrestRiskHint: !!(hd.preArrestRisk),   // 힌트 — 사망/리듬 판정 직접 사용 금지
  };
  return m.preCardiacRisk;
}
function buildTcccAssessment(unit) {
  const m = unit.medical; if (!m) return null;
  const phase = getTcccCarePhase(unit, null, null);
  let airwayConcern = false, airwayReason = '', hypothermiaRisk = false;
  const wounds = m.wounds || [];
  let massiveHemorrhage = false;
  for (const w of wounds) {
    if (w.hemorrhageControlModel && w.hemorrhageControlModel.isMassiveHemorrhage) massiveHemorrhage = true;
    if ((w.partKey === 'neck') || (w.candidateMap && w.candidateMap.some(c => c.type === 'airway'))) { airwayConcern = true; airwayReason = 'neck/airway candidate'; }
  }
  if ((m.consciousness != null && m.consciousness < 35) && (m.shock || 0) > 50) { airwayConcern = true; airwayReason = airwayReason || 'reduced consciousness'; }
  if ((m.bloodMl != null && m.bloodMl < 3500)) hypothermiaRisk = true;
  let marchStep = 'none', recommendedAction = 'monitor';
  if (massiveHemorrhage) { marchStep = 'M'; recommendedAction = 'hemorrhage_control'; }
  else if (airwayConcern) { marchStep = 'A'; recommendedAction = 'airway_hook'; }
  else if ((m.shock || 0) > 50) { marchStep = 'C'; recommendedAction = 'evac_circulation'; }
  else if ((m.pain || 0) > 60) { marchStep = 'P'; recommendedAction = 'painkiller'; }
  m.airwayModel = { airwayConcern, airwayObstructionRisk: airwayConcern, neckTraumaConcern: wounds.some(w => w.partKey === 'neck'), reducedConsciousnessAirwayRisk: (m.consciousness != null && m.consciousness < 35), airwayInterventionCandidate: airwayConcern, airwayInterventionAvailable: false, reason: airwayReason };
  m.exposureModel = { hypothermiaRisk, exposedCasualty: phase === 'evacuation_pending', severeBloodLossExposureRisk: (m.bloodMl != null && m.bloodMl < 3000), hypothermiaPreventionCandidate: hypothermiaRisk };
  m.tcccAssessment = { phase, marchStep, recommendedAction, massiveHemorrhage, airwayConcern };
  return m.tcccAssessment;
}
function updateMedicalBleeding(unit, dt) {
  const m = unit.medical;
  // wound 데이터가 있으면 wound 합산 우선(source-of-truth), 없으면 기존 bodyParts 기반 legacy fallback
  if (m.wounds && m.wounds.length > 0) {
    try { updateMedicalBleedingWoundBased(unit, dt); m._bleedSource = 'wound'; return; }
    catch (e) { m._bleedSource = 'legacy_fallback(err)'; /* 실패 시 legacy fallback */ }
  } else {
    m._bleedSource = 'legacy_fallback';
  }
  let totalExt = 0, totalInt = 0;
  for (const k of BODY_PART_KEYS) {
    const p = m.bodyParts[k];
    if (p.externalBleedRate > 0 && p.externalBleedRate < 2.0) {
      p.externalBleedRate = Math.max(0, p.externalBleedRate - 0.02 * dt);
    }
    if (p.tourniquetApplied && (k === 'leftArm' || k === 'rightArm' || k === 'leftLeg' || k === 'rightLeg')) {
      p.externalBleedRate = 0;
    }
    if (p.bandageApplied) {
      if (p.externalBleedRate > 1.5) {
        p.externalBleedRate = Math.max(1.5, p.externalBleedRate - 0.5 * dt);
      } else {
        p.externalBleedRate = Math.max(0, p.externalBleedRate - 0.3 * dt);
      }
    }
    totalExt += p.externalBleedRate;
    totalInt += p.internalBleedRate;
  }
  m.externalBleedRate = totalExt;
  m.internalBleedRate = totalInt;
  const totalBleed = totalExt + totalInt;
  if (totalBleed > 0) m.bloodMl = Math.max(0, m.bloodMl - totalBleed * dt);
}
function updateSystemicHypoxiaDamage(unit, dt) {
  const m = unit.medical;
  if (m.bloodMl >= 3350) return;
  const HYP_MUL = { head: 0.85, neck: 0.90, chest: 1.25, abdomen: 1.45,
                    leftArm: 0.45, rightArm: 0.45, leftLeg: 0.55, rightLeg: 0.55 };
  let sysRate = 0;
  if (m.bloodMl < 1800)      sysRate = 8.0;
  else if (m.bloodMl < 2500) sysRate = 4.5;
  else if (m.bloodMl < 3000) sysRate = 2.0;
  else                       sysRate = 0.6;
  for (const k of BODY_PART_KEYS) {
    const p = m.bodyParts[k];
    if (p.hp > 0) {
      p.hp = Math.max(0, p.hp - sysRate * (HYP_MUL[k] || 1.0) * dt);
      recomputeBodyPartFunctionRatio(p);   // FRACTURE-FUNC-SYNC-1 Phase1 §5: 골절 패널티 유지하며 재계산
    }
  }
}
function updateStressResponse(unit, dt) {
  const m = unit.medical;
  const sr = m.stressResponse;
  sr.timeSinceLastThreat += dt;
  sr.timeSinceLastDamage += dt;
  // 위협 입력
  const sup = (unit.suppression || 0) / 100;
  const recentHit = sr.timeSinceLastDamage < 3.5 ? (1 - sr.timeSinceLastDamage / 3.5) : 0;
  const enemyClose = (unit.currentTarget && unit.currentTarget.x != null)
    ? Math.max(0, Math.min(1, 1 - Math.hypot(unit.x - unit.currentTarget.x, unit.y - unit.currentTarget.y) / mToPx(10)))   // SIDE-METRIC-SCALE-1: 10m
    : 0;
  const newThreatInput = clamp01(sup * 0.6 + recentHit * 0.4 + enemyClose * 0.3);
  // dt 기반 exponential decay — FPS 독립적
  sr.threatDrive = Math.max(decayExp(sr.threatDrive, dt, 1.5), newThreatInput);
  sr.threatDrive = clamp01(sr.threatDrive);
  if (sr.threatDrive > 0.15 || recentHit > 0) sr.timeSinceLastThreat = 0;
  // 부상 입력
  const painNorm = m.pain / 100;
  const shockNorm = m.shock / 100;
  const lifeLoss = 1 - m.lifeStatus / 100;
  const newInjuryInput = clamp01(painNorm * 0.5 + shockNorm * 0.4 + lifeLoss * 0.3);
  sr.injuryDrive = Math.max(decayExp(sr.injuryDrive, dt, 3.0), newInjuryInput);
  sr.injuryDrive = clamp01(sr.injuryDrive);
  // 제압 — suppression 매 tick에서 직접 읽으므로 별도 감쇠 불필요
  sr.suppressionDrive = sup;
  // combatArousal target
  const arousalTarget = clamp01(sr.threatDrive * 0.7 + sr.injuryDrive * 0.5 + sr.suppressionDrive * 0.5);
  // approachValue — rise 빠르게, fall 느리게
  sr.combatArousal = clamp01(approachValue(sr.combatArousal, arousalTarget, 2.0, 0.25, dt));
  // adrenaline target
  const lowBpDrive = m.systolicBP < 95 ? Math.max(0, (95 - m.systolicBP) / 95) : 0;
  const adrenalineTarget = clamp01(
    sr.combatArousal * 0.7 + painNorm * 0.35 + lowBpDrive * 0.3 + shockNorm * 0.25 + sr.threatDrive * 0.3
  );
  sr.adrenaline = clamp01(approachValue(sr.adrenaline, adrenalineTarget, 2.5, 0.35, dt));
  // CARDIAC-1R §6: 숙련도 침착성 — adrenalineControl이 높으면 과폭주(상한)를 낮춘다 (출혈엔 무영향).
  const cp = getUnitComposureProfile(unit);
  const adrCeil = 1.0 - (cp.adrenalineControl - 0.6) * 0.35;   // elite ≈ 0.885, recruit ≈ 1.07→clamp1
  sr.adrenaline = Math.min(sr.adrenaline, clamp01(adrCeil));
  // sympatheticTone (느린 변화)
  const sympTarget = clamp01(
    sr.adrenaline * 0.6 + lowBpDrive * 0.4 + (1 - Math.min(1, m.bloodMl/m.bloodMax)) * 0.5 + painNorm * 0.2
  );
  sr.sympatheticTone = clamp01(approachValue(sr.sympatheticTone, drugSympathetic(m)>0?clamp01(sympTarget+drugSympathetic(m)):sympTarget, 1.0, 0.5, dt));
  // panic — CARDIAC-1R §6: composure.panicResistance + startleResistance(피격 직후) 기반
  const panicResistance = Math.max(0.4, Math.min(1.5, 0.5 + cp.panicResistance));
  const startleSpike = recentHit * (1 - cp.startleResistance) * 0.5;   // recruit는 피격 startle 큼
  const panicTarget = clamp01((
    sup * 0.4 + (m.lifeStatus < 30 ? 0.3 : 0) + (m.consciousness < 50 ? 0.25 : 0)
    + (m.bloodMl < 2500 ? 0.25 : 0) + sr.threatDrive * 0.3 + startleSpike
  ) / panicResistance);
  sr.panic = clamp01(approachValue(sr.panic, panicTarget, 1.5, 0.4, dt));
  // painMasking — adrenaline / painkiller / combatArousal
  const analgesia = (unit.analgesiaLevel || 0) / 100;
  const maskTarget = Math.min(0.85, sr.adrenaline * 0.45 + sr.combatArousal * 0.20 + analgesia * 0.65);
  sr.painMasking = clampMed(approachValue(sr.painMasking, maskTarget, 1.2, 0.6, dt), 0, 0.85);
  // perceivedPain = pain * (1 - painMasking)
  sr.perceivedPain = m.pain * (1 - sr.painMasking);
  // postCombatCrash — 위협 없고 adrenaline이 떨어지며 부상이 남아있을 때
  //   CARDIAC-1R §6: postCombatRecovery 높으면 crash가 더 빨리 가신다 (elite 회복 빠름).
  const adrenalineDropping = (sr.combatArousal < 0.3 && sr.timeSinceLastThreat > 5);
  const injuryPresent = (m.pain > 30 || m.lifeStatus < 70 || m.shock > 20);
  const recoveryRate = 0.05 * (0.6 + cp.postCombatRecovery);
  if (adrenalineDropping && injuryPresent) {
    sr.postCombatCrash = clamp01(approachValue(sr.postCombatCrash, 1.0 * (1.3 - cp.postCombatRecovery * 0.5), 0.15, recoveryRate, dt));
  } else {
    sr.postCombatCrash = clamp01(approachValue(sr.postCombatCrash, 0, recoveryRate, recoveryRate, dt));
  }
}
function updateHormonalCompensation(unit, dt) {
  const m = unit.medical;
  const hc = m.hormonalCompensation;
  const lowBp = m.systolicBP < 95 ? Math.max(0, (95 - m.systolicBP) / 95) : 0;
  const lowVol = Math.max(0, 1 - m.bloodMl / m.bloodMax);
  const shockNorm = m.shock / 100;
  // vasopressin (ADH) — 분 단위 반응 (rise/fall 모두 매우 느림)
  const vasoTarget = clamp01(lowBp * 0.6 + lowVol * 0.5 + shockNorm * 0.3);
  hc.vasopressin = clamp01(approachValue(hc.vasopressin, vasoTarget, 0.08, 0.04, dt));
  // RAAS — 더 느림
  const raasTarget = clamp01(lowVol * 0.6 + lowBp * 0.5 + shockNorm * 0.3);
  hc.raasActivation = clamp01(approachValue(hc.raasActivation, raasTarget, 0.04, 0.02, dt));
  hc.angiotensinTone = clamp01(approachValue(hc.angiotensinTone, hc.raasActivation * 0.8, 0.05, 0.03, dt));
  hc.aldosteroneEffect = clamp01(approachValue(hc.aldosteroneEffect, hc.raasActivation, 0.02, 0.015, dt));
  // cortisol — 장기 스트레스 (debug 용)
  const cortTarget = clamp01(m.stressResponse.combatArousal * 0.7 + m.stressResponse.injuryDrive * 0.3);
  hc.cortisolStress = clamp01(approachValue(hc.cortisolStress, cortTarget, 0.05, 0.02, dt));
}
function updateHemodynamics(unit, dt) {
  const m = unit.medical;
  const hd = m.hemodynamics;
  const sr = m.stressResponse;
  const hc = m.hormonalCompensation;
  // volumeRatio — 0~1.05 clamp (안전)
  hd.volumeRatio = clampMed(m.bloodMl / Math.max(1, m.bloodMax), 0, 1.05);
  // preload — 정맥환류 (혈액량 기반, 0.05~1.15 clamp)
  let preloadTarget;
  if (m.bloodMl >= 4250) preloadTarget = 1.0;
  else if (m.bloodMl >= 3500) preloadTarget = 0.95 - (4250 - m.bloodMl) / 750 * 0.10;
  else if (m.bloodMl >= 3000) preloadTarget = 0.85 - (3500 - m.bloodMl) / 500 * 0.20;
  else if (m.bloodMl >= 2500) preloadTarget = 0.65 - (3000 - m.bloodMl) / 500 * 0.20;
  else if (m.bloodMl >= 2000) preloadTarget = 0.45 - (2500 - m.bloodMl) / 500 * 0.15;
  else preloadTarget = Math.max(0.10, 0.30 - (2000 - m.bloodMl) / 1500 * 0.20);
  preloadTarget = clampMed(preloadTarget, 0.05, 1.15);
  hd.preload = clampMed(approachValue(hd.preload, preloadTarget, 1.2, 1.2, dt), 0.05, 1.15);
  // vascularTone (혈관수축) — 0.5~1.8 clamp
  const toneFromSymp = sr.sympatheticTone * 0.4;
  const toneFromHormone = hc.vasopressin * 0.25 + hc.angiotensinTone * 0.20;
  let toneTarget = 1.0 + toneFromSymp + toneFromHormone;
  toneTarget *= (1 - hd.compensationExhaustion * 0.5);
  toneTarget = clampMed(toneTarget, 0.5, 1.8);
  hd.vascularTone = clampMed(approachValue(hd.vascularTone, toneTarget, 0.8, 0.8, dt), 0.5, 1.8);
  hd.systemicVascularResistance = clampMed(hd.vascularTone, 0.5, 1.8);
  // contractility — 0.4~1.5 clamp
  let contractTarget = 1.0 + sr.adrenaline * 0.25 + sr.sympatheticTone * 0.15;
  contractTarget *= (1 - hd.compensationExhaustion * 0.4);
  contractTarget *= Math.max(0.6, Math.min(1.0, hd.oxygenDelivery));
  contractTarget = clampMed(contractTarget, 0.4, 1.5);
  hd.contractility = clampMed(approachValue(hd.contractility, contractTarget, 1.0, 1.0, dt), 0.4, 1.5);
  // strokeVolumeMul = preload * contractility — HR 효율 감소
  let svMul = hd.preload * hd.contractility;
  const hr = m.heartRate;
  if (hr > 100) svMul *= 1 - Math.min(0.45, (hr - 100) / 80 * 0.45);
  if (hr > 170) svMul *= 0.7;
  hd.strokeVolumeMul = clampMed(svMul, 0.05, 1.3);
  // cardiacOutputMul — SV 가중치 0.7, HR factor 0.3 (둘 다 곱하면 폭증)
  // CARDIAC-1R §8: 명시적 빈맥/서맥 penalty. 정상범위 보상, 과도 빈맥은 filling time↓, 서맥은 output↓.
  let hrFactor = clampMed(hr / 75, 0.5, 2.0);
  let fillingTimePenalty = 1.0, bradyPenalty = 1.0;
  if (hr > 145) fillingTimePenalty = 1 - Math.min(0.35, (hr - 145) / 60 * 0.35);   // 145+ 충만 시간 감소
  if (hr < 50)  bradyPenalty = Math.max(0.45, hr / 50);                              // 50↓ output 저하
  hrFactor *= fillingTimePenalty * bradyPenalty;
  // 직전 tick의 불안정 리듬이면 관류 리듬 효율 하락 (1-tick feedback — 약하게, 보수적).
  const _priorRhythm = m.cardiacRhythmModel;
  let perfusingRhythmFactor = 1.0;
  if (_priorRhythm && _priorRhythm.perfusingRhythmFactor != null) perfusingRhythmFactor = _priorRhythm.perfusingRhythmFactor;
  hd.cardiacEfficiency = +(fillingTimePenalty * bradyPenalty * perfusingRhythmFactor).toFixed(3);
  hd.cardiacOutputMul = clampMed(
    (hd.strokeVolumeMul * 0.7 + hd.strokeVolumeMul * hrFactor * 0.3) * (0.7 + perfusingRhythmFactor * 0.3), 0.05, 1.5
  );
  // MAP
  hd.map = clampMed(93 * (hd.cardiacOutputMul * 0.6 + hd.systemicVascularResistance * 0.4), 20, 200);
  hd.pulsePressure = clampMed(hd.strokeVolumeMul * 40, 15, 80);
  // tissuePerfusion — MAP + CO 종합 (0~1.2 clamp)
  hd.tissuePerfusion = clampMed(
    (hd.map / 93) * 0.5 + (hd.cardiacOutputMul / 1.0) * 0.5, 0, 1.2
  );
  // oxygenDelivery
  hd.oxygenDelivery = clampMed(
    hd.tissuePerfusion * (m.breathingEfficiency / 100) * 0.9 + 0.1, 0, 1.2
  );
  // FIELD-STAB-1 §8/§14: airway support → oxygenDelivery 제한적 보정 (직전 tick 값, 1-tick feedback).
  //   원인(저산소)을 약하게 완화할 뿐 — bloodMl/internal bleeding/tension은 건드리지 않음.
  const _fs = m.fieldStabilizationModel;
  if (_fs) {
    const awMod = (_fs.airwaySupport && _fs.airwaySupport.oxygenDeliveryModifier) || 1.0;
    hd.oxygenDelivery = clampMed(hd.oxygenDelivery * awMod, 0, 1.2);
    // circulation support — MAP/perfusion 매우 제한적 보정 (field limited)
    const csMapMod = (_fs.circulationSupport && _fs.circulationSupport.mapSupportModifier) || 1.0;
    const csPerfMod = (_fs.circulationSupport && _fs.circulationSupport.perfusionSupportModifier) || 1.0;
    if (csMapMod !== 1.0) hd.map = clampMed(hd.map * csMapMod, 20, 200);
    if (csPerfMod !== 1.0) { hd.tissuePerfusion = clampMed(hd.tissuePerfusion * csPerfMod, 0, 1.2); hd.oxygenDelivery = clampMed(hd.oxygenDelivery * csPerfMod, 0, 1.2); }
  }
  // RESIDUAL HOTFIX 3: iv_fluid / oxygen 보조효과 제한 지속 (시간벌기 · 매우 약함). 출혈 source / internalBleeding / surgery·transfusion·definitiveCare markers 불변.
  const _nowHd = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  if (m._ivAssistUntil && _nowHd < m._ivAssistUntil) {
    hd.map = clampMed(hd.map * 1.03, 20, 200);                         // 수액: MAP/perfusion 중심 소폭 (bloodMl/oxygenDelivery 혈액대체 아님)
    hd.tissuePerfusion = clampMed(hd.tissuePerfusion * 1.02, 0, 1.2);
  }
  if (m._oxygenAssistUntil && _nowHd < m._oxygenAssistUntil) {
    // 산소: oxygenDelivery 소폭만 (bloodMl 회복 아님). 혈액량 극도 부족/호흡효율 급락 시 효과 제한.
    const _o2cap = (m.breathingEfficiency < 25 || hd.volumeRatio < 0.55) ? 1.02 : 1.04;
    hd.oxygenDelivery = clampMed(hd.oxygenDelivery * _o2cap, 0, 1.2);
  }
  // compensationLoad
  hd.compensationLoad = clamp01(
    sr.sympatheticTone * 0.5 + sr.adrenaline * 0.3
    + Math.max(0, (hd.vascularTone - 1.0) * 0.8) + hc.vasopressin * 0.3
  );
  // compensationExhaustion — approachValue로 부드럽게 (rise 매우 느림, fall 더 느림)
  if (hd.compensationLoad > 0.5 && m.bloodMl < 3500) {
    const exhaustGain = 0.015 * (hd.compensationLoad - 0.5) * 2;
    hd.compensationExhaustion = clamp01(hd.compensationExhaustion + exhaustGain * dt);
  } else {
    hd.compensationExhaustion = clamp01(decayExp(hd.compensationExhaustion, dt, 60.0));
  }
  // compensated/decompensating shock 판정
  hd.compensatedShock = (m.bloodMl < 3500 && m.systolicBP >= 90 && hd.compensationLoad > 0.4);
  // CARDIAC-1R Cleanup B: decompensatingShock을 preArrestRisk/readySignal보다 먼저 계산 —
  //   severe shock tick에서 신호가 한 tick 늦게 켜지는 현상 제거 (최신 상태 반영).
  hd.decompensatingShock = (m.bloodMl < 2800 && m.systolicBP < 90 && hd.compensationLoad > 0.5)
    || (hd.compensationExhaustion > 0.6 && m.systolicBP < 95);
  // === PRECARDIAC-1 §5: 위험 단계 flag (다음 cardiac 단계 입력 — rhythm state 아님) ===
  hd.hypovolemiaSeverity = (m.bloodMl >= 4250) ? 'none' : (m.bloodMl >= 3500) ? 'mild' : (m.bloodMl >= 3000) ? 'moderate' : (m.bloodMl >= 2500) ? 'severe' : 'critical';
  hd.poorPerfusion = hd.tissuePerfusion < 0.6;
  // SIDE-MED-PHYS-HOTFIX-1A §2-B: confirmed_physiologic oxygenDrain — 잔여 저산소 보조 감쇠 (breathingDrain과 중복 크기 금지, bloodMl 영향 없음)
  {
    const _pep = aggregatePhysiologicEffectProfile(unit.medical);
    if (_pep.oxygenDrain > 0) hd.oxygenDelivery = clampMed(hd.oxygenDelivery * (1 - _pep.oxygenDrain * 0.50), 0, 1.2);
  }
  hd.oxygenDebt = hd.oxygenDelivery < 0.6;
  // preArrestRisk는 "위험 힌트"일 뿐 — arrest/사망 판정에 직접 사용 금지 (rhythm 본편은 후속 단계).
  hd.preArrestRisk = (hd.hypovolemiaSeverity === 'critical') || (hd.oxygenDelivery < 0.4) || (hd.decompensatingShock && hd.compensationExhaustion > 0.7);
  hd.cardiacRhythmReadySignal = hd.preArrestRisk || hd.decompensatingShock || hd.oxygenDebt;
}
function getHeartRateState(m) {
  const hr = m.heartRate;
  const hd = m.hemodynamics || {};
  const o2 = (hd.oxygenDelivery != null) ? hd.oxygenDelivery : 1.0;
  if (hd.preArrestRisk && (hr < 50 || hr > 170)) return 'peri_arrest';
  if (hr < 50) return (hd.decompensatingShock || o2 < 0.5) ? 'late_shock_bradycardia' : 'sinus_bradycardia_state';
  if (hr > 150) return (hd.poorPerfusion || o2 < 0.55) ? 'unstable_tachycardia' : 'panic_tachycardia';
  if (hr > 130) return (hd.compensatedShock || hd.decompensatingShock) ? 'tachycardic_compensation' : 'panic_tachycardia';
  if (hr > 100) return 'combat_aroused';
  if (hr > 88) return 'alert';
  return 'calm';
}
function updateVitalsFromHemodynamics(unit, dt) {
  const m = unit.medical;
  const hd = m.hemodynamics;
  const sr = m.stressResponse;
  // HR target — baseHR + 각종 드라이브
  const lossPct = (1 - hd.volumeRatio) * 100;
  let hypovolemiaDrive = 0;
  if (lossPct >= 33) hypovolemiaDrive = 35 + (lossPct - 33) * 1.2;
  else if (lossPct >= 20) hypovolemiaDrive = 20 + (lossPct - 20) * 1.15;
  else if (lossPct >= 10) hypovolemiaDrive = 8 + (lossPct - 10) * 1.2;
  else hypovolemiaDrive = lossPct * 0.8;
  const lowBpDrive = m.systolicBP < 95 ? Math.max(0, (95 - m.systolicBP) * 0.6) : 0;
  const adrenalineDrive = sr.adrenaline * 30;
  const arousalDrive = sr.combatArousal * 15;
  // CARDIAC-1R §5/§6: panic 빈맥 spike는 composure로 완화 (recruit 큼, elite 작음). 출혈 무영향.
  const cp = getUnitComposureProfile(unit);
  const panicDrive = sr.panic * 25 * (1.25 - cp.composure * 0.5);
  const painDrive = sr.perceivedPain * 0.15;
  const shockDrive = m.shock * 0.35;
  const breathingDrive = m.breathingEfficiency < 60 ? (60 - m.breathingEfficiency) * 0.4 : 0;
  let hrTarget = 75 + hypovolemiaDrive + lowBpDrive + adrenalineDrive + arousalDrive
    + panicDrive + painDrive + shockDrive + breathingDrive;
  // CARDIAC-1R §7: 말기/임종기 서맥 — 심근 저산소·임종 상태는 직접 결과. stress 캐스케이드와 무관하게 적용.
  //   compensated shock(생존 가능)은 빈맥 유지, agonal(임종)만 서맥 hard-cap (directive 30~70 범위).
  const o2 = (hd.oxygenDelivery != null) ? hd.oxygenDelivery : 1.0;
  const agonal = (m.lifeStatus < 15 && o2 < 0.4) || (o2 < 0.28) || (hd.decompensatingShock && hd.compensationExhaustion > 0.7 && o2 < 0.5);
  if (agonal) {
    const severity = clamp01((0.4 - o2) * 2 + (15 - m.lifeStatus) / 15 * 0.5 + Math.max(0, (hd.compensationExhaustion - 0.7)) * 1.5);
    const agonalRate = 28 + (1 - severity) * 38;   // severity 1 → ~28bpm, 0.5 → ~47bpm
    hrTarget = Math.min(hrTarget, agonalRate);
  }
  hrTarget = Math.max(25, Math.min(190, hrTarget));
  // smoothing — 피격/공포 spike는 빠르게(rise), 진정은 느리게. 단 dt scaling 유지.
  const hrLerp = (hrTarget > m.heartRate) ? Math.min(1, dt * 1.4) : Math.min(1, dt * 0.9);
  m.heartRate += (hrTarget - m.heartRate) * hrLerp;
  m._heartRateState = getHeartRateState(m);
  // BP target — hemodynamics.map 기반
  //   systolic = MAP + pulsePressure/2 (대략 +15~25)
  let bpTarget = hd.map + Math.min(25, hd.pulsePressure * 0.6);
  // 보상이 깨지면 BP 급락
  if (hd.compensationExhaustion > 0.5) {
    bpTarget *= (1 - (hd.compensationExhaustion - 0.5) * 0.8);
  }
  bpTarget = Math.max(20, Math.min(170, bpTarget));
  m.systolicBP += (bpTarget - m.systolicBP) * Math.min(1, dt * 0.7);
  m.diastolicBP = Math.max(15, m.systolicBP * 0.65 + 5);
  // breathing — 호흡 회복 (느림) + panic/adrenaline 시 빨라짐
  if (m.breathingEfficiency < 100 && m.shock < 50 && m.bloodMl > 3500) {
    m.breathingEfficiency = Math.min(100, m.breathingEfficiency + 1.0 * dt);
  }
}
function updatePainShockConsciousness(unit, dt) {
  const m = unit.medical;
  const hd = m.hemodynamics;
  const sr = m.stressResponse;
  // Pain 자연 감소
  if (m.pain > 0) m.pain = Math.max(0, m.pain - 1.5 * dt);
  // perceivedPain 갱신 (stressResponse에서도 갱신되지만 여기서 한번 더 보장)
  sr.perceivedPain = m.pain * (1 - sr.painMasking);
  // Shock — bloodMl 낮으면 상승, 안정 시 천천히 감소
  if (m.bloodMl < 3000 || hd.decompensatingShock) {
    m.shock = Math.min(100, m.shock + 2.0 * dt);
  } else if (m.shock > 0 && m.bloodMl > 3500 && m.externalBleedRate + m.internalBleedRate < 5) {
    m.shock = Math.max(0, m.shock - 0.8 * dt);
  }
  // tissuePerfusion 낮으면 shock 추가 상승
  if (hd.tissuePerfusion < 0.55) m.shock = Math.min(100, m.shock + 1.0 * dt);
  // SIDE-MED-PHYS-HOTFIX-1A §2-C: confirmed_physiologic shockBoost — shock 천천히 상승 (clamp, unconscious/death 강제 금지)
  {
    const _pep = aggregatePhysiologicEffectProfile(m);
    if (_pep.shockBoost > 0) m.shock = Math.min(100, m.shock + Math.min(0.30, _pep.shockBoost) * 3.0 * dt);
  }
  // Consciousness — hemodynamics 기반
  let consTarget = 100;
  if (m.systolicBP < 70) consTarget -= 50;
  else if (m.systolicBP < 90) consTarget -= 20;
  if (m.shock > 70) consTarget -= 30;
  if (m.bloodMl < 2000) consTarget -= 40;
  if (m.breathingEfficiency < 35) consTarget -= 25;
  if (hd.oxygenDelivery < 0.5) consTarget -= 20;
  if (hd.decompensatingShock) consTarget -= 10;
  consTarget = Math.max(0, consTarget);
  if (consTarget < m.consciousness) m.consciousness += (consTarget - m.consciousness) * Math.min(1, dt * 1.2);
  else m.consciousness += (consTarget - m.consciousness) * Math.min(1, dt * 0.3);
}
function updateMedicalPerformanceMultipliers(unit, dt) {
  const m = unit.medical;
  const sr = m.stressResponse;
  const hd = m.hemodynamics;
  // ===== aim =====
  // arm function (좌우)
  const lArm = m.bodyParts.leftArm.functionRatio;
  const rArm = m.bodyParts.rightArm.functionRatio;
  const armFn = Math.min(lArm, rArm) * 0.4 + (lArm + rArm) / 2 * 0.6;
  let aim = 1.0;
  aim *= 0.4 + armFn * 0.6;
  // perceivedPain (실제 pain이 아니라 느끼는 통증)
  aim *= 1.0 - (sr.perceivedPain / 100) * 0.35;
  // adrenaline 과다 — 손떨림 (0.7 이상에서 점진적 손해)
  if (sr.adrenaline > 0.7) aim *= 1.0 - (sr.adrenaline - 0.7) * 0.6;
  // panic
  aim *= 1.0 - sr.panic * 0.40;
  // breathing
  aim *= 0.5 + (m.breathingEfficiency / 100) * 0.5;
  // consciousness
  aim *= 0.4 + (m.consciousness / 100) * 0.6;
  // HR 과상승
  if (m.heartRate > 150) aim *= 1.0 - Math.min(0.25, (m.heartRate - 150) / 100);
  // tissuePerfusion 낮음
  aim *= 0.5 + Math.min(0.5, hd.tissuePerfusion * 0.5);
  m.aimMul = Math.max(0.05, Math.min(1.0, aim));
  // ===== move =====
  const lLeg = m.bodyParts.leftLeg.functionRatio;
  const rLeg = m.bodyParts.rightLeg.functionRatio;
  const legFn = (lLeg + rLeg) / 2;
  let mv = 1.0;
  mv *= 0.2 + legFn * 0.8;
  // perceivedPain (adrenaline으로 일부 완화)
  mv *= 1.0 - (sr.perceivedPain / 100) * 0.3;
  // shock
  mv *= 1.0 - (m.shock / 100) * 0.4;
  // low BP
  if (m.systolicBP < 90) mv *= 0.7;
  if (m.systolicBP < 70) mv *= 0.5;
  // breathing
  if (m.breathingEfficiency < 55) mv *= 0.7;
  // tissuePerfusion
  if (hd.tissuePerfusion < 0.6) mv *= 0.7;
  // postCombatCrash
  mv *= 1.0 - sr.postCombatCrash * 0.15;
  m.moveMul = Math.max(0, Math.min(1.0, mv));
  // ===== reaction =====
  let rx = 1.0;
  // adrenaline 적정 (0.3~0.7) — 약간 향상 / 과다 — 저하
  if (sr.adrenaline < 0.3) rx *= 1.0;
  else if (sr.adrenaline < 0.7) rx *= 1.0 + (sr.adrenaline - 0.3) * 0.15;
  else rx *= 1.06 - (sr.adrenaline - 0.7) * 0.5;
  // panic — 크게 악화
  rx *= 1.0 - sr.panic * 0.55;
  // shock
  rx *= 1.0 - (m.shock / 100) * 0.30;
  // low BP
  if (m.systolicBP < 80) rx *= 0.75;
  if (m.systolicBP < 60) rx *= 0.6;
  // consciousness
  rx *= 0.3 + (m.consciousness / 100) * 0.7;
  // postCombatCrash
  rx *= 1.0 - sr.postCombatCrash * 0.20;
  m.reactionMul = Math.max(0.25, Math.min(1.20, rx));
  // ===== reload =====
  let rl = 1.0;
  rl *= 0.3 + armFn * 0.7;
  rl *= 1.0 - (sr.perceivedPain / 100) * 0.25;
  rl *= 1.0 - sr.panic * 0.30;
  if (sr.adrenaline > 0.75) rl *= 1.0 - (sr.adrenaline - 0.75) * 0.4;   // 손떨림으로 재장전도 느려짐
  rl *= 0.4 + (m.consciousness / 100) * 0.6;
  m.reloadMul = Math.max(0.20, Math.min(1.0, rl));
  // ===== weaponHandling =====
  let wh = 1.0;
  wh *= 0.4 + armFn * 0.6;
  wh *= 1.0 - (sr.perceivedPain / 100) * 0.20;
  wh *= 1.0 - sr.panic * 0.25;
  if (sr.adrenaline > 0.8) wh *= 1.0 - (sr.adrenaline - 0.8) * 0.4;
  m.weaponHandlingMul = Math.max(0.25, Math.min(1.0, wh));
  // ===== stanceChange =====
  let sc = 1.0;
  sc *= 0.3 + legFn * 0.7;
  sc *= 1.0 - (sr.perceivedPain / 100) * 0.30;
  sc *= 1.0 - (m.shock / 100) * 0.35;
  if (m.systolicBP < 80) sc *= 0.75;
  if (m.breathingEfficiency < 60) sc *= 0.80;
  m.stanceChangeMul = Math.max(0.25, Math.min(1.0, sc));
  // canShoot / canMove 갱신
  // SIDE-WEAPON-INJURY-HANDLING-1A: canShoot은 절대 불가만 (사망/의식불명/의식 극저하/양팔 모두 기능상실).
  //   팔별·무기별 사용 가능 여부는 isWeaponSlotUsable()가 최종 판정.
  const _laGone = m.bodyParts.leftArm.disabled || (m.bodyParts.leftArm.functionRatio != null && m.bodyParts.leftArm.functionRatio <= 0.12);
  const _raGone = m.bodyParts.rightArm.disabled || (m.bodyParts.rightArm.functionRatio != null && m.bodyParts.rightArm.functionRatio <= 0.12);
  m.canShoot = !m.isDead && !m.isUnconscious && m.consciousness > 12 && !(_laGone && _raGone);
  m.canWalk = !m.isDead && !m.isUnconscious && m.consciousness > 25 && legFn > 0.30 && m.systolicBP > 60;
  m.canCrawl = !m.isDead && !m.isUnconscious && m.consciousness > 15 && armFn > 0.15;
  m.canMove = m.canWalk || m.canCrawl;
}
function recalcMedicalSummary(unit) {
  const m = unit.medical;
  if (!m) return;
  ensureMedicalExtensions(unit);
  const sr = m.stressResponse;
  const hd = m.hemodynamics;
  const hc = m.hormonalCompensation;
  // bodyHpTotal 합산
  let total = 0;
  for (const k of BODY_PART_KEYS) total += m.bodyParts[k].hp;
  m.bodyHpTotal = total;
  // lifeStatus — 종합 (혈액 + perfusion + shock + breathing + 의식 + 부위치명)
  let life = 100;
  const lossPct = (1 - m.bloodMl / m.bloodMax) * 100;
  life -= lossPct * 0.55;
  // tissuePerfusion이 낮으면 추가 감점 (단순 lossPct 선형 X)
  if (hd && hd.tissuePerfusion < 0.7) life -= (0.7 - hd.tissuePerfusion) * 50;
  if (hd && hd.oxygenDelivery < 0.6) life -= (0.6 - hd.oxygenDelivery) * 40;
  life -= m.shock * 0.30;
  if (m.systolicBP < 90) life -= (90 - m.systolicBP) * 0.25;
  if (m.breathingEfficiency < 70) life -= (70 - m.breathingEfficiency) * 0.4;
  if (m.consciousness < 50) life -= (50 - m.consciousness) * 0.35;
  // 부위 치명
  if (m.bodyParts.head.hp <= 0) { life = 0; m.deathReason = m.deathReason || 'head_destroyed'; }
  if (m.bodyParts.neck.hp <= 0) { life = Math.min(life, 5); m.deathReason = m.deathReason || 'neck_destroyed'; }
  if (m.bodyParts.chest.hp <= 5) { life -= 30; }
  if (m.bodyParts.abdomen.hp <= 5) { life -= 20; }
  m.lifeStatus = Math.max(0, Math.min(100, life));
  // legacy 표시값
  m.aimPerformance = m.aimMul * 100;
  m.mobility = m.moveMul * 100;
  m.reactionPerformance = m.reactionMul * 100;
  m.combatEffectiveness = (m.aimMul + m.moveMul + m.reactionMul) / 3 * 100;
  // boolean state
  m.isAlive = m.lifeStatus > 0 && !m.isDead;
  m.isCombatEffective = m.combatEffectiveness > 30 && m.canShoot;
  m.isUnconscious = m.consciousness < 20;
  // === statusTags 갱신 (우선순위 높은 것만) ===
  const tags = [];
  // 위중 (높은 우선순위)
  if (hd && hd.decompensatingShock) tags.push('보상 붕괴');
  else if (hd && hd.compensatedShock) tags.push('보상성 쇼크');
  if (hd && hd.compensationExhaustion > 0.6) tags.push('보상피로');
  if (sr && sr.panic > 0.6) tags.push('공황');
  if (sr && sr.postCombatCrash > 0.5) tags.push('전투 후 crash');
  // 보조
  if (sr && sr.adrenaline > 0.7 && tags.length < 4) tags.push('아드레날린 상승');
  if (sr && sr.painMasking > 0.4 && m.pain > 30 && tags.length < 4) tags.push('통증 둔화');
  if (sr && sr.combatArousal > 0.6 && tags.length < 4) tags.push('전투흥분');
  if (hd && hd.tissuePerfusion < 0.55 && tags.length < 5) tags.push('조직관류 저하');
  if (hd && hd.oxygenDelivery < 0.55 && tags.length < 5) tags.push('산소공급 저하');
  if (hd && hd.vascularTone > 1.25 && tags.length < 5) tags.push('혈관수축');
  if (hc && hc.vasopressin > 0.5 && tags.length < 6) tags.push('ADH 반응');
  if (hc && hc.raasActivation > 0.5 && tags.length < 6) tags.push('RAAS 활성');
  m.statusTags = tags;
}
function syncLegacyCombatState(unit) {
  const m = unit.medical;
  if (!m) return;
  // 사망 판정 (medical 기반)
  let dead = false;
  if (m.lifeStatus <= 0) dead = true;
  if (m.bodyParts.head.hp <= 0) { dead = true; m.deathReason = m.deathReason || 'head_destroyed'; }
  if (m.bloodMl < 1200) { dead = true; m.deathReason = m.deathReason || 'exsanguination'; }
  if (m.systolicBP < 30 && m.bloodMl < 1800) { dead = true; m.deathReason = m.deathReason || 'cardiac_failure'; }
  // downed 판정
  let downed = false;
  if (!dead) {
    if (m.consciousness < 30) downed = true;
    if (m.systolicBP < 70) downed = true;
    if (m.shock > 85) downed = true;
    if (m.lifeStatus < 25) downed = true;
    if (!m.canMove && !m.canShoot) downed = true;
    if (m.bloodMl < 2000) downed = true;
  }
  // conscious 판정
  const conscious = !m.isUnconscious;

  // 상태 변경 감지
  const wasDead = unit.isDead;
  const wasDowned = unit.isDowned;
  if (dead && !wasDead) {
    unit.isDead = true;
    unit.alive = false;
    unit.isDowned = true;   // dead도 시각적으론 downed
    unit.conscious = false;
    unit.combatState = 'dead';
    m.isDead = true; m.isAlive = false;
    // 사망 처리 시 stance 강제 prone (legacy 호환)
    unit.stance = 'prone';
    unit.forcedProneTimer = 9999;
    if (typeof log === 'function') log(`${unit.name} 전사 (${m.deathReason || 'unknown'})`, 'warn');
  } else if (downed && !wasDowned && !dead) {
    unit.isDowned = true;
    unit.alive = true;
    unit.canBeDragged = true;
    unit.conscious = conscious;
    unit.combatState = 'downed';
    m.isDowned = true;
    if (unit.downedTime === 0) unit.downedTime = 0.01;
    // downed 시 자세 prone (legacy)
    unit.stance = 'prone';
    if (typeof log === 'function') log(`${unit.name} 전투불능 (${m.lifeStatus.toFixed(0)}%)`, 'warn');
  } else if (!dead && !downed && wasDowned) {
    // 회복 — 다시 active (드물지만 처치로 가능)
    unit.isDowned = false;
    unit.canBeDragged = false;
    unit.combatState = m.lifeStatus < 70 ? 'wounded' : 'active';
  } else if (!dead && !downed) {
    unit.conscious = conscious;
    if (m.lifeStatus < 70 || m.bodyHpTotal < m.bodyHpMax * 0.85) {
      if (unit.combatState !== 'wounded') unit.combatState = 'wounded';
    }
  }

  // legacy hp (요약값) — lifeStatus 기반 0~100
  unit.hp = Math.round(m.lifeStatus);
  unit.maxHp = 100;
  // legacy bodyHp (이전 구조 호환) — 모든 부위 sync
  if (unit.bodyHp) {
    unit.bodyHp.head = m.bodyParts.head.hp;
    unit.bodyHp.neck = m.bodyParts.neck.hp;
    unit.bodyHp.chest = m.bodyParts.chest.hp;
    unit.bodyHp.abdomen = m.bodyParts.abdomen.hp;
    unit.bodyHp.left_arm = m.bodyParts.leftArm.hp;
    unit.bodyHp.right_arm = m.bodyParts.rightArm.hp;
    unit.bodyHp.left_leg = m.bodyParts.leftLeg.hp;
    unit.bodyHp.right_leg = m.bodyParts.rightLeg.hp;
    unit.bodyHp.arms = (m.bodyParts.leftArm.hp + m.bodyParts.rightArm.hp) / 2;
    unit.bodyHp.legs = (m.bodyParts.leftLeg.hp + m.bodyParts.rightLeg.hp) / 2;
  }
  // legacy pain
  unit.pain = m.pain;
  // legacy fracture tag — medical bodyParts.fracture 기반
  let hasArmFx = m.bodyParts.leftArm.fracture || m.bodyParts.rightArm.fracture;
  let hasLegFx = m.bodyParts.leftLeg.fracture || m.bodyParts.rightLeg.fracture;
  let hasChestFx = m.bodyParts.chest.fracture;
  if (hasArmFx && hasLegFx) unit.fracture = 'multiple';
  else if (hasArmFx) unit.fracture = 'arm';
  else if (hasLegFx) unit.fracture = 'leg';
  else if (hasChestFx) unit.fracture = 'chest';
  else unit.fracture = 'none';
  // bleeding tag (UI/AI용)
  const total = m.externalBleedRate + m.internalBleedRate;
  if (total < 0.5) unit.bleeding = 'none';
  else if (total < 8) unit.bleeding = 'light';
  else if (total < 30) unit.bleeding = 'heavy';
  else unit.bleeding = 'critical';
}
function makeUnit(opts) {
  // 팀 로드아웃 적용 — 명시적으로 opts에 지정된 값이 우선
  const teamLoadout = opts.loadout || (GAME.loadout && GAME.loadout[opts.team]) || {};   // SIDE-PER-OPERATOR-LOADOUT-1: 대원별 resolved loadout 우선
  // 팀 숙련도 적용
  const teamSkillCfg = (GAME.teamSkill && GAME.teamSkill[opts.team]) || {};
  const skillPreset = opts.skill || getSkillPreset(teamSkillCfg.presetId);
  const skill = {
    presetId: skillPreset.id || 'regular',
    presetName: skillPreset.name || '정규병',
    reaction: skillPreset.reaction != null ? skillPreset.reaction : 1.0,
    aimSpeed: skillPreset.aimSpeed != null ? skillPreset.aimSpeed : 1.0,
    accuracy: skillPreset.accuracy != null ? skillPreset.accuracy : 1.0,
    weakspot: skillPreset.weakspot != null ? skillPreset.weakspot : 1.0,
  };
  const u = {
    id: nextUnitId++,
    team: opts.team,
    name: opts.name,
    x: opts.x, y: opts.y,
    facing: opts.facing || 0,

    alive: true,
    hp: 100, maxHp: 100,
    // === 부위별 체력제 ===
    //   각 부위는 정상=100. 0이면 기능상실/치명.
    //   부위 손상은 woundSeverity로 누적, 일부는 전체 hp로 흘려 보낸다.
    bodyHp: { head: 100, neck: 100, chest: 100, abdomen: 100, arms: 100, legs: 100,
              left_arm: 100, right_arm: 100, left_leg: 100, right_leg: 100 },
    bodyHpMax: { head: 100, chest: 100, abdomen: 100, arms: 100, legs: 100 },
    // 전투 상태 — active(정상) / wounded(부상) / downed(전투불능, 살아있음) / dead(사망)
    combatState: 'active',
    isDowned: false,
    isDead: false,
    conscious: true,             // downed 상태에서 의식 여부
    canBeDragged: false,         // 끌고가기 대상 여부 (downed이면 true)
    draggedBy: null,             // 나를 끌고 있는 유닛 id
    draggingTarget: null,        // 내가 끌고 있는 유닛 id
    // === 응급처치 / 상태이상 ===
    bleeding: 'none',            // none / light / heavy / critical
    bleedingLoc: null,           // 출혈 부위 (arms/legs/abdomen/chest/head)
    bleedingTime: 0,             // 출혈 누적 시간
    fracture: 'none',            // none / arm / leg / chest / multiple
    painkillerActive: false,
    painkillerTimer: 0,          // 효과 잔여 시간 (초)
    painkillerDelay: 0,          // 발동 전 지연 (초)
    tourniquetAppliedAt: 0,      // 지혈대 적용 시각 (gameTime) — pain 증가 곡선 시작점
    tourniquetActive: false,
    stabilized: false,
    treatmentTimer: 0,           // 처치 중 잔여 시간 (초)
    treatmentTotal: 0,           // 처치 총 시간 (진행률 계산용)
    treatmentType: null,         // 'bandage' / 'tourniquet' / 'splint' / 'painkiller' / 'stabilizer'
    beingTreatedBy: null,        // 처치 중인 대원 id (자가처치면 자기 id)
    treatingTarget: null,        // 처치 시술 중인 대상 id
    pendingMedic: null,          // 접근 후 자동 실행할 처치/끌기 예약
                                 // { type:'treat'|'drag', targetId, treatType?, location? }
    pendingDoor: null,           // 접근 후 자동 개방할 문 예약 { door, t, manual, want }
    pendingPeek: null,           // 힐끗 보고 돌아오는 왕복 예약 { phase, fromX/Y, exX/Y, watchX/Y, ... }
    pendingFrag: null,           // 던지고 터진 뒤 진입하는 다단계 계획 { phase, th, spot, ... }
    flashBlindTimer: 0,          // 섬광 — 시야 상실 잔여(초). 감각기관 스캔도 멈춘다
    flashDeafTimer: 0,           // 섬광 — 청각 상실 잔여(초)
    // === 투척 장비 인벤토리 ===
    //   throwables: { [throwableId]: count } — 미래 확장 (다양한 수류탄/연막/섬광 등)
    //   기본 지급은 initUnitThrowables에서 처리
    throwables: {},
    throwState: null,            // 투척 진행 상태 { id, targetX, targetY, prepTimer, flightTimer, ... }
    // === 자세 + 수류탄 반응 ===
    stance: 'standing',          // 'standing' | 'prone'
    forcedProneTimer: 0,         // 강제 엎드림 잔여 시간 (초)
    spawnedAt: GAME.gameTime || 0,   // 스폰 시각 — 스폰 직후 grace period
    lastRoomEntryTime: null,         // 방 진입 시각 — 진입 직후 grace
    stanceTime: 0,                   // 현재 stance 지속 시간
    proneTime: 0,                    // prone 지속 시간 (proneTime != stanceTime 별도)
    grenadeReactedIds: null,     // Set<throwableInstanceId> — 이미 반응한 수류탄
    grenadeReactionCooldown: 0,  // 새 반응 가능까지 (초)
    grenadeReactionDelay: 0,     // 반응 결정 지연 (초)
    pendingGrenadeReact: null,   // { type:'evade'|'prone', grenadeRef, panicked? }

    // === Utility AI (점수 기반 행동 선택 레이어) ===
    aiIntent: 'none',            // 현재 의도: 'engage' | 'seekCover' | 'holdCover' | 'retreat' | 'goProne' | 'reload' | 'investigateNoise' | 'holdAngle' | 'reposition' | 'reassess' | 'guardNoise' | 'crawlToCover' | 'none'
    aiAction: null,              // { type, startedAt, minDuration, targetX, targetY, reason, score, afterAction }
    aiUtilityNext: 0,            // 다음 판단 시간 (GAME.gameTime 기준)
    aiUtilityDebug: null,        // { topActions: [...], picked, ctxSummary }
    _aiCommandPath: null,        // Utility AI가 발급한 명령 (플레이어 명령과 구분)
    aiState: 'idle',             // === 상태 머신 (호환 유지): idle/alert/investigateNoise/searchNoise/contact/suppressed/downed
    aiStateTimer: 0,             // 현재 상태 진입 시각 (gameTime). 상태 머문 시간 계산용.
    aiSearchTimer: 0,            // searchNoise 잔여 시간
    aiStateLogged: '',           // 마지막 로그된 상태 (중복 방지)
    _aiCoverTarget: null,        // {x,y} 자동 엄폐 대상 위치
    _aiCoverTimer: 0,            // 엄폐 시도 쿨다운
    downedTime: 0,               // downed 상태 진입 후 경과 시간 (초) — 명중률 회복용
    _playerPathBackup: null,     // 자동 엄폐 시 플레이어 명령 백업 — 도착 후 복귀
    _lastReportedConscious: true,
    _lastReportedState: null,
    // === 저지력 / 고통 (1차) ===
    //   stoppingTimer — 피격 직후 짧게 행동 방해 (초)
    //   pain — 누적 고통 0~100. 시간에 따라 천천히 감소.
    pain: 0,
    stoppingTimer: 0,
    _painReportedTier: 0,   // 큰 고통 변화 로그용 (0/30/60 단계)
    suppression: 0,
    pinned: false,
    stance: 'standing',

    sightRange: SIGHT_RANGE,
    viewArc: opts.team === 'friend' ? VIEW_ARC_FRIEND : VIEW_ARC_ENEMY,
    fireArc: opts.team === 'friend' ? FIRE_ARC_FRIEND : FIRE_ARC_ENEMY,
    // SIDE-METRIC-SCALE-1 §8: 이동속도는 m/s가 기준 (legacy 75/55/35/30 px÷20 = 3.75/2.75/1.75/1.5 m/s). px/s는 파생.
    moveSpeedMps: opts.team === 'friend' ? 3.75 : 2.75,
    moveSpeedEngagedMps: opts.team === 'friend' ? 1.75 : 1.5,
    moveSpeed: mToPx(opts.team === 'friend' ? 3.75 : 2.75),         // px/s 파생 (기존 코드 호환)
    moveSpeedEngaged: mToPx(opts.team === 'friend' ? 1.75 : 1.5),

    weaponId:    _resolveLoadoutWeaponId(opts.weaponId || teamLoadout.weaponId || (opts.team === 'friend' ? 'm4a1' : 'akm')),
    ammoId:      opts.ammoId      || teamLoadout.ammoId      || '556_m855',
    bodyArmorId: opts.bodyArmorId || teamLoadout.bodyArmorId || (opts.team === 'friend' ? 'iotv_test' : 'armor_6b23_test'),
    helmetId:    opts.helmetId    || teamLoadout.helmetId    || (opts.team === 'friend' ? 'mich_test' : 'helmet_6b47_test'),
    // 플레이트 — 방호 정보 탭에서 선택. loadout 또는 opts에서 전달
    frontPlateId: opts.frontPlateId || teamLoadout.frontPlateId || 'no_front_plate',
    backPlateId:  opts.backPlateId  || teamLoadout.backPlateId  || 'no_back_plate',
    sidePlateId:  opts.sidePlateId  || teamLoadout.sidePlateId  || 'no_side_plate',
    // 추가 보호구
    groinGuardId:    opts.groinGuardId    || teamLoadout.groinGuardId    || 'no_groin_guard',
    shoulderGuardId: opts.shoulderGuardId || teamLoadout.shoulderGuardId || 'no_shoulder_guard',
    neckGuardId:     opts.neckGuardId     || teamLoadout.neckGuardId     || 'no_neck_guard',
    visorId:         opts.visorId         || teamLoadout.visorId         || 'no_visor',
    slaapId:         opts.slaapId         || teamLoadout.slaapId         || 'no_slaap',

    skill,

    aimTimer: 0,
    fireTimer: 0,
    currentTarget: null,

    // 디버그용 — 마지막 사격의 명중률/거리/조준안정도
    _lastAimQuality: 0,
    _lastHitChance: 0,
    _lastDistanceFactor: 1.0,

    _spotted: false,
    _lastSeenAt: -999,

    movePath: [],
    homeFacing: opts.facing || 0,

    // === Range / passive target (이번 작업) ===
    //   role: 'reactive' (대응사격) | 'passive' (사격 X — 사격장 표적)
    //   spawnX/Y/Facing: 재생성 시 사용
    //   respawnDelay/respawnTimer: passive 사망 후 재생성
    role: opts.role || (opts.team === 'enemy' ? 'reactive' : 'reactive'),
    // 성향 — "무엇을 하고 싶나". 숙련도와 축이 다르다 (아래 rollTraits 주석 참조).
    traits: opts.traits || rollTraits(opts),
    spawnX: opts.x, spawnY: opts.y, spawnFacing: opts.facing || 0,
    respawnDelay: opts.role === 'passive' ? 4.0 : 0,
    respawnTimer: 0,

    // === 수동 사격 ===
    //   manualFireTarget: {x, y} 또는 null. 한 번의 trigger로 처리되고 클리어.
    manualFireTarget: null,
    // === 사격 큐 (BURST/FULL 시간차 발사용) ===
    //   shotQueue가 있으면 매 프레임 shotTimer를 감소시키고
    //   0이 되면 fireSingleShot()으로 1발씩 발사한다.
    shotQueue: null,   // null | { fireMode, shotsRemaining, shotDelay, shotTimer,
                       //         targetX, targetY, targetId, baseAng, baseSpread,
                       //         baseAimQuality, weaponId, totalShots }

    // === Threat Awareness (이번 작업) ===
    // 적별 마지막 위치 기억: { [enemyId]: { id, x, y, time, confidence } }
    lastKnownEnemies: {},
    // 탄이 스쳤거나 피격 받았을 때의 위협 방향 (radians, 또는 null)
    threatDirection: null,
    threatTime: -999,
    threatTimer: 0,
    // === 소음 시스템 ===
    lastHeardNoise: null,       // { x, y, time, confidence, type, sourceTeam }
    footstepTimer: 0,           // 발소리 step interval 카운터
    // 마지막 도착한 waypoint의 facing 유지값 (movePath 비었을 때)
    _holdFacing: null,
    // 견제사격 쿨다운
    _suppressFireTimer: 0,
    // 엄호사격 쿨다운 (coverMate 중 제압사격)
    _coverFireTimer: 0,
    // 디버그/UI용 — 현재 시선이 어디를 향하는 이유
    _aimType: 'idle',
  };
  // 탄창/재장전/발사방식 초기화
  // SIDE-WEAPON-PLATFORM-1A §11: weaponState(주/보조 슬롯 + build) 초기화 — legacy weaponId/ammoId/mag/reserve와 동기화
  if (typeof initializeWeaponStateFromLoadout === 'function') {
    try { initializeWeaponStateFromLoadout(u, teamLoadout); } catch (e) { if (typeof console !== 'undefined') console.warn('weaponState init 실패', e && e.message); }
  }
  initUnitAmmo(u);
  // 장비 무게 초기화 (loadWeightKg / loadClass 캐시)
  updateUnitWeight(u);
  // 방어구 내구도 초기화
  rebuildArmorDurability(u);
  // 기본 투척 장비 — 대원별 resolved loadout 기반 (GAME.loadout 재참조 금지)
  if (!u.throwables || Object.keys(u.throwables).length === 0) {
    const lethalId = teamLoadout && teamLoadout.lethalGrenadeId;
    const lethalCount = teamLoadout && teamLoadout.lethalGrenadeCount != null ? teamLoadout.lethalGrenadeCount : 1;
    u.throwables = {};
    if (lethalId && lethalId !== 'none' && THROWABLE_PRESETS[lethalId] && lethalCount > 0) {
      u.throwables[lethalId] = lethalCount;
    }
    const stunId = teamLoadout && teamLoadout.stunGrenadeId;
    const stunCount = teamLoadout && teamLoadout.stunGrenadeCount != null ? teamLoadout.stunGrenadeCount : 0;
    if (stunId && stunId !== 'none' && THROWABLE_PRESETS[stunId] && stunCount > 0) {
      u.throwables[stunId] = stunCount;
    }
    const smokeId = teamLoadout && teamLoadout.smokeGrenadeId;
    const smokeCount = teamLoadout && teamLoadout.smokeGrenadeCount != null ? teamLoadout.smokeGrenadeCount : 0;
    if (smokeId && smokeId !== 'none' && THROWABLE_PRESETS[smokeId] && smokeCount > 0) {
      u.throwables[smokeId] = smokeCount;
    }
  }
  u.loadoutKey = opts.loadoutKey || null;            // SIDE-PER-OPERATOR-LOADOUT-1
  u.loadoutSource = opts.loadoutSource || null;
  u.loadoutSnapshot = cloneLoadoutForOperator(teamLoadout);
  // === Medical 시스템 초기화 ===
  u.medical = createMedical();
  initMedicalResources(u);   // SIDE-MEDICAL-FIELDCARE-RESOURCE-1 §1: 현장 처치 자원
  recalcMedicalSummary(u);
  // SIDE-AMMO-1B-HOTFIX-2: 인체 관통 저항 scaffold (현재 Mk211 신관 판단 전용, 후속 의료 trajectory 연결용)
  u.bodyResistanceProfile = {
    profileId: 'human_default', enabled: true, futureMedicalTrajectoryHook: true,
    usedCurrentlyFor: ['mk211_fuze_only'],
    directionMul: BODY_HIT_DIRECTION_RESISTANCE_MUL, partResistance: BODY_PART_RESISTANCE_TABLE,
  };
  return u;
}
function rebuildArmorDurability(unit) {
  if (!unit) return;
  unit.armorDurability = {};
  const ba = unit.bodyArmorId ? BODY_ARMOR_PRESETS[unit.bodyArmorId] : null;
  const hm = unit.helmetId ? HELMET_PRESETS[unit.helmetId] : null;

  // Soft armor — 방탄복 자체 (전/후/좌/우)
  if (ba && ba.softMaxDurability) {
    const mat = (ba.coverage && ba.coverage.chest && ba.coverage.chest.soft && ba.coverage.chest.soft.material) || 'aramid';
    const m = ba.softMaxDurability;
    // 부위별 분리. 같은 max 공유.
    for (const k of ['chest_front_soft','chest_rear_soft','chest_left_soft','chest_right_soft',
                     'abdomen_front_soft','abdomen_rear_soft']) {
      unit.armorDurability[k] = { current: m, max: m, material: mat, sourceId: ba.id };
    }
  }

  // Plates — front / back / side
  // SIDE-KORUND-FRONTSET §3.4: frontSet은 slot별 분리 max, 그 외는 maxDurability fallback
  function getPlateMaxDurabilityForSlot(plate, slotKey) {
    if (!plate) return 50;
    if (plate.frontSetSlotMax && plate.frontSetSlotMax[slotKey] != null) return plate.frontSetSlotMax[slotKey];
    if (plate.slotMax && plate.slotMax[slotKey] != null) return plate.slotMax[slotKey];
    return plate.maxDurability || 50;
  }
  function addPlateDurability(slotKey, plateId) {
    if (!plateId) return;
    const p = PLATE_PRESETS[plateId];
    if (!p || p.isNone) return;
    const max = getPlateMaxDurabilityForSlot(p, slotKey);   // §3.4 frontSet slot별 분리
    unit.armorDurability[slotKey] = {
      current: max, max,
      material: p.material || 'composite',
      sourceId: plateId,
    };
  }
  // 6B23 frontSet: chest_front + abdomen_front 둘 다
  const fp = unit.frontPlateId ? PLATE_PRESETS[unit.frontPlateId] : null;
  if (fp && !fp.isNone) {
    if (fp.slotType === 'frontSet') {
      addPlateDurability('chest_front_hard', unit.frontPlateId);
      addPlateDurability('abdomen_front_hard', unit.frontPlateId);
    } else {
      addPlateDurability('chest_front_hard', unit.frontPlateId);
    }
  }
  // back
  addPlateDurability('chest_rear_hard', unit.backPlateId);
  // side: 좌/우 한 장씩 — left_side_hard / right_side_hard 통합 슬롯
  //   chest_left / abdomen_left 피격은 모두 left_side_hard를 참조한다.
  //   chest_right / abdomen_right 피격은 모두 right_side_hard를 참조한다.
  if (unit.sidePlateId && PLATE_PRESETS[unit.sidePlateId] && !PLATE_PRESETS[unit.sidePlateId].isNone) {
    addPlateDurability('left_side_hard',  unit.sidePlateId);
    addPlateDurability('right_side_hard', unit.sidePlateId);
  }

  // Police Vest 등 고정 알루미늄 — bodyArmor coverage에 hardArmor 있으면 hard slot 생성
  if (ba && ba.coverage) {
    function ensureHardFromArmor(slotKey, covKey) {
      if (unit.armorDurability[slotKey]) return;   // plate가 이미 있으면 skip
      const c = ba.coverage[covKey];
      if (!c || !c.hard || !c.hard.smallArmor || c.hard.smallArmor <= 0) return;
      const max = ba.softMaxDurability || 50;
      unit.armorDurability[slotKey] = {
        current: max, max,
        material: c.hard.material || 'aluminum',
        sourceId: ba.id + ':fixed',
      };
    }
    ensureHardFromArmor('chest_front_hard',   'chest_front');
    ensureHardFromArmor('chest_rear_hard',    'chest_rear');
    ensureHardFromArmor('abdomen_front_hard', 'abdomen_front');
    ensureHardFromArmor('abdomen_rear_hard',  'abdomen_rear');
  }

  // 헬멧
  if (hm && hm.maxDurability) {
    const skullMat = (hm.head_skull && hm.head_skull.hard && hm.head_skull.hard.material) || 'aramid';
    const tempMat = (hm.head_temporal && hm.head_temporal.hard && hm.head_temporal.hard.material) || skullMat;
    const m = hm.maxDurability;
    unit.armorDurability.head_skull_shell    = { current: m, max: m, material: skullMat, sourceId: unit.helmetId };
    unit.armorDurability.head_temporal_shell = { current: m, max: m, material: tempMat,  sourceId: unit.helmetId };
  }

  // 추가 보호구
  function addAccDurability(slotKey, accId) {
    if (!accId) return;
    const a = PROTECTION_ACCESSORY_PRESETS[accId];
    if (!a || a.isNone) return;
    const max = a.maxDurability || 25;
    unit.armorDurability[slotKey] = {
      current: max, max,
      material: a.material || 'aramid',
      durabilityMaterial: a.durabilityMaterial || a.material || 'aramid',
      sourceId: accId,
    };
  }
  addAccDurability('groin_soft',      unit.groinGuardId);
  addAccDurability('neck_soft',       unit.neckGuardId);
  // shoulder: 좌/우 분리 (한 쌍이지만 내구도는 좌/우)
  if (unit.shoulderGuardId && PROTECTION_ACCESSORY_PRESETS[unit.shoulderGuardId]
      && !PROTECTION_ACCESSORY_PRESETS[unit.shoulderGuardId].isNone) {
    addAccDurability('left_arm_soft',  unit.shoulderGuardId);
    addAccDurability('right_arm_soft', unit.shoulderGuardId);
  }
  // 바이저 — PRETRAUMA-STAB-1 §4.3 A안: visorHitTable이면 슬롯은 'mixed'(분류/표시용) shared pool 유지.
  //   실제 손상/곡선 계산은 피격 zone의 durabilityMaterial(glass/titanium)이 protection._zoneDurabilityMaterial로 항상 우선.
  //   zone별 별도 내구도 풀 분리는 다음 패치 TODO.
  if (unit.visorId && PROTECTION_ACCESSORY_PRESETS[unit.visorId]
      && !PROTECTION_ACCESSORY_PRESETS[unit.visorId].isNone) {
    const v = PROTECTION_ACCESSORY_PRESETS[unit.visorId];
    const max = v.maxDurability || 28;
    unit.armorDurability.head_face_visor = {
      current: max, max,
      material: v.material || 'pe',
      durabilityMaterial: v.durabilityMaterial || (v.visorHitTable ? 'mixed' : v.material) || 'pe',
      sourceId: unit.visorId,
    };
  }
  addAccDurability('head_front_slaap', unit.slaapId);
  // 2A-6.2: 바이저 시야/분리내구도 상태 초기화
  try { initUnitVisorState(unit); } catch (e) {}
}
const TRAIT_ARCHETYPES = [
  { key: 'assault',  aggression:  0.80, caution: -0.30 },   // 돌격 — 밀어붙인다
  { key: 'methodic', aggression:  0.20, caution:  0.80 },   // 신중 — 밀되 먼저 본다
  { key: 'support',  aggression: -0.60, caution:  0.50 },   // 지원 — 자리를 지킨다
  { key: 'reckless', aggression:  0.50, caution: -0.80 },   // 무모 — 나가되 대책이 없다
];
function _traitHash(str, salt) {
  let h = 2166136261 ^ (salt || 0);
  const t = String(str || '');
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;                        // 0..1
}
function rollTraits(opts) {
  const o = opts || {};
  const skill = (o.skill && o.skill.presetId) || o.skillId || 'regular';
  // 숙련도가 높을수록 기질이 덜 튄다 — 잘 훈련된 대원은 기질보다 교리를 따른다.
  const damp = skill === 'elite' ? 0.55 : skill === 'veteran' ? 0.75 : 1.0;
  const name = o.name || '';
  const m = /(\d+)\s*$/.exec(name);
  const idx = m ? (parseInt(m[1], 10) - 1) : Math.floor(_traitHash(name, 7) * TRAIT_ARCHETYPES.length);
  const a = TRAIT_ARCHETYPES[((idx % TRAIT_ARCHETYPES.length) + TRAIT_ARCHETYPES.length) % TRAIT_ARCHETYPES.length];
  const j = (salt) => (_traitHash(name, salt) * 2 - 1) * 0.15;   // 같은 원형끼리도 조금은 다르다
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  return {
    key: a.key,
    aggression: +clamp((a.aggression + j(11)) * damp).toFixed(2),
    caution:    +clamp((a.caution    + j(29)) * damp).toFixed(2),
  };
}
function _ammoBigBore(ammo) { return !!(ammo && ammo.caliber && String(ammo.caliber).indexOf('12.7') >= 0); }
function _ammoNotes(ammo) { return (ammo && ((ammo.ui && ammo.ui.notes) || ammo.notes || ammo._notes)) || []; }
function _noteHas(ammo, k) { const n = _ammoNotes(ammo); return Array.isArray(n) && n.indexOf(k) >= 0; }
function _incendiaryInfo(ammo) {
  if (!ammo) return null;
  const beh = ammo.barrierBehavior || '';
  const isInc = beh.indexOf('api') >= 0 || _noteHas(ammo,'api') || _noteHas(ammo,'api_t') || _noteHas(ammo,'incendiary') || _noteHas(ammo,'incendiaryFuture');
  if (!isInc) return null;
  const big = _ammoBigBore(ammo);
  return { enabled:true, flashOnly:true, armorScorch:true, ignitionEnabled:false, postPenOnly:true,
    postPenInternalDamageMul: big?1.10:1.07, postPenShockMul: big?1.07:1.05, postPenPainMul: big?1.07:1.05 };
}
const BODY_HIT_DIRECTION_RESISTANCE_MUL = {
  front:          { resistanceMul: 1.00, note: 'front torso/limb path' },
  rear:           { resistanceMul: 1.00, note: 'rear body path' },
  side:           { resistanceMul: 0.75, note: 'side hit shorter body path' },
  oblique:        { resistanceMul: 1.15, note: 'angled longer tissue track' },
  lengthwise_limb:{ resistanceMul: 1.25, note: 'longitudinal limb path' },
};
const BODY_PART_RESISTANCE_TABLE = {
  head:          { penetrationCost: 8,  dropRatio: 0.08, triggerBias: 0.05, cls: 'dense_head' },
  neck:          { penetrationCost: 6,  dropRatio: 0.06, triggerBias: 0.05, cls: 'soft_tissue' },
  chest_front:   { penetrationCost: 10, dropRatio: 0.10, triggerBias: 0.08, cls: 'torso' },
  chest_side:    { penetrationCost: 8,  dropRatio: 0.08, triggerBias: 0.06, cls: 'torso' },
  abdomen_front: { penetrationCost: 9,  dropRatio: 0.09, triggerBias: 0.06, cls: 'torso' },
  abdomen_side:  { penetrationCost: 7,  dropRatio: 0.07, triggerBias: 0.04, cls: 'torso' },
  pelvis:        { penetrationCost: 12, dropRatio: 0.12, triggerBias: 0.10, cls: 'dense_pelvis' },
  shoulder_outer:{ penetrationCost: 6,  dropRatio: 0.06, triggerBias: 0.03, cls: 'muscle' },
  upper_arm:     { penetrationCost: 5,  dropRatio: 0.05, triggerBias: 0.00, cls: 'muscle' },
  forearm:       { penetrationCost: 4,  dropRatio: 0.04, triggerBias: -0.02, cls: 'thin_limb' },
  thigh:         { penetrationCost: 8,  dropRatio: 0.08, triggerBias: 0.05, cls: 'muscle' },
  calf:          { penetrationCost: 5,  dropRatio: 0.05, triggerBias: 0.00, cls: 'muscle' },
  hand_foot:     { penetrationCost: 3,  dropRatio: 0.03, triggerBias: -0.05, cls: 'thin_limb' },
};
const MEDICAL_RESOURCE_DEFAULTS = {
  bandage:4, pressure_bandage:2, hemostatic_gauze:2, wound_packing:1, tourniquet:2,
  oxygen:1, pelvic_binder:1, iv_fluid:1, blood_pack:0, analgesic:2, splint:1
};
function initMedicalResources(unit) {
  if (!unit) return;
  if (!unit.medicalResources) unit.medicalResources = Object.assign({}, MEDICAL_RESOURCE_DEFAULTS);
}
function cloneLoadoutForOperator(ld) {
  const c = ld ? JSON.parse(JSON.stringify(ld)) : {};
  if (typeof migrateTeamLoadout === 'function') migrateTeamLoadout(c);
  return c;
}
function updateHemodynamicsR(unit, dt) {
  const m = unit.medical;
  const hd = m.hemodynamics;
  const sr = m.stressResponse;
  const hc = m.hormonalCompensation;
  // volumeRatio — 0~1.05 clamp (안전)
  hd.volumeRatio = clampMed(m.bloodMl / Math.max(1, m.bloodMax), 0, 1.05);
  // preload — 정맥환류 (혈액량 기반, 0.05~1.15 clamp)
  let preloadTarget;
  if (m.bloodMl >= 4250) preloadTarget = 1.0;
  else if (m.bloodMl >= 3500) preloadTarget = 0.95 - (4250 - m.bloodMl) / 750 * 0.10;
  else if (m.bloodMl >= 3000) preloadTarget = 0.85 - (3500 - m.bloodMl) / 500 * 0.20;
  else if (m.bloodMl >= 2500) preloadTarget = 0.65 - (3000 - m.bloodMl) / 500 * 0.20;
  else if (m.bloodMl >= 2000) preloadTarget = 0.45 - (2500 - m.bloodMl) / 500 * 0.15;
  else preloadTarget = Math.max(0.10, 0.30 - (2000 - m.bloodMl) / 1500 * 0.20);
  preloadTarget = clampMed(preloadTarget, 0.05, 1.15);
  hd.preload = clampMed(approachValue(hd.preload, preloadTarget, 1.2, 1.2, dt), 0.05, 1.15);
  // vascularTone (혈관수축) — 0.5~1.8 clamp
  const toneFromSymp = sr.sympatheticTone * 0.4;
  const toneFromHormone = hc.vasopressin * 0.25 + hc.angiotensinTone * 0.20;
  let toneTarget = 1.0 + toneFromSymp + toneFromHormone;
  toneTarget *= (1 - hd.compensationExhaustion * 0.5);
  toneTarget = clampMed(toneTarget, 0.5, 1.8);
  hd.vascularTone = clampMed(approachValue(hd.vascularTone, toneTarget, 0.8, 0.8, dt), 0.5, 1.8);
  hd.systemicVascularResistance = clampMed(hd.vascularTone, 0.5, 1.8);
  // contractility — 0.4~1.5 clamp
  let contractTarget = 1.0 + sr.adrenaline * 0.25 + sr.sympatheticTone * 0.15;
  contractTarget *= (1 - hd.compensationExhaustion * 0.4);
  contractTarget *= Math.max(0.6, Math.min(1.0, hd.oxygenDelivery));
  contractTarget = clampMed(contractTarget, 0.4, 1.5);
  hd.contractility = clampMed(approachValue(hd.contractility, contractTarget, 1.0, 1.0, dt), 0.4, 1.5);
  // strokeVolumeMul = preload * contractility — HR 효율 감소
  let svMul = hd.preload * hd.contractility;
  const hr = m.heartRate;
  if (hr > 100) svMul *= 1 - Math.min(0.45, (hr - 100) / 80 * 0.45);
  if (hr > 170) svMul *= 0.7;
  hd.strokeVolumeMul = clampMed(svMul, 0.05, 1.3);
  // cardiacOutputMul — SV 가중치 0.7, HR factor 0.3 (둘 다 곱하면 폭증)
  // CARDIAC-1R §8: 명시적 빈맥/서맥 penalty. 정상범위 보상, 과도 빈맥은 filling time↓, 서맥은 output↓.
  let hrFactor = clampMed(hr / 75, 0.5, 2.0);
  let fillingTimePenalty = 1.0, bradyPenalty = 1.0;
  if (hr > 145) fillingTimePenalty = 1 - Math.min(0.35, (hr - 145) / 60 * 0.35);   // 145+ 충만 시간 감소
  if (hr < 50)  bradyPenalty = Math.max(0.45, hr / 50);                              // 50↓ output 저하
  hrFactor *= fillingTimePenalty * bradyPenalty;
  // 직전 tick의 불안정 리듬이면 관류 리듬 효율 하락 (1-tick feedback — 약하게, 보수적).
  const _priorRhythm = m.cardiacRhythmModel;
  let perfusingRhythmFactor = 1.0;
  if (_priorRhythm && _priorRhythm.perfusingRhythmFactor != null) perfusingRhythmFactor = _priorRhythm.perfusingRhythmFactor;
  hd.cardiacEfficiency = +(fillingTimePenalty * bradyPenalty * perfusingRhythmFactor).toFixed(3);
  hd.cardiacOutputMul = clampMed(
    (hd.strokeVolumeMul * 0.7 + hd.strokeVolumeMul * hrFactor * 0.3) * (0.7 + perfusingRhythmFactor * 0.3), 0.05, 1.5
  );
  // MAP
  hd.map = clampMed(93 * (hd.cardiacOutputMul * 0.6 + hd.systemicVascularResistance * 0.4), 20, 200);
  hd.pulsePressure = clampMed(hd.strokeVolumeMul * 40, 15, 80);
  // tissuePerfusion — MAP + CO 종합 (0~1.2 clamp)
  hd.tissuePerfusion = clampMed(
    (hd.map / 93) * 0.5 + (hd.cardiacOutputMul / 1.0) * 0.5, 0, 1.2
  );
  // oxygenDelivery
  hd.oxygenDelivery = clampMed(
    hd.tissuePerfusion * (m.breathingEfficiency / 100) * 0.9 + 0.1, 0, 1.2
  );
  // FIELD-STAB-1 §8/§14: airway support → oxygenDelivery 제한적 보정 (직전 tick 값, 1-tick feedback).
  //   원인(저산소)을 약하게 완화할 뿐 — bloodMl/internal bleeding/tension은 건드리지 않음.
  const _fs = m.fieldStabilizationModel;
  if (_fs) {
    const awMod = (_fs.airwaySupport && _fs.airwaySupport.oxygenDeliveryModifier) || 1.0;
    hd.oxygenDelivery = clampMed(hd.oxygenDelivery * awMod, 0, 1.2);
    // circulation support — MAP/perfusion 매우 제한적 보정 (field limited)
    const csMapMod = (_fs.circulationSupport && _fs.circulationSupport.mapSupportModifier) || 1.0;
    const csPerfMod = (_fs.circulationSupport && _fs.circulationSupport.perfusionSupportModifier) || 1.0;
    if (csMapMod !== 1.0) hd.map = clampMed(hd.map * csMapMod, 20, 200);
    if (csPerfMod !== 1.0) { hd.tissuePerfusion = clampMed(hd.tissuePerfusion * csPerfMod, 0, 1.2); hd.oxygenDelivery = clampMed(hd.oxygenDelivery * csPerfMod, 0, 1.2); }
  }
  // RESIDUAL HOTFIX 3: iv_fluid / oxygen 보조효과 제한 지속 (시간벌기 · 매우 약함). 출혈 source / internalBleeding / surgery·transfusion·definitiveCare markers 불변.
  const _nowHd = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  if (m._ivAssistUntil && _nowHd < m._ivAssistUntil) {
    hd.map = clampMed(hd.map * 1.03, 20, 200);                         // 수액: MAP/perfusion 중심 소폭 (bloodMl/oxygenDelivery 혈액대체 아님)
    hd.tissuePerfusion = clampMed(hd.tissuePerfusion * 1.02, 0, 1.2);
  }
  if (m._oxygenAssistUntil && _nowHd < m._oxygenAssistUntil) {
    // 산소: oxygenDelivery 소폭만 (bloodMl 회복 아님). 혈액량 극도 부족/호흡효율 급락 시 효과 제한.
    const _o2cap = (m.breathingEfficiency < 25 || hd.volumeRatio < 0.55) ? 1.02 : 1.04;
    hd.oxygenDelivery = clampMed(hd.oxygenDelivery * _o2cap, 0, 1.2);
  }
  // compensationLoad
  hd.compensationLoad = clamp01(
    sr.sympatheticTone * 0.5 + sr.adrenaline * 0.3
    + Math.max(0, (hd.vascularTone - 1.0) * 0.8) + hc.vasopressin * 0.3
  );
  // R: deficit/load equilibrium, independent of dwell time. Game tuning.
  const deficit=Math.max(0,1-hd.volumeRatio);
  const drive=clamp01((deficit-.40)/.60);
  hd.compensationExhaustion=drive**4*hd.compensationLoad;
  // compensated/decompensating shock 판정
  hd.compensatedShock = (m.bloodMl < 3500 && m.systolicBP >= 90 && hd.compensationLoad > 0.4);
  // CARDIAC-1R Cleanup B: decompensatingShock을 preArrestRisk/readySignal보다 먼저 계산 —
  //   severe shock tick에서 신호가 한 tick 늦게 켜지는 현상 제거 (최신 상태 반영).
  hd.decompensatingShock = (m.bloodMl < 2800 && m.systolicBP < 90 && hd.compensationLoad > 0.5)
    || (hd.compensationExhaustion > 0.6 && m.systolicBP < 95);
  // === PRECARDIAC-1 §5: 위험 단계 flag (다음 cardiac 단계 입력 — rhythm state 아님) ===
  hd.hypovolemiaSeverity = (m.bloodMl >= 4250) ? 'none' : (m.bloodMl >= 3500) ? 'mild' : (m.bloodMl >= 3000) ? 'moderate' : (m.bloodMl >= 2500) ? 'severe' : 'critical';
  hd.poorPerfusion = hd.tissuePerfusion < 0.6;
  // SIDE-MED-PHYS-HOTFIX-1A §2-B: confirmed_physiologic oxygenDrain — 잔여 저산소 보조 감쇠 (breathingDrain과 중복 크기 금지, bloodMl 영향 없음)
  {
    const _pep = aggregatePhysiologicEffectProfile(unit.medical);
    if (_pep.oxygenDrain > 0) hd.oxygenDelivery = clampMed(hd.oxygenDelivery * (1 - _pep.oxygenDrain * 0.50), 0, 1.2);
  }
  hd.oxygenDebt = hd.oxygenDelivery < 0.6;
  // preArrestRisk는 "위험 힌트"일 뿐 — arrest/사망 판정에 직접 사용 금지 (rhythm 본편은 후속 단계).
  hd.preArrestRisk = (hd.hypovolemiaSeverity === 'critical') || (hd.oxygenDelivery < 0.4) || (hd.decompensatingShock && hd.compensationExhaustion > 0.7);
  hd.cardiacRhythmReadySignal = hd.preArrestRisk || hd.decompensatingShock || hd.oxygenDebt;
}
function updateHemodynamicsR2(unit, dt) {
  const m = unit.medical;
  const hd = m.hemodynamics;
  const sr = m.stressResponse;
  const hc = m.hormonalCompensation;
  // volumeRatio — 0~1.05 clamp (안전)
  hd.volumeRatio = clampMed(m.bloodMl / Math.max(1, m.bloodMax), 0, 1.05);
  // preload — 정맥환류 (혈액량 기반, 0.05~1.15 clamp)
  let preloadTarget = preloadTargetR2(hd.volumeRatio);
  hd.preload = clampMed(approachValue(hd.preload, preloadTarget, 1.2, 1.2, dt), 0.05, 1.15);
  // vascularTone (혈관수축) — 0.5~1.8 clamp
  const toneFromSymp = sr.sympatheticTone * 0.4;
  const toneFromHormone = hc.vasopressin * 0.25 + hc.angiotensinTone * 0.20;
  let toneTarget = 1.0 + toneFromSymp + toneFromHormone;
  toneTarget *= (1 - hd.compensationExhaustion * 0.5);
  toneTarget = clampMed(toneTarget, 0.5, 1.8);
  hd.vascularTone = clampMed(approachValue(hd.vascularTone, toneTarget, 0.8, 0.8, dt), 0.5, 1.8);
  hd.systemicVascularResistance = clampMed(hd.vascularTone, 0.5, 1.8);
  // contractility — 0.4~1.5 clamp
  let contractTarget = 1.0 + sr.adrenaline * 0.25 + sr.sympatheticTone * 0.15;
  contractTarget *= (1 - hd.compensationExhaustion * 0.4);
  contractTarget *= Math.max(0.6, Math.min(1.0, hd.oxygenDelivery));
  contractTarget = clampMed(contractTarget, 0.4, 1.5);
  hd.contractility = clampMed(approachValue(hd.contractility, contractTarget, 1.0, 1.0, dt), 0.4, 1.5);
  // strokeVolumeMul = preload * contractility — HR 효율 감소
  let svMul = hd.preload * hd.contractility;
  const hr = m.heartRate;
  if (hr > 100) svMul *= 1 - Math.min(0.45, (hr - 100) / 80 * 0.45);
  if (hr > 170) svMul *= 0.7;
  hd.strokeVolumeMul = clampMed(svMul, 0.05, 1.3);
  // cardiacOutputMul — SV 가중치 0.7, HR factor 0.3 (둘 다 곱하면 폭증)
  // CARDIAC-1R §8: 명시적 빈맥/서맥 penalty. 정상범위 보상, 과도 빈맥은 filling time↓, 서맥은 output↓.
  let hrFactor = clampMed(hr / 75, 0.5, 2.0);
  let fillingTimePenalty = 1.0, bradyPenalty = 1.0;
  if (hr > 145) fillingTimePenalty = 1 - Math.min(0.35, (hr - 145) / 60 * 0.35);   // 145+ 충만 시간 감소
  if (hr < 50)  bradyPenalty = Math.max(0.45, hr / 50);                              // 50↓ output 저하
  hrFactor *= fillingTimePenalty * bradyPenalty;
  // 직전 tick의 불안정 리듬이면 관류 리듬 효율 하락 (1-tick feedback — 약하게, 보수적).
  const _priorRhythm = m.cardiacRhythmModel;
  let perfusingRhythmFactor = 1.0;
  if (_priorRhythm && _priorRhythm.perfusingRhythmFactor != null) perfusingRhythmFactor = _priorRhythm.perfusingRhythmFactor;
  hd.cardiacEfficiency = +(fillingTimePenalty * bradyPenalty * perfusingRhythmFactor).toFixed(3);
  hd.cardiacOutputMul = clampMed(
    (hd.strokeVolumeMul * 0.7 + hd.strokeVolumeMul * hrFactor * 0.3) * (0.7 + perfusingRhythmFactor * 0.3), 0.05, 1.5
  );
  // R2: filling reserve couples CO and resistance pressure to available flow.
  const reserve=circulatingReserveR2(hd.volumeRatio);
  hd.circulatingReserve=reserve;
  hd.cardiacOutputMul*=reserve;
  hd.strokeVolumeMul*=reserve;
  // MAP
  hd.map = clampMed(93 * (hd.cardiacOutputMul * 0.6 + hd.systemicVascularResistance * 0.4 * reserve), 20, 200);
  hd.pulsePressure = clampMed(hd.strokeVolumeMul * 40, 0, 80);
  // tissuePerfusion — MAP + CO 종합 (0~1.2 clamp)
  hd.tissuePerfusion = clampMed(
    (hd.map / 93) * 0.5 + (hd.cardiacOutputMul / 1.0) * 0.5, 0, 1.2
  );
  // oxygenDelivery
  hd.oxygenDelivery = clampMed(
    hd.tissuePerfusion * (m.breathingEfficiency / 100) * 0.9 + 0.1, 0, 1.2
  );
  // FIELD-STAB-1 §8/§14: airway support → oxygenDelivery 제한적 보정 (직전 tick 값, 1-tick feedback).
  //   원인(저산소)을 약하게 완화할 뿐 — bloodMl/internal bleeding/tension은 건드리지 않음.
  const _fs = m.fieldStabilizationModel;
  if (_fs) {
    const awMod = (_fs.airwaySupport && _fs.airwaySupport.oxygenDeliveryModifier) || 1.0;
    hd.oxygenDelivery = clampMed(hd.oxygenDelivery * awMod, 0, 1.2);
    // circulation support — MAP/perfusion 매우 제한적 보정 (field limited)
    const csMapMod = (_fs.circulationSupport && _fs.circulationSupport.mapSupportModifier) || 1.0;
    const csPerfMod = (_fs.circulationSupport && _fs.circulationSupport.perfusionSupportModifier) || 1.0;
    if (csMapMod !== 1.0) hd.map = clampMed(hd.map * csMapMod, 20, 200);
    if (csPerfMod !== 1.0) { hd.tissuePerfusion = clampMed(hd.tissuePerfusion * csPerfMod, 0, 1.2); hd.oxygenDelivery = clampMed(hd.oxygenDelivery * csPerfMod, 0, 1.2); }
  }
  // RESIDUAL HOTFIX 3: iv_fluid / oxygen 보조효과 제한 지속 (시간벌기 · 매우 약함). 출혈 source / internalBleeding / surgery·transfusion·definitiveCare markers 불변.
  const _nowHd = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  if (m._ivAssistUntil && _nowHd < m._ivAssistUntil) {
    hd.map = clampMed(hd.map * 1.03, 20, 200);                         // 수액: MAP/perfusion 중심 소폭 (bloodMl/oxygenDelivery 혈액대체 아님)
    hd.tissuePerfusion = clampMed(hd.tissuePerfusion * 1.02, 0, 1.2);
  }
  if (m._oxygenAssistUntil && _nowHd < m._oxygenAssistUntil) {
    // 산소: oxygenDelivery 소폭만 (bloodMl 회복 아님). 혈액량 극도 부족/호흡효율 급락 시 효과 제한.
    const _o2cap = (m.breathingEfficiency < 25 || hd.volumeRatio < 0.55) ? 1.02 : 1.04;
    hd.oxygenDelivery = clampMed(hd.oxygenDelivery * _o2cap, 0, 1.2);
  }
  // compensationLoad
  hd.compensationLoad = clamp01(
    sr.sympatheticTone * 0.5 + sr.adrenaline * 0.3
    + Math.max(0, (hd.vascularTone - 1.0) * 0.8) + hc.vasopressin * 0.3
  );
  // R: deficit/load equilibrium, independent of dwell time. Game tuning.
  const deficit=Math.max(0,1-hd.volumeRatio);
  const drive=clamp01((deficit-.40)/.60);
  hd.compensationExhaustion=drive**4*hd.compensationLoad;
  // compensated/decompensating shock 판정
  hd.compensatedShock = (m.bloodMl < 3500 && m.systolicBP >= 90 && hd.compensationLoad > 0.4);
  // CARDIAC-1R Cleanup B: decompensatingShock을 preArrestRisk/readySignal보다 먼저 계산 —
  //   severe shock tick에서 신호가 한 tick 늦게 켜지는 현상 제거 (최신 상태 반영).
  hd.decompensatingShock = (m.bloodMl < 2800 && m.systolicBP < 90 && hd.compensationLoad > 0.5)
    || (hd.compensationExhaustion > 0.6 && m.systolicBP < 95);
  // === PRECARDIAC-1 §5: 위험 단계 flag (다음 cardiac 단계 입력 — rhythm state 아님) ===
  hd.hypovolemiaSeverity = (m.bloodMl >= 4250) ? 'none' : (m.bloodMl >= 3500) ? 'mild' : (m.bloodMl >= 3000) ? 'moderate' : (m.bloodMl >= 2500) ? 'severe' : 'critical';
  hd.poorPerfusion = hd.tissuePerfusion < 0.6;
  // SIDE-MED-PHYS-HOTFIX-1A §2-B: confirmed_physiologic oxygenDrain — 잔여 저산소 보조 감쇠 (breathingDrain과 중복 크기 금지, bloodMl 영향 없음)
  {
    const _pep = aggregatePhysiologicEffectProfile(unit.medical);
    if (_pep.oxygenDrain > 0) hd.oxygenDelivery = clampMed(hd.oxygenDelivery * (1 - _pep.oxygenDrain * 0.50), 0, 1.2);
  }
  hd.oxygenDebt = hd.oxygenDelivery < 0.6;
  // preArrestRisk는 "위험 힌트"일 뿐 — arrest/사망 판정에 직접 사용 금지 (rhythm 본편은 후속 단계).
  hd.preArrestRisk = (hd.hypovolemiaSeverity === 'critical') || (hd.oxygenDelivery < 0.4) || (hd.decompensatingShock && hd.compensationExhaustion > 0.7);
  hd.cardiacRhythmReadySignal = hd.preArrestRisk || hd.decompensatingShock || hd.oxygenDebt;
}
function updateMedicalBleedingWoundBasedR2(unit, dt) {
  const m = unit.medical;
  ensureBodyPartTreatments(m);
  // 부위별 합산
  const partExt = {}, partInt = {};
  for (const k of BODY_PART_KEYS) { partExt[k] = 0; partInt[k] = 0; }
  for (const w of m.wounds) {
    const bp = w.bleedingProfile;
    if (!bp) continue;
    const pk = w.partKey;
    const ts = w.treatmentState || {};
    // ORGANIC-BLEED-1 Phase1 §6: 자연 지혈 — 대혈관/major organ confirmed(majorVesselLocked)가 아니면 sustained/naturalReductionTarget 쪽으로 서서히 감소.
    //   자연 감소는 완치가 아님(wound 유지, 재출혈 위험 유지). 움직임/shock/낮은 처치품질은 감소를 늦추거나 멈춤.
    const _locked = !!bp.majorVesselLocked;
    const _moving = !!(unit.isMoving || unit.beingDragged || unit._draggeeId);
    if (!_locked) {
      const _targetExt = (bp.naturalReductionTargetExternal != null) ? bp.naturalReductionTargetExternal
                       : (bp.sustainedExternal != null ? bp.sustainedExternal : bp.currentExternal);
      const _targetInt = (bp.naturalReductionTargetInternal != null) ? bp.naturalReductionTargetInternal
                       : (bp.sustainedInternal != null ? bp.sustainedInternal : bp.currentInternal);
      let _rate = (bp.selfReductionRate != null ? bp.selfReductionRate : 0.2);
      if (_moving) _rate *= 0.35;                                  // 움직임 → 감소 둔화
      if (m.shockState === 'decompensated' || (m.map != null && m.map < 55)) _rate *= 0.5;   // shock → 둔화
      // external: target 쪽으로 접근 (초과분만)
      if (bp.currentExternal != null && bp.currentExternal > _targetExt) {
        bp.currentExternal = bp.rNaturalReduction?.floor != null ? _targetExt + (bp.currentExternal - _targetExt) * Math.exp(-_rate * dt) : Math.max(_targetExt, bp.currentExternal - _rate * dt);
      }
      // internal: cavity major는 위 target이 sustained라 거의 안 내려감. 그 외는 완만히.
      if (bp.currentInternal != null && bp.currentInternal > _targetInt) {
        const _intRate = _rate * 0.6;
        bp.currentInternal = bp.rNaturalReduction?.floor != null ? _targetInt + (bp.currentInternal - _targetInt) * Math.exp(-_intRate * dt) : Math.max(_targetInt, bp.currentInternal - _intRate * dt);
      }
    } else {
      // majorVesselLocked — 자연 감소 거의 없음 (아주 약한 clot만, external 극소량)
      if (bp.currentExternal != null && bp.bleedingType === 'external' && bp.currentExternal > (bp.sustainedExternal || 0)) {
        bp.currentExternal = Math.max(bp.sustainedExternal || 0, bp.currentExternal - 0.03 * dt);
      }
    }
    // legacy 미세 출혈 자연 지혈 (evidence 없는 아주 작은 외출혈)
    if (bp.currentExternal > 0 && bp.currentExternal < 2.0 && bp.naturalReductionTargetExternal == null) {
      bp.currentExternal = Math.max(0, bp.currentExternal - 0.02 * dt);
    }
    // === SIDE-MED-2C §25: 처치 modifier (외출혈) — 조합 보너스 포함, 체강 내부출혈은 현장처치로 감소 금지 ===
    let extMul = 1.0;
    const bleedT = bp.bleedingType;
    const isCavityBleed = (bleedT === 'cavity');
    const isJunctional = (bleedT === 'junctional');
    // hemostatic — external/muscle/junctional 접근 가능 성분 감소 (cavity 본체엔 외부 성분만)
    const hemoEff = ts.hemostaticApplied && (ts.hemostaticEffective !== false);
    // packing — junctional/deep muscle channel
    const packEff = ts.packed && (ts.packingEffective !== false);
    if (packEff && hemoEff) extMul *= 0.09;            // 조합: 패킹+지혈거즈 최강
    else if (packEff) extMul *= 0.14;
    else if (hemoEff) extMul *= 0.20;
    // pressure bandage — 단독/조합. packed/hemostatic 이후 추가 안정화
    if (ts.pressureBandaged) {
      ts.pressureBandageStabilization = Math.min(1, (ts.pressureBandageStabilization || 0) + dt * 0.06);
      const initMul = (ts.pressureBandageInitialMul != null) ? ts.pressureBandageInitialMul : 0.15;
      const tgtMul = (ts.pressureBandageTargetMul != null) ? ts.pressureBandageTargetMul : 0.03;
      const stab = ts.pressureBandageStabilization;
      let pbMul = (initMul + (tgtMul - initMul) * stab);
      if (packEff || hemoEff) pbMul *= 0.6;            // 조합 시 추가 감소
      if (isJunctional) pbMul = Math.min(1, pbMul * 1.8);   // 접합부 단독 효과 제한
      extMul *= pbMul;
    }
    else if (ts.bandaged && !packEff && !hemoEff) extMul *= 0.30;
    // junctional pressure — 접합부 외부 성분 일시 감소 (quality/유지 반영, 단독 완전정지 금지)
    if (ts.junctionalPressureApplied && isJunctional) {
      const jq = ts.junctionalPressureQuality || 0.6;
      const jpMul = ts.junctionalPressureMaintained ? (0.45 - jq * 0.2) : (0.7 - jq * 0.1);
      extMul *= Math.max(0.3, jpMul);                  // 단독으론 30% 바닥 (잔여 유지)
    }
    // abdominal dressing — external oozing 소폭만 (내부 무효)
    if (ts.abdominalDressed) extMul *= 0.85;
    // 부위 전체 지혈대 — limb external/muscle 강하게, junctional/cavity 제한/무효
    const bpt = m.bodyPartTreatments[pk];
    let tqSup = false;
    if (bpt && bpt.tourniquet) {
      const tq = bpt.tourniquet;
      if (bp.tourniquetEligible) {
        const eff = (tq.quality === 'good') ? 0.90 : (tq.quality === 'poor') ? 0.62 : 0.85;
        extMul *= (1 - eff);
        tqSup = true;
      } else if (isJunctional) {
        extMul *= 0.85;   // 접합부 — 지혈대 효과 낮음
      }
      // cavity/torso는 지혈대 무효 (multiplier 미적용)
    }
    w._tourniquetSuppressed = tqSup;
    // severe/critical / field_unmanageable wound는 잔여 출혈 바닥 유지 (완전 0 금지)
    const ibmW = w.internalBleedingModel;
    const hcm = w.hemorrhageControlModel;
    let extFloorMul = 0;
    if (hcm && (hcm.treatmentEffectLimit === 'partial_control_only')) extFloorMul = 0.12;
    else if (hcm && hcm.treatmentEffectLimit === 'temporary_stabilization') extFloorMul = 0.18;
    else if (hcm && hcm.treatmentEffectLimit === 'not_field_controllable') extFloorMul = 0.3;
    if (extFloorMul > 0) extMul = Math.max(extMul, extFloorMul);
    let effExt = bp.currentExternal * extMul;
    // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §8: confirmed_physiologic 외부 대혈관/장기 → external 가중 (처치 비례 감소 유지, clamp)
    {
      const pep = w.physiologicEffectProfile;
      if (pep && ((pep.externalBleedBoost || 0) > 0 || (pep.majorVesselMul || 1) > 1)) {
        let physExtMul = 1 + (pep.externalBleedBoost || 0) + Math.max(0, (pep.majorVesselMul || 1) - 1) * 0.6;
        effExt *= Math.min(2.4, physExtMul);
      }
    }
    let effInt = bp.currentInternal;
    // === PRECARDIAC-1 §4.1/§6: 장기/혈관 후보·혈흉 위험 기반 내부출혈 진행 보정 ===
    //   확정 파열이 아니라 "위험 보정"이다. bleedingProfile 원본은 불변, 합산 clamp ×1.35.
    //   처치는 이 값을 절대 줄이지 못한다 (위험 증가 전용 — cavity field-care 불변 원칙과 별개 축).
    if (effInt > 0) {
      let intRiskMul = 1.0;
      const oimW = w.organInjuryModel;
      if (oimW && oimW.injuries) {
        for (const inj of oimW.injuries) {
          const solid = (inj.organ === 'liver' || inj.organ === 'spleen' || inj.organ === 'kidney' || inj.organ === 'retroperitoneal_bleed' || inj.organ === 'pelvic_bleed');
          const vessel = /vessel|carotid_jugular/.test(inj.organ);
          if (!(solid || vessel)) continue;
          if (!(inj.bleedRisk === 'high' || inj.bleedRisk === 'massive')) continue;
          if (inj.status === 'confirmed_limited') intRiskMul *= 1.18;        // §6.1: confirmed_limited만 조금 더
          else if (inj.status === 'likely') intRiskMul *= 1.10;
          else if (inj.status === 'suspected' && vessel) intRiskMul *= 1.05; // 혈관 의심은 소폭
        }
      }
      // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §8: confirmed_physiologic internal 가중 (중복 clamp — major/organ이면 상한 상향)
      let intCap = 1.35, physIntMul = 1.0;
      const pep = w.physiologicEffectProfile;
      if (pep) {
        physIntMul = 1 + (pep.internalBleedBoost || 0) + Math.max(0, (pep.majorVesselMul || 1) - 1) * 0.4;
        const hasMajorOrOrgan = (w.physiologicInjuries || []).some(i => i.confirmedLevel === 'confirmed_physiologic' && (i.type === 'major_vessel_injury' || i.type === 'solid_organ_injury'));
        if (hasMajorOrOrgan) intCap = ((pep.majorVesselMul || 1) > 1.5) ? 2.0 : 1.7;
      }
      effInt *= Math.min(intCap, intRiskMul * physIntMul);
    }
    // === CARDIAC-1R §8: 박동성 보정 — effective rate에 MAP/HR/pulsePressure/혈관수축 제한 반영 ===
    const _beforeExt = effExt, _beforeInt = effInt;
    const pulse = buildBleedingPulseModel(unit, w, bp, extMul);
    effExt *= pulse.extPulse;
    effInt *= pulse.intPulse;   // cavity는 MAP 영향만 — 현장처치로는 불변(extMul/effInt 분리), chestseal/abdominal 무관
    // FIELD-STAB-1 §10/§11: pelvic_binder / junctional_control → 해당 wound EXTERNAL bleed만 제한적 완화.
    //   internal cavity bleed(effInt)는 절대 줄이지 않는다 (source-of-truth / 후송·수술 필요).
    const _fsm = unit.medical.fieldStabilizationModel;
    if (_fsm) {
      if (_fsm.pelvicControl && _fsm.pelvicControl.active && _woundIsPelvicRegion(w)) effExt *= _fsm.pelvicControl.pelvicBleedModifier;
      if (_fsm.junctionalControl && _fsm.junctionalControl.active && _woundIsJunctionalRegion(w)) effExt *= (1 - _fsm.junctionalControl.pulseSuppression);
      // RESIDUAL HOTFIX 4: pelvic_binder → pelvic_internal의 pulse amplification만 매우 약하게(≤~8%) 완화.
      //   effInt 기저는 직접 줄이지 않음(내부출혈 source 유지) · definitiveCare/surgery/vascular markers 불변 · 출혈 제거 아님(악화만 약하게 늦춤).
      if (_fsm.pelvicControl && _fsm.pelvicControl.active && (w.internalBleedingCategory === 'pelvic_internal') && _woundIsPelvicRegion(w)) {
        const _ip = pulse.intPulse;
        if (_ip > 1.0) { effInt *= ((1 + (_ip - 1) * 0.92) / _ip); }   // 박동 증폭 초과분의 ~8%만 완화
      }
    }
    if (w.bleedingPulseModel) {
      w.bleedingPulseModel.effectiveExternalBeforeClamp = +_beforeExt.toFixed(3);
      w.bleedingPulseModel.effectiveInternalBeforeClamp = +_beforeInt.toFixed(3);
      w.bleedingPulseModel.effectiveExternalAfterClamp = +Math.max(0, effExt).toFixed(3);
      w.bleedingPulseModel.effectiveInternalAfterClamp = +Math.max(0, effInt).toFixed(3);
    }
    // SIDE-MED-2C §25: 체강 내부출혈(effInt)은 현장처치(hemostatic/packing/pressure/abdominal/chestseal)로 감소시키지 않는다 — source-of-truth/수술·후송 필요.
    //   (이전의 packed+cavity 내부 감소는 directive 위반이므로 제거)
    w._effExternal = +Math.max(0, effExt).toFixed(3);     // §2: UI 라벨이 최신 effective rate 참조
    w._effInternal = +Math.max(0, effInt).toFixed(3);
    w._extMul = +extMul.toFixed(3);
    partExt[pk] = (partExt[pk] || 0) + Math.max(0, effExt);
    partInt[pk] = (partInt[pk] || 0) + Math.max(0, effInt);
  }
  let totalExt = 0, totalInt = 0;
  for (const k of BODY_PART_KEYS) {
    const p = m.bodyParts[k];
    if (!p) continue;
    p.externalBleedRate = +(partExt[k] || 0).toFixed(3);
    p.internalBleedRate = +(partInt[k] || 0).toFixed(3);
    // legacy 호환 — bandage/tourniquet boolean 동기화
    const bpt = m.bodyPartTreatments[k];
    p.tourniquetApplied = !!(bpt && bpt.tourniquet);
    totalExt += p.externalBleedRate;
    totalInt += p.internalBleedRate;
  }
  if (isNaN(totalExt)) totalExt = 0; if (isNaN(totalInt)) totalInt = 0;
  m.externalBleedRate = Math.max(0, totalExt);
  m.internalBleedRate = Math.max(0, totalInt);
  const totalBleed = m.externalBleedRate + m.internalBleedRate;
  if (totalBleed > 0) m.bloodMl = Math.max(0, m.bloodMl - totalBleed * dt);
}
function getOriginalBleedingPulseTerms(unit, w, bp, extMul) {
  const m = unit.medical, hd = m.hemodynamics || {};
  const MAP = (hd.map != null) ? hd.map : 75, PP = (hd.pulsePressure != null) ? hd.pulsePressure : 40, HR = m.heartRate || 75;
  const vtone = (hd.vascularTone != null) ? hd.vascularTone : 1.0;
  const isJunctional = bp.bleedingType === 'junctional';
  const isCavity = bp.bleedingType === 'cavity';
  let majorVessel = false, arterial = false;
  const oim = w.organInjuryModel;
  if (oim && oim.injuries) for (const inj of oim.injuries) {
    if (/vessel|carotid_jugular/.test(inj.organ) && (inj.bleedRisk === 'high' || inj.bleedRisk === 'massive')) {
      if (inj.bleedRisk === 'massive') majorVessel = true;
      arterial = true;
    }
  }
  if (bp.tourniquetEligible && (bp.vesselRisk || 0) > 0.4) arterial = true;
  // §8.3 heartRate 영향 — 성격별 상한 clamp (soft 8%/venous-limb 12%/arterial·junctional 20%/major 25%)
  const hrCap = majorVessel ? 0.25 : (arterial || isJunctional) ? 0.20 : bp.tourniquetEligible ? 0.12 : 0.08;
  const hrNorm = clamp01((HR - 75) / 95);
  const heartRateInfluence = hrNorm * hrCap;
  // §8.2 pulsePressure 영향 — arterial/junctional 큼, venous/soft 작음
  const ppNorm = clamp01((PP - 40) / 40);
  const ppCap = (majorVessel || arterial || isJunctional) ? 0.18 : 0.05;
  const pulsePressureInfluence = ppNorm * ppCap;
  // §8.1 MAP 보정 — 높으면 분출↑, 낮으면 분출↓(상태는 나쁨, 치료 아님)
  const pressureModifier = clampMed(1 + ((MAP - 75) / 75) * 0.25, 0.6, 1.25);
  // §8.4 혈관수축 — 말초 external 일부 감소, cavity/major vessel은 큰 효과 없음
  let vascularToneModifier = 1.0;
  if (!isCavity && !majorVessel) vascularToneModifier = clampMed(1 - Math.max(0, vtone - 1.0) * 0.25, 0.8, 1.0);
  const pulseModifier = 1 + heartRateInfluence + pulsePressureInfluence;
  const extPulse = clampMed(pressureModifier * pulseModifier * vascularToneModifier, 0.5, 1.6);
  const intPulse = isCavity ? clampMed(pressureModifier, 0.7, 1.2) : clampMed(pressureModifier * (1 + pulsePressureInfluence * 0.5), 0.7, 1.3);
  const tags = [];
  if (arterial) tags.push('arterial_pulse');
  if (isJunctional) tags.push('junctional_pulse');
  if (heartRateInfluence > 0.1) tags.push('tachy_bleed');
  if (MAP < 60) tags.push('low_map_low_flow');
  if (vascularToneModifier < 0.95) tags.push('vasoconstriction_partial');
  if (isCavity) tags.push('cavity_uncontrolled');
  if (extMul != null && extMul <= 0.2 && bp.tourniquetEligible) tags.push('tourniquet_control');
  else if (extMul != null && extMul <= 0.35) tags.push('packing_control');
  const hcm = w.hemorrhageControlModel;
  if (hcm && (hcm.treatmentEffectLimit === 'not_field_controllable' || hcm.hemorrhageType === 'cavity_internal')) tags.push('field_care_limited');
  w.bleedingPulseModel = {
    pressureModifier: +pressureModifier.toFixed(3), pulseModifier: +pulseModifier.toFixed(3),
    vascularToneModifier: +vascularToneModifier.toFixed(3), heartRateInfluence: +heartRateInfluence.toFixed(3),
    pulsePressureInfluence: +pulsePressureInfluence.toFixed(3), treatmentSuppression: extMul != null ? +(1 - extMul).toFixed(3) : 0,
    tags,
  };
  return { pressureModifier, pulseModifier, vascularToneModifier, pulsePressureInfluence };
}
function installMedicalSlots(factory){
const slots=factory({buildBodyTrajectoryContext,buildOrganInjuryModel,buildConfirmedInjuryModel,buildVascularEvidence,buildFractureEvidence,reinforceVascularEvidenceWithPartDestruction,finalizeBleedingProfileWithEvidence,buildBleedingPulseModel,updateSystemicHypoxiaDamage,updateMedicalPerformanceMultipliers,updateMedicalBleedingWoundBased,updateMedicalBleeding,updateHemodynamics,updateVitalsFromHemodynamics,updatePainShockConsciousness,recalcMedicalSummary,syncLegacyCombatState,recomputeBodyPartFunctionRatio,aggregatePhysiologicEffectProfile,updateHemodynamicsR,updateHemodynamicsR2,updateMedicalBleedingWoundBasedR2,getOriginalBleedingPulseTerms});
if(typeof slots.buildBodyTrajectoryContext==='function')buildBodyTrajectoryContext=slots.buildBodyTrajectoryContext;
if(typeof slots.buildOrganInjuryModel==='function')buildOrganInjuryModel=slots.buildOrganInjuryModel;
if(typeof slots.buildConfirmedInjuryModel==='function')buildConfirmedInjuryModel=slots.buildConfirmedInjuryModel;
if(typeof slots.buildVascularEvidence==='function')buildVascularEvidence=slots.buildVascularEvidence;
if(typeof slots.buildFractureEvidence==='function')buildFractureEvidence=slots.buildFractureEvidence;
if(typeof slots.reinforceVascularEvidenceWithPartDestruction==='function')reinforceVascularEvidenceWithPartDestruction=slots.reinforceVascularEvidenceWithPartDestruction;
if(typeof slots.finalizeBleedingProfileWithEvidence==='function')finalizeBleedingProfileWithEvidence=slots.finalizeBleedingProfileWithEvidence;
if(typeof slots.buildBleedingPulseModel==='function')buildBleedingPulseModel=slots.buildBleedingPulseModel;
if(typeof slots.updateSystemicHypoxiaDamage==='function')updateSystemicHypoxiaDamage=slots.updateSystemicHypoxiaDamage;
if(typeof slots.updateMedicalPerformanceMultipliers==='function')updateMedicalPerformanceMultipliers=slots.updateMedicalPerformanceMultipliers;
if(typeof slots.updateMedicalBleedingWoundBased==='function')updateMedicalBleedingWoundBased=slots.updateMedicalBleedingWoundBased;
if(typeof slots.updateMedicalBleeding==='function')updateMedicalBleeding=slots.updateMedicalBleeding;
if(typeof slots.updateHemodynamics==='function')updateHemodynamics=slots.updateHemodynamics;
if(typeof slots.updateVitalsFromHemodynamics==='function')updateVitalsFromHemodynamics=slots.updateVitalsFromHemodynamics;
if(typeof slots.updatePainShockConsciousness==='function')updatePainShockConsciousness=slots.updatePainShockConsciousness;
if(typeof slots.recalcMedicalSummary==='function')recalcMedicalSummary=slots.recalcMedicalSummary;
if(typeof slots.syncLegacyCombatState==='function')syncLegacyCombatState=slots.syncLegacyCombatState;
}
function tickUnitMedicalBefore(unit,dt){
unit.suppression = Math.max(0, unit.suppression - dt * 9);
unit.pinned = unit.suppression >= 70;
if (unit.isDowned) unit.downedTime += dt;
}
function tickUnitMedicalAfter(unit,dt){
if (unit.stoppingTimer > 0) unit.stoppingTimer = Math.max(0, unit.stoppingTimer - dt);
if (unit.flashBlindTimer > 0) unit.flashBlindTimer = Math.max(0, unit.flashBlindTimer - dt);
if (unit.flashDeafTimer > 0) unit.flashDeafTimer = Math.max(0, unit.flashDeafTimer - dt);
if ((unit.impactKnockdownTimer || 0) > 0) {
    unit.impactKnockdownTimer = Math.max(0, unit.impactKnockdownTimer - dt);
    if (unit.medical) unit.medical.impactKnockdownTimer = unit.impactKnockdownTimer;   // alias 동기화
    unit._knockdownStanceApplied = (unit.impactKnockdownTimer > 0);   // 종료 시 false → 정상 제어 복귀 신호
  } else if (unit._knockdownStanceApplied) {
    unit._knockdownStanceApplied = false;
  }
}
return {makeUnit,createMedical,ensureMedicalExtensions,get recalcMedicalSummary(){return recalcMedicalSummary;},get syncLegacyCombatState(){return syncLegacyCombatState;},applyDamageEvent,tickMedical,validatePartDestructionFoundation,validateWoundPipelineInvariants,validateWoundUiProjection,getAmmoMedicalProfile,normalizeMedicalImpactAddress,computeProjectileKinetics,applyOutcome,OUTCOME,getProjectileDiameterMm,installMedicalSlots,tickUnitMedicalBefore,tickUnitMedicalAfter,setTime(t){GAME.gameTime=t;},diagnostics(){return {pipelineErrors:GAME._pipelineErrors||[],eventSequence:GAME._woundEventSeq||0};}};
}
