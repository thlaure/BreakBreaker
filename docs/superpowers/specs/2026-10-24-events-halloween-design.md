# BreakBreaker — Événements saisonniers et thème Halloween (design)

Date : 2026-10-24. Statut : décrit en chat et validé (« c'est parfait… vas-y, go »). Les points marqués *(choix de Claude)* sont des propositions non contredites. Version visée : **1.5.0** (moyenne : nouveau contenu). Cadre : `AGENTS.md` (règles de contenu).

## 1. Pourquoi

Halloween approche. Le propriétaire veut un thème **drôle et coloré** (« le but, c'est que ça reste fun ») posé **par-dessus** le jeu de base, sans rien changer aux règles, et qui revienne chaque année sans rien refaire.

**Anti-buts :** aucun effet sur le gameplay, la simulation, la carte de base ni les records ; rien de sombre ou gore ; aucun texte en dur.

## 2. Décisions (porteur du projet)

- Une partie des casseurs devient des **zombies**, style *Plantes contre Zombies* : dessin rigolo, cheveux **bleus, roses**, etc.
- Quelques **décorations Halloween** sur la carte.
- La couche se **retire sans toucher à la base** et le dossier est **conservé** pour l'an prochain : un dossier d'événements permanent (`src/events/`), activable et désactivable.
- Dates : du **24 octobre au 2 novembre** chaque année, automatiquement.

## 3. Précisions (choix de Claude)

- **Registre** `src/events/` : une liste d'événements (id, fenêtre de dates), un module par événement (`src/events/halloween/`). Hors fenêtre, le jeu est exactement celui de base.
- **Forcer :** paramètre d'adresse `?event=halloween` (allume) ou `?event=none` (éteint), pour tester ou jouer hors dates.
- **Zombies :** environ un casseur sur deux (hash entier de son `lifeId`, aucun aléa, aucune sim) sauf le Caïd, qui garde son look. Les feuilles de personnages zombie sont **peintes au démarrage** à partir des feuilles de casseurs (comme les Caïds) : peau vert-gris, cheveux flashy (bleu, rose, violet, turquoise, jaune), cône de chantier ou seau sur la tête pour certains. Seulement quand l'événement est actif (aucun coût sinon). Un zombie n'a **aucun** effet de jeu : même PV, même vitesse, même score (chaque KO +1, compteur neutre).
- **Décors** (rendu seul, par-dessus la carte) : citrouilles souriantes devant les bâtiments, guirlandes de fanions orange / violet / rose / vert sur les façades, fantômes sympas qui flottent, chauve-souris qui tournent (figées avec mouvement réduit). Rien n'est solide, rien ne modifie `DISTRICT`.
- **Contenu :** tout inventé, aucune personne réelle, aucun symbole religieux ou de haine ; les zombies sont des casseurs déguisés, jamais une moquerie d'apparence.

## 4. Contraintes

Simulation intacte et déterministe, TDD pour la logique pure (dates, choix zombie, peinture), `typecheck` / `lint` / `vitest` / `build` verts, `bench` ≤ 0,3 ms/pas, fichiers < 400 lignes, mouvement réduit respecté, coût nul hors événement, poids de chargement inchangé hors événement, vérification navigateur une seule fois à la fin.

## 5. Laissé au constructeur

Positions exactes des décors, dessin des citrouilles, fantômes et chauves-souris, teintes exactes.
