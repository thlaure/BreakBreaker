# BreakBreaker — Grande place, église, château du Président et sauna (design)

Date : 2026-10-23. Statut : décrit en chat, plan de la carte validé (« très bien, tu peux construire »). Les points marqués *(choix de Claude)* sont des propositions non contredites. Version visée : **1.1.0** (moyenne : nouveau contenu). Cadre de la satire : voir la mémoire du projet et `ROADMAP.md`.

## 1. Pourquoi

Le centre de la carte est de la rue vide. On veut une vraie **place du quartier** (église, mairie, château, manifestants pacifiques) qui donne un cœur au jeu, un nouvel enjeu à défendre (l'église) et un peu d'humour (le Président au balcon, le sauna). Succès : le joueur reconnaît la place comme « le centre du village » et rit en passant devant le balcon.

**Anti-buts :** aucune personne réelle ni nom réel (ni de parti) ; pas de caricature du physique, de l'origine ou de la religion ; pas de harem ni de représentation sexualisée ou dégradante ; l'église n'est pas un symbole moqué (c'est un lieu à défendre comme les autres).

## 2. Décisions (porteur du projet)

- Supprimer les bâtiments pleins inutiles qui gênent (les n° 6 et 7 : R(14,26,6,5) et R(30,28,7,5)) ; garder les n° 3 et 4 (abris en périphérie).
- Une **grande place** autour d'une **église au centre** de la carte, avec la **mairie** et le **château** autour.
- L'**église est un lieu à défendre**, comme la mairie.
- **Deux ou trois groupes de manifestants pacifiques** sur la place (trois).
- **Château** avec un **Président fictif** (silhouette générique : costume bleu, aucun modèle réel) sur un **balcon** : il s'agite, bras en l'air, pleure, s'énerve ; **bulles de répliques** tirées d'un dictionnaire de phrases célèbres et décalées, sans attribution, sans nom.
- **Sauna** : petit bâtiment œuf de Pâques, trois silhouettes de dirigeants en serviette dans la vapeur, reconnaissables seulement par des accessoires et des attitudes, jamais par leur physique ; sans effet sur le jeu, Paul n'y entre pas.

## 3. Précisions (choix de Claude)

**Carte (proposition du plan, à ajuster par le constructeur si un chemin ou un spawn l'exige) :**
- Église : R(22,22,4,5), porte au sud C(24,27), 4 points d'attaque devant la porte.
- Mairie : déplacée de R(15,3,6,4) vers R(15,15,6,4) (ouest de la place), porte au sud ; le reste de son comportement est inchangé. L'ancien emplacement nord reste libre (ou accueille un bâtiment plein).
- Château : décor plein R(27,14,6,4), balcon tourné vers la place ; jamais attaqué (comme la CAF et le Poulet Crousti).
- Sauna : décor plein R(31,29,4,3), au sud-est de la place.
- Monument équestre : inchangé (R(33,21,2,2)), il fait partie de la place.
- Trois groupes pacifiques : un au nord-ouest de l'église, un à l'est, un au sud ; chacun 6 membres, même comportement que l'actuel ; le tableau `peacefulGroup` devient `peacefulGroups` (rendu, grille, snapshot, sim adaptés).
- Station de soins, point de départ de Paul, kits d'outils, rochers, arbres (`trunks`) et autres éléments en conflit sont déplacés au plus près pour rester à l'air libre et atteignables ; le constructeur vérifie qu'aucun spawn, soin ou attaque n'est dans un bâtiment ou à moins de 64 px d'une porte.

**Église (lieu à défendre) :** nouveau genre de casse `church`, 150 PV, feu, ruine, réparation par la caisse à outils (remise à 60 %), points sauvé / perdu / réparé comme un grand bâtiment (+8 / −3 / +5), entre dans le tirage des casses dès la **manche 3**, compte pour la règle des deux urgences. Façade pixel art : clocher, toit d'ardoise, porte en arche, vitraux ; bannière « ÉGLISE ATTAQUÉE ! » ; nom affiché « Église ». Aucun texte ni symbole religieux moqueur.

**Président au balcon (rendu seulement, aucune simulation) :** quatre humeurs en boucle (bras en l'air, larmes, colère, apaisé), changement toutes les 3 à 6 s ; une bulle toutes les 8 à 14 s tirée au hasard dans un dictionnaire de 20 à 30 courtes phrases françaises célèbres ou décalées (exemples : « C'est de la poudre de perlimpinpin ! », « Abracadabrantesque ! », « Moi, président de la République… », « Les ennuis, ça vole toujours en escadrille. », « On est en guerre ! ») ; le constructeur complète en restant dans des phrases publiques et courtes. Hors écran : rien n'est dessiné ni animé. Quand Paul passe à moins de 6 tuiles, le Président s'agite plus fort. Mouvement réduit : humeur figée, bulles toujours affichées. Le tirage utilise un générateur du rendu (jamais celui de la simulation).

**Sauna :** façade de bois avec lanterne et vapeur qui monte (particules ; aucune avec mouvement réduit) ; trois silhouettes floues derrière une vitre embuée, avec des accessoires distinctifs (par exemple un seau, des lunettes de soleil, une toque) ; une pancarte « Sauna – Ne pas déranger ».

## 4. Contraintes

Simulation pure et déterministe (aucun `Math.random`), TDD pour la logique (carte, église, groupes), `typecheck` / `lint` / `vitest` / `build` verts, `npm run bench` ≤ 0,3 ms/pas, UI en français, texte technique en anglais, pixel art, tout KO = +1, compteur neutre ; specs, CHANGELOG (1.1.0) et ROADMAP mis à jour ; vérification dans un vrai navigateur (place, église attaquée, balcon, sauna, mobile).

## 5. Laissé au constructeur

Valeurs exactes (PV de l'église dans la fourchette 120–200, rayons, durées des humeurs), dessin du clocher et du balcon, texte exact du dictionnaire, ajustements de la grille (spawns, chemins, flowfield), réglage de l'équilibrage au robot de test (la manche 3 avec l'église ne doit pas devenir injouable), nom des fichiers.
