# BreakBreaker

Jeu web 2D en vue de dessus, en pixel art, réécrit depuis l'ancien prototype Three.js (conservé dans l'historique git).

## Tranche jouable (first playable slice)

Une première boucle complète : le héros affronte des casseurs dans une rue, les met KO, et le score s'incrémente.

Choix et écarts par rapport au cahier des charges initial :

- Le héros est **Paul** (personnage fictif).
- Chaque casseur mis KO rapporte **+1** au score.
- Le compteur affiché est un compteur neutre, **« Casseurs neutralisés »** (pas de notion d'OQTF).
- Tuiles de **32 px**, sprites LPC en frames de **64×64**.
- Vue interne de **640×360**, mise à l'échelle (`Scale.FIT`, centrée, pixel art net).

## Stack

Vite, TypeScript (strict), Phaser 4.2.1, Vitest.

Deux points d'entrée :

- `/` : page d'accueil statique, sans code de jeu.
- `/jouer/` : le jeu Phaser.

## Scripts

```bash
npm install
npm run dev        # serveur de dev Vite
npm test           # vitest run (inclut un build de vérification)
npm run build      # build de production dans dist/
npm run preview    # prévisualiser le build
npm run typecheck  # tsc --noEmit
```
