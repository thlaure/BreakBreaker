/** French rules and controls shown on the start screen and in the pause help (Task 15's landing reuses this module). */

export const RULES: readonly string[] = [
  'Pas de limite de temps : la partie se termine quand Paul est mis KO ou quand tu l’arrêtes volontairement.',
  'La partie avance par manches, avec 6 s de répit entre deux. Un lieu attaqué perd de la santé (feu, casse) : neutralise ses casseurs pour le sauver. Un lieu en feu ou détruit le reste tant qu’il n’est pas réparé, sans arrêter la partie : passe sur une caisse à outils, va près du lieu en ruine ou en feu et appuie sur F.',
  'Les groupes pacifiques et les victimes sont à protéger et à contourner : Paul ne peut pas les frapper.',
  'Des armes apparaissent au hasard dans les rues (bâton, marteau, panneau) : passe dessus pour les prendre. Elles mettent KO d’un coup, frappent plus loin et s’usent après quelques coups.',
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
  { action: 'Réparer / éteindre (caisse à outils)', keyboard: 'F', touch: 'Bouton Agir (près d’un lieu à réparer)' },
  { action: 'Pause', keyboard: 'Échap', touch: 'Bouton Pause' },
];

/** One-line goal and the actions listed on the card shown when the game launches. */
export const INTRO_GOAL = 'Défends l’école et le quartier, secours les victimes, tiens le plus de manches possible.';
export const INTRO_ACTIONS: readonly string[] = ['Se déplacer', 'Frapper', 'Renvoyer une pierre', 'Courir'];
