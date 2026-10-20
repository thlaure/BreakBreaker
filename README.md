# BreakBreaker

Jeu web 2D en vue de dessus, en pixel art, réécrit depuis l'ancien prototype Three.js (conservé dans l'historique git).

## Tranche jouable (first playable slice)

Une session complète, jouable au clavier/souris ou au tactile, dans un quartier unique :

- **Défense de l'école** : une première ligne de casseurs dégrade la façade ; la réserve de l'école ne baisse que pendant la dégradation. Une fois la première ligne neutralisée, une courte séquence « Renforts en approche ! » (passable avec Agir / Espace ou un appui) annonce 8 renforts.
- **Secours** : une victime menacée à rejoindre et sécuriser, puis à aider (Agir).
- **Pierres** : les lanceurs annoncent leur tir ; Paul ramasse les pierres tombées (3 max) et les renvoie.
- **Soins** : bornes de soin rechargeables, à activer à l'arrêt (Agir).
- **Vagues sans fin** : après l'intro, l'école et le secours, les vagues s'enchaînent avec une pression croissante jusqu'au KO (ou à l'arrêt volontaire). Pas de compte à rebours global.
- Récapitulatif de fin de session (score, record local, vague atteinte, statistiques) et Rejouer.

Choix :

- Le héros est **Paul**, personnage fictif ; aucun personnage ne représente une personne réelle.
- Chaque casseur mis KO rapporte **+1** au score ; le compteur affiché est un compteur neutre **« Casseurs neutralisés »**.
- Tuiles de **32 px**, sprites LPC en frames de **64×64**.
- Mise à l'échelle : `Scale.RESIZE` (le canevas occupe toute la fenêtre, 1 px CSS = 1 px de canevas) et **zoom de caméra entier** (paysage : `floor(min(l/640, h/360))`, portrait : `floor(min(l/360, h/640))`, minimum 1). Pixel art net, jamais étiré.

## Stack

Vite, TypeScript (strict), Phaser 4.2.1, Vitest. Simulation déterministe à pas fixe (60 Hz) dans `src/sim/` (sans Phaser), rendu et interface dans `src/game/`.

Deux points d'entrée :

- `/` : page d'accueil statique (règles, commandes, aperçu), sans code de jeu.
- `/jouer/` : le jeu Phaser.

## Scripts

```bash
npm install
npm run dev        # serveur de dev Vite
npm run build      # build de production dans dist/
npm run preview    # prévisualiser le build
npm test           # vitest run (inclut un build de production de vérification, dans un dossier temporaire)
npm run typecheck  # tsc --noEmit
npm run assets     # télécharge et assemble les ressources (sprites LPC, tuiles, sons) et régénère public/CREDITS.md
npm run bench      # coût d'un pas de simulation sous charge (40 casseurs, 24 pierres en vol)
```

## Crédits

Les sprites, tuiles et sons sont des ressources libres (notamment LPC, CC-BY-SA 3.0 / GPL 3.0 / OGA-BY 3.0). Chaque auteur et licence est listé dans [`public/CREDITS.md`](public/CREDITS.md), généré par `npm run assets` à partir de `scripts/credits-template.md` et accessible depuis le pied de la page d'accueil et le menu pause du jeu.
