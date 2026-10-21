# BreakBreaker — Cahier des charges fonctionnel et technique

**Version :** 1.9.8 — 21 octobre 2026  
**Périmètre :** jeu web 2D en pixel art, vue du dessus non isométrique, mode arcade par manches sans limite de durée, Paris, Paul (commerçant fictif) comme héros unique, ordinateur et téléphone  
**Statut :** spécification de référence ; les décisions confirmées par le porteur du projet et les recommandations de conception sont identifiées. Une première tranche jouable existe (section 24) ; ce document ne constitue pas une validation de production ni une attestation que toutes les exigences sont déjà implémentées.  
**Langue de lancement :** français  
**Projet :** BreakBreaker

## Sommaire

1. [Vision et positionnement](#1-vision-et-positionnement)
2. [Exigences validées et décisions proposées](#2-exigences-validées-et-décisions-proposées)
3. [Périmètre et priorités](#3-périmètre-et-priorités)
4. [Parcours du joueur](#4-parcours-du-joueur)
5. [Carte, exploration et objectifs](#5-carte-exploration-et-objectifs)
6. [Paul, déplacement et caméra](#6-paul-déplacement-et-caméra)
7. [Commandes](#7-commandes)
8. [Combat, projectiles et groupes protégés](#8-combat-projectiles-et-groupes-protégés)
   - [8.7 Armes ramassables](#87-armes-ramassables)
   - [8.8 Mode furie](#88-mode-furie)
   - [8.9 Bouclier et onde d’énergie](#89-bouclier-et-onde-dénergie)
9. [Personnages, hordes et intelligence artificielle](#9-personnages-hordes-et-intelligence-artificielle)
10. [Bâtiments menacés, défense et réparation](#10-bâtiments-menacés-défense-et-réparation)
11. [Objectif monument](#11-objectif-monument)
12. [Mode arcade, manches, événements, progression et soins](#12-mode-arcade-manches-événements-progression-et-soins)
13. [Score, compteur de casseurs neutralisés et bilan](#13-score-compteur-de-casseurs-neutralisés-et-bilan)
14. [Interface et accessibilité](#14-interface-et-accessibilité)
15. [Direction artistique et ressources pixel art](#15-direction-artistique-et-ressources-pixel-art)
16. [Son](#16-son)
17. [Choix techniques](#17-choix-techniques)
18. [Architecture logicielle et données](#18-architecture-logicielle-et-données)
19. [Performances et compatibilité](#19-performances-et-compatibilité)
20. [Stockage, chargement et diffusion](#20-stockage-chargement-et-diffusion)
21. [Validation et critères de recette](#21-validation-et-critères-de-recette)
22. [Production et livrables](#22-production-et-livrables)
23. [Extensions prévues](#23-extensions-prévues)
24. [Écart avec le prototype actuel](#24-écart-avec-le-prototype-actuel)
25. [Décisions restantes et sources](#25-décisions-restantes-et-sources)
26. [Landing page et accès au jeu](#26-landing-page-et-accès-au-jeu)

## 1. Vision et positionnement

### 1.1 Concept

Jeu web d’action arcade en **2D pixel art, vu du dessus, sans isométrie**, proche d’un hack-and-slash rétro. Le joueur incarne Paul, un commerçant de quartier fictif, représenté avec des cheveux longs, une tenue noire et une écharpe blanche qui le distingue des casseurs.

Il se déplace librement dans une carte parisienne fictive : places, école, monument et commerces. Des hordes de casseurs arrivent par plusieurs accès. Le joueur les combat au contact, à mains nues ou avec des armes ramassées dans les rues, évite leurs projectiles, peut récupérer certaines pierres tombées puis les renvoyer, défend l’école et reprend des drapeaux.

Des groupes de manifestants pacifiques occupent des parties de la carte. Ils ne sont pas des cibles pour Paul et doivent être contournés. Certains peuvent être menacés par des casseurs lors d’événements de secours. D’autres rencontres mettent en scène une personne ou un couple âgé victime de vol ou d’intimidation, à aider rapidement.

La session est découpée en manches : chaque manche fixe un nombre de casseurs à neutraliser et un à trois objectifs. La santé, les petits soins et la survie jusqu’au KO restent conservés. Aucun compte à rebours global et aucune victoire terminant automatiquement la session. Une barre de santé indique en revanche l’état d’un lieu attaqué, et un délai local le temps restant pour intervenir auprès de personnes menacées. Un lieu détruit peut être réparé avec une caisse à outils trouvée sur la carte.

### 1.2 Promesse

« Se déplacer, repousser les hordes, ramasser des armes, renvoyer leurs pavés et tenir le quartier manche après manche, aussi longtemps que possible. »

Le plaisir repose sur le mouvement, la lecture des groupes, les coups, l’esquive par déplacement, le renvoi de projectiles, la défense des lieux et la gestion de la santé. La récupération d’objets est limitée et compréhensible ; aucun inventaire complexe.

### 1.3 Direction visuelle

Vue orthogonale du dessus, carte à axes horizontaux/verticaux, sprites et décors dessinés en pixels. De petits volumes dessinés et des faces de bâtiment peuvent améliorer la lisibilité, sans projection isométrique ni grille en losanges.

La référence GTA / The Division n’est plus une cible de rendu. La crédibilité vient désormais des détails reconnaissables, des animations, des réactions et du son, dans une représentation rétro cohérente.

### 1.4 Public et accès

Navigateur sur ordinateur et téléphone, sans compte ni installation obligatoire. Caméra automatique, commandes simples et version tactile. Le pixel art réduit certains besoins graphiques, mais ne dispense pas de limiter les hordes, les collisions et les effets ni de tester sur téléphone réel.

### 1.5 Paul, protagoniste unique

**Confirmé (révision 1.5) :** le héros est Paul, un commerçant de quartier entièrement fictif. Repères visuels : cheveux longs, vêtements noirs et un accent clair (écharpe ou bavoir blanc) qui le distingue des casseurs vêtus de sombre ; silhouette identifiable à la taille réelle du sprite. Aucun choix de sexe, de teint ou d’un autre héros.

Paul ne représente aucune personne réelle. Les missions parisiennes, les dialogues et les positions exprimées dans le jeu relèvent de la fiction. Aucun nom de famille, élément biographique ou référence de presse n’est associé au personnage.

## 2. Exigences validées et décisions proposées

### 2.1 Statut

- **Confirmé** : demandé explicitement par le porteur du projet.
- **Proposé** : solution concrète de conception à essayer.
- **Paramètre initial** : valeur d’équilibrage modifiable sans changer la vision.
- **Extension** : hors première version de diffusion.

La présente révision remplace la cible 3D. Les dernières demandes annulent la vue derrière l’épaule, la personnalisation et le chronomètre global. L’idée de murs ou de ruelles imposés a été retirée par l’utilisateur ; elle ne doit pas devenir une fonctionnalité à développer.

La révision 1.5 intègre des décisions **confirmées** : héros fictif Paul, barème égal pour tous les casseurs, compteur neutre « Casseurs neutralisés », frappe circulaire, soins appliqués au contact, armes ramassables, manches à effectif fixe et lancement direct depuis la landing. Les valeurs chiffrées associées restent des paramètres initiaux sauf mention contraire.

### 2.2 Exigences confirmées

| ID | Exigence |
| --- | --- |
| EX-01 | Jeu web, un joueur, ordinateur et téléphone, sans compte. |
| EX-02 | 2D pixel art, vue du dessus, non isométrique, action de type hack-and-slash rétro. |
| EX-03 | Déplacement libre sur la carte ; Paris pour la première version. |
| EX-04 | Paul, commerçant fictif, héros unique ; aucun écran de sélection d’apparence ; aucune référence à une personne réelle. |
| EX-05 | Trois variantes de casseurs : classique, drapeau palestinien, drapeau Antifa. Le drapeau est purement cosmétique : même barème (+1 au KO), mêmes rôles possibles. |
| EX-06 | Arrivée de hordes ; casseurs hostiles jusqu’au KO, sans reddition ni interpellation. |
| EX-07 | Combat au contact, à mains nues ou avec des armes ramassées ; aucun gore, aucun sang. **Modifié (v1.9) :** le porteur du projet lève l’ancienne interdiction des armes à feu pour les tireurs ennemis (AK-47, manches tardives) et le flashball de Paul, en style cartoon, tirs lisibles et esquivables ; prévu pour la phase B de la tranche 2, non livré dans la phase A. |
| EX-08 | Projectiles ennemis de type caillou, pavé ou brique. |
| EX-09 | Possibilité de récupérer des projectiles et de les renvoyer contre les casseurs. |
| EX-10 | Groupes de manifestants pacifiques à éviter et non ciblables par Paul ; certains peuvent subir une menace ennemie et être secourus. |
| EX-11 | Étudiants, professeurs, policiers, pompiers, soignants et commerçants restent non ennemis. |
| EX-12 | Santé et petits soins conservés. |
| EX-13 | Session arcade sans durée limite, découpée en manches, poursuivie jusqu’au KO du joueur. |
| EX-14 | École à défendre : première ligne, vague, réparation, retour des étudiants et formations projetées. |
| EX-15 | Captures de drapeau sur des monuments, avec zone contestée et changement de drapeau. **Modifié (v1.9.4, demande du porteur du projet) :** une statue équestre dont le cavalier tient un drapeau français ; des casseurs s’en prennent à la statue et, en quelques secondes, remplacent le drapeau français par un drapeau palestinien ; Paul le reprend en capture du drapeau (section 11). |
| EX-16 | Flèche et zone au sol pour les objectifs. |
| EX-17 | Chaque casseur KO ajoute une unité au compteur neutre « Casseurs neutralisés », sans doublon. |
| EX-18 | Score, record local, pause, arrêt volontaire et son après geste utilisateur. |
| EX-19 | Assez de contenu et de renouvellement pour plusieurs manches. |
| EX-20 | Santé d’un lieu attaqué (feu, dégradeurs) avant sa destruction, pour créer une urgence de défense ; elle remplace l’ancien délai local (v1.9, section 10.2). |
| EX-21 | Caisses à outils récupérables sur la carte ; près d’un lieu détruit ou en feu, un appui sur Agir (F, bouton Agir) lance la réparation ou l’extinction, qui se termine 2 s plus tard sans maintenir la touche, abords sûrs (v1.9.1, section 10.6). Un lieu en feu ou détruit le reste tant qu’il n’est pas réparé. |
| EX-22 | Événements dynamiques de secours : manifestants agressés, personne ou couple âgé menacé ou dépouillé ; délai local d’intervention. |
| EX-23 | Déplacement libre, mais impossibilité de traverser les bâtiments, les troncs d’arbre et les obstacles solides. |
| EX-24 | Landing page publique simple donnant accès au jeu ; contenu et fonctionnement définis ici, direction visuelle traitée séparément avec Claude. |
| EX-25 | Armes ramassables apparaissant aléatoirement dans les rues ; chacune met un casseur KO en un coup, avec portée et nombre de coups propres ; armes à feu cartoon seulement dans les conditions d’EX-07 (section 8.7). |
| EX-26 | Manches à effectif fixe : un nombre de casseurs à neutraliser et un à trois objectifs par manche, panneau « Manche N terminée » non bloquant pendant un répit voulu de 6 s sans entrée de casseur, puis la manche suivante est annoncée (v1.9, section 12.2). |
| EX-27 | Landing sobre (titre, accroche, boutons Jouer et Commandes, pied de page) avec visuel original ; règles et instructions affichées au lancement du jeu ; bouton « Commandes » (modale) sur la landing et dans le jeu (section 26). |
| EX-28 | Alerte visible dans le style pixel du jeu à l’apparition de chaque incident (« ÉCOLE EN FEU ! », « AGRESSION EN COURS ! », « VOL EN COURS ! ») avec flèche et distance, puis indicateur en bord d’écran par incident actif hors écran ; système générique réutilisé par les futurs événements de casse (section 14.1). |

### 2.3 Propositions de départ

| Sujet | Proposition |
| --- | --- |
| Carte | Quartier unique, 48 × 48 tuiles de 32 pixels (1 536 × 1 536 pixels logiques) |
| Vue | Caméra qui suit Paul, orientation fixe et zoom entier |
| Déplacement | Huit directions, diagonales normalisées ; quatre orientations dessinées au minimum |
| Contact | **Confirmé :** frappe circulaire à 360° autour de Paul, les plus proches d’abord, jusqu’à trois casseurs, chacun touché une seule fois ; Paul se tourne vers le plus proche |
| Armes | **Confirmé :** armes ramassées en passant dessus, une tenue à la fois, KO en un coup, usure par coup utile (section 8.7) |
| Pierres | Ramassage automatique des pierres ennemies déjà tombées, stock maximal de trois |
| Renvoi | Action distincte, direction choisie ; pas de capture parfaite de projectile en vol en V1 |
| Manifestants | Non ciblables par Paul ; menace ennemie représentée par un état de détresse pendant un événement de secours |
| Objectifs | École, monument, boutique proposée pour varier les manches |
| Manches | **Confirmé :** manches à effectif fixe et un à trois objectifs ; progression des effectifs proposée en section 12.2, avec plafond de simulation |
| Soins | **Confirmé :** stations limitées appliquées au contact (+25) ; petits soins de terrain, sans régénération passive |
| Réparation après perte | Caisse à outils distincte des soins, une portée au maximum, réparation ou extinction lancée par un appui sur F (Agir), interrompable |
| Urgences | Une barre de santé par lieu attaqué, un délai local par secours, pas de fin de partie à leur échec |
| Technique | Retenu : Phaser 4.2.1, TypeScript, Vite et Vitest ; simulation pure séparée du rendu ; validation sur appareils réels |

Les seuils précis sont proposés, pas déjà validés par l’utilisateur, sauf mention « Confirmé ». La récupération au sol est une première interprétation de « récupérer pour renvoyer », plus accessible que l’interception en vol.

## 3. Périmètre et priorités

| Priorité | Contenu |
| --- | --- |
| P0 | Vue du dessus non isométrique, Paul unique, déplacement libre, hordes et trois variantes, frappe circulaire, armes ramassables, projectiles récupérables et renvoi, groupes pacifiques protégés, santé, soins, caisses à outils, urgences locales et secours, arcade par manches sans limite, école et capture, score, compteur de casseurs neutralisés, pause. |
| P1 | Pixel art abouti, boutique, nouvelles armes débloquées par manche (section 8.7), diversité d’assauts, repérage, accessibilité, optimisation et longue session sur téléphone réel. |
| P2 | Autres cartes/villes, dialogues complets, récupération de projectile en vol si utile, PWA. |

La cible de diffusion inclut P0 et P1. Contenu minimal proposé : un quartier, trois objectifs récurrents, trois variantes visuelles hostiles et deux comportements de combat (contact/lanceur), trois groupes pacifiques, deux points de soin, trois armes de contact et au moins quatre compositions d’assaut.

La carte doit pouvoir être parcourue librement, y compris entre deux objectifs. Les objectifs peuvent être activés progressivement pour l’apprentissage ; le joueur n’est pas enfermé dans une succession d’arènes fermées. La caméra ne doit pas tirer le joueur de force vers une mission.

Hors périmètre : 3D, isométrie, monde ouvert de grande taille, construction de murs, couloirs obligatoires, conduite, armes à feu réalistes, gore, multijoueur, compte et inventaire complexe. Les tireurs ennemis et le flashball cartoon d’EX-07 (v1.9) font exception.

Cible de variété : plusieurs situations différentes dans les dix premières minutes si le joueur survit, sans durée minimale ou maximale imposée.

## 4. Parcours du joueur

### 4.1 Accueil

Le site s’ouvre sur une landing page légère, distincte du jeu, volontairement sobre : titre, accroche, bouton « Jouer » (qui lance directement la partie) et bouton « Commandes » (modale des touches). **Confirmé (1.6) :** les règles et instructions de jeu ne sont pas sur la landing ; elles s’affichent au lancement du jeu (§26.4). Son contenu détaillé est défini en section 26. Aucun choix de sexe ou teint ; aucune limite globale de durée annoncée.

### 4.2 Entrée

**Confirmé :** « Jouer » ouvre `/jouer/?go`. La page du jeu affiche sa progression de chargement (moteur, sprites, tuiles, collisions, sons utiles et premiers adversaires), puis la partie démarre dès que les ressources indispensables sont prêtes, sans écran de départ. Le son se déverrouille à la première touche, au premier clic ou au premier toucher. Une visite directe sur `/jouer/` (sans `?go`) affiche l’écran des règles avec l’action « Commencer ». Caméra du dessus dès la prise de contrôle, pas de cinématique derrière l’épaule ni de modèle 3D.

La première école est indiquée, ainsi qu’un groupe pacifique et un soin proche. Les premières secondes permettent de se déplacer avant d’être pressé par une horde. La première attaque est annoncée et laisse le temps du trajet depuis le point de départ (la santé ne baisse qu’au feu ou sous les coups) ; il n’attend pas obligatoirement que Paul entre dans le cercle. Le premier lanceur est introduit seul ou en petit nombre pour enseigner la récupération.

### 4.3 Boucle

Explorer → repérer un objectif / un soin / une arme → combattre ou contourner → esquiver et récupérer des pierres → les renvoyer → résoudre les objectifs et neutraliser l’effectif de la manche → panneau « Manche N terminée » (non bloquant) pendant que la manche suivante démarre.

La réussite des objectifs n’arrête pas la session. Santé, score, KO, soins utilisés, stock porté et arme tenue persistent entre objectifs et manches, sous les règles de réapprovisionnement.

### 4.4 Fin

Santé à zéro : KO, bilan et Rejouer. Un arrêt volontaire reste accessible depuis Pause. Rejouer réinitialise tout l’état de la session, pas les préférences et records compatibles.

## 5. Carte, exploration et objectifs

### 5.1 Carte

Paris fictif en tuiles orthogonales : sol, places, rues ouvertes, bâtiments, école, monument, boutique, soins et emplacements de groupes pacifiques. Gabarit retenu pour la première tranche : 48 × 48 tuiles de 32 pixels, soit 1 536 × 1 536 pixels logiques, à ajuster aux essais.

La taille doit produire de vrais choix de trajet sans longues traversées vides. Deux objectifs proches peuvent être visibles dans des directions différentes. La première destination reste atteignable rapidement depuis le départ.

### 5.2 Déplacement libre

Pas de murs ajoutés comme mécanique, pas de labyrinthes de ruelles imposés. Les empreintes de bâtiments, les troncs d’arbre et les objets solides restent des obstacles cohérents. Paul ne peut pas les traverser ; le feuillage dessiné peut être au-dessus du personnage sans agrandir artificiellement la collision du tronc. Les limites de carte sont lisibles et les accès ne forment pas de pièges involontaires.

Aucun objectif ne doit avoir un seul passage pouvant être entièrement condamné par un groupe pacifique. Les points de soin, caisses à outils et zones de secours ont des accès praticables. La distance de parcours réelle est utilisée pour planifier un événement urgent, pas seulement la distance à vol d’oiseau. Les groupes laissent plusieurs possibilités de contournement ; ils ne constituent pas des refuges fermés invulnérables.

### 5.3 Couches

Sol ; détails de sol ; empreintes solides ; objets ; personnages ; parties hautes des bâtiments ; effets ; marqueurs d’objectifs ; HUD. Ordre de profondeur lié à la position des pieds pour les éléments qui se chevauchent.

Les toits ou parties hautes qui masquent Paul deviennent transparents ou disparaissent localement. La collision d’un bâtiment suit son empreinte, pas toute la hauteur dessinée du sprite.

### 5.4 États

École dégradée/en feu, reconstruction, ouverte, perdue puis éventuellement reconquise. Monument au drapeau français, attaqué, drapeau remplacé, zone contestée, drapeau repris (v1.9.4). Boutique bloquée, dégagée, ouverte. Soins chargés/épuisés ; armes au sol ; groupes pacifiques toujours reconnaissables.

Chaque nouvel assaut est annoncé et identifié ; les bonus ne sont pas rejoués par un changement purement graphique. Un lieu détruit reste en ruine tant qu’il n’a pas été réparé avec une caisse à outils ; une transition de manche ne le répare pas gratuitement.

## 6. Paul, déplacement et caméra

### 6.1 Héros

Sprite de Paul aux cheveux longs et vêtements noirs, avec un accent clair (écharpe ou bavoir blanc), lisible dans quatre orientations au minimum. Accent clair, silhouette, animation et contour doivent permettre de le distinguer des casseurs classiques également vêtus de couleurs sombres.

Sprite retenu : personnage composé à partir des spritesheets Universal LPC, cellules de 64 × 64 pixels pour une silhouette visible d’environ 32 × 48, avec variantes d’animation et accessoires séparés. Les pieds définissent l’ancrage et la petite zone de collision au sol.

### 6.2 Déplacement

Huit directions libres. Gauche déplace à gauche de la carte, haut vers le haut, indépendamment de l’orientation précédente. Le schéma 3D « gauche fait tourner le nez » est remplacé. Les diagonales sont normalisées pour ne pas accélérer.

Valeurs initiales proposées, adaptées aux tuiles de 32 pixels : 180 pixels logiques/seconde en déplacement, 250 en course. La vitesse exacte reste à équilibrer. Arrêt rapide et léger lissage, sans inertie qui empêche d’esquiver un caillou.

Pas de saut, de roulade ou de barre d’endurance indispensable en V1. L’esquive demandée repose d’abord sur le déplacement. Une roulade éventuelle est une extension, pas une condition implicite de la jouabilité.

### 6.3 Caméra

Caméra du dessus à orientation fixe, centrée avec une petite zone morte. Aucun contrôle de rotation et aucune perspective isométrique. Le suivi est fluide mais arrondi au pixel au rendu pour préserver la netteté ; le zoom de caméra est toujours entier.

La visibilité autour du héros doit laisser le temps de lire une préparation de lancer. Un indicateur de menace peut annoncer un lanceur hors écran ; un projectile ne doit pas atteindre Paul sans signal ou délai suffisant.

Adaptation paysage/portrait par cadrage et zones de HUD, sans étirer les sprites. Le changement d’orientation ne fait pas apparaître d’ennemis à portée immédiate et ne modifie pas leur vitesse.

## 7. Commandes

| Action | Ordinateur | Téléphone | Manette, si retenue |
| --- | --- | --- | --- |
| Déplacer | ZQSD, WASD ou flèches | Joystick gauche | Stick gauche |
| Viser / orienter | Souris ; repli vers dernière direction de mouvement | Direction du mouvement, ou glisser depuis Renvoyer pour viser | Stick droit, repli vers déplacement |
| Frapper (frappe circulaire autour de Paul) | Espace ou clic principal, remappable | Bouton Frapper | Bouton principal |
| Renvoyer une pierre portée | E ou clic secondaire, remappable | Bouton Renvoyer ; relâcher après visée si mode glisser | Bouton secondaire |
| Ramasser une pierre au sol | Automatique à portée si stock disponible | Automatique | Automatique |
| Ramasser une arme | Automatique en passant dessus ; remplace l’arme tenue | Automatique | Automatique |
| Se soigner à une station | Automatique en passant sur une station chargée | Automatique | Automatique |
| Agir : réparer une ruine ou éteindre un lieu en feu avec une caisse à outils (un appui lance l’action, 2 s sans maintien, v1.9.1) ; passer la séquence de l’école ; aucune action ne demande de maintenir F (le secours est automatique) | F | Bouton contextuel nommé, masqué sans action possible | Bouton d’action |
| Courir | Maj, maintien ou bascule | Bouton ou seuil du joystick selon essai | Bouton ou pression stick |
| Pause / arrêter | Échap / menu | Bouton Pause | Menu |

Le clic secondaire n’est pas obligatoire : une touche doit permettre de renvoyer sans dépendre d’un menu contextuel. Sur téléphone, une pression simple renvoie vers la dernière direction de visée ; le glissement permet une direction plus précise. La visée ne concerne que le renvoi : la frappe est circulaire. Aucune frappe sur un groupe pacifique ne peut être déclenchée par une aide au ciblage. Agir ne sert plus à se soigner (section 12.6) ni à terminer un secours (section 12.12).

Options : remappage, sensibilité de visée, maintien/bascule pour frapper, courir et Agir, désactivation du glissement de visée si gênant. L’option d’assistance de renvoi ne sélectionne que des casseurs actifs visibles et ne traverse pas un groupe ou un obstacle.

Les pointeurs tactiles du joystick et des actions sont indépendants. Une annulation, un menu ou une perte de focus relâche tous les boutons. Les commandes ne déclenchent ni zoom de page, ni défilement, ni sélection de texte.

## 8. Combat, projectiles et groupes protégés

### 8.1 Contact

Hack-and-slash de proximité. **Confirmé : frappe circulaire.** Chaque coup touche tout autour de Paul (360°) les casseurs actifs à portée, les plus proches d’abord, au plus trois par attaque ; Paul se tourne vers le plus proche des casseurs touchés. Portée à mains nues : 56 pixels logiques (tuiles de 32 pixels). Cadence proposée : un coup toutes les 0,45 seconde. Chaque cible ne reçoit qu’un contact par identifiant de coup. Une arme tenue remplace la portée et met KO en un coup (section 8.7).

À mains nues, la résistance commence à deux coups, puis certains ennemis renforcés clairement signalés peuvent demander jusqu’à quatre points de dégâts. Le premier coup ne provoque jamais de reddition.

Les contacts sont synchronisés aux images utiles de l’animation. Recul court, réaction et flash d’impact lisible sans sang. Les corps KO ne sont plus ciblables, ne bloquent pas le passage et ne rapportent plus de points.

### 8.2 Lanceurs ennemis

Le rôle « lanceur » est indépendant de la variante visuelle : un casseur classique ou à drapeau peut lancer une pierre. Aucun drapeau n’attribue automatiquement une statistique supérieure.

Objets : caillou, pavé, brique. En V1, ils peuvent partager les mêmes valeurs de dégâts avec des sprites différents. Pas d’explosif ni d’arme à feu ajouté implicitement. La bouteille incendiaire (Molotov) est réservée au casseur dédié de la section 10.2, qui vise les lieux, et, **modifié (v1.9.4)**, aux lanceurs sur Paul de la section 10.9, dont la bouteille laisse une flaque de feu au sol.

Chaque lancer possède une préparation, une direction/zone annoncée et un délai de trajet. Paramètres de départ : préparation d’au moins 0,6 seconde ; portée 280 à 360 pixels ; trajet d’au moins 0,5 seconde sur une cible éloignée ; 5 PV perdus par impact au départ. Un intervalle individuel empêche le tir continu.

Un petit arc visuel et une ombre peuvent représenter la trajectoire, mais la collision est calculée dans le plan 2D. Le point d’impact ou la trajectoire est visible avant les dégâts. Les lancers hors écran nécessitent un avertissement et ne sont pas autorisés à très courte distance sans préparation.

### 8.3 Cycle de récupération et renvoi

```mermaid
flowchart LR
  A[Lancer ennemi] --> B[Projectile en vol]
  B -->|Paul évite le projectile| C[Chute au sol]
  B -->|Contact avec Paul| D[Dégâts puis chute]
  B -->|Obstacle ou groupe neutre hors événement| E[Arrêt sans dommage aux neutres]
  C --> F[Pierre récupérable]
  D --> F
  E -->|Zone de chute valide| F
  F -->|À portée et stock libre| G[Stock de Paul]
  G -->|Action Renvoyer| H[Projectile du joueur]
  H --> I[Impact ou fin de portée]
  I --> J[Objet inerte retiré : pas de récupération infinie]
```

Proposition V1 : récupération des **projectiles ennemis au sol**, pas interception en vol. Ramassage automatique dans un rayon d’environ 28 pixels, seulement s’il reste une place. Un projectile en vol ne peut pas être ramassé.

Stock maximal : trois objets. Stock plein : l’objet reste au sol. Le nombre porté est visible. Aucun achat, fabrication ou inventaire à ouvrir.

Renvoyer consomme un objet porté, crée un projectile appartenant au joueur et suit la direction choisie au lancement. Aucun guidage automatique une fois en vol. Paramètres initiaux : un point de dégât, portée d’environ 360 pixels et intervalle de 0,5 seconde. Un seul casseur touché, pas de ricochet en chaîne en V1.

Après un renvoi, l’objet devient inerte à son prochain contact ou en fin de course et est retiré ; il n’alimente pas une boucle de ramassage infinie. Seules les nouvelles pierres ennemies produisent des objets récupérables. La collision avec Paul du projectile qu’il vient de renvoyer est désactivée.

### 8.4 Règles d’impact

| Source | Cible | Effet |
| --- | --- | --- |
| Contact du joueur | Casseur actif | Dégâts et éventuellement KO ; KO immédiat avec une arme |
| Pierre ennemie en vol | Paul | Dégâts, puis chute récupérable en zone valide |
| Pierre renvoyée | Casseur actif | Dégâts ; score seulement si KO |
| Coup / pierre de Paul | Groupe pacifique ou victime à secourir | Aucun dégât, aucun KO, aucune unité au compteur de casseurs neutralisés |
| Attaque d’un agresseur affecté à un secours | Victime de cet événement | Réduit le délai / la jauge de détresse de cet événement, sans gore |
| Attaque ennemie ordinaire hors secours | Groupe pacifique | Pas de dégâts de foule non scénarisés ni d’événement silencieux |
| Pierre en vol | Obstacle solide | Arrêt ; chute ou retrait selon espace disponible |
| Pierre renvoyée | Corps KO | Pas de nouveau score ; ne sert pas de cible active |

Le KO a le même barème quelle que soit l’origine des dégâts de Paul : mains nues, arme ou renvoi. Aucun bonus supplémentaire pour un projectile ou une arme.

### 8.5 Groupes pacifiques protégés

Les manifestants sont regroupés, avec pancartes et animation calme. Le ciblage, la frappe circulaire et le renvoi de Paul les excluent : un manifestant dans le rayon de frappe n’est ni touché ni compté parmi les trois cibles. Ils ne possèdent pas de transition de KO infligée par le joueur. Pendant un secours identifié, un sous-ensemble du groupe ou une victime désignée peut passer en détresse sous la menace des agresseurs affectés à cet événement.

Les groupes occupent un espace identifiable à contourner. Leurs positions ne peuvent pas bloquer entièrement un objectif, une sortie ou un soin. Le joueur ne peut pas les déplacer ou les disperser à coups. Les ennemis doivent également pouvoir les contourner.

Un projectile de Paul qui rencontre le volume protégé du groupe est arrêté sans blessure. Un projectile ennemi ordinaire suit aussi cette protection ; seule une attaque explicitement affectée à un secours peut faire avancer sa menace. Une chute récupérable exige une position libre hors du groupe ; sinon l’objet est retiré. Les pierres renvoyées arrêtées deviennent inertes. Les sprites neutres ne servent pas à masquer un casseur intouchable : ordre d’affichage, navigation et trajectoires doivent être vérifiés.

L’intérêt d’éviter les groupes vient du déplacement et des lignes de renvoi, pas de dégâts infligés par Paul aux manifestants. Il faut distinguer cette protection permanente contre le joueur de la détresse provoquée par des ennemis dans un secours annoncé. Aucun score positif ou négatif de « frappe sur manifestant » n’est déclenché, puisque ces contacts sont exclus. Les pénalités héritées restent applicables aux autres personnes protégées si elles sont touchables ; une extension d’invulnérabilité à tous les neutres reste possible, à décider explicitement.

### 8.6 Santé

100 PV au départ, pas de régénération passive en normal. Contacts et projectiles peuvent réduire la santé. Brève invulnérabilité après impact, proposée à 0,6 seconde, pour éviter des dégâts simultanés illisibles. Un projectile ne produit qu’un événement de dommage par trajectoire.

La progression des dégâts est plafonnée comme celle des assauts. Les soins décrits en section 12 sont conservés. Le KO du héros reste la seule défaite globale.

### 8.7 Armes ramassables

**Confirmé (EX-25) :** des armes apparaissent au hasard dans les rues. Elles remplacent l’ancienne extension « accessoires de contact ». Aucun gore. **Modifié (v1.9) :** l’interdiction des armes à feu est levée pour le flashball de Paul et les tireurs ennemis, en style cartoon (EX-07, phase B à venir).

| Règle | Valeur |
| --- | --- |
| Emplacement d’apparition | Point libre et praticable, à 160–480 pixels logiques de Paul, hors groupe pacifique et hors obstacle |
| Rythme | Première arme après environ 10 secondes, puis une toutes les 15 à 25 secondes |
| Plafond au sol | Deux armes au maximum ; au-delà, aucune apparition ni réserve invisible |
| Ramassage | Automatique en passant dessus ; la nouvelle arme remplace l’arme tenue, qui disparaît |
| Effet | Toute arme met un casseur KO en un coup, y compris un casseur renforcé ; portée propre à chaque arme ; frappe toujours circulaire, trois cibles au maximum |
| Usure | Seul un coup touchant au moins un casseur consomme une charge ; à zéro, l’arme se brise et Paul revient à mains nues (56 pixels) |
| Manches | L’arme tenue et ses coups restants sont conservés d’une manche à la suivante |

Armes de contact actuelles (**Confirmé**, valeurs en paramètre initial) :

| Arme | Portée | Coups |
| --- | ---: | ---: |
| Bâton | 72 pixels | 15 |
| Marteau | 64 pixels | 8 |
| Panneau de signalisation | 96 pixels | 10 |

Présentation : une arme au sol flotte, oscille et brille pour être repérée ; l’arme tenue tourne sur elle-même à chaque coup. Le HUD affiche « Arme : <nom> (<coups>) » ou « Arme : mains nues ». Le score d’un KO à l’arme est identique à celui d’un KO à mains nues ou par renvoi.

**Nouvelles armes débloquées par manche — Proposé, tranche 2 :**

| Arme | Comportement proposé | Disponibilité |
| --- | --- | --- |
| Gant de boxe à ressort | Coup de poing à distance en ligne droite ; KO et repoussement du premier casseur touché ; environ 6 tirs | Débloqué par la progression des manches |
| Kamehame | **Confirmé et livré (v1.9.7)** sous le nom « Onde d’énergie » : voir section 8.9 | Retournement dès la manche 5, rue dès la manche 7 |
| Bouclier | **Confirmé et livré (v1.9.7)** : voir section 8.9 | Retournement dès la manche 3, rue dès la manche 5 |

Ton cartoon, aucun gore ; armes à feu cartoon seulement dans les conditions d’EX-07. Équilibrage : les armes puissantes restent rares et sont associées à l’arrivée de casseurs plus résistants. Les rayons et coups à distance respectent la protection des groupes pacifiques et des victimes (section 8.5) : ils s’arrêtent sur leur volume sans les blesser.

### 8.8 Mode furie

**Confirmé (v1.9.3, demande du porteur du projet) :** dans les manches difficiles, un bonus de puissance rare se ramasse comme une arme mais, au lieu d’une arme ou d’un bouclier, il déclenche aussitôt le **mode furie** de Paul. Nom en jeu : « Mode furie ». Visuel original en pixel art (aura jaune-blanc à pointes, étincelles), sans emprunt à une franchise existante.

| Règle | Valeur (paramètres `CONFIG.furie`) |
| --- | --- |
| Objet au sol | Orbe jaune lumineux à éclair, flottant et pulsant ; type de ramassage `furie` du système d’armes |
| Ramassage | Automatique en passant dessus ; le mode s’active à l’instant pour 12 s (`durationSec`) ; il ne remplace pas l’arme tenue, qui garde ses coups et reste utilisable ; un second ramassage pendant le mode remet le minuteur à 12 s |
| Apparition | Jamais avant la manche 4. **Modifié (v1.9.7) :** à partir de la manche 4, l’arme du retournement (section 12.2) est tirée au sort parmi les spéciaux débloqués (bouclier dès la manche 3, mode furie dès la manche 4, onde d’énergie dès la manche 5 ; section 8.9) ; un mode furie du retournement disparaît après 15 s (bannière « MODE FURIE DISPONIBLE ! » / « Fonce le ramasser »). À partir de la manche 6, environ une apparition chronométrée sur six est un mode furie (`spawnShare`). Tout mode furie au sol, quelle que soit son origine, a l’indicateur « FURIE » (icône étoile). L’arme posée pendant le répit reste une arme normale |
| Déplacement | Marche et course ×1,35 (`speedMul`) |
| Frappe | Portée ×1,5 à mains nues comme avec une arme (`reachMul`), jusqu’à 8 casseurs par coup (`maxTargets`, 3 hors mode), KO en un coup même à mains nues ; le coup ne consomme pas de charge d’arme |
| Dégâts reçus | ×0,5 (`damageTakenMul`) |
| Fin | Minuteur écoulé, ou Paul KO (fin immédiate) ; la pause gèle le minuteur ; Rejouer repart sans mode |
| Envol | Chaque casseur mis KO par un coup de Paul pendant le mode s’envole en tourbillon (purement visuel, aucune règle de jeu changée) : direction opposée à Paul avec un léger écart, 220–420 px, 2 à 5 tours, tirés d’un flux aléatoire séparé et déterministe ; chaque KO compte toujours +1. Le renvoi de pierre est inchangé |

Présentation : aura jaune-blanc additive à pointes derrière Paul avec pulsation, étincelles en flammes qui montent, teinte chaude du sprite et contour doré, fin anneau de minuterie aux pieds ; l’aura faiblit et clignote pendant les 2 dernières secondes. Les corps envolés tournoient pendant environ 0,7 s (trajet amorti, arc, léger écrasement, traînée d’étoiles et de poussière) au-dessus du décor, puis retombent au point libre le plus éloigné de leur trajet, jamais hors de la carte ni dans un mur, et restent au sol comme les autres corps. Chaque coup qui touche pendant le mode affiche une courte bulle pixel « POW ! » / « BOUM ! » (réutilisée) et une très légère secousse de caméra, supprimée avec `prefers-reduced-motion`. HUD : « Arme : Bâton (12) · Mode furie 9 s » (secondes arrondies au supérieur, en jaune) ; bannière courte sans flèche « MODE FURIE ! » au ramassage. Son : montée synthétique au début, bourdonnement grave pendant le mode (une voix du plafond, coupé par la sourdine et la pause), descente à la fin.

### 8.9 Bouclier et onde d’énergie

**Confirmé (v1.9.7, demande du porteur du projet) :** deux armes spéciales rejoignent le mode furie. Elles se ramassent comme une arme (en passant dessus) et **remplacent l’arme tenue**. Visuels originaux en pixel art, sans emprunt à une franchise existante ; l’identifiant interne de l’onde reste `kamehame`, le nom en jeu est « Onde d’énergie ».

| Règle | Bouclier (`CONFIG.bouclier`) | Onde d’énergie (`CONFIG.kamehame`) |
| --- | --- | --- |
| Durée / usages | 20 s de temps de jeu actif (`durationSec`), la pause gèle le minuteur ; puis il se brise (« WeaponBroken ») ; aucun compteur de coups | 2 tirs (`uses`) ; brisée après le dernier |
| Effet | Pierres et bouteilles des lanceurs sur Paul qui l’atteignent de face (cône de 120°, `frontDeg`, autour de son orientation) : bloquées. Une pierre bloquée tombe au point d’impact, récupérable, sans dégât ; une bouteille bloquée s’éteint sans flaque. Coups au contact et flaques déjà au sol : non bloqués | Maintenir Frapper (Espace, clic gauche, bouton Frapper) charge 1 s (`chargeSec`) ; Paul ne se déplace pas (la visée à la souris l’oriente). Relâcher avant 1 s, prendre un coup, perdre l’arme ou être KO annule sans rien consommer. À 1 s le rayon part seul : 320 px (`length`) dans l’orientation de Paul, 16 px de demi-largeur (`halfWidth`), arrêté au premier obstacle (bâtiment, objet, tronc, socle du monument, groupe pacifique) ; tous les casseurs actifs à moins de 16 px + leur rayon de la ligne sont KO (+1 chacun) ; jamais les victimes ni le groupe. Un tir sans cible consomme quand même un usage |
| Frappe | Coup de bouclier : portée 64 px (`bashRange`), KO en un coup, corps repoussé de 24 px (`knockback`), aucune charge consommée ; compatible avec le mode furie (portée ×1,5, 8 cibles, envol) | Frapper lance la charge (pas de coup circulaire) ; **modifié (v1.9.8) :** les casseurs KO par le rayon sont **satellisés** (voir ci-dessous) |
| HUD | « Bouclier (14 s) » (secondes arrondies au supérieur) | « Onde d’énergie (2) » ; petite barre de charge pixel sous la barre de santé pendant la charge |
| Présentation | Bouclier rond bleu et acier tenu devant Paul (devant lui de face et de profil, derrière lui de dos), qui pâlit et clignote les 3 dernières secondes ; étincelles et anneau court à chaque blocage | Lueur bleu-blanc qui grandit dans les mains, fin anneau qui se resserre ; rayon de dessin animé bleu-blanc (≈ 250 ms, largeurs par paliers, lueur additive) et légère secousse de caméra (aucune avec `prefers-reduced-motion`) |
| Objet au sol | Bouclier rond bleu et acier avec reflet, flottant et pulsant | Orbe bleu lumineux avec une étincelle, flottant et pulsant |
| Son | Choc métallique bref au blocage | Bourdonnement montant pendant la charge, décharge au tir (WebAudio, dans le plafond de voix) |

**Satellisation (v1.9.8, demande du porteur du projet : « j’ai envie que les émeutiers soient satellisés »).** Chaque casseur mis KO par l’onde d’énergie est expédié dans le ciel le long du rayon, au lieu du tourbillon du mode furie : envol `satellite` de la charge visuelle (`launch.kind`), 1 100 à 1 800 px (`satellitePower`), 6 à 10 tours (`satelliteSpin`), ± 0,15 rad autour du rayon (`satelliteJitter`), tirés du flux aléatoire séparé des envols (déterministe, aucune autre séquence décalée). À l’écran : environ 1,3 s d’accélération (lente puis très rapide) en tournoyant, en montant et en rapetissant jusqu’à 25 %, petite traînée d’étoiles et de poussière, au-dessus de tout, sans limite de carte (il peut sortir du monde et de l’écran). L’étoile est toujours vue : une petite étoile pixel « ✦ » scintille (avec une fois sur deux une minuscule bulle « PING ! », à l’échelle du zoom comme les autres bulles) au point où le corps quitte l’écran, ramené à l’intérieur du bord (8 px), ou là où il finit s’il finit à l’écran ; jamais deux étoiles pour un même corps. Les corps d’un même rayon décollent l’un après l’autre (0, 30, 60, 90, 120 ms selon leur rang, sans hasard). Le corps est ensuite retiré : aucun corps ne reste au sol. Seize satellites au plus en vol à la fois (au-delà, le corps disparaît aussitôt avec son étoile) ; étoiles et bulles réutilisées. `prefers-reduced-motion` : vol de 0,5 s sans rotation. Purement visuel : chaque KO compte toujours +1, aucun point en plus ; le mode furie garde son tourbillon (`tumble`), les KO à mains nues, à l’arme ou à la pierre n’ont pas d’envol.

**Qui les dépose.** Spéciaux : mode furie, bouclier, onde d’énergie. Le retournement « arme » (section 12.2) tire au sort (graine) parmi les spéciaux débloqués à la manche : bouclier dès la manche 3, mode furie dès la manche 4, onde d’énergie dès la manche 5 ; avant la manche 3, une arme ordinaire. Dans la rue, chaque spécial s’ajoute aux armes ordinaires avec un poids d’environ un sur six, deux manches après son déblocage au retournement (bouclier dès la manche 5, mode furie dès la manche 6, onde dès la manche 7) ; un spécial de la rue ne disparaît pas, celui du retournement après 15 s.

**Indicateur.** Seuls les spéciaux au sol ont un indicateur de bord d’écran (selon leur type, quelle que soit leur origine) : « FURIE » (icône étoile), « BOUCLIER » (icône bouclier), « RAYON » (icône orbe), et seul un spécial du retournement a une bannière : « MODE FURIE DISPONIBLE ! » / « Fonce le ramasser », « BOUCLIER DISPONIBLE ! » / « Fonce le ramasser », « ONDE D’ÉNERGIE DISPONIBLE ! » / « Fonce la ramasser ». Les armes ordinaires (bâton, marteau, panneau), y compris celle du retournement avant la manche 3, n’ont ni bannière ni indicateur.

## 9. Personnages, hordes et intelligence artificielle

### 9.1 Catégories visuelles

| Catégorie | Fonction | Score et compteur « Casseurs neutralisés » |
| --- | --- | --- |
| Casseur classique | Contact, dégradation ou lancer selon rôle | +1 point et +1 au compteur au KO |
| Casseur avec drapeau palestinien | Même familles de rôles, drapeau distinct | +1 point et +1 au compteur au KO |
| Casseur avec drapeau Antifa | Même familles de rôles, drapeau distinct | +1 point et +1 au compteur au KO |
| Groupe de manifestants pacifiques | Groupe neutre à contourner et protéger ; secours possible si menacé | Jamais |
| Victime individuelle ou couple âgé | Vol/intimidation pendant un événement de secours, jamais adversaire | Jamais |
| Étudiants / professeurs | Présence pacifique et retour à l’école | Jamais |
| Police / pompiers / soignants / commerçants | Présence et fonctions protégées | Jamais |

Les teints des PNJ varient dans toutes les catégories. La tenue, la pancarte ou le drapeau ne remplace pas la logique d’entité et son comportement hostile ou neutre. **Confirmé :** le drapeau est purement cosmétique ; il ne modifie ni le score, ni le compteur, ni les statistiques.

### 9.2 Rôles d’ennemis

- Contact : rejoint Paul, prépare puis frappe à portée.
- Dégradeur : rejoint une façade tant que l’objectif est actif, puis change de cible si elle est perdue.
- **Attirés par Paul (v1.9.1) :** un dégradeur ou un agresseur de victime s’en prend à Paul quand il passe à 220 px au plus avec une ligne dégagée, et retourne à son poste au-delà de 320 px (hystérésis). Quand il ne reste que trois hostiles actifs au plus, un dégradeur qui tient son poste depuis plus de 6 s le quitte pour Paul, définitivement. **Modifié (v1.9.5) :** un agresseur de victime n’est plus concerné : il reste sur la victime (et la vole, section 12.12) tant que Paul ne s’approche pas à 220 px ; un petit secours seul sur la carte perd donc ses objets si Paul tarde. Un Molotov n’est jamais détourné avant son lancer. Paramètres `hostile.aggroRadius`, `aggroRelease`, `fewLeft`, `postSec`.
- Lanceur : cherche une distance de lancer et une ligne lisible, prépare puis projette ; revient au contact si nécessaire.

La première manche enseigne le contact seul ; les lanceurs apparaissent à partir de la manche 2 (section 12.2). Une horde mélange ensuite les rôles. Aucun état de reddition, de fuite comptée comme victoire ou de disparition donnant gratuitement un KO.

### 9.3 Hordes et pression

Les hordes sont plus nombreuses que dans la version 3D prévue. Dans une manche, les casseurs entrent un par un (1,5 seconde d’écart), par les trois points d’entrée les plus proches de Paul parmi ceux situés à 320 px au moins (v1.9.1), avec au plus douze casseurs de manche sur la carte à la fois ; les suivants attendent dans une file d’entrée. Le plafond technique reste de quarante hostiles actifs, agresseurs d’événements compris, à valider par les budgets mobile. Ce plafond reste une règle commune aux qualités graphiques, pas un nombre réduit automatiquement sur les appareils lents.

Le directeur limite les préparations d’attaques simultanées : au départ deux frappes de contact et deux lancers ; augmentation progressive plafonnée à quatre contacts et quatre lancers en préparation. Les autres ennemis approchent, se repositionnent ou dégradent. Le total de projectiles en vol est plafonné séparément.

### 9.4 Navigation

Grille orthogonale, empreintes de bâtiments et volumes de groupes pacifiques. Évitement local et partage des chemins ou champs de direction pour ne pas recalculer une recherche complète pour chaque ennemi à chaque image.

Partition spatiale pour voisinage, contacts et projectiles. Aucun parcours quadratique de toute la foule à chaque image comme solution de production. Les apparitions sont hors du champ proche, dans un emplacement libre, jamais au milieu d’un groupe pacifique.

Une horde ne doit pas bloquer définitivement son propre trajet. Un agent coincé recalcule ou rejoint une autre cible valide ; pas de téléportation visible près de Paul.

### 9.5 Groupes pacifiques

Trois groupes proposés sur la carte, de six à huit sprites chacun, sur des emplacements non obligatoires. Déplacements lents de groupe possibles après validation, sans couper brutalement la seule voie d’esquive.

Leurs pancartes et leur densité les distinguent des hordes. Ils restent neutres même quand Paul passe près ou se fait poursuivre. Un événement peut les faire appeler à l’aide ou se replier ; ils ne deviennent pas hostiles et ne sont pas exposés à des dégâts libres de Paul. Ils ne nourrissent pas les systèmes de butin, de soins ou de score de KO.

## 10. Bâtiments menacés, défense et réparation

### 10.1 Boucle d’un lieu attaqué

**Modifié (v1.9) :** l’ancienne réserve de temps (30 s) est remplacée partout, école comprise, par un modèle de santé. La boucle vaut pour tous les lieux de casse (école, voiture, abribus, **ajouté (v1.9.4)** boutique de jeux rétro, puis ceux de la section 12.2).

```mermaid
flowchart TD
  A[Attaque annoncée : Molotov et casseurs en route] --> B[Molotov : 1,5 s d’élan puis lancer]
  A --> C[Dégradeurs à la façade]
  B -->|KO pendant l’élan| C
  B -->|Bouteille lancée| D[Lieu en feu]
  D --> E[Santé qui baisse]
  C --> E
  E -->|Derniers casseurs KO, pas de feu| F[Lieu sauvé, bonus]
  E -->|Derniers casseurs KO, feu en cours| S[Le feu continue : 0,7 PV/s]
  S -->|Caisse à outils + F, 2 s| F2[Feu éteint : lieu sauvé, points de réparation]
  S -->|Santé à zéro| G
  E -->|Santé à zéro| G[Ruine persistante : session continue]
  G --> H[Ramasser une caisse à outils]
  H --> I[Appuyer sur F près de la ruine : 2 s, abords sûrs]
  I --> J[Lieu réparé à 100 %]
  F --> K[Étudiants et formations projetées]
  F2 --> K
  J --> K
```

### 10.2 Alerte, Molotov et santé

Chaque lieu a une **barre de santé** : bâtiments 100 PV (école, boutique de jeux rétro), mobilier urbain (voiture, abribus, kiosque) 60 PV. Elle est dessinée au-dessus du lieu sur la carte et reprise dans la carte d’incident du HUD (« École 64 % ») ; le HUD n’affiche pas de compte à rebours pour un lieu.

Une attaque commence par un **casseur Molotov** : il marche vers le lieu, s’arrête à 96 px au plus avec une ligne dégagée, lève une bouteille allumée pendant 1,5 s (élan visible), puis la lance ; le lieu **prend feu**. Le mettre KO pendant l’élan empêche ce feu. **Modifié (v1.9.1) :** une attaque compte plusieurs lanceurs de Molotov, en plus de ses autres casseurs : min(4, 1 + manche ÷ 2 arrondi à l’inférieur), soit 1 en manche 1, 2 en manches 2–3, 3 en manches 4–5, 4 ensuite (aussi pour la boutique de jeux rétro, v1.9.4, qui est un bâtiment), deux au plus pour une voiture ou l’abribus ; ils arrivent en tête de la première ligne, sauf pour l’école de la manche 1 dont le second lanceur vient avec les renforts, après la cinématique. Plusieurs lanceurs du même lieu ne lancent jamais ensemble : chacun garde sa bouteille levée 0,25 s de plus que le précédent. Une bouteille sur un lieu déjà en feu ne le rallume pas (pas de nouvelle bannière ni d’alarme) mais lui retire d’un coup 8 PV (`molotov.burstDamage`), avec une gerbe de flammes visible ; à zéro, même ruine et même pénalité unique que pour le feu. Les autres casseurs de l’attaque se partagent entre **dégradeurs** (ils frappent la façade) et casseurs qui s’en prennent à Paul ; ce mélange est le réglage d’équilibrage.

Le feu retire 2 PV/s ; chaque dégradeur en train de frapper retire 1,2 PV/s, quatre au plus comptés. La santé ne baisse que pendant ces dégradations effectives ; elle ne dépend pas de l’entrée de Paul dans une zone. La première école (manche 1) présente sa première ligne puis huit renforts ; ces casseurs comptent dans l’effectif de la manche (section 12.2).

### 10.3 Source de vérité de la santé

La santé du lieu, tenue par la simulation, est l’unique source de vérité : pas de second minuteur. Elle ne se réinitialise pas quand Paul quitte la zone et ne remonte pas pendant l’attaque.

À zéro : lieu détruit. La perte est résolue une seule fois (−3 pour un bâtiment, −2 pour le mobilier urbain) et le bonus de sauvetage est perdu. La ruine (brûlée, fumante) persiste d’une manche à l’autre et n’est plus attaquée tant qu’elle n’est pas réparée. Un lieu détruit ne termine jamais la session ; seul le KO de Paul y met fin. Les survivants de l’attaque se reportent sur Paul.

### 10.4 Première ligne et renforts

L’entrée du cercle déclenche la confrontation, pas le début du danger. Les KO obtenus avant l’entrée sont conservés. Aucun agent ne réapparaît à cause d’une sortie/rentrée.

Après la première ligne entièrement KO, une courte cinématique annonce les huit renforts ; elle n’existe que pour l’école de la manche 1. Pendant cette présentation suspendue, la santé du lieu et tous les autres incidents sont également suspendus. Passer la séquence (F, Espace ou toucher) ne double pas les renforts.

Si le bâtiment a déjà été détruit, cette occurrence ne crée pas ses renforts en retard. Les survivants restent à traiter, mais la voie de résolution devient la réparation par caisse à outils.

### 10.5 Sauvetage avant destruction

Tous les casseurs de l’attaque KO avec une santé strictement positive et **aucun feu** : le lieu est sauvé aussitôt. Bonus +8 pour un bâtiment, +4 pour le mobilier urbain, une seule fois par occurrence ; retour du drapeau français pour l’école ; aucune caisse consommée. La santé d’un lieu sauvé revient au maximum à la fin de la manche.

**Modifié (v1.9.1) — un feu ne s’éteint jamais seul.** Si le lieu brûle quand ses derniers casseurs tombent, l’attaque est réglée pour la manche (objectif « réussi » tant que le lieu tient debout, la manche peut se terminer) mais le feu **continue** : il retire 0,7 PV/s (`target.smoulderDps` ; école de 100 PV ≈ 143 s, voiture de 60 PV ≈ 86 s), à travers les fins de manche et le répit, sans remise à niveau de la santé. Seule une caisse à outils l’éteint (section 10.6) : le lieu est alors sauvé (drapeau de l’école, statistiques), sans le bonus de sauvetage, avec les points de réparation. S’il atteint zéro avant, il devient une ruine (pénalité unique). Un lieu en feu n’est pas attaqué de nouveau ; sa carte « en feu » et son indicateur flamme restent affichés pour guider Paul, sans nouvelle bannière.

### 10.6 Caisses à outils après destruction

**Modifié (v1.9.1) :** la réparation se lance avec la touche Agir (F, bouton Agir), sans la maintenir. Une ruine se répare, et un lieu en feu s’éteint, avec une **caisse à outils** trouvée sur la carte. Elle est distincte des soins médicaux : caisse orange/rouge, même animation flottante que les soins ; portée, son icône flotte au-dessus de Paul (**modifié v1.9.6 :** plus de compteur « Caisse » dans le HUD). Elle ne rend pas de santé à Paul.

Stock : une caisse portée au maximum, au plus deux au sol, posées sur des emplacements libres au début et à la fin de chaque manche (la manche 1 en a donc). Paul la ramasse en passant dessus (rayon de 20 px) ; une caisse au sol ne disparaît pas s’il en porte déjà une. Une caisse portée est conservée entre manches. Les emplacements sont accessibles sans traverser bâtiment, tronc ou groupe ; aucune caisse dans la ruine à réparer.

Pour réparer ou éteindre : à 48 px au plus de la porte d’un lieu en ruine ou en feu (la ruine d’abord si les deux sont proches), Paul debout, caisse portée et **sans casseur actif à 64 px**, **appuyer une fois sur Agir** (F au clavier, bouton Agir au tactile) ; l’action dure ensuite **2 secondes** sans maintenir la touche. S’éloigner, laisser un casseur approcher ou un KO de Paul remet la progression à zéro et il faut appuyer de nouveau ; sans appui, rien ne se passe. Le HUD l’affiche sous Paul : « F — Réparer » (ruine) ou « F — Éteindre le feu » (feu), sans la touche au tactile où le bouton Agir prend le libellé « Réparer » / « Éteindre » ; « Réparation… » (en cours) ; « Caisse à outils requise » (sans caisse) et « Abords non sécurisés » (casseur trop proche), informatifs.

La caisse n’est consommée qu’à la fin des 2 s. Interruption : aucun gain, aucune caisse consommée. Éteindre un lieu en feu (pendant ou après l’attaque) ne lui rend pas de santé et rapporte une fois par feu les points de réparation (+5 bâtiment, +3 mobilier urbain).

### 10.7 Résultat d’une réparation

Le lieu revient à **100 % de sa santé** (ruine réparée ou feu éteint) ; sa fonction reprend (l’école peut de nouveau recevoir des étudiants). Points : +5 pour un bâtiment, +3 pour le mobilier urbain, sans effacer la pénalité déjà subie ni ajouter le bonus de sauvetage : sauver avant destruction reste mieux récompensé.

Une réparation ne recrée ni l’attaque perdue ni une nouvelle occurrence d’assaut. Chaque lieu conserve la référence de son dernier incident détruit et de sa réparation pour empêcher le double bonus. Une nouvelle attaque ultérieure est annoncée et identifiée séparément.

### 10.8 Étudiants et formations

Après sauvetage ou réparation, quatre étudiants puis de petits groupes peuvent rejoindre la porte. Chaque entrée produit une seule formation projetée, ingénieur ou scientifique. Pas de points de classement par attente. Au plus cinq étudiants en déplacement.

Les arrivées se suspendent si l’école est attaquée ou détruite. Les compteurs déjà obtenus ne sont pas effacés. Une réparation les fait reprendre sans remettre à zéro l’historique de session.

### 10.9 Lanceurs sur Paul

**Confirmé (v1.9.4, demande du porteur du projet) :** quelques casseurs à cocktail Molotov lancent aussi leurs bouteilles **sur Paul**, pas seulement sur les lieux. Ce sont les **lanceurs sur Paul** (rôle `firebomber`), peu nombreux.

- **Comportement :** comme le lanceur de pierres, il se tient entre 140 et 260 px de Paul avec une ligne dégagée, lève une bouteille allumée pendant **1,2 s** (« ! » au-dessus de la tête et ligne de visée en pointillés jusqu’au sol, avec l’anneau de la future flaque), puis lance. La bouteille vole **0,7 s** vers l’endroit où se trouvait Paul **au début de l’élan** : Paul qui se déplace l’évite. Un lancer toutes les 5 s. Paul à moins de 100 px : il se bat au contact comme un casseur ordinaire. Le mettre KO pendant l’élan empêche le lancer. Ses élans comptent dans le plafond des élans de lancer (avec les pierres).
- **Flaque de feu :** là où la bouteille tombe, une flaque de 30 px de rayon brûle **3,5 s** (six au plus à la fois : une nouvelle chasse la plus ancienne). Une bouteille qui tomberait dans un obstacle s’allume au point libre le plus proche (aucune flaque à défaut). Paul debout dedans perd **4 PV toutes les 0,5 s** par le chemin normal des dégâts : les images d’invulnérabilité s’appliquent (un coup refusé est retenté dès qu’elles finissent) et le mode furie les réduit de moitié. La flaque ne blesse aucun casseur et n’enflamme jamais un lieu. La pause la fige.
- **Qui :** jamais en manches 1–2. Dès la manche 3, environ **un casseur de remplissage sur huit** (au moins un dès que le remplissage en compte quatre, trois au plus par manche) ; et, dans chaque attaque de lieu, le **dernier lanceur de Molotov** de la composition, après sa bouteille sur le lieu (inchangée), devient un lanceur sur Paul au lieu d’un simple casseur de contact. Ce sont des casseurs ordinaires de la manche : ils comptent dans K/T, doivent être mis KO, +1 chacun ; leurs variantes alternent comme les autres.
- **Rendu et son :** bouteille en main comme le casseur Molotov, même trajectoire de bouteille, flaque en pixel art (lueur, flammes, étincelles, léger anneau de danger) qui s’estompe sur sa dernière demi-seconde ; même souffle que le Molotov au lancer. Aucune bannière ni nouvel élément de HUD.

## 11. Objectif monument

**Réécrit (v1.9.4, demande du porteur du projet).** L’ancienne version (monument occupé dès le départ, défenseurs à l’entrée dans la zone, capture de 12 s) est remplacée par la règle ci-dessous.

### 11.1 Présentation

Une **statue équestre** fictive en pixel art : un cheval et son cavalier en bronze sombre sur un socle de pierre à plaque vierge, le cavalier tenant une hampe. **Le drapeau tenu est d’abord le drapeau français** (bleu #0055a4, blanc, rouge #ef4135). Le tissu ondule (trois images). Aucune personne réelle n’est représentée. Le socle est solide comme le mobilier urbain : tuiles 33–34 × 21–22 (`R(33,21,2,2)`), mât en {1088, 672}, zone de capture circulaire {1088, 704} de rayon 112 px. Huit points d’occupation entourent le socle sur les tuiles libres ; socle, bord de zone et points sont atteignables depuis l’apparition de Paul et les entrées, sans chevaucher bâtiment, mobilier, station, arbre ni groupe pacifique.

Le monument n’a pas de santé et n’est pas un lieu de casse : il ne brûle pas, n’est pas réparé par caisse à outils et n’entre pas dans les ruines. Son drapeau, en revanche, **persiste comme une ruine** : une fois remplacé, il le reste d’une manche à l’autre et pendant les répits, jusqu’à ce que Paul le reprenne.

### 11.2 Occupation (« MONUMENT ATTAQUÉ ! »)

Dès la manche 4, la deuxième étape de la manche alterne entre le monument et le secours : monument quand le drapeau est français et que la manche précédente n’avait pas le monument, sinon secours. **Aucune occupation ne démarre tant que le drapeau est palestinien.** Si aucun lieu de casse n’est libre, l’étape restante est seule et donne son titre à la manche (« Monument menacé »).

Une occupation (`monument#n`) envoie **6 casseurs** la première fois, puis min(8, 5 + ⌊manche ÷ 3⌋). Ils entrent par la file d’entrée (en tête, comme les autres objectifs), variantes **mélangées en alternance** (classique, drapeau palestinien, Antifa), et marchent jusqu’au socle comme des dégradeurs ; ils comptent dans K/T et chaque KO vaut +1. Ils peuvent se détourner vers Paul quand il approche (règle d’attraction de la section 9).

Tant qu’au moins un casseur de l’occupation se tient au socle, un compteur de remplacement avance d’1 s par seconde **par casseur au socle (trois au plus comptés)** ; il garde sa valeur quand ils s’en éloignent. À **4 s** (environ 1,3 s à trois), le drapeau français est remplacé par le drapeau palestinien : animation (le drapeau descend, l’autre monte, 0,5 s), bannière « DRAPEAU REMPLACÉ ! » / « Reprends le monument », −3 une seule fois par occurrence. L’occupation est alors réglée pour la manche (objectif « perdu ») : la manche peut se clore, mais ses casseurs restent au socle et doivent être mis KO comme les autres. Si tous les casseurs de l’occupation sont KO avant le remplacement, le monument est **défendu** : +4 une fois, objectif « réussi ».

### 11.3 Capture du drapeau

Seulement quand le drapeau est palestinien, **à tout moment, répit compris** :

| Situation | Progression |
| --- | --- |
| Drapeau français | Aucune capture |
| Paul hors de la zone (distance au centre > 112 px) | Suspendue, valeur conservée |
| Paul dans la zone avec un hostile actif à l’intérieur | Suspendue : « zone contestée » |
| Paul dans la zone, aucun hostile actif à l’intérieur | Avance d’1 s par seconde |
| 8 s atteintes | Drapeau français rétabli |

Aucune touche : rester dans la zone suffit. Les corps KO et les personnes protégées ne contestent pas ; pause et KO de Paul figent la progression. À 8 s : drapeau français (animation inverse), son de confirmation, étincelles bleu-blanc-rouge, bannière courte « DRAPEAU RÉCUPÉRÉ ! », **+10 une seule fois par remplacement** (clé `monument#<n° du remplacement>:captured`). Plusieurs cycles remplacement / capture dans une session sont comptés chacun.

### 11.4 Affichage

Bannière « MONUMENT ATTAQUÉ ! » / « Défends le drapeau » au début de l’occupation (palette jaune, icône fanion neutre, flèche et distance), indicateur en bord d’écran « MONUMENT » pendant l’occupation puis « DRAPEAU » tant que le drapeau est palestinien ; carte « Drapeau — capture N/8 s » avec une mini-barre, « zone contestée » quand un hostile bloque. Au sol, l’anneau de la zone est discret quand le drapeau est français, rouge quand il est palestinien, hachuré quand la zone est contestée, avec un arc qui se remplit pendant la capture. Les drapeaux des casseurs restent purement cosmétiques (section 9) ; aucune variante n’est désignée comme occupante.

## 12. Mode arcade, manches, événements, progression et soins

### 12.1 Règle centrale

**Aucune durée limite de session. Aucun compte à rebours global. La session se poursuit jusqu’au KO du héros.** La session est découpée en manches (section 12.2). Réussir l’école, le monument ou une manche augmente le score et renouvelle le contenu, sans réinitialiser la santé et sans afficher une victoire finale. Un objectif échoué ne termine jamais la session : seul le KO de Paul y met fin.

Les délais de frappe, la destruction d’un bâtiment attaqué, la détresse d’un secours, les cinématiques, la capture et les interactions ont des durées locales. Une mesure de durée de survie peut apparaître au bilan, en temps écoulé, sans pression de compte à rebours.

### 12.2 Structure des manches

**Confirmé :** les manches remplacent les vagues sans fin comme structure cible. Une manche fixe un nombre de casseurs à mettre KO et un à trois objectifs. Elle se termine quand tout son effectif a été neutralisé et que ses objectifs sont résolus, réussis ou perdus. Un objectif échoué ne termine jamais la session ; seul le KO de Paul y met fin.

**Modifié (v1.9) — rythme d’une manche.** Une manche alterne temps forts et temps faibles : (1) **répit de 6 s** sans aucune entrée de casseur, avec le panneau non bloquant « Manche N terminée » (KO, objectifs « réussi » / « perdu », points, « Bonus +5 » s’il est gagné, « Soins rechargés », compte à rebours « Manche N+1 dans 4… »), stations de soin rechargées, santé des lieux sauvés ou réparés remise au maximum (jamais celle d’un lieu encore en feu), caisses à outils reposées (aussi au début de la manche) et une arme posée près de Paul ; la manche 1 n’a pas de répit, l’intro de 4 s en tient lieu ; (2) **annonce** par la bannière pixel « MANCHE N ! » avec la casse phare de la manche (« Voiture menacée · 18 casseurs » : rien n’est encore en feu) ; (3) **montée** : le premier groupe file vers le lieu attaqué ; (4) **retournement** dès que la moitié de l’effectif est KO : une seconde urgence ailleurs ou une arme à aller chercher (disparaît après 15 s ; **modifié v1.9.7 :** une arme ordinaire sans bannière en manche 2, puis un spécial tiré au sort parmi ceux débloqués — bouclier dès la manche 3, mode furie dès la manche 4, onde d’énergie dès la manche 5 — avec sa bannière, sections 8.8 et 8.9) ; (5) **apogée** : le dernier groupe de la manche entre plus serré (0,8 s d’intervalle) ; (6) **récompense** : bonus +5 si tous les objectifs sont réussis, puis retour au répit. Le répit commence quand tout l’effectif de la manche est KO. Le joueur conserve sa santé, son score, ses KO, ses formations, son stock de pierres, sa caisse à outils portée, son arme tenue avec ses coups restants et son historique de soins.

Les casseurs affectés aux objectifs (première ligne, renforts, défenseurs, agresseurs de secours) font partie de l’effectif de la manche. Une réparation optionnelle d’un bâtiment déjà perdu n’empêche pas la transition. Les secours déjà déclenchés doivent être résolus ou reportés explicitement avec leur état ; ils ne disparaissent pas gratuitement au changement de manche. La boutique, détaillée en section 23, fait partie de la cible de diffusion : elle apparaît comme « commerce pillé » dès la manche 2, puis dans le mélange des manches suivantes. **Modifié (v1.9.4, demande du porteur du projet) :** la boutique livrée est une **boutique de jeux vidéo rétro** (« JEUX RÉTRO »), un bâtiment à protéger comme l’école (santé, Molotov, dégradeurs, feu qui couve jusqu’à la caisse à outils, réparation à pleine santé), sans rideau ni commerçant ; elle entre dans le tirage au sort de la casse phare dès la manche 2 (tirage aléatoire, v1.9.4).

Progression proposée (valeurs **Proposé**, à équilibrer) :

| Manche | Casseurs à neutraliser | Objectifs et nouveautés | Casse (nouveaux éléments) |
| --- | ---: | --- | --- |
| 1 | 10 | École ; casseurs au contact uniquement | École en feu |
| 2 | 14 | École, secours puis commerce ; apparition des lanceurs | + Commerce pillé (rideau forcé) |
| 3 | 18 | Deux urgences simultanées ; nouvelle arme (gant de boxe à ressort) | + Voiture en feu, abribus saccagé (l’un des deux par manche) |
| 4 | 22 | Ajout du monument (v1.9.4 : occupation un tour sur deux à la place du secours tant que le drapeau est français) ; casseurs renforcés | + Monument attaqué, drapeau remplacé |
| 5 | 26 | Deux lieux attaqués à la fois puis monument ou secours ; nouvelle arme (bouclier) | + École maternelle en feu, kiosque saccagé |
| 6 et suivantes | +4 par manche, plafonné à 40 grâce à la file d’entrée | Deux lieux attaqués à la fois tirés dans le catalogue, puis monument ou secours ; une nouvelle arme ou un nouveau type d’ennemi toutes les deux manches (Kamehame en manche 7) | + Mairie attaquée (manche 7), bibliothèque en feu (manche 9) |

**Catalogue de casse — Proposé.** Chaque élément de casse est un lieu de la carte (bâtiment existant ou mobilier urbain ajouté) avec des états visibles : intact → attaqué (feu, fumée, vitres brisées) → ruine persistante → réparé par caisse à outils. Il réutilise la mécanique de l’école : santé qui ne baisse que sous le feu ou une dégradation effective (section 10.2), ruine qui persiste entre les manches, réparation par caisse à outils (section 10.6), apparitions comptées dans l’effectif de la manche. Un lieu en ruine n’est plus tiré au sort tant qu’il n’est pas réparé ; s’il était prévu, ses casseurs rejoignent la file de la manche.

| Élément | Lieu | Disponible dès | Santé | Points sauvé / perdu / réparé |
| --- | --- | ---: | ---: | --- |
| École en feu | École (nord-ouest) | Manche 1 | 100 PV | +8 / −3 / +5 |
| Boutique de jeux rétro (livré, v1.9.4) | Bâtiment 5, au sud-ouest du centre (porte au sud) ; pas de rideau | Manche 2 | 100 PV | +6 / −2 / +4 |
| Voiture en feu | Deux emplacements de voiture garée | Manche 2 (phase A) | 60 PV | +4 / −2 / +3 |
| Abribus saccagé | Abribus | Manche 2 (phase A) | 60 PV | +4 / −2 / +3 |
| Monument attaqué (livré, v1.9.4) | Statue équestre au drapeau français, à l’est du centre (section 11) | Manche 4 | — (pas de santé) | +4 défendu / −3 drapeau remplacé / +10 drapeau repris |
| École maternelle en feu | Bâtiment sud-ouest | Manche 5 | 100 PV | +8 / −3 / +5 |
| Kiosque saccagé | Kiosque à journaux | Manche 5 | 60 PV | +4 / −2 / +3 |
| Mairie attaquée | Bâtiment nord | Manche 7 | 100 PV | +8 / −3 / +5 |
| Bibliothèque en feu | Bâtiment sud | Manche 9 | 100 PV | +8 / −3 / +5 |

À partir de la manche 5, deux lieux sont attaqués en même temps (nouveautés de la manche d’abord, puis tirage pondéré favorisant les lieux absents de la manche précédente), dans la limite de deux urgences simultanées (une seule en manches 1 et 2). Seule l’école principale garde la séquence première ligne + renforts ; les autres lieux ont une seule ligne de casseurs. Chaque incident déclenche l’alerte pixel de la section 14.1. Le mobilier urbain ajouté (voitures, abribus, kiosque) est solide, laisse au moins une tuile libre autour de lui, reste à l’écart du groupe pacifique, des points d’apparition et des stations, et ne coupe aucun passage.

Déroulement interne : les casseurs entrent un par un, le premier d’un groupe 2 s après sa mise en file puis à 1,5 s d’intervalle (0,8 s pour le groupe d’apogée), avec au plus douze casseurs en attente d’entrée sur la carte à la fois ; les suivants attendent dans une file d’entrée. Les casseurs des objectifs passent en tête de file. L’effectif T de la manche vaut `max(casseurs des objectifs, [10, 14, 18, 22][N−1] ou min(40, 22 + 4·(N − 4)))` ; il compte tous les casseurs de la manche (objectifs, agresseurs, retournement), seules les patrouilles de maintien du flux en sont exclues.

**Numérotation et objectif des manches.** Les manches sont numérotées à partir de 1 dès le début de la partie ; le numéro n’affiche jamais 0. Chaque manche a un objectif « K/T » : T casseurs à neutraliser, K casseurs de cette manche déjà mis KO (borné entre 0 et T). Pendant l’intro de 4 s, aucun objectif n’est encore fixé (« Manche 1 »). **Modifié (v1.9.4, demande du porteur du projet : « ça ne peut pas être aléatoire ? ») :** la manche 1 est l’école puis le secours (apprentissage : premier Molotov, cinématique, renforts) ; **à partir de la manche 2, la casse phare est tirée au sort** (tirage déterministe par graine) parmi tous les lieux libres — debout, hors feu, sans attaque en cours : école, boutique, voitures, abribus — poids 2, poids 1 pour celui de la manche précédente (il peut revenir, rarement ; rien n’est imposé). Deuxième étape : le secours, ou dès la manche 4 le monument en alternance (section 11). Aucun lieu libre : la deuxième étape seule. Retournement : arme (un spécial débloqué dès la manche 3, section 8.9) en manche 2 et aux manches paires, seconde urgence aux manches impaires dès la manche 3. Attaque de la boutique : ses lanceurs de Molotov en tête, puis deux dégradeurs et un casseur au contact, plus min(6, 2 + pression ÷ 3) dégradeurs et casseurs au contact en alternance, comme l’école après la manche 1 ; variantes toujours mélangées.

**Flux régulier dans une manche, répit entre deux (RC-94).** À l’intérieur d’une manche, une fois l’intro terminée, il ne s’écoule jamais plus d’environ 3 s sans casseur actif sur la carte : si personne n’est actif pendant 1,5 s, le groupe suivant entre aussitôt, sinon une patrouille hors effectif. **Exception voulue :** les 6 s de répit entre deux manches sont un temps faible délibéré, sans aucune entrée, demandé par le porteur du projet ; elles remplacent l’ancienne règle « la manche suivante démarre pendant le bilan ».

Préparer au moins quatre compositions d’assaut et plusieurs points d’apparition. Aucun nouvel objectif ne doit se déclencher pendant une cinématique suspendue. Le panneau de bilan entre manches est un délai local d’affichage ; il n’impose pas un chronomètre de partie.

### 12.3 Directeur de pression

Le directeur suit la manche, ses groupes, les objectifs résolus, les KO, la file d’entrée et les agents actifs. La difficulté augmente avec la progression, pas uniquement avec le temps passé à attendre dans un coin.

Proposition de niveau de pression : `P = min(12, 1 + floor(manche / 2) + floor(KO / 30))`, où `manche` est le numéro de la manche en cours (v1.9). Elle remplace la formule de la révision 1.4 et reste un point de départ à tester. Elle rend le combat d’adversaires additionnels progressivement plus dangereux, même si le joueur retarde un objectif.

Les paramètres augmentent par paliers avec plafonds : nombre total de renforts par épisode, variantes de comportement, rapidité de décision, résistance de certains casseurs et dégâts. La vitesse d’animation ne doit jamais supprimer la lisibilité de la préparation d’attaque.

| Paramètre | Départ normal proposé | Plafond proposé |
| --- | --- | --- |
| Santé joueur | 100 | 100, sans hausse automatique par manche |
| Coups nécessaires par casseur | 2 à mains nues ; 1 avec une arme | 4 à mains nues pour les adversaires renforcés clairement signalés ; toujours 1 avec une arme |
| Préparations simultanées contre le héros | 2 contacts + 2 lancers | 4 contacts + 4 lancers, avec fenêtres lisibles |
| Dégâts par attaque ennemie | 5 | 12 |
| Intervalle individuel d’attaque | 1,8 s | Pas moins de 1,2 s ; préparation toujours visible |
| Casseurs de manche sur la carte | Entrée un par un toutes les 1,5 s | 12 à la fois ; plafond technique de 40 hostiles actifs, agresseurs compris |
| Étudiants en déplacement | Jusqu’à 5 | 5 |

Les augmentations de dégâts ou de résistance sont annoncées par l’apparence, le statut ou la jauge, sans bonus aléatoire incompréhensible. Les statistiques des rôles renforcés sont une variation de difficulté séparée. Les rôles de lanceur ou de dégradeur sont indépendants de la variante visuelle.

Un plafond d’agents est un plafond de calcul, pas une fin d’assaut : le directeur garde des renforts en file d’entrée et les fait entrer après libération d’une place. Les agents survivants d’un objectif perdu occupent ces places. Aucun adversaire actif ne doit être supprimé silencieusement pour résoudre le problème.

### 12.4 Anti-stagnation

Le joueur peut quitter un objectif, mais pas attendre indéfiniment dans un refuge invulnérable en gagnant des points ou des soins. Les ennemis actifs poursuivent le héros selon leur rôle. En cas d’inaction prolongée sans ennemi actif, le directeur peut annoncer une petite patrouille après un délai local de 20 à 30 secondes, sous le même plafond d’agents.

La patrouille n’entraîne ni gain de points gratuit ni soin automatique. Les KO augmentent la pression. Les bonus d’objectifs restent liés à des occurrences uniques, pas au fait d’entrer et sortir d’un cercle.

### 12.5 Santé et petits soins

Santé maximale : 100. Aucune régénération passive automatique en normal. Le joueur doit repérer et atteindre des soins. Chaque ressource est un état de gameplay persistant pour la session, pas un effet qui réapparaît à chaque visite.

Deux points de soin sont proposés dans le quartier : trousse près d’un poste de secours et armoire ou trousse dans une arrière-boutique. Ils sont signalés par un pictogramme médical accompagné d’un texte. Leur implantation laisse une voie de retrait sans garantir l’absence d’ennemis.

| Ressource proposée | Effet | Stock / obtention |
| --- | --- | --- |
| Point de soin | +25 PV appliqués au contact, sans dépasser 100 | Une charge par point et par manche, deux points au départ |
| Petit soin de terrain | +10 PV | Un soin après chaque tranche de 8 KO éligibles ; au plus deux au sol |
| Réapprovisionnement de manche | Restaure les charges des deux points de soin | Une fois à la fin de la manche, pas au simple retour au point |

Les quantités sont à équilibrer. Les deux points ne donnent pas un soin complet ; la santé n’est pas remise à 100 après un objectif ou une manche.

### 12.6 Soin au contact

**Confirmé :** marcher sur un point de soin chargé applique immédiatement +25 PV, plafonnés à 100, et consomme sa charge de la manche. Aucune touche, aucun maintien, aucune interruption possible. La charge et le gain de santé sont appliqués ensemble, une seule fois, par identifiant de charge.

À pleine santé, aucune charge n’est consommée et l’interface indique « Santé au maximum ». Station utilisée : « Épuisé » jusqu’à la manche suivante. Une station ne remet pas les ennemis à zéro et ne suspend pas le combat.

Une trousse chargée flotte et pulse doucement (petite animation) pour être repérée de loin ; une station épuisée reste immobile.

Le petit soin de terrain se ramasse en passant à portée courte. Il ne disparaît pas à pleine santé ; il reste jusqu’à consommation, nettoyage entre manches ou expiration de ressource documentée. Proposition simple : pas d’expiration temporelle, retrait à la transition de manche après annonce.

Quand deux petits soins sont déjà au sol, les tranches de KO suivantes ne créent pas de réserve invisible. Elles sont considérées comme traitées ; libérer ensuite une place ne fait pas apparaître une pile différée. Un objet porte un identifiant unique empêchant la double consommation.

### 12.7 Équilibrage des soins

Les soins récompensent le déplacement et la progression, sans garantir une survie illimitée sur place. Chaque nouveau stock est lié à la manche ou aux KO éligibles. Aucun réapprovisionnement continu uniquement parce qu’un temps s’est écoulé ou qu’un menu a été ouvert.

Le mode découverte peut augmenter les soins ou réduire les dégâts, avec record séparé. L’ajustement automatique de la qualité graphique ne modifie jamais la santé, les soins, la pression ou le nombre d’adversaires à vaincre.

### 12.8 Horloges et suspension

- **Simulation active** : mouvements, contacts, IA, soins, capture et délais de renforts.
- **Présentation suspendue** : menus, aide, cinématiques et préparation obligatoire de ressources ; aucune santé perdue.
- **Durée de survie** : mesure monotone facultative du temps actif, affichée au bilan si retenue.

Une baisse de fréquence de rendu ne doit pas modifier les trajectoires et contacts de projectiles, ni faire progresser une capture ou une réparation différemment à durée active égale. Le passage en arrière-plan suspend la simulation et relâche les commandes ; la reprise est explicite.

### 12.9 Fins de session

| Cause | Résultat |
| --- | --- |
| Santé du héros à zéro | Défaite arcade et bilan définitif |
| Objectif perdu | Pénalité ou bonus manqué ; session poursuivie |
| Manche terminée | Panneau « Manche N terminée » non bloquant, stations rechargées, nouvelle manche déjà lancée ; santé, score et arme conservés |
| Pause | Session suspendue, aucun résultat validé |
| Arrêt volontaire | Bilan marqué « Session interrompue volontairement » |
| Problème technique irrécupérable | Sortie technique signalée, pas de fausse défaite enregistrée |

Un KO ne doit pas être annulé par un soin traité plus tard dans le même pas. Ordonner les contacts, les dégâts, la vérification du KO, puis les interactions encore valides. Un événement terminal empêche les nouveaux gains après ce point.


### 12.10 Événements dynamiques de secours

Le terme de conception est **événement dynamique** ou **rencontre aléatoire**. Il s’agit d’un incident court qui apparaît pendant l’exploration et invite à changer temporairement de priorité.

Trois variantes proposées :

| Rencontre | Mise en scène | Intervention |
| --- | --- | --- |
| Groupe pacifique harcelé | Deux à quatre casseurs menacent une personne du groupe | Neutraliser les agresseurs ; la victime remercie (« MERCI ! ») |
| Manifestante agressée | Victime en détresse, animation d’intimidation ou de recul | Intervenir avant l’expiration puis prise en charge |
| Personne ou couple âgé victime de vol | Un ou deux civils menacés, objets personnels au sol, casseurs à proximité | Neutraliser les agresseurs ; la victime remercie, sans action supplémentaire |

**Ajouté (v1.9.5, demande du porteur du projet) :** dans chaque secours, la victime se fait peu à peu voler ses affaires pendant l’agression, et Paul peut les lui rapporter (section 12.12, « Objets volés à rendre »). Uniquement des objets personnels ordinaires (sac, chapeau, canne, lunettes, écharpe, casquette, sac à dos) : jamais de vêtement porté, de déshabillage, de nudité ni rien de dégradant, ni dans les sprites, ni dans les textes, ni dans les bulles.

Ces rencontres sont fictives. Les anecdotes citées par l’utilisateur servent d’inspiration narrative ; le cahier ne les présente pas comme des faits historiques vérifiés. Le gameplay ne nécessite ni reproduction d’une blessure au visage, ni nudité, ni recette ou simulation détaillée d’un dispositif incendiaire. La violence est rendue par détresse, recul, appel à l’aide et menace lisible.

### 12.11 Déclenchement et équité

Le directeur choisit un emplacement atteignable, hors obstacle et hors groupe encombrant un passage obligatoire. L’événement n’apparaît pas sous les pieds de Paul. Alerte visuelle, direction, distance et délai sont disponibles dès le début, y compris hors écran : bannière d’alerte à l’apparition (« AGRESSION EN COURS ! » ou « VOL EN COURS ! ») puis indicateur en bord d’écran (section 14.1). Dès que Paul arrive, la victime affiche une bulle « À L’AIDE ! ».

Délais proposés : de vingt à trente secondes de menace effective pour un secours. Le délai minimal doit couvrir le trajet praticable, une confrontation raisonnable et une marge de réaction. Calculer ce trajet sur la navigation, pas à travers les bâtiments.

Plafond proposé : un incident urgent à la fois pendant l’apprentissage, puis au plus deux au total en normal, bâtiments et secours confondus. Ne pas déclencher deux incidents impossibles à atteindre successivement. Les objectifs ordinaires sans échéance peuvent rester actifs en parallèle.

Le directeur varie les types, lieux et groupes ; il évite de répéter immédiatement le même scénario. Les agresseurs utilisent le même plafond de quarante hostiles que les hordes. Les victimes sont prises dans un groupe existant si possible ; le nombre de personnages supplémentaires reste borné.

Une fenêtre de repos entre rencontres et une sélection pondérée suffisent en V1. L’apparition aléatoire est contrôlée : aucun besoin d’une génération procédurale complète ou d’un scénario tiré sans tenir compte de la position du joueur.

### 12.12 Détresse, secours et échec local

La protection contre Paul est permanente : ses coups et ses pierres ne blessent jamais ces victimes. En revanche, les agresseurs désignés peuvent faire avancer une **jauge de détresse / un compte à rebours de secours**, uniquement dans l’événement concerné. Les autres passants ne deviennent pas subitement vulnérables à toute la foule.

La menace à portée est un état continu pendant l’intimidation ou le cycle d’agression, pas seulement l’image d’impact. La jauge et le délai affiché représentent une seule réserve autoritaire, sans seconde santé cachée pour la victime.

Le délai décroît tant qu’au moins un agresseur de cet événement exécute une menace valide à portée de la victime ; il se suspend si cette menace est interrompue. Ne pas retirer une seconde barre de vie indépendante au même rythme : une source de vérité par incident.

Tous les agresseurs affectés KO avant zéro (coup ou pierre renvoyée, peu importe) : menace arrêtée, délai figé, et le secours se termine **automatiquement** : aucune touche, aucun maintien, aucune distance à respecter. La victime affiche une bulle « MERCI ! » environ 1,5 seconde (paramètre `rescue.thanksSec`), puis le secours est validé et le bonus accordé une seule fois, proposé à +6 par événement, indépendamment du nombre de victimes. La pause suspend aussi ce court délai.

Bulles de la victime (pixel art, police pixel, au-dessus de la tête) : « À L’AIDE ! » en rouge avec un léger rebond saccadé tant qu’elle est menacée ; « MERCI ! » en vert une fois sauvée, jusqu’à ce qu’elle s’éloigne ; aucune bulle en cas d’échec. Jamais de marqueur d’ennemi sur la victime.

**Objets volés à rendre (v1.9.5, demande du porteur du projet).** La victime porte trois objets personnels ordinaires : « sac à main », « chapeau », « canne » (personne âgée volée) ou « sac à dos », « écharpe », « casquette » (groupe harcelé). Quand la réserve de détresse passe à 75 %, 50 % puis 25 % (`rescue.theftAt`), l’agresseur actif le plus proche de la victime lui prend l’objet suivant et l’emporte (petite icône pixel au-dessus de sa tête) ; aucun vol sans agresseur debout à ce moment, donc des agresseurs neutralisés avant un seuil = objet jamais volé. Un voleur KO lâche l’objet au point libre le plus proche (jamais dans un obstacle) : l’objet flotte au sol avec un léger halo. Paul le ramasse en passant dessus (20 px, `rescue.pickupRadius`, jusqu’à trois, sans conflit avec l’arme ni la caisse à outils ; ligne « OBJETS N » de la liste de score) puis, à 48 px de la victime au plus (`rescue.returnRadius`), lui rend d’un coup tout ce qu’il porte : +2 par objet (`rescue.itemBonus`, une seule fois par objet et par secours) et bulle « MERCI ! ». Aucune touche.

Sécurisé alors qu’un objet volé n’est pas revenu (au sol ou porté par Paul) : la victime attend ses affaires jusqu’à 12 s (`rescue.returnSec` ; carte « Rends les objets · 8 s », indicateur en bord d’écran vers la victime tant qu’un objet est au sol ou porté), puis les 1,5 s de « MERCI ! » et le bonus de +6 une fois, comme avant ; tout rendu = les 1,5 s commencent aussitôt. Les objets non rendus à l’issue de l’attente sont simplement perdus, sans pénalité ; les objets au sol disparaissent quand le secours se termine. Secours manqué : les objets emportés, au sol ou portés sont perdus, rien d’autre ne change. Cette attente est une fin d’objectif minutée : elle n’ajoute aucun casseur et la manche se clôt toujours à K = T. La carte du secours affiche « Objets 1/3 rendus » (rendus / objets de la victime) dès le premier vol. Les agresseurs d’un secours ne quittent plus la victime d’eux-mêmes quand peu de casseurs restent (section 10, « Attirés par Paul ») : seul Paul qui s’approche les détourne. Bulles : « MON SAC ! » (« MON CHAPEAU ! », « MA CANNE ! », « MON SAC À DOS ! », « MON ÉCHARPE ! », « MA CASQUETTE ! ») environ 2 s après un vol, et pendant l’attente pour le premier objet manquant ; « MERCI ! » à chaque remise. Son de ramassage à la prise, carillon à la remise. Pas de nouvelle bannière.

À zéro avant sécurisation : secours manqué, bonus perdu, session continuée. La victime passe dans un état de repli ou de prise en charge par les secours ; pas de mort graphique ni de nudité. Les agresseurs restants redeviennent des hostiles ordinaires. L’échec n’incrémente pas le compteur de casseurs neutralisés et ne remet pas la santé de Paul à zéro.

Un secours ne réapparaît pas par entrée/sortie de zone. Une personne déjà secourue n’est pas choisie de nouveau immédiatement. Les KO des agresseurs sont comptés une seule fois, avec le barème ordinaire ; le bonus d’événement est distinct.

### 12.13 Délais locaux et mode arcade

Les délais de bâtiment, détresse, capture et interaction n’imposent aucune durée totale de partie. Leur expiration affecte seulement l’incident concerné. Pause, aide, cinématique et perte de focus suspendent tous les délais et toutes les actions hostiles.

La réduction de qualité graphique ne modifie pas ces délais. Un mode découverte peut les allonger explicitement avec record séparé. Le HUD réserve les nombres d’urgence aux incidents actifs, sans remettre une case globale « Temps restant ».

## 13. Score, compteur de casseurs neutralisés et bilan

### 13.1 Barème de référence

| Événement | Points | Statut |
| --- | ---: | --- |
| KO de casseur, quelle que soit sa variante ou son drapeau | +1 | Confirmé (révision 1.5) |
| Coup valide sur policier | −3 | Demande initiale |
| Coup valide sur autre personne protégée hors groupe pacifique | −2 | Héritage conservé si ces PNJ sont touchables |
| Tentative de coup ou renvoi vers groupe pacifique | 0 ; aucun contact de dégâts accepté | Protection confirmée dans la révision 1.2 |
| École restaurée | +8 par occurrence réussie | Brief initial |
| École perdue | −3 une fois par occurrence, sans fin de session | Brief initial adapté au mode arcade |
| Réparation tardive par caisse à outils | +5 (bâtiment) / +3 (mobilier urbain), sans cumul avec le +8 de sauvetage de la même occurrence | Proposition |
| Secours réussi | +6 par événement, une seule fois | Proposition |
| Secours manqué | Aucun bonus ; pas de défaite globale | Proposition |
| Monument défendu (tous les occupants KO avant le remplacement) | +4 par occurrence | Livré (v1.9.4) |
| Drapeau du monument remplacé | −3 une fois par occurrence | Livré (v1.9.4) |
| Drapeau du monument repris (capture) | +10 par remplacement | Livré (v1.9.4) |
| Boutique dégagée puis rouverte | +4 puis +5 par occurrence | Brief initial |
| Manche entièrement réussie sans personne protégée frappée | +5 une fois à sa clôture | Proposition arcade |
| Soin ou formation projetée | 0 | Proposition pour éviter l’attente rentable |
| Coup non terminal sur casseur | 0 | Gain au KO seulement |

Aucun bonus ne dépend d’un temps restant. Il n’existe pas de score maximal fini pour toute la session arcade. La référence précédente de 51 points et le compteur limité à 17 casseurs sont supprimés.

L’effectif de chaque manche suit la progression proposée en section 12.2 (10, 14, 18, 22, puis +4 par manche), hors patrouilles additionnelles. Le bonus de manche exige de réussir ses objectifs ; il ne se déclenche pas au seul passage de numéro après un objectif perdu. L’enchaînement sans fin des manches empêche de déduire une limite de score ou de KO.

### 13.2 Compteur « Casseurs neutralisés »

`Casseurs neutralisés = nombre d’identifiants uniques de casseurs passés de actif à KO depuis le lancement de la session.`

Chaque variante ajoute 1, comme au score. Un corps déjà KO, un groupe pacifique, une victime, un soin, une caisse à outils, une réparation, un secours, une capture, un ramassage ou une formation ne l’incrémente jamais. Mains nues, arme et renvoi partagent le même événement de KO, donc jamais deux unités pour un même casseur. Le compteur ne se réinitialise pas à chaque manche.

**Confirmé (révision 1.5) :** le compteur est neutre ; il ne mentionne ni nationalité, ni situation administrative, ni sanction.

### 13.3 Bilan

Score, record compatible, cause de fin, manche atteinte, casseurs neutralisés, armes ramassées et brisées, bâtiments sauvés/détruits/réparés, secours réussis/manqués, objectifs réussis/perdus, KO, erreurs de ciblage, formations, soins et caisses à outils utilisés. Durée de survie écoulée facultative, sans compte à rebours en mission.

Le bilan affiche une ligne neutre :

> X casseurs neutralisés

X est égal au compteur de la section 13.2. Les anciennes lignes satiriques du bilan sont supprimées (révision 1.5).

Un arrêt volontaire produit un bilan partiel identifié. Une proposition de record définitif de survie n’est validée qu’au KO ; un meilleur score provisoire d’une session arrêtée peut être conservé séparément, sans se confondre avec une session terminée par défaite.

### 13.4 Records

Records par version de règles et difficulté ; score comme classement principal, puis manche atteinte et éventuellement durée active en départage. Une durée plus longue n’apporte aucun point direct et ne doit pas encourager l’attente immobile. Les statistiques de projectiles récupérés, renvoyés et ayant touché peuvent figurer au bilan, sans gain de points par simple ramassage.

Le mode découverte et les réglages modifiant les soins ou la pression utilisent une catégorie distincte. Le record est local et modifiable dans le stockage du navigateur ; aucun classement mondial sécurisé n’est promis.

Dédupliquer le score par identifiants d’événements et d’occurrences d’objectif. Un recyclage de modèle ou de pool d’agent attribue un nouvel identifiant de vie, sans réutiliser à tort l’identité du casseur précédent.

## 14. Interface et accessibilité

### 14.1 Interface

**Modifié (v1.9.7, demande du porteur du projet) : menus centrés.** Le menu pause (Reprendre, Son, Aide, Crédits, Retour au site, Arrêter la partie) est une colonne étroite centrée à l’écran, horizontalement et verticalement, titre compris ; la confirmation « Retour au site », l’écran de départ, l’aide, la modale Commandes et le résumé sont eux aussi centrés. Un panneau plus haut que l’écran (aide, règles sur téléphone) commence en haut et défile, sans jamais être coupé ; les marges de sécurité des écrans à encoche sont respectées.

**Modifié (v1.9.6, demande du porteur du projet).** **Santé de Paul au-dessus de sa tête :** une barre pixel dessinée dans le monde (environ 28 × 5 px, contour sombre `#14121c`, coordonnées entières, nette au zoom entier de la caméra ; agrandie ×2 au zoom 1 comme les bulles des victimes), verte au-dessus de 50 %, jaune au-dessus de 25 %, rouge en dessous, petit cœur pixel discret à gauche. Elle suit le sprite de Paul, passe au-dessus de lui et de ses objets (l’aura du mode furie reste derrière), clignote en blanc avec une secousse de 1 px quand il perd de la santé (sans secousse avec `prefers-reduced-motion`) et disparaît quand il est KO. Le HUD n’a plus de ligne de santé visible ; un élément masqué visuellement (`role="progressbar"`, « Santé 85 sur 100 ») garde la valeur pour les lecteurs d’écran.

**Liste de score en haut à gauche**, en police pixel (Press Start 2P), dans le même panneau pixel que les bannières et les cartes (fond sombre, bordure dorée en escalier, ombre portée dure de 4 px, sans flou) : une ligne par statistique, libellé petit et atténué, valeur grande et claire, dans cet ordre : « SCORE » (valeur d’environ 20 px, dorée ; elle « saute » d’une image, par paliers, quand le score augmente), « NEUTRALISÉS » (compteur « Casseurs neutralisés », texte complet pour les lecteurs d’écran), « MANCHE N · K/T » (casseurs neutralisés sur l’effectif de la manche, simplement « MANCHE 1 » tant qu’aucun objectif n’est fixé ; texte complet « Manche N : K/T casseurs » pour les lecteurs d’écran ; la ligne clignote une fois, par paliers, quand le numéro change), puis en plus petit « PIERRES » (trois emplacements), « ARME » (« <nom> (<coups>) », « Bouclier (N s) », « Onde d’énergie (N) » ou « Mains nues », suivi de « · Mode furie N s » pendant le mode furie) et « OBJETS N » seulement quand Paul porte des objets volés à rendre. Toutes ces animations sont coupées avec `prefers-reduced-motion`. Sur téléphone (375 × 812) la liste reste compacte (score d’environ 16 px, lignes de 8 à 10 px) et ne recouvre ni le bouton Pause, ni le bouton Commandes, ni les commandes tactiles. L’ancien compteur de caisse à outils (« Caisse 0/1 ») est retiré : la caisse portée se voit au-dessus de Paul et les messages « Caisse à outils requise… » restent. Les cartes d’incident s’affichent sous la liste, sans la recouvrir ; bannières, panneau de manche et indicateurs de bord d’écran restent à l’écart de la liste (bordure et ombre comprises). Chaque lieu attaqué a sa carte d’incident avec une mini-barre de santé (« École 64 % », « en feu » / « attaquée »). Objectifs et soins indiqués dans la carte et éventuellement sur une mini-carte. Santé des lieux attaqués, délai local des secours, jauges de capture et de réparation, sans compte à rebours global. Chaque carte d’incident porte le nom de son événement, sa distance et son état (« en feu / attaquée / renforts » pour un lieu, « en cours / interrompu / sécurisé / sauvé / perdu » pour un secours).

Les groupes pacifiques ont un signe lisible de neutralité et une alerte distincte si une victime est en détresse. Une icône neutre ne doit jamais être remplacée par un marqueur d’ennemi sur une victime. La cible de contact ou de renvoi assisté ne peut pas les désigner. Les projectiles doivent se distinguer du sol, des pierres ramassables, des armes au sol, des soins et des décors.

**Alertes d’incident.** **Modifié (v1.9.1) :** le feu n’est annoncé que lorsque la bouteille est lancée (« ÉCOLE EN FEU ! », « VOITURE EN FEU ! », « ABRIBUS SACCAGÉ ! » à l’embrasement, ligne « Manche N ») ; le début d’une attaque n’affiche pas de bannière, son lieu a déjà sa carte « attaquée » et un indicateur en bord d’écran en palette jaune, icône d’alerte, qui passe en palette feu, icône flamme, une fois le lieu en feu. À l’apparition de chaque incident, une bannière dans le style pixel du jeu (police pixel, bordures franches, ombre portée dure de 4 px, animations par paliers) s’affiche en haut au centre, sans recouvrir la liste de score ni le bouton Commandes, lisible jusqu’à 320 px de large : « ÉCOLE EN FEU ! » (palette orange/rouge, icône flamme, « Rejoins l’école »), « VOITURE EN FEU ! » (même palette, « Chasse les casseurs »), « ABRIBUS SACCAGÉ ! » (palette jaune, icône vitre brisée, « Arrête la casse »), « AGRESSION EN COURS ! » (« Une personne est menacée ») ou « VOL EN COURS ! » (« Une personne âgée est menacée ») en palette jaune avec icône d’alerte. Elle porte une flèche pixel orientée de Paul vers l’incident, mise à jour en continu, et la distance en mètres (une tuile = 1 m). Elle disparaît seule après environ six secondes ; une seconde alerte attend la fin de la première. Une bannière d’incident (affichée ou en attente) est retirée dès que son incident n’est plus actif (lieu sauvé ou détruit, secours résolu), pour ne jamais annoncer pendant le répit une urgence déjà terminée ; les bannières « MANCHE N ! » et celles des spéciaux du retournement (section 8.9) suivent la même file. Elle est annoncée aux lecteurs d’écran (`role="alert"`) et n’est pas interactive. Ensuite, chaque incident actif (lieu attaqué, victime menacée) dont la cible est hors écran a un indicateur en bord d’écran : icône, libellé court (« ÉCOLE », « VOITURE », « ABRIBUS », « AGRESSION », « VOL »), distance et flèche, sur fond sombre (contraste ≥ 4,5:1), à l’écart du panneau, du bouton Commandes et des commandes tactiles. Toutes ces animations sont coupées avec `prefers-reduced-motion`. Le système est générique (type, libellé, position) : les futurs événements de casse le réutilisent.

**Annonce des manches (v1.9).** Chaque manche est annoncée par la même bannière pixel (même file d’attente, même durée, `role="alert"`) : titre « MANCHE N ! », sous-titre « <casse phare> · T casseurs » (« École menacée », « Voiture menacée », « Abribus menacé », « Boutique menacée » (v1.9.4) ou « Agression en cours », v1.9.1), icône pixel de horde en palette rouge/orange, sans flèche ni distance (une manche n’a pas de position). Les bannières d’incident portent une seconde petite ligne « Manche N · T casseurs ». **Modifié (v1.9.7) :** seul un spécial du retournement est annoncé, avec flèche et distance (section 8.9) : « MODE FURIE DISPONIBLE ! » / « Fonce le ramasser » (palette jaune, indicateur « FURIE »), « BOUCLIER DISPONIBLE ! » / « Fonce le ramasser », « ONDE D’ÉNERGIE DISPONIBLE ! » / « Fonce la ramasser » ; une arme ordinaire n’a ni bannière ni indicateur. Le ramassage du mode furie affiche une bannière courte (environ 2 s) « MODE FURIE ! » sans flèche ni distance. La mise en page reste compacte et lisible entre 320 et 375 px de large.

**Panneau de manche (v1.9).** Pendant le répit, le panneau « Manche N terminée » (section 12.2) s’affiche en haut au centre, dans le même style pixel, sous la bannière s’il y en a une et sous la liste de score quand l’écran est trop étroit ; il ne couvre jamais Paul (centre de l’écran) ni la liste de score, n’est pas interactif (`role="status"`) et disparaît à la reprise.

**Alertes des éléments de casse — Proposé** (même style, même file d’attente ; nouvelles icônes pixel : rideau forcé, vitre brisée, fanion neutre sans drapeau national) :

| Élément | Titre | Sous-titre | Libellé du bord d’écran | Palette et icône |
| --- | --- | --- | --- | --- |
| Boutique de jeux rétro (livré, v1.9.4) | « BOUTIQUE EN FEU ! » (au lancer de la bouteille, comme l’école) | « Défends la boutique » | BOUTIQUE | orange/rouge, flamme |
| Voiture en feu (livré, v1.9) | « VOITURE EN FEU ! » | « Chasse les casseurs » | VOITURE | orange/rouge, flamme |
| Abribus saccagé (livré, v1.9) | « ABRIBUS SACCAGÉ ! » | « Arrête la casse » | ABRIBUS | jaune, vitre brisée |
| Kiosque saccagé | « KIOSQUE SACCAGÉ ! » | « Protège le kiosque » | KIOSQUE | jaune, vitre brisée |
| Monument attaqué (livré, v1.9.4) | « MONUMENT ATTAQUÉ ! » puis « DRAPEAU REMPLACÉ ! » ; « DRAPEAU RÉCUPÉRÉ ! » (courte, sans flèche) | « Défends le drapeau » puis « Reprends le monument » | MONUMENT puis DRAPEAU | jaune, fanion neutre |
| École maternelle en feu | « MATERNELLE EN FEU ! » | « Rejoins l’école maternelle » | MATERNELLE | orange/rouge, flamme |
| Mairie attaquée | « MAIRIE ATTAQUÉE ! » | « Défends la mairie » | MAIRIE | orange/rouge, flamme |
| Bibliothèque en feu | « BIBLIOTHÈQUE EN FEU ! » | « Sauve la bibliothèque » | BIBLIO | orange/rouge, flamme |

Un lieu attaqué, un commerce en cours de pillage et le monument (attaqué, puis tant que son drapeau est à reprendre) ont chacun leur indicateur en bord d’écran tant qu’ils sont actifs.

Afficher les états : préparation ennemie, pierre en vol, pierre récupérable, stock plein, arme au sol, arme brisée, soin chargé ou épuisé, santé au maximum, cercle contesté, objectif résolu, fin de manche. Les annonces ne doivent pas masquer une zone d’impact ou une échappatoire. Au plus deux alertes urgentes sont détaillées ; une sélection affiche le trajet ou la direction vers l’incident choisi.

### 14.2 Accessibilité

Remappage ; grosses actions tactiles ; maintien ou bascule ; options de visée ; contraste ; taille de HUD ; sons doublés par des repères visuels ; focus clavier ; pause automatique. Aucun contrôle de caméra à apprendre en V1.

Les alertes de secours ont texte/icône en plus d’un son et de leur couleur. Les sprites peuvent être dessinés à basse résolution, mais le texte de règles et le HUD doivent rester lisibles à taille CSS adaptée. Une police bitmap trop petite n’est pas imposée. Les couleurs rouge/vert sont complétées par formes, icônes ou textes.

Paysage recommandé, portrait pris en charge avec aire de jeu et boutons adaptés. Ne pas simplement réduire tout l’écran paysage en une miniature. Les zones système du téléphone restent dégagées.

Les [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/basic/) et la [liste complète](https://gameaccessibilityguidelines.com/full-list/) servent de référence, sans déclaration de certification intégrale.

### 14.3 Modes

Normal : santé, soins, hordes et trajectoires de référence. Découverte : dégâts réduits, préparation des lancers plus longue et visée assistée renforcée, avec record distinct. Aucun mode n’impose une limite globale de temps.

La qualité visuelle ne change jamais la taille des hitboxes, la vitesse des pierres, la pression, le stock ou le score. Une qualité basse garde toutes les alertes utiles.

## 15. Direction artistique et ressources pixel art

### 15.1 Style

Pixel art dessiné, palette cohérente et sprites de même échelle. Vue du dessus orthogonale, sans isométrie. Paul conserve cheveux longs et tenue noire ; l’écharpe ou le bavoir blanc et un contour contrasté le distinguent du sol et de la foule.

Paris est évoqué par les pavés, panneaux, façades, devantures, école et monument. Les silhouettes et panneaux doivent rester compréhensibles à la taille de jeu. Les drapeaux sont lisibles sans agrandir tous les adversaires.

### 15.2 Gabarits retenus

| Élément | Gabarit |
| --- | --- |
| Tuile de sol | 32 × 32 pixels logiques (tuiles Kenney / LPC CC0) |
| Paul et personnages courants | Cellules de 64 × 64 des spritesheets Universal LPC, silhouette visible d’environ 32 × 48, ancrage aux pieds |
| Grandes animations de contact | Cellule plus large si nécessaire, hitbox séparée |
| Drapeau | Accessoire séparé, lisible et non retourné avec du texte inversé |
| Caillou / pavé / brique | Environ 8 à 16 pixels, contour visible |
| Arme au sol | Sprite lisible avec halo, flottement et oscillation |
| Vue interne paysage | Base de 640 × 360 pixels logiques |
| Vue interne portrait | Base de 360 × 640 pixels logiques, sans étirement |

Mise à l’échelle retenue : mode RESIZE de Phaser (le canevas occupe la fenêtre) et zoom de caméra entier, calculé à partir de la base paysage ou portrait, minimum 1. Les pixels restent nets ; des marges ou un champ visible plus large sont acceptés plutôt qu’une déformation.

### 15.3 Ressources

Un jeu de sprites de Paul ; armes au sol et tenues (bâton, marteau, panneau de signalisation) ; victimes individuelles et couple âgé ; caisse à outils au sol et portée ; objets personnels de secours ; trois variantes de casseurs avec rôles contact/lanceur ; manifestants en groupe avec pancartes ; étudiants et secours ; tuiles de sol et bâtiment ; école à plusieurs états ; monument et drapeaux ; boutique ; stations de soin ; pierres en vol et au sol ; icônes.

Les groupes pacifiques doivent se lire comme un ensemble calme. Éviter de donner aux sprites neutres les mêmes animations de charge ou de lancer que les hostiles.

Sources retenues pour la première tranche : personnages Universal LPC, tuiles Kenney et LPC sous CC0, sons Kenney sous CC0. Chaque auteur et licence est listé dans `public/CREDITS.md`, accessible depuis la landing et le menu Pause.

### 15.4 Animations

Au minimum : repos, déplacement, frappe circulaire, rotation de l’arme tenue à chaque coup, flottement et halo des armes au sol, flottement et pulsation des trousses chargées, réaction, KO, ramassage bref ou indication de ramassage, renvoi, soin, lancer ennemi, dégradation, port de drapeau, manifestation calme, appel à l’aide, recul de victime, aide/rassurance, réparation, marche des étudiants, feu, ruine, réparation et changement de drapeau. Aucune animation de nudité ou de brûlure graphique n’est nécessaire.

Quatre directions dessinées au minimum ; huit directions de déplacement logique. Le choix de huit directions dessinées est une amélioration, pas un prérequis au premier prototype. Les effets de contact ne remplacent pas une animation lisible du héros.

### 15.5 Préparation

Sources éditables de sprites et carte ; exports PNG avec transparence ; atlas de textures et données d’animation ; carte en JSON de tuiles et objets ; validation des ancrages, collisions et cadres. Pas de pipeline de modèles GLB ou de squelette 3D dans cette version.

Registre des auteurs, licences, attributions, sources et modifications (`public/CREDITS.md`). Les ressources du prototype ne doivent pas être de simples carrés colorés présentés comme une direction pixel art finale. Une création ou adaptation artistique reste nécessaire.

## 16. Son

Le premier clic, toucher ou geste clavier pertinent autorise l’initialisation audio. Le son reste désactivable depuis l’accueil et la pause. L’échec de l’audio ne bloque pas le jeu.

Prévoir des groupes de volume séparés : ambiance, effets, musique éventuelle, voix. La musique est facultative ; la lisibilité du combat prime. Les sons proches sont spatialisés avec mesure et le nombre de voix simultanées plafonné.

Les sons de la première tranche proviennent de Kenney (CC0). Les pas suivent le rythme de déplacement ; les impacts correspondent au contact ; les alarmes ou crépitements indiquent la présence du feu. Les répétitions de coups utilisent plusieurs variantes pour éviter un effet mécanique.

Repères sonores de la tranche 2 (phase A) : alarme une fois par attaque, au moment où le lieu prend feu (v1.9.1), et une fois par secours, souffle bref à chaque lancer de Molotov (sur un lieu ou, v1.9.4, sur Paul), crépitement du feu qui suit le lieu le plus touché tant qu’un lieu est attaqué ou brûle, carillon bref (deux notes) quand un lieu est sauvé ou réparé et en fin de manche, son de ramassage pour la caisse à outils. Souffle et carillon sont synthétisés (WebAudio), sans nouveau fichier. **Ajouté (v1.9.3) :** mode furie (section 8.8) : montée synthétique au ramassage, bourdonnement grave tant que le mode dure (une voix du plafond de huit, soumis à la sourdine et suspendu en pause), descente à la fin ; sans nouveau fichier. **Ajouté (v1.9.7) :** bourdonnement montant pendant la charge de l’onde d’énergie (coupé au tir ou à l’annulation), décharge au tir, choc métallique quand le bouclier bloque (section 8.9) ; synthétisés, dans le plafond de voix.

Une cinématique ne doit pas déclencher une seconde copie des sons de la scène à sa reprise. Retour d’onglet et reprise de contexte audio sont gérés explicitement.

## 17. Choix techniques

### 17.1 Stack retenue

| Domaine | Choix | Motif |
| --- | --- | --- |
| Langage | TypeScript compilé en JavaScript | États, objets, collisions et tests typés |
| Build | Vite, version verrouillée | Développement local et build statique |
| Moteur 2D | Phaser 4.2.1, version verrouillée | Rendu des sprites, animations, caméra, entrées, son et scènes |
| Simulation | Module TypeScript pur et déterministe à pas fixe (60 Hz), sans dépendance à Phaser, séparé du rendu | Règles testables et reproductibles |
| Rendu | WebGL, pixelArt activé, mode d’échelle RESIZE, zoom de caméra entier, base 640 × 360 / 360 × 640 | Netteté sans étirement |
| Collisions | Cercles et rectangles 2D calculés par la simulation ; grille de tuiles de 32 pixels | Contacts, projectiles et top-down sans dépendre du moteur de rendu |
| Projectiles | Trajectoires 2D et arc visuel séparé | Contrôle et coût prévisible |
| Carte | Tuiles orthogonales et objets JSON | Sol, collisions, objectifs, groupes et apparitions |
| Animation | Spritesheets/atlas | Pas de squelette 3D requis |
| IA | États, directeur de hordes, grille et voisinage spatial | Beaucoup d’agents simples, logique testable |
| Interface | HUD de jeu et menus HTML/CSS accessibles | Séparer commandes de jeu et navigation de menus |
| Son | Système audio Phaser / Web Audio | Mixage et reprise après interruption |
| Tests | Vitest pour la simulation et les règles ; parcours navigateur | Projeter, ramasser, renvoyer, protéger les groupes, frapper, armes |
| Ressources | Universal LPC, Kenney / LPC CC0, sons Kenney CC0 | Crédits dans `public/CREDITS.md` |
| Livraison | Fichiers statiques sur HTTPS | Sans compte, API payante ou serveur applicatif |

### 17.2 Changement par rapport à Three.js

La direction visuelle a changé : la conservation du moteur 3D n’est plus un objectif. Phaser a été retenu pour utiliser un cadre 2D de jeu plutôt que reconstituer sprites, scènes et collisions autour d’un moteur 3D.

Les règles pures de score, capture, santé et objectifs peuvent être réutilisées après adaptation. Le rendu, la caméra, les entrées directionnelles et les ressources doivent être refaits. Aucun portage automatique des modèles et animations procédurales du prototype ne donnera un résultat pixel art final.

Three.js, Rapier 3D, KTX2, GLB et le choix WebGPU ne font plus partie de la cible. Ils ne doivent pas être chargés dans le build 2D de production.

### 17.3 Références et limites

Le [téléchargement officiel](https://phaser.io/download) et les [archives de versions](https://phaser.io/download/archive) indiquent les versions disponibles. La documentation [Arcade Physics](https://docs.phaser.io/phaser/concepts/physics/arcade) reste une référence ; la première tranche calcule toutefois ses collisions dans la simulation pure.

Le [Scale Manager](https://docs.phaser.io/phaser/concepts/scale-manager) et les [caméras](https://docs.phaser.io/phaser/concepts/cameras) servent à adapter l’affichage. Les options [pixel art](https://docs.phaser.io/api-documentation/typedef/types-core) permettent de préserver des pixels nets.

Le Canvas de Phaser 4 est annoncé comme déprécié dans la [présentation officielle du moteur de rendu](https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games). Le cahier ne promet donc pas un mode Canvas de secours équivalent avant essai. La base de recette est WebGL ; l’absence de prise en charge produit un message clair.

### 17.4 Première validation technique

Avant de figer la version : faire fonctionner Paul, quarante adversaires, trois groupes pacifiques, les collisions et des projectiles sur les téléphones cibles. Vérifier le poids réel du moteur et des atlas, pas seulement la facilité du démarrage sur ordinateur.

Pas de backend, IA générative à l’exécution, dépendance réseau à chaque manche, physique de débris complète ou effet WebGPU obligatoire.

## 18. Architecture logicielle et données

### 18.1 Systèmes

```text
src/
  site/         landing HTML/CSS, contenu, aperçu et lien vers le jeu
  app/          démarrage, menus, chargement et erreurs
  scenes/       accueil, quartier, HUD, pause et bilan
  sim/          simulation pure et déterministe, sans Phaser : entités, règles, manches, armes
  core/         états, horloges, identifiants, événements
  input/        clavier, souris, tactile, manette
  player/       Paul, déplacement, visée, frappe circulaire, santé
  weapons/      armes au sol, apparition, ramassage, usure et bris
  projectiles/  lancers, trajectoires, impacts, ramassage, stock, renvoi
  crowds/       groupes pacifiques et volumes protégés
  ai/           hordes, rôles, pression, navigation et voisinage
  objectives/   école, monument, boutique, résistance locale et occurrences
  incidents/    directeur, urgences de bâtiment et secours de victimes
  repairs/      caisses à outils, stock, réparation / extinction lancée par Agir, interruption et restauration
  healing/      stations au contact, petits soins et charges
  rules/        dégâts, KO, score, casseurs neutralisés et bilan
  rendering/    atlas, animations, profondeur, effets et qualité
  audio/        groupes de sons et interruptions
  storage/      préférences et records versionnés
  data/         carte, atlas, manches, compositions et paramètres
public/assets/  sprites, tuiles, atlas, sons et cartes exportés
public/CREDITS.md  auteurs et licences des ressources
assets-source/  sources artistiques et fichiers de carte
tests/          règles, intégration, navigateur et endurance
```

Cette arborescence est une cible ; la première tranche regroupe la simulation dans `src/sim/` et le rendu, les entrées et l’interface dans `src/game/`. La logique de mission ne doit pas dépendre d’un sprite visible ou du nom d’une image. Une séparation entre entités de jeu et objets de rendu facilite les tests et le recyclage.

### 18.2 États de projectile

`EnemyWindup → EnemyFlying → LandedRecoverable → InInventory → PlayerFlying → Inert/Removed`.

Chaque projectile possède identifiant, propriétaire, type visuel, état, position, vitesse, durée de vie et identifiant d’impact. Un événement de transition est accepté une seule fois. Un pool réinitialise entièrement les champs avant réutilisation et attribue une nouvelle identité de vie.

Seul `LandedRecoverable` peut entrer dans le stock. `PlayerFlying` ne redevient pas récupérable. Le stock n’est jamais supérieur à trois ou inférieur à zéro. Un objet retiré ne peut pas être consommé de nouveau.

### 18.3 Événements

`SessionStarted`, `RoundStarted`, `ObjectiveActivated`, `AttackStarted`, `HitConfirmed`, `EnemyThrowStarted`, `ProjectileLanded`, `ProjectilePickedUp`, `ProjectileReturned`, `ProtectedGroupBlockedImpact`, `ActorKnockedOut`, `SchoolStarted` (position), `BuildingThreatStarted`, `BuildingThreatPaused`, `BuildingDestroyed`, `RepairKitPickedUp`, `RepairStarted`, `RepairCancelled`, `BuildingRepaired`, `RescueStarted` (position et type, émis une fois ; il déclenche l’alerte), `RescueSecured`, `RescueCompleted`, `RescueFailed`, `ObjectiveLost`, `SchoolRestored`, `StudentEnteredSchool`, `MonumentCaptured`, `HealCompleted`, `WeaponSpawned`, `WeaponPickedUp`, `WeaponBroken`, `WaveStarted`, `RoundCompleted`, `PlayerKnockedOut`, `SessionEnded`.

Le système de règles est seul auteur du score et du compteur de casseurs neutralisés. Les KO, consommations de soins, ramassages et bonus d’objectif sont dédupliqués. Les groupes pacifiques et victimes ne peuvent jamais émettre un KO valide. Les santés de lieu, délais de secours, consommation de caisse à outils, réparation et bonus de secours sont dédupliqués par identifiant propre. Une ancienne perte encore réparable garde seulement son état minimal ; elle n’oblige pas à conserver tout le journal historique.

### 18.4 Configuration cible

```json
{
  "rulesVersion": "1.5.0",
  "sessionMode": "arcade",
  "view": "top-down-orthogonal",
  "artStyle": "pixel-art",
  "districtId": "paris-sciences",
  "playerCharacterId": "paul",
  "characterCustomization": false,
  "tileSize": 32,
  "flagAffectsScore": false,
  "playerStrikeArcDegrees": 360,
  "playerStrikeRange": 56,
  "maxStrikeTargets": 3,
  "sessionTimeLimitSeconds": null,
  "endOnPlayerKnockout": true,
  "endOnObjectiveLoss": false,
  "playerMaxHealth": 100,
  "captureSeconds": 12,
  "maxCarriedProjectiles": 3,
  "recoverFlyingProjectiles": false,
  "recoverReturnedProjectiles": false,
  "pacifistGroupsTargetable": false,
  "pacifistGroupsDamageableByPlayer": false,
  "rescueVictimsThreatenedByHostiles": true,
  "rescueUsesDistressMeter": true,
  "buildingThreatSeconds": 30,
  "rescueThreatSeconds": 25,
  "maxUrgentIncidents": 2,
  "buildingThreatRequiresActiveDegrader": true,
  "destroyedBuildingsPersistAcrossRounds": true,
  "maxCarriedRepairKits": 1,
  "maxGroundRepairKits": 2,
  "repairApplicationSeconds": 3,
  "repairSafetyRadius": 64,
  "repairBonus": 5,
  "rescueBonus": 6,
  "maxActiveHostiles": 40,
  "maxFlyingProjectiles": 24,
  "maxRecoverableProjectiles": 16,
  "maxActiveStudents": 5,
  "maxGroundHeals": 2,
  "stationHealAmount": 25,
  "stationHealOnContact": true,
  "firstWeaponSpawnSeconds": 10,
  "weaponSpawnIntervalSeconds": [15, 25],
  "weaponSpawnDistance": [160, 480],
  "maxGroundWeapons": 2,
  "roundEnemyCounts": [10, 14, 18, 22],
  "roundEnemyIncrement": 4,
  "maxRoundEnemies": 40,
  "maxRoundEnemiesOnMap": 12,
  "enemyEntryIntervalSeconds": 1.5,
  "waveRestSeconds": 6,
  "smallHealAmount": 10
}
```

Les valeurs sont proposées. Les caps de simulation sont communs aux profils graphiques ; un réglage de difficulté distinct peut changer les effectifs, pas une baisse automatique de qualité.

### 18.5 Collisions et temps

Simulation fixe cible 60 Hz, rendu séparé. Coordonnées logiques flottantes ; arrondi seulement au rendu. Utiliser des volumes de pieds pour les agents, des empreintes de bâtiments et des volumes de groupe séparés.

Les projectiles rapides utilisent une vérification du segment parcouru ou des sous-pas bornés pour éviter de traverser une petite hitbox entre deux images. Les groupes protégés et obstacles doivent être considérés avant une cible derrière eux.

Pause : santé des lieux, feu, détresse, capture, réparation, apparition d’armes, entrée des casseurs, IA, projectiles, particules utiles et dégâts suspendus. Perte de focus : commandes relâchées et reprise explicite. Ne pas rejouer toute une trajectoire en accéléré au retour d’onglet.

### 18.6 Ressources bornées

Pool de sprites, corps, pierres, armes, soins, caisses à outils, victimes et effets. Le directeur de secours utilise les mêmes plafonds d’agents hostiles ; ses agresseurs ne sont pas une population supplémentaire hors budget. Plafonds distincts pour projectiles en vol et pierres au sol. Après le plafond au sol, remplacer la plus ancienne pierre récupérable par une nouvelle chute ou retirer la nouvelle selon une règle unique documentée ; proposition : recycler la plus ancienne hors de proximité immédiate du joueur.

Les projectiles en attente de lancement ne créent pas une réserve infinie : le directeur retarde la préparation quand le budget de vol est atteint. Les corps et pierres sont nettoyés entre manches ou hors vue selon les règles annoncées. Aucun retrait d’un projectile en vol dangereux sans résolution explicite.

Conserver les totaux historiques, pas tous les événements, corps ou identifiants depuis le lancement. Rejouer et enchaîner des manches ne doivent pas augmenter indéfiniment textures, écouteurs, minuteries ou sons.

## 19. Performances et compatibilité

### 19.1 Statut

Budgets proposés à mesurer sur un vrai prototype 2D. Le pixel art n’est pas une garantie automatique de performance : transparences, projectiles, chemins et collisions peuvent rester coûteux.

### 19.2 Budgets de départ

| Indicateur | Cible proposée |
| --- | --- |
| Premier chargement jouable | Au plus 8 Mo transférés |
| Quartier complet | Au plus 20 Mo de ressources, audio compris |
| Mobile modeste de référence | Cible nominale 30 images/s, 95 % des images actives ≤ 40 ms |
| Ordinateur de référence | Cible nominale 60 images/s, 95 % des images actives ≤ 20 ms |
| Hostiles actifs | 40 au maximum ; 12 casseurs de manche sur la carte à la fois |
| Groupes pacifiques | 3 groupes de 6 à 8 sprites dans la carte de référence |
| Étudiants actifs | 5 au maximum |
| Projectiles en vol | 24 au maximum |
| Pierres récupérables au sol | 16 au maximum |
| Petits soins au sol | 2 au maximum |
| Armes au sol | 2 au maximum |
| Caisses à outils au sol / portées | 2 au sol et 1 portée au maximum |
| Incidents urgents simultanés | 1 pendant l’introduction, puis 2 au maximum |
| Corps visibles / persistants | Budget borné, proposé à 16 avant recyclage hors vue |
| Chargement puis contrôle | Cible ≤ 8 secondes sur le profil rapide de recette |

Profil rapide : cache froid, 20 Mbit/s descendants, 80 ms de latence, appareil documenté. Profil contraint : 5 Mbit/s et 150 ms, progression explicite et reprise possible, sans promesse de huit secondes.

Percentiles sur scénario reproductible de dix minutes, hors chargement/pause, cinq essais par configuration. Endurance sur appareil réel pendant trente minutes ; cent manches en simulation.

### 19.3 Rendu pixel art

Atlas raisonnables, proposés à 2 048 × 2 048 pixels maximum par page pour la base de recette. Partager les atlas entre variantes, éviter les changements de texture et de mode de fusion permanents. Le texte et les dessins de foule ne sont pas recréés en bitmap à chaque image.

La définition interne n’est pas multipliée sans limite par le ratio de pixels du téléphone. Un agrandissement net est privilégié ; pas de flou, d’anticrénelage ou de zoom continu obligatoire. Les effets lumineux et les ombres sont simples et désactivables sans masquer la lecture du combat.

### 19.4 Qualité

Économie, Standard, Élevée : varier particules, détails décoratifs, ombres et effets. Ne pas réduire silencieusement les hordes, les alertes de lancer, les groupes protégés ou les hitboxes. Les projectiles restent visibles en Économie.

Les positions et collisions sont calculées avec le même système quel que soit le rendu. Les formats portrait/paysage peuvent modifier le champ visible mais pas la simulation ou la vitesse.

### 19.5 Compatibilité

WebGL comme base de production, détection au démarrage, pas de WebGPU ou WebAssembly de physique obligatoire. Aucun écran vide si le contexte n’est pas disponible. Un mode Canvas équivalent n’est pas promis sans validation spécifique.

Recette : Safari iPhone ancien compatible et récent ; Chrome Android modeste et récent ; Chrome/Edge/Firefox sur portable Windows intégré ; Safari/Chrome sur Mac. Modèles et versions exacts consignés avant validation. Navigateur intégré à une autre application non déclaré compatible sans essai.

Vérifier chauffe, mémoire, multi-touch, interruptions, rotation, reprise audio et vingt transitions de manche au minimum. Les textures doivent se stabiliser après le chargement de la carte ; la durée de session ne doit pas faire croître le nombre d’objets.

## 20. Stockage, chargement et diffusion

### 20.1 Local

Préférences de commandes, audio, accessibilité, qualité et records par version de règles/difficulté. Aucun choix d’apparence du héros, aucun compte. Une ancienne préférence de sexe/teint du prototype est ignorée à la migration.

Un stockage indisponible n’empêche pas de jouer. Le record d’une session interrompue est distingué selon la règle arcade. Le chargement d’une ancienne donnée invalide revient à des valeurs sûres.

### 20.2 Ressources

La landing et le jeu ont des points d’entrée séparés. La landing ne télécharge ni moteur ni atlas ni sons du jeu ; le chargement de ces ressources commence à l’ouverture de la page du jeu. Les exigences détaillées de navigation et de poids sont en section 26.

Moteur, atlas de Paul et ennemis, armes, carte, collisions, pierres, soins et alertes indispensables chargés avant le contrôle. Autres sons et détails possibles ensuite. Les hordes suivantes ne redescendent pas le même atlas à chaque manche.

Les sprites réutilisent des textures partagées mais conservent leur état d’animation indépendant. Aucun chargement synchrone au premier coup ou à la première pierre renvoyée.

### 20.3 Livraison

Build statique HTTPS, fichiers versionnés et compression adaptée. Sprites et sons hébergés avec le jeu, sans dépendance à une URL de démonstration externe. La session continue hors connexion après le chargement complet du quartier ; rechargement hors connexion réservé à une évolution PWA.

Aucun backend, publicité, analyse d’audience ou API générative nécessaire. Les diagnostics de développement sont locaux. La spécification n’autorise ni achat ni nouvelle publication externe.

## 21. Validation et critères de recette

### 21.1 Preuves

Tests de règles ; intégration avec horloge contrôlée ; navigateur avec rendu ; téléphone réel ; essais de prise en main. Aucun test de l’ancien moteur 3D ne valide le rendu ou les entrées du futur jeu 2D.

### 21.2 Cas de recette

| ID | Scénario | Résultat attendu |
| --- | --- | --- |
| RC-01 | Lancer | Accueil sans compte, héros Paul unique, aucune personnalisation. |
| RC-02 | Observer le jeu | Vue du dessus orthogonale, pixels nets, aucune isométrie. |
| RC-03 | Déplacer dans huit directions | Traduction directe sur la carte, diagonales sans vitesse supérieure. |
| RC-04 | Explorer hors objectif | Déplacement libre et retour possible, aucune caméra imposant une arène. |
| RC-05 | Passer derrière un bâtiment | Paul reste visible ; collision sur l’empreinte uniquement. |
| RC-06 | Frappe circulaire | Casseurs touchés à 360° dans un rayon de 56 px à mains nues, les plus proches d’abord, trois au maximum, un dégât par cible et attaque ; Paul se tourne vers le plus proche. |
| RC-07 | Premier coup | Réaction, aucune reddition. |
| RC-08 | KO et corps frappé ensuite | Un gain de score et une unité au compteur « Casseurs neutralisés », aucun doublon. |
| RC-09 | Voir une horde | Trois variantes lisibles, rôles contact/lanceur possibles indépendamment ; KO d’un casseur à drapeau : +1 comme un casseur classique. |
| RC-10 | Préparation de lancer | Animation et trajectoire/zone annoncées avant dégâts. |
| RC-11 | Éviter une pierre | Pierre au sol récupérable, dégâts évités. |
| RC-12 | Recevoir une pierre | Dégâts une seule fois, santé cohérente, pas de rafale multi-contact. |
| RC-13 | Passer sur une pierre en vol | Aucun ramassage. |
| RC-14 | Passer sur une pierre au sol | Stock +1 et objet retiré une seule fois si place disponible. |
| RC-15 | Stock déjà à trois | Pas de dépassement ; pierre au sol conservée. |
| RC-16 | Renvoyer | Stock −1, direction choisie au lancement, aucune arme à feu. |
| RC-17 | Renvoyer à stock vide | Aucun projectile ni stock négatif. |
| RC-18 | Toucher un casseur par renvoi | Dégâts puis éventuel KO avec le même barème que le contact. |
| RC-19 | Pierre renvoyée en fin de trajectoire | Inerte/retirée, pas de recyclage infini en stock. |
| RC-20 | Plusieurs tentatives simultanées de ramassage | Une seule acquisition par objet. |
| RC-21 | Groupe pacifique autour de Paul | Aucune sélection par la frappe circulaire, aucun dégât de contact. |
| RC-22 | Projectile de Paul vers un groupe pacifique | Arrêt sans blessure ni KO ; aucun point ni casseur neutralisé compté pour les manifestants. |
| RC-23 | Contourner un groupe | Plusieurs passages praticables, objectif et soin non bloqués définitivement. |
| RC-24 | Casseur derrière un groupe | Pas de frappe ou renvoi à travers le groupe ; contournement possible. |
| RC-25 | École attaquée avant arrivée du joueur | Alerte, Molotov et première ligne, feu et barre de santé lisibles ; la santé baisse déjà sous le feu ou une dégradation valide. |
| RC-26 | Entrer/sortir/rentrer | Une occurrence, pas de résurrection ni bonus répété. |
| RC-27 | Renforts de l’école | Renforts après première ligne (manche 1) ; santé de l’école retirée seulement par le feu ou une dégradation valide. |
| RC-28 | Défendre l’école avec succès | Réparation visible, bonus unique et étudiants. |
| RC-29 | Santé de l’école à zéro | Ruine persistante, pénalité unique, session continuée et réparation par caisse à outils possible. |
| RC-30 | Étudiant entrant | Une formation par entrée, aucune file ou population illimitée. |
| RC-31 | Capture avec contestation / sortie | Jauge suspendue, valeur conservée. |
| RC-32 | Capture réussie | **Modifié (v1.9.4) :** drapeau palestinien, Paul 8 s cumulées dans la zone sans hostile actif à l’intérieur (pause hors zone ou zone contestée, progression gardée) → drapeau français, +10 une fois par remplacement, session poursuivie. |
| RC-33 | Boutique rouverte | Gains uniques, pas de soin complet implicite. |
| RC-34 | Passer une manche | Effectif neutralisé et objectifs résolus : répit de 6 s sans entrée de casseur avec le panneau non bloquant « Manche N terminée », stations rechargées, puis annonce « MANCHE N+1 ! » ; score, santé, stock, caisse et arme conservés ; la règle des 3 s sans casseur actif ne s’applique qu’à l’intérieur d’une manche (RC-94). |
| RC-35 | Reprendre un objectif | Nouvelle occurrence explicite et nouveaux gains possibles, pas un doublon. |
| RC-36 | Marcher sur un point de soin chargé | +25 immédiat plafonné à 100, sans touche ni maintien ; charge consommée une seule fois. |
| RC-37 | Repasser sur une station utilisée | « Épuisé », aucun gain jusqu’à la manche suivante. |
| RC-38 | Marcher sur une station à pleine santé | Pas de charge consommée ; « Santé au maximum ». |
| RC-39 | Stations épuisées | Pas de réapprovisionnement par attente ou menu ; recharge selon manche. |
| RC-40 | Perte de focus / pause | Paul, ennemis, trajectoires, captures et soins suspendus ; commandes relâchées. |
| RC-41 | Santé de Paul à zéro | Défaite et bilan, pas de soin tardif annulant le KO. |
| RC-42 | Session prolongée | Aucune fin à l’ancienne limite ; aucune victoire finale après une manche. |
| RC-43 | Stockage indisponible | Jeu possible, pas de plantage. |
| RC-44 | Rotation / redimensionnement | Carte et HUD adaptés, pixels non étirés, actions accessibles. |
| RC-45 | Profil Économie | Projectiles et alertes lisibles ; règles inchangées. |
| RC-46 | Plafonds d’agents et projectiles | Pas de réserve invisible infinie ni suppressions dangereuses incohérentes. |
| RC-47 | Réutiliser un pool | Nouveaux identifiants, propriétaire/stock/hitbox correctement remis à zéro. |
| RC-48 | Session de trente minutes | Ressources stables, commandes et soins toujours fonctionnels. |
| RC-49 | Bilan | Compteurs de session cohérents ; ligne « X casseurs neutralisés » égale au nombre de KO. |
| RC-50 | Cent manches en simulation | Progression bornée, aucune croissance sans limite, fin au KO toujours possible. |
| RC-51 | Marcher vers bâtiment ou tronc | Collision solide ; aucune traversée malgré liberté d’exploration. |
| RC-52 | Casseurs en trajet vers un lieu | Santé du lieu intacte tant qu’aucun feu ni dégradation valide. |
| RC-53 | Dégradation valide puis interruption | La santé baisse puis cesse de baisser (hors feu) ; barre sur la carte et carte HUD cohérentes. |
| RC-54 | Quitter/rentrer dans la zone attaquée | Même santé du lieu et même identifiant d’incident. |
| RC-55 | Lieu détruit puis changement de manche | Lieu toujours en ruine jusqu’à sa réparation par caisse à outils. |
| RC-56 | Ramasser une caisse à outils | En passant dessus : un objet retiré, icône de caisse au-dessus de Paul (aucun compteur « Caisse » dans le HUD, v1.9.6) ; stock jamais supérieur à un. |
| RC-57 | Caisse déjà portée | Caisse au sol non consommée et aucun doublon. |
| RC-58 | Réparer en zone sûre | Un appui sur F près de la ruine sans casseur proche, puis 2 s sans maintien : caisse consommée une fois, lieu à 100 %, fonction rétablie. |
| RC-59 | Réparation interrompue (éloignement ou casseur à 64 px) | Progression remise à zéro, aucune caisse consommée ni réparation partielle gratuite. |
| RC-60 | Caisse portée près d’un lieu intact | Aucune réparation, consommation ou gain de points. |
| RC-61 | Réparer après une perte | Bonus tardif unique, pénalité conservée, pas de cumul avec bonus de sauvetage. |
| RC-62 | Déclencher un secours | Victime, agresseurs, délai, direction et accès valides ; pas plus de deux urgences ; alerte « AGRESSION EN COURS ! » ou « VOL EN COURS ! » émise une seule fois avec la position. |
| RC-63 | Paul frappe ou renvoie vers la victime | Aucun dégât ; aucune sélection comme ennemi, aucun KO ni casseur neutralisé compté. |
| RC-64 | Agresseur affecté menace la victime | Détresse de cet événement seulement ; protection des autres groupes inchangée. |
| RC-65 | Neutraliser tous les agresseurs avant zéro | Délai figé, bulle « MERCI ! », puis secours validé automatiquement après environ 1,5 s, sans aucune touche, avec un seul bonus (+6). |
| RC-66 | Délai de secours épuisé | Secours manqué, repli/prise en charge sans bulle, session continuée sans violence graphique. |
| RC-67 | Pause pendant une attaque, une détresse ou une réparation | Santé des lieux, feu, délais et réparation suspendus sans consommation de ressource. |
| RC-68 | Transition de manche avec incident ou ruine | Pas de disparition, guérison ou réparation gratuite ; état reporté ou résolu explicitement. |
| RC-69 | Ouvrir la racine du site | Visuel, titre, boutons Jouer et Commandes visibles ; ni règles ni tableau des touches affichés d’emblée ; aucune session démarrée. |
| RC-70 | Activer Jouer | Navigation dans le même onglet vers `/jouer/?go`, chargement lisible puis carte « Comment jouer » **bloquante** : la partie attend, rien ne bouge, jusqu’à une touche, un clic ou un toucher ; audio déverrouillé par ce geste. |
| RC-71 | Ouvrir directement `/jouer/` | Jeu accessible sans passage préalable par la landing, y compris après rechargement ; écran des règles avec Commencer. |
| RC-72 | Inspecter le réseau avant Jouer | Aucun moteur, atlas ou son du jeu téléchargé par la landing. |
| RC-73 | Naviguer au clavier et sur téléphone | Liens utilisables, focus visible, texte lisible, aucun débordement horizontal. |
| RC-74 | Consulter le visuel et les textes | Visuel original sans photographie réelle ; absence de promesse 3D, de durée globale ou de fonctionnalité absente. |
| RC-75 | Ouvrir le site puis le jeu avec son bloqué | Aucun son automatique ; activation par geste sur la page du jeu, mode muet toujours jouable. |
| RC-76 | Revenir au site depuis Pause ou Bilan | Navigation fonctionnelle ; abandon d’une session active explicitement confirmé dans le jeu. |
| RC-77 | Aperçu indisponible ou JavaScript désactivé sur la landing | Présentation et vrai lien vers le jeu restent accessibles ; aucun bloc vide bloquant. |
| RC-78 | Charger landing et jeu sur hébergement statique | Deux routes servies correctement, ressources versionnées, budgets mesurés séparément. |
| RC-86 | Landing : bouton Commandes | La modale s’ouvre sans JavaScript, liste toutes les commandes (clavier et tactile), se ferme par Fermer, Échap ou clic extérieur ; sans API popover, le tableau reste lisible sous le contenu. |
| RC-87 | Lancer le jeu via Jouer | Carte « Comment jouer » (objectif, touches principales, « Appuie sur une touche pour commencer » / « Touche l’écran pour commencer ») **bloquante** : la simulation est en pause, aucun minuteur ne la ferme ; une touche (hors Maj/Ctrl/Alt seuls), un clic ou un toucher la ferme, sans que ce geste agisse dans le jeu, et lance la partie (intro de 4 s, puis manche 1) ; touches tactiles affichées sur téléphone. |
| RC-88 | Bouton Commandes en jeu | Un clic met la partie en pause, ouvre la modale (touches et règles) avec le focus sur Fermer ; Fermer ou Échap reprend la partie sans perte d’état. |
| RC-89 | Visuel de la landing | Illustration originale, aucune photographie réelle ; texte lisible (contraste ≥ 4,5:1) sur ordinateur et téléphone, sans débordement horizontal. |
| RC-90 | Visuel pixel art de la landing | L’image de fond est générée par `npm run hero` à partir des tuiles et sprites du jeu (sortie déterministe, au plus 250 Ko) ; aucun drapeau, aucune photographie ni personne réelle ; la police pixel (OFL) est créditée et pèse au plus 100 Ko. |
| RC-91 | Apparition d’un incident (école, voiture, abribus, agression, vol) | Bannière dans le style pixel du jeu avec le bon titre, sous-titre, icône, flèche vers l’incident et distance ; disparition après environ 6 s, seconde alerte mise en file ; un indicateur en bord d’écran par incident actif hors écran, à l’écart du HUD et des commandes tactiles ; animations coupées avec `prefers-reduced-motion`. |
| RC-92 | Bulles de la victime | « À L’AIDE ! » (rouge, rebond par paliers) pendant la menace, « MERCI ! » (vert) une fois sauvée jusqu’à son départ, aucune bulle en cas d’échec ; rendu net sous zoom entier, jamais de marqueur d’ennemi. |
| RC-93 | Début d’une manche | Bannière pixel « MANCHE N ! » avec « <casse phare> · T casseurs », sans flèche ni distance, mise en file comme les autres alertes ; bannières d’incident avec la ligne « Manche N · T casseurs ». |
| RC-94 | Compteur et rythme des manches | Jamais 0 : manche 1 dès le départ ; HUD « Manche N : K/T casseurs » avec K borné à T et ne comptant que les KO de la manche ; à l’intérieur d’une manche, une fois l’intro terminée, aucune période de plus de 3 s sans casseur actif ; **exception :** le répit de 6 s entre deux manches, sans aucune entrée (v1.9). |
| RC-95 | Molotov | Élan visible de 1,5 s (0,25 s de plus par lanceur du même lieu déjà en élan) à 96 px au plus du lieu, ligne dégagée ; KO pendant l’élan = pas de bouteille ; plusieurs lanceurs par attaque selon la manche (1, 2, 3 puis 4 ; 2 au plus pour le mobilier urbain) ; une bouteille sur un lieu en feu ne relance ni bannière ni alarme et retire 8 PV d’un coup. |
| RC-96 | Santé d’un lieu | Barre au-dessus du lieu et carte HUD « <lieu> N % » ; feu 2 PV/s, dégradeurs 1,2 PV/s chacun (quatre au plus) ; un feu ne s’éteint jamais seul : après le dernier KO il continue à 0,7 PV/s, à travers les manches, jusqu’à son extinction par caisse à outils ou la ruine ; à zéro, ruine persistante, pénalité unique, session poursuivie. |
| RC-97 | Réparation et extinction par Agir | Caisse ramassée en passant dessus (une portée, deux au sol au plus, posées en début et en fin de manche) ; à 48 px d’une ruine ou d’un lieu en feu sans casseur à 64 px, « F — Réparer » / « F — Éteindre le feu » (bouton Agir au tactile) ; un appui puis 2 s sans maintien → ruine ou feu éteint, santé remise à 100 %, points de réparation ; sans appui rien ne se passe ; s’éloigner ou laisser approcher un casseur remet à zéro ; messages « Caisse à outils requise », « Abords non sécurisés », « Réparation… ». |
| RC-98 | Panneau de manche | Pendant le répit uniquement : « Manche N terminée », KO, objectifs réussi/perdu, points, « Bonus +5 » seulement s’il est gagné, « Soins rechargés », « Manche N+1 dans 4… » ; non modal, ne couvre ni Paul ni la liste de score, lisible à 375 × 812. |
| RC-99 | Ramasser un mode furie | Mode actif à l’instant pour 12 s, arme tenue et coups conservés ; HUD « Arme : … · Mode furie N s » ; bannière courte « MODE FURIE ! » ; un second ramassage remet 12 s ; pause = minuteur gelé ; KO de Paul = fin immédiate ; Rejouer = sans mode. |
| RC-100 | Frapper en mode furie | Vitesse ×1,35, portée ×1,5, jusqu’à 8 casseurs KO en un coup même à mains nues, aucune charge d’arme consommée, dégâts reçus ×0,5 ; chaque KO compte +1. |
| RC-101 | Envol des casseurs en mode furie | Les corps KO par un coup de Paul s’envolent en tourbillon loin de Paul (même graine = même envol), retombent sur la carte hors des murs ; aucun KO ni point en plus ; secousse absente avec `prefers-reduced-motion`. |
| RC-102 | Apparition du mode furie | Jamais avant la manche 4 ; **modifié (v1.9.7) :** dès la manche 4, l’arme du retournement est un spécial tiré au sort parmi ceux débloqués (dont le mode furie ; « MODE FURIE DISPONIBLE ! », 15 s) ; environ une apparition chronométrée sur six dès la manche 6 ; indicateur « FURIE » pour tout mode furie au sol ; l’arme du répit reste une arme. |
| RC-103 | Lanceur sur Paul (v1.9.4) | Élan de 1,2 s visible (bouteille levée, « ! », ligne de visée) puis bouteille vers l’endroit où Paul était au début de l’élan ; Paul qui bouge ne prend rien ; KO pendant l’élan = aucune bouteille ; flaque de 3,5 s, 4 PV toutes les 0,5 s dedans (moitié en mode furie), rien dehors, six flaques au plus ; aucun casseur ni lieu touché. |
| RC-104 | Présence des lanceurs sur Paul (v1.9.4) | Aucun en manches 1–2 ; dès la manche 3, au moins un dans un remplissage de quatre casseurs ou plus, trois au plus par manche ; le dernier lanceur de Molotov d’une attaque devient lanceur sur Paul après sa bouteille sur le lieu ; manches toujours closes à K = T. |
| RC-105 | Boutique de jeux rétro (v1.9.4) | Bâtiment de 100 PV devant lequel les casseurs se placent (trois points d’attaque et la porte, atteignables depuis l’apparition) ; Molotov = « BOUTIQUE EN FEU ! » / « Défends la boutique », indicateur « BOUTIQUE », carte « Boutique NN % » ; tous les casseurs KO sans feu = +6, ruine = −2 une fois, extinction ou réparation par caisse à outils = +4 et retour à 100 PV ; enseigne « JEUX RÉTRO », manette pixel, auvent rayé, vitrines éclairées ; chaque KO compte +1, variantes mélangées. |
| RC-106 | Place de la boutique dans les manches (v1.9.4) | **Modifié (v1.9.4) :** dès la manche 2, la boutique est tirée au sort avec les autres lieux intacts hors feu, moitié moins souvent juste après une manche où elle était la casse phare ; jamais en ruine ou en feu. |
| RC-107 | Statue équestre (v1.9.4) | Socle solide R(33,21,2,2) qui bloque déplacement et vue ; zone {1088, 704, 112} ; points d’occupation et bord de zone atteignables ; cavalier en bronze tenant un drapeau français qui ondule au début de la partie. |
| RC-108 | Occupation du monument (v1.9.4) | Dès la manche 4, en alternance avec le secours tant que le drapeau est français ; 6 casseurs la première fois puis min(8, 5 + ⌊manche ÷ 3⌋), variantes mélangées ; un casseur au socle remplace le drapeau en 4 s (trois : environ 1,3 s, pas plus vite au-delà) → « DRAPEAU REMPLACÉ ! », −3 une fois ; tous KO avant = +4 ; manche close à K = T. |
| RC-109 | Drapeau persistant et capture (v1.9.4) | Le drapeau palestinien reste d’une manche à l’autre et pendant les répits, sans nouvelle occupation ; capture possible à tout moment, répit compris ; deux cycles remplacement / capture rapportent chacun +10. |
| RC-110 | Casse phare aléatoire (v1.9.4) | Manche 1 = école ; dès la manche 2, tirage déterministe par graine parmi les lieux libres, chaque type de lieu pouvant ouvrir la manche 2 selon la graine ; aucun lieu en ruine ou en feu tiré. |
| RC-111 | Objets volés au secours (v1.9.5) | Trois objets ordinaires par victime ; un vol à 75, 50 et 25 % de la réserve, par l’agresseur actif le plus proche, seulement s’il en reste un debout ; aucun vol après la neutralisation ; voleur KO = objet au sol sur un point libre ; ramassage à 20 px, trois au plus ; remise à 48 px = +2 par objet une seule fois par secours ; bulles « MON SAC ! » puis « MERCI ! » ; jamais de vêtement porté, de nudité ni rien de dégradant. |
| RC-113 | Bouclier : blocage (v1.9.7) | Tenu 20 s de jeu actif (pause = figé) puis brisé ; pierre ou bouteille arrivant dans le cône de 120° devant Paul = bloquée (pierre récupérable au point d’impact, bouteille sans flaque, aucun dégât, « ShieldBlocked », étincelles et choc métallique) ; de dos ou à 70° de côté = dégâts normaux ; coups au contact et flaques au sol jamais bloqués. |
| RC-114 | Bouclier : coup (v1.9.7) | Frapper = coup de bouclier à 64 px, KO en un coup, corps repoussé de 24 px loin de Paul, aucune charge consommée ; avec le mode furie : 8 cibles, portée ×1,5, envol ; HUD « Bouclier (N s) ». |
| RC-115 | Onde d’énergie : charge (v1.9.7) | Frapper maintenu 1 s : Paul immobile, lueur dans les mains et barre de charge sous la santé ; relâché à 0,9 s, un coup reçu, l’arme perdue ou Paul KO = annulé sans usage ; la pause fige la charge ; le tir part seul à 1 s même si la touche reste enfoncée, une nouvelle charge demande un nouvel appui. |
| RC-116 | Onde d’énergie : rayon (v1.9.7, v1.9.8) | Rayon de 320 px dans l’orientation de Paul, 16 px de demi-largeur : tous les casseurs actifs sur la ligne KO (+1 chacun), satellisés le long du rayon (1 100–1 800 px, 6–10 tours, départs décalés de 0 à 120 ms, même graine = même envol, aucun corps laissé au sol, une seule étoile « ✦ » / « PING ! » par corps, au bord de l’écran où il sort ou là où il finit, 0,5 s sans rotation avec `prefers-reduced-motion`) ; arrêté par un bâtiment, un objet, un tronc, le socle ou le groupe pacifique, jamais de victime touchée ; un usage par tir même sans cible, brisée après le second ; HUD « Onde d’énergie (N) ». |
| RC-117 | Spéciaux : apparition et indicateur (v1.9.7) | Retournement : arme ordinaire avant la manche 3, puis tirage (graine) parmi bouclier (≥ 3), mode furie (≥ 4), onde d’énergie (≥ 5) ; rue : chaque spécial ≈ 1 sur 6 dès la manche 5 / 6 / 7 ; indicateurs « FURIE » / « BOUCLIER » / « RAYON » pour tout spécial au sol, bannière seulement au retournement ; aucune bannière ni indicateur pour bâton, marteau, panneau. |
| RC-112 | Attente des objets (v1.9.5) | Sécurisé avec un objet dehors : attente de 12 s au plus (carte « Rends les objets · N s », indicateur vers la victime), puis 1,5 s et +6 une fois ; tout rendu = 1,5 s aussitôt ; non rendus perdus sans pénalité ; échec du secours = objets perdus ; pause = tout figé ; manche close à K = T, déterministe par graine ; un secours de trois agresseurs seul sur la carte, Paul au loin, perd ses trois objets aux trois seuils puis échoue. |
| RC-79 | Apparition d’armes | Emplacement libre praticable à 160–480 px de Paul, hors groupe pacifique ; première après environ 10 s, puis toutes les 15 à 25 s ; jamais plus de deux au sol. |
| RC-80 | Ramasser une arme en tenant déjà une | Nouvelle arme tenue, ancienne remplacée ; HUD « Arme : <nom> (<coups>) ». |
| RC-81 | Frapper avec une arme | KO en un coup à la portée de l’arme ; charge consommée seulement si au moins un casseur est touché. |
| RC-82 | Arme à zéro coup | Arme brisée, HUD « Arme : mains nues », portée de 56 px rétablie. |
| RC-83 | Changer de manche avec une arme | Arme et coups restants conservés. |
| RC-84 | Objectif échoué en cours de manche | Pénalité ou bonus manqué, manche poursuivie ; seule la santé de Paul à zéro termine la session. |
| RC-85 | Entrée des casseurs d’une manche | Premier casseur d’un groupe 2 s après sa mise en file, puis un toutes les 1,5 s (0,8 s pour le groupe d’apogée), au plus 12 en attente d’entrée sur la carte ; la manche suivante ne commence qu’après le KO de tout l’effectif et le répit de 6 s. |

### 21.3 Recette visuelle

Évaluer la taille réelle à l’écran : Paul identifiable grâce à son accent clair, armes au sol repérables, groupes pacifiques distincts, drapeaux lisibles, pierres en vol/au sol différentes, soins et caisses à outils distincts, victime identifiable, barre de santé et alerte lisibles, frappe et renvoi compréhensibles. Vérifier profondeur des pieds et bâtiments, pixel art net, aucune caméra isométrique.

### 21.4 Joueurs et performance

Scénario de dix minutes sur appareils cibles, puis trente minutes de session continue. Premier panel de cinq à huit personnes : compréhension des groupes protégés, du stock de pierres, de l’esquive et du renvoi sans explication orale prolongée.

La première minute doit enseigner le mouvement et un lancer récupérable. Un premier secours introduit ensuite le choix d’urgence ; les deux événements simultanés ne sont ajoutés qu’après cet apprentissage. Vérifier que l’interface tactile ne demande pas simultanément de déplacer, tourner la caméra et viser : la caméra est automatique.

## 22. Production et livrables

| Lot | Livrable | Condition de passage |
| --- | --- | --- |
| L0 | Référence de pixel art, Paul, carte et règles | Vue orthogonale et gabarits validés à taille réelle |
| L1 | Scène 2D avec déplacement, frappe circulaire, armes ramassables et trois variantes | Contrôle précis au clavier et au tactile |
| L2 | Groupes protégés, lanceur, pierres, stock et renvoi | Aucun dommage de Paul aux groupes ; cycle de projectile cohérent |
| L3 | École et capture | Objectifs lisibles dans la vue du dessus |
| L4 | Soins, caisses à outils, santé des lieux et secours dynamiques | Urgences lisibles, ruines réparables, protection des victimes contre Paul |
| L4b | Boutique, manches à effectif fixe, nouvelles armes et hordes | Session arcade renouvelée jusqu’au KO |
| L5 | Habillage, sons, menus, accessibilité et records | Parcours complet sans outils de développement |
| L5b | Landing et accès au jeu | Présentation, règles, commandes, navigation directe et chargement séparé validés |
| L6 | Profilage et endurance | Quarante hostiles, groupes et projectiles sur appareils réels |
| L7 | Livraison | Sources, build, ressources, mesures et limites |

L1 et L2 précèdent la production de tous les décors. Le changement de moteur et de direction artistique nécessite une nouvelle scène de référence ; les résultats du prototype 3D ne suffisent pas.

Livrables : code et dépendances verrouillés, build statique, sources de sprites/cartes/sons, registre de ressources, paramètres de hordes et soins, tests et rapports d’appareils réels, vidéos de gameplay. Compétences : développement de jeu 2D web, pixel art et animation, conception de carte, équilibrage, son et QA mobile.

Le budget et le calendrier restent à chiffrer après la scène de référence 2D. Pas d’achat ou de calendrier ferme implicitement approuvé par ce document.

## 23. Extensions prévues

### 23.1 Boutique — contenu proposé pour la V1 arcade

Disperser un attroupement de casseurs devant une boutique : +4. Si un incident de destruction vise cette boutique, sa santé suit les mêmes règles que l’école (section 10.2). Puis rester 2 s à la porte pour relever le rideau, automatiquement (v1.9) : +5, une fois. Le commerçant reste protégé et sa frappe coûte −2. Le rideau ne peut être relevé tant que les casseurs requis sont actifs. Si le bâtiment est détruit, une caisse à outils est nécessaire pour la restauration, et le bonus tardif remplace les gains de sauvetage non acquis afin d’éviter un double paiement. Quitter la porte remet la progression du rideau à zéro.

**Modifié (v1.9.4) :** la boutique livrée est la boutique de jeux vidéo rétro de la section 12.2, un lieu de casse ordinaire (santé, feu, ruine, caisse à outils ; +6 / −2 / +4). Le rideau, le commerçant et le bonus de réouverture décrits ci-dessus ne sont pas livrés.

Cette mission devient le troisième type d’objectif proposé pour varier la session arcade. Elle est répétable lors de nouvelles occurrences annoncées, avec des identifiants propres. Elle ne remet pas la santé à 100. Un point de soin en arrière-boutique peut être rendu plus facile d’accès après réouverture, sans devenir un stock illimité.

### 23.2 Étudiants et professeurs : dialogues

Conversation à proximité, trois répliques, commandes Suivant / Terminer / Plus tard ; pause de simulation et bonus de +3 une seule fois par session à l’échange terminé. Quitter ne donne pas de bonus ; reprendre ne doit pas dupliquer le gain.

Contenus demandés initialement : établissement dégradé par les casseurs plutôt que par le cortège ; réplique attribuant 32 % du budget de l’Éducation nationale aux retraites ; pour les professeurs, argument sur les salaires, les conditions de travail et les embauches.

Le chiffre de 32 % est conservé ici comme formulation demandée pour un argument de personnage, non comme donnée vérifiée par ce cahier. Avant son intégration finale, préciser période, périmètre et formulation, ou retenir une réplique sans chiffre. Ces dialogues ne sont pas un préalable à la V1 Paris.

### 23.3 Autres villes et tension

Lille, Limoges, Bordeaux, Lyon, Grenoble, Marseille et Nice, en complément de Paris. Retour éventuel de la carte de France uniquement à ce stade, sans écran de personnalisation du héros. Chaque destination possède un lieu public et des étudiants ou des professeurs. Une tension entre 2 et 5 modifie la taille des vagues selon une configuration documentée.

Ne pas publier huit noms pour un quartier identique en les présentant comme huit environnements distincts. Une réutilisation de kit est possible, mais chaque destination doit apporter une implantation ou un habillage identifiable.

### 23.4 Armes supplémentaires

L’ancienne extension « accessoires de contact » est remplacée par les armes ramassables de la section 8.7 (Bâton, Marteau, Panneau de signalisation). Les armes débloquées par manche (Gant de boxe à ressort, Kamehame, Bouclier) y sont décrites au statut **Proposé**, pour la tranche 2. Les armes à feu suivent EX-07 (v1.9) : flashball cartoon pour Paul, tireurs ennemis à partir de la manche 6, prévus en phase B. Toute nouvelle arme définit animations, portée, nombre de coups et rareté avant ajout ; le score d’un KO reste identique quelle que soit l’arme.

### 23.5 Diffusion et confort

Installation PWA facultative, démarrage hors connexion après cache complet, manette étendue, autres langues, davantage de réglages et nouveaux quartiers. Un classement mondial ou un mode multijoueur constituerait un projet distinct avec backend et règles propres.

## 24. Écart avec le prototype actuel

**Le prototype Three.js est remplacé.** Le prototype 02 (Three.js, personnalisation, limite de 120 secondes) est abandonné et reste consultable dans l’historique ; ses tests ne valident pas le jeu 2D. Une première tranche jouable 2D est disponible sur la branche principale (`main`) : Phaser 4.2.1, Vite, TypeScript, Vitest, simulation pure séparée du rendu.

| Sujet | Première tranche livrée (`main`) | Reste à faire (tranche 2) |
| --- | --- | --- |
| Vue et rendu | 2D du dessus non isométrique, tuiles de 32 px, sprites Universal LPC, zoom de caméra entier en mode RESIZE | Habillage abouti, optimisation |
| Héros | Paul unique, déplacement en huit directions, frappe circulaire | — |
| Hordes | Trois variantes cosmétiques, rôles contact et lanceur, barème +1 égal | Casseurs renforcés, nouveaux types d’ennemis |
| Projectiles | Lancers annoncés, récupération au sol, stock de trois, renvoi | Blocage par bouclier |
| Armes | Bâton, Marteau, Panneau de signalisation ; apparition aléatoire, usure et bris | Gant de boxe à ressort, Kamehame, Bouclier |
| Objectifs | École, voiture, abribus et boutique de jeux rétro (v1.9.4) avec santé, Molotov, feu et ruines ; caisses à outils (réparation ou extinction par Agir) ; secours dynamique | Monument, maternelle, kiosque, mairie, bibliothèque |
| Soins | Stations au contact, petits soins de terrain | — |
| Structure | Manches à effectif fixe (10, 14, 18, 22, puis +4), répit de 6 s avec panneau « Manche N terminée », annonce, retournement et apogée (tranche 2, phase A) | Nouveautés par manche de la section 12.2 (ennemis, armes, casse) |
| Score et bilan | Score, compteur « Casseurs neutralisés », record local, bilan | Statistiques de manche |
| Accès | Landing sur `/`, jeu sur `/jouer/`, démarrage immédiat par `/jouer/?go` | — |
| Validation | Tests Vitest de simulation et build de vérification | Recette sur appareils réels et endurance |

Les éléments de la colonne « Reste à faire » demeurent des exigences de la cible de diffusion.

**Tranche 2 « Fun » — phases B à D à venir.** La phase A (rythme des manches, santé des lieux, Molotov, feu, ruines, caisses à outils, voiture et abribus) est décrite dans ce document. Les phases suivantes suivent la [conception de la tranche 2 « Fun »](superpowers/specs/2026-10-20-slice-2-fun-design.md) : **B** nouveaux ennemis (coureur, costaud, tireur AK-47 cartoon, mini-boss « Le Caïd ») et nouvelles armes (flashball, gant de boxe à ressort, bouclier, kamehame) ; **C** nouveaux lieux de casse (boutique au rideau automatique, monument, maternelle, kiosque, mairie, bibliothèque) et deux urgences simultanées ; **D** chutes de KO comiques (dont des chutes rares « WTF » et l’effet domino), gel d’impact, secousse et onomatopées pixel. Cette conception l’emporte sur les règles plus anciennes qu’elle contredit.

## 25. Décisions restantes et sources

### 25.1 Paramètres à valider par le prototype 2D

| Sujet | Proposition de travail |
| --- | --- |
| Direction | Pixel art orthogonal du dessus, pas d’isométrie |
| Héros | Paul (fictif), cheveux longs, tenue noire, accent clair, sprite unique |
| Gabarits | Tuile 32 × 32 ; cellules LPC 64 × 64, silhouette environ 32 × 48 |
| Déplacement | Huit directions, diagonales normalisées |
| Contact | Frappe circulaire de 56 px à mains nues, trois cibles maximum (confirmé) |
| Armes | Portées, coups et rythme d’apparition de la section 8.7 |
| Manches | Effectifs 10, 14, 18, 22 puis +4 ; 12 casseurs sur la carte au plus |
| Récupération | Pierres ennemies tombées, ramassage automatique |
| Stock | Trois pierres ; renvois non récupérables |
| Groupes pacifiques | Non ciblables par Paul ; détresse ennemie seulement dans un événement annoncé |
| Bâtiments urgents | Santé 100 PV (bâtiments) / 60 PV (mobilier) ; feu 2 PV/s, dégradeur 1,2 PV/s |
| Secours | Délai local de 20 à 30 secondes, deux urgences simultanées maximum |
| Caisses à outils | Une portée, deux au sol (posées en début et fin de manche), réparation ou extinction lancée par F / Agir, 2 s sans maintien et sans casseur à 64 px |
| Autres neutres | Anciennes pénalités conservées s’ils restent touchables ; option de protection généralisée à décider |
| Hordes | Quarante hostiles maximum pour la référence normale |
| Projectiles | Vingt-quatre en vol et seize récupérables au sol au maximum |
| Moteur | Phaser 4.2.1 retenu ; compatibilité à confirmer sur appareils réels |
| Durée | Arcade par manches sans limite, santé et soins conservés |
| Ressources et diffusion | Universal LPC, Kenney / LPC CC0 retenus ; aucune nouvelle publication autorisée par cette spécification |

Ces paramètres permettent de construire une version de travail sans attendre chaque détail artistique. La première tranche 2D existe (section 24) ; elle ne valide pas encore ces paramètres sur appareils réels.

### 25.2 Sources techniques

Consultation le 19 octobre 2026, mise à jour le 20 octobre 2026. Les budgets et règles sont des choix de projet, pas des garanties fournies par les sources.

- [Phaser — téléchargement officiel](https://phaser.io/download).
- [Phaser — archives et versions](https://phaser.io/download/archive).
- [Phaser — Arcade Physics](https://docs.phaser.io/phaser/concepts/physics/arcade).
- [Phaser — caméras](https://docs.phaser.io/phaser/concepts/cameras).
- [Phaser — Scale Manager](https://docs.phaser.io/phaser/concepts/scale-manager).
- [Phaser — options de rendu et pixel art](https://docs.phaser.io/api-documentation/typedef/types-core).
- [Phaser — état du moteur de rendu et Canvas](https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games).
- [Vite](https://vite.dev/guide/).
- [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/basic/).
- [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator).
- [Kenney — ressources CC0](https://kenney.nl/assets).

Le héros Paul est un personnage fictif ; aucune source ne le rattache à une personne réelle.

### 25.3 Définition de « terminé »

Landing accessible et jeu accessible directement ; chargement séparé ; Paul jouable dans une carte du dessus non isométrique ; pixel art de référence atteint ; mouvement libre ; hordes lisibles ; frappe circulaire, armes et projectiles cohérents ; récupération/stock/renvoi sans duplication ; groupes protégés contre Paul et secourables ; santé/soins ; santé des lieux et délais de secours équitables ; ruines persistantes et caisses à outils ; école/capture et manches à effectif fixe ; fin au KO ; performances et longue session validées sur appareils réels.

Une capture d’écran pixelisée, une conversion de perspective ou les anciens tests 3D ne suffisent pas.

### 25.4 Historique

- **1.0 — 19 octobre 2026 :** mission Paris 3D chronométrée et personnage personnalisable.
- **1.1 — 19 octobre 2026 :** protagoniste unique, arcade sans limite, soins, manches et échecs d’objectifs non terminaux.
- **1.2 — 19 octobre 2026 :** 2D pixel art du dessus non isométrique, héros nommé, exploration libre, hordes, groupes pacifiques protégés, pierres récupérables et renvoi ; nouvelle stack 2D proposée.
- **1.3 — 19 octobre 2026 :** collisions bâtiments/arbres précisées, délais locaux de destruction, kits pour ruines persistantes, événements de secours et distinction entre protection contre le héros et détresse ennemie.
- **1.4 — 19 octobre 2026 :** landing page, contenu de présentation, routes distinctes, chargement différé du jeu et recette du parcours site → jeu.
- **1.5 — 20 octobre 2026 :** héros renommé Paul, commerçant fictif, sans référence à une personne réelle ; barème égal (+1 par KO, drapeaux cosmétiques) ; compteur neutre « Casseurs neutralisés » à la place de l’ancien compteur et suppression des lignes satiriques du bilan ; frappe circulaire à 360° (56 px, trois cibles) ; soins appliqués au contact ; armes ramassables (section 8.7, EX-25) et nouvelles armes proposées pour la tranche 2 ; manches à effectif fixe remplaçant les vagues sans fin (EX-26) et nouvelle formule de pression ; choix techniques effectifs (Phaser 4.2.1, Vite, TypeScript, Vitest, simulation pure, tuiles 32 px, LPC/Kenney) ; lancement direct par `/jouer/?go` ; section 24 décrivant la première tranche ; recette RC-79 à RC-85.
- **1.6 — 20 octobre 2026 :** landing sobre avec visuel original en pixel art (scène composée à partir des tuiles et sprites du jeu par `npm run hero`, drapeaux exclus ; pas de photographie d’événement réel) et police pixel Press Start 2P (licence SIL OFL 1.1, créditée) ; règles et instructions affichées au lancement du jeu (carte « Comment jouer » non bloquante avec `?go`, écran de départ pour l’accès direct) ; bouton « Commandes » (modale) sur la landing et dans le jeu ; EX-27 et RC-86 à RC-90.
- **1.7 — 21 octobre 2026 :** le secours se termine automatiquement une fois les agresseurs neutralisés (bulle « MERCI ! » environ 1,5 s, bonus +6 une fois), sans maintien de F ; bulles de victime « À L’AIDE ! » / « MERCI ! » ; alertes d’incident dans le style pixel du jeu (bannière « ÉCOLE EN FEU ! », « AGRESSION EN COURS ! », « VOL EN COURS ! » avec flèche et distance, indicateurs en bord d’écran par incident actif), génériques pour les futurs événements de casse ; ligne Agir de la section 7 réservée aux réparations et au rideau ; icône du site (favicon pixel, tête de Paul) ; EX-28, RC-62, RC-65, RC-66 ajustés, RC-91 et RC-92.
- **1.8 — 21 octobre 2026 :** vagues numérotées à partir de 1 (école = vague 1, secours = vague 2, puis vagues de remplissage), jamais 0 ; objectif K/T par vague affiché dans le HUD (« Vague N : K/T casseurs ») ; chaque vague annoncée (bannière pixel « VAGUE N ! » sans flèche, ligne « Vague N · T casseurs » sur les bannières de l’école et du secours) ; flux régulier sans repos entre vagues (premier casseur ≤ 1,5 s après le début d’une vague, respiration école → secours de 2 s, jamais plus de 3 s sans casseur actif) ; RC-85 ajustée, RC-93 et RC-94. Entre les manches, le bilan devient un panneau non bloquant sans temps mort (la manche suivante démarre pendant son affichage). Vagues distinctes (effectif fixe, la suivante n’est annoncée qu’une fois la vague en cours entièrement neutralisée ; premier casseur 2 s après l’annonce).
- **1.9 — 21 octobre 2026 :** tranche 2 « Fun », phase A. Les vagues deviennent des manches rythmées (répit de 6 s avec panneau non bloquant « Manche N terminée », annonce « MANCHE N ! » avec la casse phare, montée, retournement à mi-effectif, apogée, bonus +5) ; RC-94 garde la règle des 3 s à l’intérieur d’une manche avec l’exception voulue du répit. Modèle de santé pour tous les lieux à la place de la réserve de 30 s (section 10) : casseur Molotov (élan 1,5 s, KO = pas de feu), feu et dégradeurs, extinction automatique 1,5 s après le dernier KO, ruines persistantes ; voiture et abribus attaquables ; caisses à outils et réparation automatique sans F (sections 10.6 et 10.7). Levée de l’interdiction des armes à feu pour des tireurs et un flashball cartoon (EX-07, phase B à venir) ; renvoi vers la conception des phases B à D (section 24). EX-20, EX-21, EX-26 et les RC des kits, délais et manches (RC-25, RC-27, RC-29, RC-34, RC-52 à RC-60, RC-67, RC-85, RC-91, RC-93, RC-94) alignées ; RC-95 à RC-98 ; une bannière d’incident devenue caduque est retirée de la file.
- **1.9.1 — 21 octobre 2026 :** retours de partie (phase A). Le feu n’est annoncé (bannière, alarme) qu’au lancer de la bouteille ; titres de manche neutres (« École menacée »…) ; indicateur jaune puis flamme. Casseurs attirés par Paul (220 px / 320 px, ligne dégagée ; à trois hostiles actifs au plus, ceux qui tiennent leur poste depuis 6 s viennent à lui ; Molotov jamais détourné) et entrées par les trois points les plus proches à 320 px au moins. Réparation et extinction lancées par Agir (F, bouton Agir) sans maintien, 2 s, interrompues par l’éloignement ou un casseur ; caisses posées aussi en début de manche. Un lieu en feu ou détruit le reste jusqu’à sa réparation : plus d’extinction automatique, le feu continue à 0,7 PV/s après l’attaque. Plusieurs lanceurs de Molotov par attaque selon la manche (1, 2, 3 puis 4 ; deux au plus pour le mobilier urbain ; le second de la manche 1 avec les renforts de l’école), décalés de 0,25 s ; une bouteille sur un lieu déjà en feu lui retire 8 PV d’un coup. Les mentions de la v1.9 sur l’extinction et la réparation automatiques sont remplacées (sections 7, 9.2, 9.3, 10, 12.2, 14.1, 18, RC-58, RC-96, RC-97).
- **1.9.3 — 21 octobre 2026 :** mode furie (section 8.8), à la demande du porteur du projet : bonus rare ramassé comme une arme qui active pour 12 s vitesse ×1,35, portée ×1,5, 8 cibles, KO en un coup sans usure d’arme et dégâts reçus ×0,5, sans remplacer l’arme tenue ; casseurs KO envolés en tourbillon (visuel seulement) ; aura jaune-blanc, bulles « POW ! » / « BOUM ! », bannières « MODE FURIE DISPONIBLE ! » et « MODE FURIE ! », indicateur « FURIE », sons dédiés. Arme du retournement remplacée par un mode furie dès la manche 4 et environ une apparition chronométrée sur six dès la manche 6 (sections 8.8, 12.2, 14, 16 ; RC-99 à RC-102).
- **1.9.4 — 21 octobre 2026 :** lanceurs sur Paul (section 10.9), à la demande du porteur du projet : dès la manche 3, quelques casseurs lancent leurs Molotov sur Paul (environ un casseur de remplissage sur huit, trois au plus par manche, et le dernier lanceur de Molotov de chaque attaque après sa bouteille sur le lieu) ; élan de 1,2 s avec ligne de visée, bouteille de 0,7 s vers la position de Paul au début de l’élan, flaque de feu de 3,5 s (4 PV toutes les 0,5 s, moitié en mode furie, six au plus), sans bannière (sections 8, 10.9, 16 ; RC-103, RC-104). Carte « Comment jouer » bloquante au lancement (RC-70, RC-87) : la partie attend une touche, un clic ou un toucher. Boutique de jeux vidéo rétro (sections 10, 12.2, 14, 24 ; RC-105, RC-106), à la demande du porteur du projet : nouveau bâtiment à protéger (100 PV, +6 / −2 / +4), tirée au sort comme casse phare avec les autres lieux libres dès la manche 2 ; « BOUTIQUE EN FEU ! », enseigne pixel « JEUX RÉTRO » ; le rideau et le commerçant de la section 23.1 restent non livrés. Statue équestre au drapeau français et capture du drapeau (section 11 réécrite, EX-15, sections 12.2, 13, 14.1 ; RC-32, RC-107 à RC-109), à la demande du porteur du projet : dès la manche 4, en alternance avec le secours, des casseurs attaquent la statue et remplacent en quelques secondes le drapeau français par un drapeau palestinien (−3) ; tous KO avant = +4 ; le drapeau reste palestinien jusqu’à ce que Paul tienne 8 s la zone sans hostile à l’intérieur (+10 par reprise). Casse phare tirée au sort à partir de la manche 2 (manche 1 = école ; RC-106, RC-110), à la demande du porteur du projet.
- **1.9.5 — 21 octobre 2026 :** objets volés à rendre (sections 12.10, 12.12 ; RC-111, RC-112), à la demande du porteur du projet : pendant un secours, aux seuils de 75, 50 et 25 % de la réserve, un agresseur prend un objet personnel ordinaire de la victime (sac, chapeau, canne, sac à dos, écharpe, casquette ; jamais de vêtement porté ni rien de dégradant) ; le voleur KO le lâche, Paul le ramasse et le rend près de la victime (+2 par objet) ; un secours sécurisé attend jusqu’à 12 s les objets dehors avant les 1,5 s de « MERCI ! » et le +6 ; objets non rendus perdus sans pénalité ; carte « Objets 1/3 rendus », case « Objets N », bulles « MON SAC ! ». Les agresseurs de victime ne quittent plus leur poste pour Paul quand il reste peu de casseurs (les dégradeurs, si ; section 10).
- **1.9.8 — 21 octobre 2026 :** casseurs satellisés par l’onde d’énergie (section 8.9 ; RC-116), à la demande du porteur du projet : envol `satellite` (1 100–1 800 px, 6–10 tours, le long du rayon) au lieu du tourbillon du mode furie ; vol d’environ 1,3 s qui accélère, tournoie, monte et rapetisse, sans limite de carte, puis étoile « ✦ » (et « PING ! » une fois sur deux) au bord de l’écran où il sort, ou à sa fin s’il reste à l’écran, départs décalés de 0 à 120 ms, et plus aucun corps au sol ; 16 satellites au plus ; 0,5 s sans rotation avec `prefers-reduced-motion`.
- **1.9.7 — 21 octobre 2026 :** armes spéciales (section 8.9 ; sections 8.7, 8.8, 12.2, 14.1, 16 ; RC-102, RC-113 à RC-117), à la demande du porteur du projet : **bouclier** (20 s, bloque de face pierres et bouteilles, coup de bouclier qui repousse sans usure) et **onde d’énergie** (identifiant `kamehame` ; maintenir Frapper 1 s, Paul immobile, rayon de 320 px qui met KO toute la ligne et s’arrête aux obstacles et au groupe ; 2 tirs) ; entrée « Frapper maintenu » (`strikeHeld`) ; le retournement tire au sort parmi les spéciaux débloqués (bouclier dès la manche 3, mode furie dès la 4, onde dès la 5), une arme ordinaire avant ; bannière et indicateur de bord d’écran **seulement pour les spéciaux** (« FURIE », « BOUCLIER », « RAYON »), plus jamais pour une arme ordinaire (fin de « ARME SPÉCIALE ! »). Menu pause et autres panneaux superposés centrés à l’écran, horizontalement et verticalement (défilement conservé pour les panneaux longs).
- **1.9.6 — 21 octobre 2026 :** HUD (section 14.1, sections 10.6 et 12.12 ; RC-56, RC-98), à la demande du porteur du projet : santé au-dessus de Paul (barre pixel dans le monde, verte / jaune / rouge, clignotement blanc au coup, masquée au KO ; valeur gardée pour les lecteurs d’écran), liste de score en police pixel en haut à gauche (SCORE en grand, NEUTRALISÉS, MANCHE N · K/T, PIERRES, ARME, OBJETS), indicateur de caisse retiré.

## 26. Landing page et accès au jeu

### 26.1 Rôle et périmètre

Une seule page publique présente le jeu et permet de le lancer rapidement. Elle fait comprendre le genre et donne accès aux commandes (modale) ; les règles sont expliquées dans le jeu, au lancement. Elle ne demande ni compte, ni inscription, ni téléchargement d’application.

La structure fonctionnelle et les contenus sont définis ci-dessous. **Confirmé (1.6) :** peu d’éléments, un visuel travaillé en plein écran. **Le visuel de la landing est original** : une scène en pixel art vue du dessus, composée à partir des tuiles et sprites du jeu (script `npm run hero`, une seule image PNG décorative à sa taille native, agrandie sans lissage), **drapeaux exclus** (accessoires cosmétiques du jeu, jamais utilisés comme visuel promotionnel) ; aucune photographie d’un événement réel, ni de personnes réelles, n’est utilisée sans droits ni consentement, et aucune image ne présente des manifestants ou des groupes réels comme des adversaires du jeu. Le nom définitif et les textes de promotion restent modifiables sans changer le parcours.

Landing et navigation sont P0. L’habillage final et un aperçu représentatif sont P1, requis pour une diffusion publique de la version aboutie. Pas de boutique, newsletter, faux avis, compteur de joueurs inventé ou réseau social nécessaire à la première version.

### 26.2 Contenu recommandé, dans l’ordre de lecture

| Bloc | Contenu attendu | Action |
| --- | --- | --- |
| Visuel plein écran | Scène originale en pixel art composée à partir des tuiles et sprites du jeu (école en feu, Paul, casseurs « classiques », projectiles, panneau au sol, kit de soins, groupe pacifique aux pancartes vierges), drapeaux exclus ; décorative, sans texte porteur d’information, avec braises et lueur animées en CSS (coupées si la réduction des animations est demandée) | Aucune |
| Présentation | Nom du jeu et une phrase de promesse (le genre est dans la description du site, pas en surtitre) | Bouton principal « Jouer » ; bouton secondaire « Commandes » |
| Commandes | Modale (sans JavaScript) avec le tableau des commandes ordinateur et téléphone, issu de la même source que le jeu | Ouverte par le bouton « Commandes », fermée par « Fermer », Échap ou clic extérieur |
| Pied de page | Version et statut prototype/version jouable, crédits, lien vers le code source, mention de fiction satirique | Crédits, code source |
| Icône du site | Favicon pixel art tiré de la tête de Paul (`npm run favicon` : `favicon.png` 32 × 32 et `apple-touch-icon.png` 180 × 180), couleur de thème `#14121c`, liée depuis `/` et `/jouer/`, créditée comme dérivé LPC | Aucune |

Texte de présentation retenu : **« Défends le quartier. Tiens aussi longtemps que possible. »**

**Confirmé (1.6) :** aucune ligne de mentions (solo, plateformes, sans compte) sous le bouton Jouer. Si une telle mention revient, elle n’affichera que les compatibilités réellement vérifiées. La mention « gratuit » ne sera ajoutée que si ce modèle de diffusion est confirmé.

Les chiffres d’équilibrage, l’architecture technique, les règles détaillées et la liste des fonctionnalités n’ont pas leur place sur la landing.

### 26.3 Règles à expliquer au lancement du jeu

**Confirmé (1.6) :** ces règles sont affichées par le jeu, pas par la landing : sur la carte de lancement (§26.4) et dans la modale « Commandes » du jeu.

- La session n’a pas de limite globale de temps : elle se termine au KO ou par arrêt volontaire.
- La partie avance par manches, avec un court répit entre deux. Les lieux attaqués ont une barre de santé et les secours un délai local. Manquer une intervention n’arrête pas la partie ; une caisse à outils et la touche F (bouton Agir) permettent d’éteindre un lieu en feu ou de réparer une ruine.
- Les groupes pacifiques et les victimes sont à protéger et à contourner. La frappe de Paul les exclut.
- Les projectiles ennemis tombés peuvent être récupérés puis renvoyés ; des armes apparaissent dans les rues ; la santé et les soins sont limités, une station soigne quand on passe dessus.
- La partie avance par manches : neutraliser l’effectif de la manche et traiter ses objectifs pour passer à la suivante.
- Les commandes affichées reprennent les affectations réellement livrées de la section 7 ; ne pas maintenir une seconde liste divergente. Présenter le clavier et le tactile sans laisser croire qu’une souris est obligatoire sur téléphone.

Le statut satirique du jeu est indiqué en une phrase lisible. Le site ne présente pas les scènes fictives comme une reconstitution ; Paul est un personnage fictif. Les marqueurs de gameplay et compteurs sont expliqués dans les règles et le bilan, sans leur attribuer une valeur documentaire.

### 26.4 Navigation et lancement

Routes proposées : **`/` pour la landing**, **`/jouer/` pour le jeu**. Elles peuvent être servies comme deux entrées statiques dans le même dépôt, sans framework de site supplémentaire. Les deux routes et leurs ressources doivent fonctionner après navigation directe et rechargement sur l’hébergement retenu.

**Confirmé :** « Jouer » est un vrai lien vers `/jouer/?go`, dans le même onglet. Le jeu ne commence pas à se charger au survol, au défilement ou à l’ouverture de la landing. Aucun préchargement automatique du moteur ou des atlas. La page de jeu affiche l’avancement, les erreurs et une action Réessayer en cas d’échec. Avec `?go`, la partie démarre dès que les ressources indispensables sont prêtes, sans écran de départ bloquant ; **une carte « Comment jouer » non bloquante** (objectif, touches principales, bouton « Compris », disparition automatique après ~25 s) s’affiche par-dessus la partie ; un bouton **« Commandes »** reste dans l’interface et ouvre une modale (touches et règles) qui met la partie en pause jusqu’à sa fermeture. L’audio se déverrouille à la première touche, au premier clic ou au premier toucher.

L’accès direct au jeu est autorisé : la landing n’est pas une étape obligatoire. Une visite directe sur `/jouer/` affiche l’écran des règles essentielles et des commandes avec l’action « Commencer ». L’activation audio se fait sur un geste dans la page du jeu ; le clic effectué sur une autre page ne doit pas être supposé suffisant.

Pause et bilan proposent « Retour au site ». Depuis une session en cours, une confirmation intégrée précise qu’elle sera abandonnée, avec « Continuer la partie » et « Quitter la partie ». Depuis le bilan, retour direct. Le rechargement ou la fermeture ne garantissent pas la reprise : aucune sauvegarde de session n’est prévue en V1. Le record et les préférences déjà enregistrés restent locaux au navigateur et à la même origine.

Avant livraison du nouveau jeu 2D, ne pas relier un bouton annonçant ce jeu à l’ancien prototype 3D sans avertissement. En revue interne, un aperçu peut être marqué « maquette » ; pour diffusion, employer une vraie capture de la version jouable. Une fonctionnalité absente est retirée de la présentation ou clairement annoncée comme à venir.

### 26.5 Accessibilité, téléphone et médias

HTML sémantique, un titre principal, ordre de lecture cohérent, vrais liens et boutons, navigation clavier complète, focus visible et contrastes suffisants. Le titre, les boutons et le titre de la modale utilisent la police pixel Press Start 2P (licence SIL OFL 1.1, sous-ensemble latin, créditée dans les crédits) avec une police de repli ; le texte courant reste en police système. La présentation reste lisible sans JavaScript ; le jeu affiche son besoin de JavaScript et de WebGL si ces fonctions manquent. La compatibilité du jeu reste celle de la section 19.

Le lien Jouer doit être repérable dans le premier écran sur les formats cibles, sans masquer les règles ni recouvrir le contenu. Les zones tactiles visent au moins 44 × 44 pixels CSS. Vérifier petits écrans, zoom du navigateur et absence de débordement horizontal. Une image n’est pas le seul support du titre, des règles ou des commandes.

Aucun son automatique. Une vidéo éventuelle se lance volontairement, avec commandes, image d’affiche et alternative textuelle ; elle ne bloque pas le lancement du jeu. Respecter la réduction des animations. L’aperçu utilise un texte alternatif utile et des dimensions réservées pour éviter les sauts de mise en page. Son indisponibilité laisse la présentation et le lien Jouer utilisables.

### 26.6 Chargement et budgets proposés

| Mesure | Cible de départ |
| --- | --- |
| HTML, CSS et JavaScript propres à la landing | Au plus 300 Ko transférés compressés, hors aperçu optionnel |
| Aperçu principal fixe | Au plus 250 Ko, format adapté, dimensions explicites |
| Moteur, atlas et sons de jeu avant navigation vers Jouer | Zéro téléchargement |
| Vidéo éventuelle | Aucun téléchargement vidéo avant action, hors image d’affiche |
| Ressources sous la ligne de flottaison | Chargement différé quand utile |
| Mesures | Poids, stabilité visuelle et temps d’affichage relevés séparément du chargement du jeu |

Ces budgets sont des objectifs de projet à vérifier sur un profil de réseau et un appareil documentés. La landing utilise un script minimal si nécessaire ; aucun framework supplémentaire, service d’analytique ou cookie de suivi n’est requis. Les ressources du jeu restent soumises aux budgets de la section 19.

### 26.7 Livrables et recette

Livrer les textes, les deux points d’entrée, le lien vers le jeu, l’aperçu fidèle à la version, les commandes synchronisées avec le jeu et les crédits. Fournir les consignes de build et d’hébergement pour les deux routes. Le travail visuel de Claude devra respecter ces contrats de navigation, de chargement et d’accessibilité.

La recette RC-69 à RC-78 et RC-86 à RC-106 complète la recette du jeu. Elle doit vérifier le trajet landing → jeu → bilan → landing, ainsi qu’une entrée directe sur le jeu. Le présent document décrit cette cible ; il ne constitue pas une preuve que la landing ou le nouveau jeu ont déjà été réalisés.
