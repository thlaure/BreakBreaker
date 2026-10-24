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
- **Zombies :** environ un casseur sur deux (hash entier de son `lifeId`, aucun aléa, aucune sim) sauf le Caïd, qui garde son look. *Révisé en 1.5.2 (après une vidéo de référence du propriétaire : « des personnages à part entière, pas simplement des skins »)* : les zombies sont de **vrais personnages** construits depuis le corps et la tête zombie du pack LPC (peau verte, yeux jaunes brillants, vêtements déchirés, cheveux flashy ou capuche), fichiers chargés **seulement pendant l'événement**. **Lanceurs de sort** : les zombies lanceurs de pierres sont des zombies en robe à capuche (animation de sort) dont les pierres volent comme des boules magiques vertes ; purement visuel, comme tout le reste. Rien n'est repris de la vidéo en dehors de l'idée des zombies (aucune caricature de personne, marque, drapeau ni police). Un zombie n'a **aucun** effet de jeu : même PV, même vitesse, même score (chaque KO +1, compteur neutre).
- **Décors** (rendu seul, par-dessus la carte) : citrouilles souriantes devant les bâtiments, guirlandes de fanions orange / violet / rose / vert sur les façades, fantômes sympas qui flottent, chauve-souris qui tournent (figées avec mouvement réduit). Rien n'est solide, rien ne modifie `DISTRICT`.
- **Contenu :** tout inventé, aucune personne réelle, aucun symbole religieux ou de haine ; les zombies sont des casseurs déguisés, jamais une moquerie d'apparence.

## 4. Contraintes

Simulation intacte et déterministe, TDD pour la logique pure (dates, choix zombie, peinture), `typecheck` / `lint` / `vitest` / `build` verts, `bench` ≤ 0,3 ms/pas, fichiers < 400 lignes, mouvement réduit respecté, coût nul hors événement, poids de chargement inchangé hors événement, vérification navigateur une seule fois à la fin.

## 5. Laissé au constructeur

Positions exactes des décors, dessin des citrouilles, fantômes et chauves-souris, teintes exactes.

## 6. Ajouts (1.5.3)

- **Têtes de citrouille :** environ un casseur sur quatre (hors zombies) et un Caïd sur trois ont une tête de citrouille (trois expressions), posée en sprite sur la tête ; le Caïd garde son corps, ses accessoires, sa couronne et sa barre de vie. Rendu seulement.
- **Drapeaux des zombies :** jamais le drapeau palestinien ni antifa ; un tiers portent un drapeau noir à tête de mort (drapeau de pirates, aucun autre symbole), les autres aucun.
