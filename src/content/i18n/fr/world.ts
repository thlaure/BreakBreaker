/**
 * French texts, domain `world`: what is drawn in the street (src/game/render, src/game/scenes): building signs, markers,
 * the action prompt, booth lines, prison counters, comic pops, and the loading messages. Keys are `world.*`; a plural is
 * `key.one` / `key.other`. The roof signs of the decor (CAF, POULET CROUSTI, château, sauna) are the core `sign.*` keys.
 */
export const frWorld = {
  // roof and facade signs (render/world.ts, buildingFronts.ts, churchFront.ts, prisonFront.ts, saunaFront.ts)
  'world.sign.school': 'ÉCOLE',
  'world.sign.shop': 'MICRO RÉTRO',
  'world.sign.nursery': 'MATERNELLE',
  'world.sign.townHall': 'MAIRIE',
  'world.sign.library': 'BIBLIOTHÈQUE',
  'world.sign.church': 'ÉGLISE',
  'world.sign.prison': 'PRISON',
  'world.sign.saunaBoard': 'Sauna – Ne pas déranger',
  // labels under the heal stations and the toolboxes (render/pickups.ts)
  'world.marker.station': 'Soins',
  'world.marker.toolbox': 'Outils',
  // the action prompt (render/actionHintMath.ts): in-world verb, line under Paul, touch button
  'world.action.repair.verb': 'Réparer',
  'world.action.repair.line': 'Réparer',
  'world.action.repair.button': 'Réparer',
  'world.action.extinguish.verb': 'Éteindre',
  'world.action.extinguish.line': 'Éteindre le feu',
  'world.action.extinguish.button': 'Éteindre',
  'world.action.callFire.verb': 'Appeler les pompiers',
  'world.action.callFire.line': 'Appeler les pompiers',
  'world.action.callFire.button': 'Appeler',
  'world.action.callPolice.verb': 'Appeler la police',
  'world.action.callPolice.line': 'Appeler la police',
  'world.action.callPolice.button': 'Appeler',
  'world.action.needToolbox.verb': 'Il faut une caisse à outils',
  'world.action.needToolbox.line': 'Il faut une caisse à outils',
  'world.action.repairing': 'Réparation…',
  'world.help.firstRuin.touch': 'Ramasse une caisse à outils, puis touche Agir devant le bâtiment.',
  'world.help.firstRuin.keys': 'Ramasse une caisse à outils, puis appuie sur F devant le bâtiment.',
  // the line under a phone booth (render/serviceMath.ts)
  'world.booth.refused.noFire': 'Aucun feu à éteindre',
  'world.booth.refused.fewRioters': 'Pas assez de casseurs',
  'world.booth.refused.noCalls': 'Plus d’appels',
  'world.booth.refused.busy': 'Déjà en route',
  'world.booth.refused.ruined': 'Cabine hors service',
  'world.booth.called.fire': 'Pompiers en route !',
  'world.booth.called.police': 'Police en route !',
  // the prison (render/prisonMath.ts, prison.ts, prisonVans.ts)
  'world.prison.jailed': 'Caïds enfermés : {n}',
  'world.prison.released.one': '{n} Caïd libéré',
  'world.prison.released.other': '{n} Caïds libérés',
  'world.prison.breakout': 'ÉVASION !',
  'world.prison.lockedUp': 'BOUCLÉ !',
  // comic pops (render/furie.ts, fallMath.ts, satellite.ts, scenes/WorldScene.ts)
  'world.pow.a': 'POW !',
  'world.pow.b': 'BOUM !',
  'world.pow.serviceHit': 'PAF !',
  'world.pow.domino': 'DOMINO ×{n} !',
  'world.pow.ping': 'PING !',
  // loading and start-up messages (game/loadingUi.ts, main.ts, scenes/BootScene.ts)
  'world.boot.loading': 'Chargement…',
  'world.boot.loadFailed': 'Le chargement a échoué. Vérifie ta connexion.',
  'world.boot.retry': 'Réessayer',
  'world.boot.noWebgl': 'Ce jeu nécessite WebGL.',
} as const;
