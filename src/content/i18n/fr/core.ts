/**
 * French texts of the ids the simulation emits (toolbox and heal-station messages, school status, round objective
 * results, held items, rescue belongings, decor signs). Keys are `domain.id`; a plural is `key.one` / `key.other`.
 */
export const frCore = {
  // Snapshot.toolboxes.message (src/sim/repair.ts ToolboxMessage)
  'toolbox.toolboxRequired': 'Caisse à outils requise',
  'toolbox.areaUnsafe': 'Abords non sécurisés',
  // Snapshot.stationMessage (src/sim/healing.ts StationMessage)
  'station.fullHealth': 'Santé au maximum',
  'station.spent': 'Épuisé',
  // Snapshot.school.status (src/sim/incidents/school.ts SchoolStatus)
  'school.burning': 'en feu',
  'school.attacked': 'attaquée',
  'school.reinforcements': 'renforts',
  'school.lost': 'perdue',
  'school.saved': 'sauvée',
  // RoundSummary.objectives[].result (src/sim/directorObjectives.ts ObjectiveResult)
  'objective.won': 'réussi',
  'objective.lost': 'perdu',
  // what Paul holds (src/sim/types.ts PickupKind)
  'held.baton': 'Bâton',
  'held.marteau': 'Marteau',
  'held.panneau': 'Panneau',
  'held.gant': 'Gant de boxe',
  'held.flashball': 'Flashball',
  'held.bouclier': 'Bouclier',
  // the rescue victim's belongings (src/sim/incidents/rescue.ts RESCUE_ITEMS ids)
  'item.handbag': 'sac à main',
  'item.hat': 'chapeau',
  'item.cane': 'canne',
  'item.backpack': 'sac à dos',
  'item.scarf': 'écharpe',
  'item.cap': 'casquette',
  // decor roof signs (src/sim/map/district.ts DISTRICT.decor ids)
  'sign.caf': 'CAF',
  'sign.pouletCrousti': 'POULET CROUSTI',
  'sign.chateau': 'CHÂTEAU',
  'sign.sauna': 'SAUNA',
} as const;
