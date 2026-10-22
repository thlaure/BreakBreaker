# BreakBreaker — Spécifications : Vision et périmètre

> **Rôle du fichier :** vision du jeu, exigences validées, périmètre et priorités, production et livrables, extensions prévues, décisions restantes et sources.  
> Fait partie des spécifications de BreakBreaker (version 1.9.25), découpées en plusieurs fichiers. Retour à l’[index des spécifications](SPECS%20-%20Index.md) (sommaire général, historique des versions, conventions, plan des fichiers).

## 1. Vision et positionnement

### 1.1 Concept

Jeu web d’action arcade en **2D pixel art, vu du dessus, sans isométrie**, proche d’un hack-and-slash rétro. Le joueur incarne Paul, un commerçant de quartier fictif, représenté avec des cheveux longs, des lunettes rectangulaires noires, une tenue noire et une écharpe blanche qui le distingue des casseurs.

Il se déplace librement dans une carte parisienne fictive : places, école, monument et commerces. Des hordes de casseurs arrivent par plusieurs accès. Le joueur les combat au contact, à mains nues ou avec des armes ramassées dans les rues, évite leurs projectiles, peut récupérer certaines pierres tombées puis les renvoyer, défend l’école et reprend des drapeaux.

Des groupes de manifestants pacifiques occupent des parties de la carte. Ils ne sont pas des cibles pour Paul et doivent être contournés. Certains peuvent être menacés par des casseurs lors d’événements de secours. D’autres rencontres mettent en scène une personne ou un couple âgé victime de vol ou d’intimidation, à aider rapidement.

La session est découpée en manches : chaque manche fixe un nombre de casseurs à neutraliser et un à trois objectifs. La santé, les soins (stations ; petits soins de terrain livrés, v1.9.18) et la survie jusqu’au KO restent conservés. Aucun compte à rebours global et aucune victoire terminant automatiquement la session. Une barre de santé indique en revanche l’état d’un lieu attaqué, et un délai local le temps restant pour intervenir auprès de personnes menacées. Un lieu détruit peut être réparé avec une caisse à outils trouvée sur la carte.

### 1.2 Promesse

« Se déplacer, repousser les hordes, ramasser des armes, renvoyer leurs pavés et tenir le quartier manche après manche, aussi longtemps que possible. »

Le plaisir repose sur le mouvement, la lecture des groupes, les coups, l’esquive par déplacement, le renvoi de projectiles, la défense des lieux et la gestion de la santé. La récupération d’objets est limitée et compréhensible ; aucun inventaire complexe.

### 1.3 Direction visuelle

Vue orthogonale du dessus, carte à axes horizontaux/verticaux, sprites et décors dessinés en pixels. De petits volumes dessinés et des faces de bâtiment peuvent améliorer la lisibilité, sans projection isométrique ni grille en losanges.

La référence GTA / The Division n’est plus une cible de rendu. La crédibilité vient désormais des détails reconnaissables, des animations, des réactions et du son, dans une représentation rétro cohérente.

### 1.4 Public et accès

Navigateur sur ordinateur et téléphone, sans compte ni installation obligatoire. Caméra automatique, commandes simples et version tactile. Le pixel art réduit certains besoins graphiques, mais ne dispense pas de limiter les hordes, les collisions et les effets ni de tester sur téléphone réel.

### 1.5 Paul, protagoniste unique

**Confirmé (révision 1.5) :** le héros est Paul, un commerçant de quartier entièrement fictif. Repères visuels : cheveux longs, lunettes rectangulaires noires (v1.9.10), vêtements noirs et un accent clair (écharpe ou bavoir blanc) qui le distingue des casseurs vêtus de sombre ; silhouette identifiable à la taille réelle du sprite. Aucun choix de sexe, de teint ou d’un autre héros.

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
| EX-07 | Combat au contact, à mains nues ou avec des armes ramassées ; aucun gore, aucun sang. **Modifié (v1.9) :** le porteur du projet lève l’ancienne interdiction des armes à feu pour les tireurs ennemis (AK-47, manches tardives) et le flashball de Paul, en style cartoon, tirs lisibles et esquivables ; livré en phase B de la tranche 2 (v1.9.15, section 12.14). |
| EX-08 | Projectiles ennemis de type caillou, pavé ou brique. |
| EX-09 | Possibilité de récupérer des projectiles et de les renvoyer contre les casseurs. |
| EX-10 | Groupes de manifestants pacifiques à éviter et non ciblables par Paul ; certains peuvent subir une menace ennemie et être secourus. |
| EX-11 | Étudiants, professeurs, policiers, pompiers, soignants et commerçants restent non ennemis. |
| EX-12 | Santé et petits soins conservés (stations de soin livrées ; petits soins de terrain livrés en v1.9.18, section 12.5). |
| EX-13 | Session arcade sans durée limite, découpée en manches, poursuivie jusqu’au KO du joueur. |
| EX-14 | École à défendre : première ligne, renforts, réparation, retour des étudiants et formations projetées (étudiants et formations à faire, section 10.8). |
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
| EX-25 | Armes ramassables apparaissant aléatoirement dans les rues, en petit nombre (v1.9.16, section 8.7) ; chacune met un casseur KO en un coup (2 dégâts seulement sur un costaud ou « Le Caïd », section 12.14), avec portée et nombre de coups propres ; armes à feu cartoon seulement dans les conditions d’EX-07 (section 8.7). |
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
| Armes | **Confirmé :** armes ramassées en passant dessus, une tenue à la fois, KO en un coup (2 dégâts sur un costaud ou le Caïd, v1.9.13), usure par coup utile (section 8.7) |
| Pierres | Ramassage automatique des pierres ennemies déjà tombées, stock maximal de trois |
| Renvoi | Action distincte, direction choisie ; pas de capture parfaite de projectile en vol en V1 |
| Manifestants | Non ciblables par Paul ; menace ennemie représentée par un état de détresse pendant un événement de secours |
| Objectifs | École, monument, boutique proposée pour varier les manches |
| Manches | **Confirmé :** manches à effectif fixe et un à trois objectifs ; progression des effectifs proposée en section 12.2, avec plafond de simulation |
| Soins | **Confirmé :** stations limitées appliquées au contact (+25) ; petits soins de terrain (+10, livrés en v1.9.18), sans régénération passive |
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

### 23.1 Boutique — contenu proposé pour la V1 arcade (non livré)

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

L’ancienne extension « accessoires de contact » est remplacée par les armes ramassables de la section 8.7 (Bâton, Marteau, Panneau de signalisation). Parmi les armes débloquées par manche, le bouclier est livré (v1.9.7, section 8.9) ; l’onde d’énergie (« kamehame ») et le mode furie sont livrés comme pouvoirs de la jauge d’énergie (v1.9.14, sections 8.8 et 8.9) ; le gant de boxe à ressort et le flashball sont livrés (v1.9.15, sections 8.7 et 12.14). Les armes à feu suivent EX-07 (v1.9) : flashball cartoon pour Paul, tireurs ennemis à partir de la manche 6 (livrés, v1.9.15). Toute nouvelle arme définit animations, portée, nombre de coups et rareté avant ajout ; le score d’un KO reste identique quelle que soit l’arme.

### 23.5 Diffusion et confort

Installation PWA facultative, démarrage hors connexion après cache complet, manette étendue, autres langues, davantage de réglages et nouveaux quartiers. Un classement mondial ou un mode multijoueur constituerait un projet distinct avec backend et règles propres.

## 25. Décisions restantes et sources

### 25.1 Paramètres à valider par le prototype 2D

| Sujet | Proposition de travail |
| --- | --- |
| Direction | Pixel art orthogonal du dessus, pas d’isométrie |
| Héros | Paul (fictif), cheveux longs, lunettes rectangulaires noires, tenue noire, accent clair, sprite unique |
| Gabarits | Tuile 32 × 32 ; cellules LPC 64 × 64, silhouette environ 32 × 48 |
| Déplacement | Huit directions, diagonales normalisées |
| Contact | Frappe circulaire de 56 px à mains nues, trois cibles maximum (confirmé) |
| Armes | Portées, coups et rythme d’apparition de la section 8.7 |
| Manches | Effectifs 10, 14, 18, 22 puis +4 ; 12 casseurs sur la carte au plus |
| Récupération | Pierres ennemies tombées, ramassage automatique |
| Stock | Trois pierres ; renvois non récupérables |
| Groupes pacifiques | Non ciblables par Paul ; détresse ennemie seulement dans un événement annoncé |
| Bâtiments urgents | Santé 100 PV (bâtiments) / 60 PV (mobilier) ; feu 2 PV/s, dégradeur 1,2 PV/s (quatre au plus), feu qui couve 0,7 PV/s ; Molotov sur un lieu en feu −8 PV |
| Monument | 6 occupants la première fois, puis min(8, 5 + ⌊manche ÷ 3⌋) ; remplacement en 4 s (trois occupants comptés au plus) ; capture de 8 s dans une zone de 112 px |
| Secours | Délai local de 25 s (fourchette 20 à 30 s), deux urgences simultanées maximum dès la manche 3 |
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

> La sous-section 25.4 (Historique) est tenue dans l’[index des spécifications](SPECS%20-%20Index.md#254-historique).
