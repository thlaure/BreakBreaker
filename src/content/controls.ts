/** French rules and controls shown on the start screen and in the pause help (Task 15's landing reuses this module). */

export const RULES: readonly string[] = [
  'Pas de limite de temps : la partie se termine quand Paul est mis KO ou quand tu l’arrêtes volontairement.',
  'Les bâtiments et les secours ont chacun un délai local ; en manquer un n’arrête pas la partie.',
  'Les groupes pacifiques et les victimes sont à protéger et à contourner : Paul ne peut pas les frapper.',
  'Des armes apparaissent au hasard dans les rues (bâton, marteau, panneau) : passe dessus pour les prendre. Elles mettent KO d’un coup, frappent plus loin et s’usent après quelques coups.',
  'Les pierres lancées par les casseurs tombent au sol : ramasse-les puis renvoie-les. Passe sur une station « Soins » pour récupérer de la santé (une fois par station).',
];

export const SATIRE_NOTICE =
  'BreakBreaker est une fiction satirique : les personnages et les situations sont imaginaires et ne représentent aucun groupe réel.';

export interface ControlRow {
  action: string;
  keyboard: string;
  touch: string;
}

export const CONTROLS: readonly ControlRow[] = [
  { action: 'Se déplacer', keyboard: 'ZQSD, WASD ou flèches', touch: 'Joystick (moitié gauche de l’écran)' },
  { action: 'Frapper', keyboard: 'Espace ou clic gauche', touch: 'Bouton Frapper' },
  { action: 'Renvoyer une pierre', keyboard: 'E ou clic droit', touch: 'Bouton Renvoyer : toucher = dernière visée, glisser = viser' },
  { action: 'Agir (aider une victime)', keyboard: 'F (maintenir)', touch: 'Bouton Agir (maintenir)' },
  { action: 'Courir', keyboard: 'Maj', touch: 'Pousser le joystick à fond' },
  { action: 'Pause', keyboard: 'Échap', touch: 'Bouton Pause' },
];

/** One-line goal and the actions listed on the card shown when the game launches. */
export const INTRO_GOAL = 'Défends l’école, secours les victimes, tiens le plus longtemps possible.';
export const INTRO_ACTIONS: readonly string[] = ['Se déplacer', 'Frapper', 'Renvoyer une pierre', 'Courir'];
