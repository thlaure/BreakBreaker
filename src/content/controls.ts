/** French rules and controls shown on the start screen and in the pause help (Task 15's landing reuses this module). */

export const RULES: readonly string[] = [
  'Pas de limite de temps : la partie se termine quand Paul est mis KO ou quand tu l’arrêtes volontairement.',
  'La partie avance par manches, avec 6 s de répit entre deux. Un lieu attaqué perd de la santé (feu, casse) : neutralise ses casseurs pour le sauver. Un lieu en feu ou détruit le reste tant qu’il n’est pas réparé, sans arrêter la partie : passe sur une caisse à outils, va près du lieu en ruine ou en feu et appuie sur F.',
  'Les groupes pacifiques et les victimes sont à protéger et à contourner : Paul ne peut pas les frapper.',
  'Des armes apparaissent au hasard dans les rues (bâton, marteau, panneau) : passe dessus pour les prendre. Elles mettent KO d’un coup, frappent plus loin et s’usent après quelques coups.',
  'Chaque casseur mis KO remplit la jauge d’énergie (plus pour une brute ou le Caïd, rien pendant le mode furie ni avec l’onde). Dès la moitié, maintiens C pour charger l’onde d’énergie 1 s (Paul reste immobile) : elle met KO tous les casseurs sur sa ligne et coûte la moitié de la jauge. Pleine, appuie sur R pour le mode furie (12 s) : elle se vide entièrement.',
  'Quand ça chauffe, un bouclier peut apparaître (20 s) : il arrête pierres et bouteilles de tous les côtés et repousse d’un coup.',
  'Les pierres lancées par les casseurs tombent au sol : ramasse-les puis renvoie-les. Passe sur une station « Soins » pour récupérer de la santé (une fois par station).',
];

export const SATIRE_NOTICE =
  'BreakBreaker est une fiction satirique.';

export interface ControlRow {
  action: string;
  keyboard: string;
  touch: string;
}

export const CONTROLS: readonly ControlRow[] = [
  { action: 'Se déplacer', keyboard: 'ZQSD, WASD ou flèches', touch: 'Joystick (moitié gauche de l’écran)' },
  { action: 'Frapper', keyboard: 'Espace ou clic gauche', touch: 'Bouton Frapper' },
  { action: 'Renvoyer une pierre', keyboard: 'E ou clic droit', touch: 'Bouton Renvoyer : toucher = dernière visée, glisser = viser' },
  { action: 'Courir', keyboard: 'Maj', touch: 'Pousser le joystick à fond' },
  { action: 'Onde d’énergie', keyboard: 'Maintenir C (jauge à moitié)', touch: 'Maintenir le bouton Onde' },
  { action: 'Mode furie', keyboard: 'R (jauge pleine)', touch: 'Bouton Furie' },
  { action: 'Réparer / éteindre (caisse à outils)', keyboard: 'F', touch: 'Bouton Agir (près d’un lieu à réparer)' },
  { action: 'Pause', keyboard: 'Échap', touch: 'Bouton Pause' },
];

/** One-line goal and the actions listed on the card shown when the game launches. */
export const INTRO_GOAL = 'Défends l’école et le quartier, secours les victimes, tiens le plus de manches possible.';
export const INTRO_ACTIONS: readonly string[] = ['Se déplacer', 'Frapper', 'Renvoyer une pierre', 'Courir'];
