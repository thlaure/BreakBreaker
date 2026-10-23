# BreakBreaker — Scène de squelettes et cabines sur la place (design)

Date : 2026-10-24. Statut : décrit en chat et validé (« ton plan me convient, j'aime bien »). Les points marqués *(choix de Claude)* sont des propositions non contredites. Version visée : **1.4.0** (moyenne : nouveau contenu). Cadre : `AGENTS.md` (règles de contenu).

## 1. Pourquoi

La grande place est « l'endroit où l'on se retrouve » : les cabines d'urgence y ont leur place. Et une petite scène avec un groupe de squelettes de rock donne un clin d'œil fun, avec une ambiance de ras-le-bol, sans aucun effet sur le jeu. Succès : le joueur sourit en passant devant la scène, la musique monte quand il s'approche.

**Anti-buts :** aucun morceau commercial ni aucune parole existante ; aucun musicien réel représenté (le groupe est inventé) ; la scène ne gêne pas le jeu (pas une cible, aucun avantage).

## 2. Décisions (porteur du projet)

- **Cabines** (rouge : pompiers, bleue : police) déplacées **au bord de la grande place**.
- **Scène** à la place d'un bâtiment inutile, avec des **squelettes habillés en groupe de rock**, pas des portraits : un clin d'œil, jamais les musiciens réels.
- Un **squelette chanteur** avec quelques répliques.
- **Musique** qui monte quand on s'approche de la scène.
- (Retenu, en réponse à la proposition de Claude) : **musique originale** composée avec le synthétiseur du jeu ; paroles originales dans les deux langues ; pas de reprise du morceau d'inspiration.

## 3. Précisions (choix de Claude)

- **Emplacement :** la scène remplace le bâtiment plein n° 3, `R(36,3,8,5)` (nord-est) ; décor non attaquable, solide, jamais une cible ; le front de scène regarde le sud (la rue). Nouveau `DecorId` `'stage'` dans `DISTRICT.decor` (mêmes règles que les autres décors : à 64 px des spawns, soins, outils, portes).
- **Cabines :** `boothRed` et `boothBlue` sont reposées au bord de la place (par exemple à l'est de la mairie, côté place, autour de `R(21,30,1,1)` et `R(22,30,1,1)`) ; le constructeur choisit l'emplacement exact libre, atteignable, à plus de 64 px d'un spawn, avec points d'attaque libres ; tous les tests qui ciblent les anciennes coordonnées sont mis à jour.
- **Groupe :** cinq squelettes (chanteur, deux guitaristes, bassiste, batteur) en tenues génériques de rock (veste noire, bandana, lunettes), pixel art original, léger balancement (immobile avec mouvement réduit) ; amplis, batterie, éclairage de scène coloré.
- **Paroles du chanteur** (bulles, 2 langues, courtes, inventées, sur le ras-le-bol — jamais reprises d'une chanson) : par exemple « On efface tout ! » / « Wipe the slate clean! », « Ras le bol, ras le bol ! » / « Fed up, fed up! » ; 6 répliques par langue, ≤ 30 caractères, mêmes règles de contenu (noms interdits, mots religieux).
- **Musique :** un riff de métal original (guitare saturée, basse, batterie synthétisées avec WebAudio), en boucle courte, démarré par le premier geste du joueur comme tout le son ; volume selon la distance du joueur à la scène (inaudible au-delà de 12 tuiles, plein à moins de 4), coupé par le bouton Son, le menu pause et la fin de partie ; ne couvre jamais les effets sonores importants (volume maximal bas) ; aucune donnée audio externe. *Option ultérieure :* une piste libre (CC0 / CC-BY) créditée dans `public/CREDITS.md`.
- **Rendu seulement :** la scène, les squelettes, les bulles et la musique n'existent que dans `src/game` ; la simulation ne connaît que l'emprise et les cabines déplacées.

## 4. Contraintes

Déterminisme de la simulation (aucun texte, aucun aléa), TDD pour la logique pure (carte, volume selon la distance, boucle), `typecheck` / `lint` / `vitest` / `build` verts, `bench` ≤ 0,3 ms/pas, fichiers < 400 lignes, deux langues (catalogues `fr`/`en` identiques en clés), mouvement réduit respecté, vérification dans le navigateur une seule fois à la fin.

## 5. Laissé au constructeur

Emplacement exact des cabines, dessin de la scène et des squelettes, notes et tempo du riff, courbe de volume, texte exact des répliques.
