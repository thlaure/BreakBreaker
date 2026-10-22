# BreakBreaker — Spécifications : Manches et progression

> **Rôle du fichier :** mode arcade, manches, événements, soins, services d’urgence, prison, score et bilan.  
> Fait partie des spécifications de BreakBreaker (version 1.9.25), découpées en plusieurs fichiers. Retour à l’[index des spécifications](SPECS%20-%20Index.md) (sommaire général, historique des versions, conventions, plan des fichiers).

## 12. Mode arcade, manches, événements, progression et soins

### 12.1 Règle centrale

**Aucune durée limite de session. Aucun compte à rebours global. La session se poursuit jusqu’au KO du héros.** La session est découpée en manches (section 12.2). Réussir l’école, le monument ou une manche augmente le score et renouvelle le contenu, sans réinitialiser la santé et sans afficher une victoire finale. Un objectif échoué ne termine jamais la session : seul le KO de Paul y met fin.

Les délais de frappe, la destruction d’un bâtiment attaqué, la détresse d’un secours, les cinématiques, la capture et les interactions ont des durées locales. Une mesure de durée de survie peut apparaître au bilan, en temps écoulé, sans pression de compte à rebours.

### 12.2 Structure des manches

**Confirmé :** les manches remplacent les vagues sans fin comme structure cible. Une manche fixe un nombre de casseurs à mettre KO et un à trois objectifs. Elle se termine quand tout son effectif a été neutralisé et que ses objectifs sont résolus, réussis ou perdus. Un objectif échoué ne termine jamais la session ; seul le KO de Paul y met fin.

**Modifié (v1.9) — rythme d’une manche.** Une manche alterne temps forts et temps faibles : (1) **répit de 6 s** sans aucune entrée de casseur, avec le panneau non bloquant « Manche N terminée » (KO, objectifs « réussi » / « perdu », points, « Bonus +5 » s’il est gagné, « Soins rechargés », compte à rebours « Manche N+1 dans 6… » jusqu’à 1), stations de soin rechargées, santé des lieux intacts remise au maximum (jamais celle d’un lieu encore en feu), caisses à outils reposées (aussi au début de la manche) et, **modifié (v1.9.16) :** à la fin des manches paires seulement, une arme ordinaire posée à 160–480 px de Paul (disparaît après 15 s ; aucune si une arme est déjà au sol à 200 px de Paul) ; les patrouilles en attente sont annulées et celles encore sur la carte s’en vont ; la manche 1 n’a pas de répit, l’intro de 4 s en tient lieu ; (2) **annonce** par la bannière pixel « MANCHE N ! » avec la casse phare de la manche (« Voiture menacée · 18 casseurs » : rien n’est encore en feu) ; (3) **montée** : le premier groupe file vers le lieu attaqué ; (4) **retournement** dès que la moitié de l’effectif (arrondie au supérieur) est KO : **modifié (v1.9.12) :** une arme à aller chercher dès la manche 2 (disparaît après 15 s ; **modifié (v1.9.14, v1.9.16)** : dès la manche 3 le bouclier, avec sa bannière, une fois sur deux ; sinon, et en manche 2, une arme ordinaire sans bannière une fois sur deux, rien sinon ; section 8.9), et **en plus**, aux manches impaires dès la 3, une seconde urgence ailleurs si le plafond d’urgences le permet (le joueur choisit entre courir à l’arme et défendre) ; (5) **apogée** : le dernier groupe de la manche entre plus serré (0,8 s d’intervalle) ; (6) **récompense** : bonus +5 si tous les objectifs sont réussis, puis retour au répit. Le répit commence quand tout l’effectif de la manche est KO. Le joueur conserve sa santé, son score, ses KO, son stock de pierres, sa caisse à outils portée, son arme tenue avec ses coups restants et son historique de soins.

Les casseurs affectés aux objectifs (première ligne, renforts, occupants du monument, agresseurs de secours) font partie de l’effectif de la manche. Une réparation optionnelle d’un bâtiment déjà perdu n’empêche pas la transition. Un secours déclenché est toujours résolu (réussi ou manqué) avant la fin de sa manche, puisque ses agresseurs font partie de l’effectif. **Modifié (v1.9.4, demande du porteur du projet) :** l’ancien « commerce pillé » (rideau, commerçant, section 23.1) n’est pas livré ; la boutique livrée est une **boutique de jeux vidéo rétro** (« JEUX RÉTRO »), un bâtiment à protéger comme l’école (santé, Molotov, dégradeurs, feu qui couve jusqu’à la caisse à outils, réparation à pleine santé), sans rideau ni commerçant ; elle entre dans le tirage au sort de la casse phare dès la manche 2 (tirage aléatoire, v1.9.4).

**Progression des manches — éléments livrés / à faire (v1.9.11, retournement v1.9.12).** Effectifs (paramètres `round.totals`, `growth`, `maxTotal`) ; la colonne « Livré » décrit le jeu actuel, la colonne « À faire » les nouveautés prévues par la conception de la tranche 2 et pas encore réalisées (sections 12.14 et 12.15).

| Manche | Casseurs à neutraliser | Livré | À faire |
| --- | ---: | --- | --- |
| 1 | 10 | École (Molotov, dégradeurs, cinématique et huit renforts) puis secours ; casseurs au contact, dégradeurs et Molotov ; bâton, marteau, panneau dans la rue ; jauge d’énergie (onde à 50, mode furie à 100, v1.9.14) dès la manche 1 | — |
| 2 | 14 | Casse phare tirée au sort (école, boutique de jeux rétro, voiture, abribus) puis secours ; lanceurs de pierres ; retournement : arme ordinaire une fois sur deux (v1.9.16) ; première arme du répit à la fin de la manche (manches paires, v1.9.16) | — |
| 3 | 18 | Lanceurs sur Paul ; meute de coureurs et « Le Caïd » en dernier casseur de chaque manche dès celle-ci (v1.9.13 ; 14 PV, +2 toutes les deux manches, v1.9.16) ; retournement : bouclier une fois sur deux, sinon arme ordinaire une fois sur deux (v1.9.14, v1.9.16) **et** seconde urgence (deux urgences simultanées au plus dès cette manche) ; gant de boxe à ressort dans la rue (v1.9.15) ; deux cabines téléphoniques en jeu, attaquables dès cette manche (v1.9.19) ; le premier Caïd KO est enfermé dans la prison (v1.9.20) | — |
| 4 | 22 | Monument en alternance avec le secours ; un costaud par manche (deux dès la 6, trois dès la 8, v1.9.13) ; retournement : bouclier ou arme ordinaire ; **prison attaquable (v1.9.20)** : 400 PV, les Caïds mis KO y sont enfermés (dès la manche 3, tant qu’elle tient), ses 5 gardiens sont postés dès la manche 1 | — |
| 5 | 26 | Retournement : bouclier ou arme ordinaire, et seconde urgence ; bouclier et flashball (v1.9.15) dans la rue ; **deux lieux attaqués à la fois dès le début de la manche ; école maternelle et kiosque (v1.9.18)** | — |
| 6 | 30 | Tireur AK-47 cartoon (un par manche aux manches 6–7, dans le dernier groupe), flashball garanti avec le premier tireur de la partie (v1.9.15) | — |
| 7 | 34 | Mairie (v1.9.18) | — |
| 8 | 38 | Deux tireurs par manche (v1.9.15) | — |
| 9 et suivantes | 40 (plafond) | Même mélange, pression croissante ; deux tireurs par manche en manche 9, **trois dès la manche 10 (v1.9.24, `shooter.counts`)**, jamais plus de trois (plafond de `shooter.maxPerRound`) ; bibliothèque (manche 9, v1.9.18) ; effectif pouvant dépasser 40 (voir ci-dessous) | — |

**Catalogue de casse.** Chaque élément de casse est un lieu de la carte (bâtiment existant ou mobilier urbain ajouté) avec des états visibles : intact → attaqué (feu, fumée, vitres brisées) → ruine persistante → réparé par caisse à outils. Il réutilise la mécanique de l’école : santé qui ne baisse que sous le feu ou une dégradation effective (section 10.2), ruine qui persiste entre les manches, réparation par caisse à outils (section 10.6), apparitions comptées dans l’effectif de la manche. Un lieu en ruine n’est plus tiré au sort tant qu’il n’est pas réparé ; s’il était prévu, ses casseurs rejoignent la file de la manche.

| Élément | Lieu | Disponible dès | Santé | Points sauvé / perdu / réparé |
| --- | --- | ---: | ---: | --- |
| École en feu (livré) | École (nord-ouest) | Manche 1 | 100 PV | +8 / −3 / +5 |
| Boutique de jeux rétro (livré, v1.9.4) | Bâtiment 5, au sud-ouest du centre (porte au sud) ; pas de rideau | Manche 2 | 100 PV | +6 / −2 / +4 |
| Voiture en feu (livré) | Deux emplacements de voiture garée | Manche 2 | 60 PV | +4 / −2 / +3 |
| Abribus saccagé (livré) | Abribus | Manche 2 | 60 PV | +4 / −2 / +3 |
| Monument attaqué (livré, v1.9.4) | Statue équestre au drapeau français, à l’est du centre (section 11) | Manche 4 | — (pas de santé) | +4 défendu / −3 drapeau remplacé / +10 drapeau repris |
| École maternelle en danger (livré, v1.9.18) | Bâtiment 9, au sud-ouest (R(6,30,7,6), porte en C(9,36) côté rue, quatre points d’attaque sur la rangée 36) | Manche 5 | 100 PV | +8 / −3 / +5 |
| Kiosque saccagé (livré, v1.9.18) | Kiosque à journaux, mobilier urbain R(34,40,2,1) en terrain dégagé au sud-est, au sud du bâtiment 7 et à l’ouest du bâtiment 11 | Manche 5 | 60 PV | +4 / −2 / +3 |
| Mairie attaquée (livré, v1.9.18) | Bâtiment 1, au nord (R(15,3,6,4), porte en C(18,7)) | Manche 7 | 100 PV | +8 / −3 / +5 |
| Bibliothèque en feu (livré, v1.9.18) | Bâtiment 10, au sud (R(22,38,8,5), porte en C(26,43), attaquée par son front sud, rangée 43) | Manche 9 | 100 PV | +8 / −3 / +5 |
| Cabine saccagée (livré, v1.9.19) | Deux cabines téléphoniques, mobilier urbain 1 × 1 : la rouge en R(4,22), la bleue en R(5,22), côte à côte sur la place dégagée du centre-ouest (section 12.16) | Manche 3 | 60 PV | +4 / −2 / +3 |
| Prison attaquée (livré, v1.9.20) | Bâtiment 11, au sud-est (R(38,36,6,6), porte en C(41,42) sur la rangée de rue 42, points d’attaque en C(39|40|42|43, 42)) ; gardiens, Caïds enfermés et évasion (section 12.17) | Manche 4 | 400 PV | +8 / −3 / +5 |

**Urgences simultanées.** Livré : une seule urgence à la fois en manches 1 et 2, deux au plus dès la manche 3 ; la seconde vient du retournement des manches impaires (dès la 3), en plus de l’arme déposée, sur un lieu libre tiré au sort, de préférence un lieu pas encore attaqué dans la manche (rien de plus à défaut de place ou de lieu libre ; **modifié v1.9.12**). **Livré (v1.9.18) :** à partir de la manche 5 (`TWO_URGENCIES_FROM`), la première séquence de la manche lance deux casses à la fois, sur deux lieux libres distincts, au début de la manche. Règle de sélection : les types qui ouvrent cette manche passent d’abord (manche 5 : école maternelle puis kiosque ; manche 7 : mairie ; manche 9 : bibliothèque) ; les places restantes sont tirées par le tirage pondéré existant (poids 1 pour un type de la première séquence de la manche précédente, 2 pour les autres, ce qui favorise les lieux absents). Un type différent est préféré ; s’il n’en reste aucun de libre, un second lieu du même type est pris (voiture 1 et voiture 2). Les deux cabines (v1.9.19) et la prison (v1.9.20) comptent comme des lieux libres de ce tirage à partir de la manche 5, comme les deux voitures (les deux cabines peuvent être tirées). Avec un seul lieu libre, une seule attaque ; sans lieu libre, seule la seconde séquence se déroule. Un lieu en ruine ou en feu n’est jamais tiré. Les types de lieux s’ouvrent selon `CONFIG.casse.fromRound` (école 1 ; voiture, abribus, boutique 2 ; maternelle, kiosque 5 ; mairie 7 ; bibliothèque 9 ; cabines 3, v1.9.19 ; prison 4, v1.9.20) ; les manches 2 à 4 tirent exactement comme avant, hors cabines à partir de la 3 et prison à partir de la 4 (les graines d’avant la v1.9.19, puis d’avant la v1.9.20, ne se rejouent donc plus à l’identique). La prison peut être tirée comme première casse dès la manche 4 et comme seconde urgence dès la manche 4 ; elle compte pour la règle des deux urgences comme n’importe quel lieu. La seconde séquence (secours ou monument en alternance) attend toujours que la première soit réglée et que le plafond d’urgences soit respecté. **Le retournement des manches impaires n’ajoute jamais une troisième urgence :** il est ignoré tant que deux urgences sont en cours. Seule l’école de la manche 1 garde la séquence première ligne + renforts ; les autres attaques ont une seule ligne de casseurs. Chaque incident déclenche l’alerte pixel de la section 14.1. Le mobilier urbain ajouté (voitures, abribus, kiosque, cabines) est solide, laisse au moins une tuile libre autour de lui, reste à l’écart du groupe pacifique, des points d’apparition et des stations, et ne coupe aucun passage.

Déroulement interne : les casseurs entrent un par un, le premier d’un groupe 2 s après sa mise en file puis à 1,5 s d’intervalle (0,8 s pour le groupe d’apogée), seulement tant que moins de douze hostiles sont actifs sur la carte ; les suivants attendent dans une file d’entrée. Les casseurs des objectifs passent en tête de file. Le reste de l’effectif (remplissage) est découpé en groupes d’environ six (les plus gros en dernier : le dernier est l’apogée) ; un groupe n’entre qu’une fois le précédent entièrement entré et KO. Dès la manche 2, un casseur de remplissage sur cinq lance des pierres ; dès la manche 3, quelques-uns lancent des Molotov sur Paul (section 10.9). Un secours compte de deux à quatre agresseurs en manche 1, trois ensuite. L’effectif T de la manche vaut `max(casseurs des objectifs, [10, 14, 18, 22][N−1] ou min(40, 22 + 4·(N − 4)))` ; il compte tous les casseurs de la manche (objectifs, agresseurs, retournement), seules les patrouilles de maintien du flux en sont exclues. **Ajouté (v1.9.18) :** dès la manche 5, T est relevé au besoin à « casseurs des objectifs + réserve de remplissage » (`fillReserve`) : la meute de coureurs de la manche plus le plus petit remplissage dont les places « contact » (après les lanceurs de pierres et les lanceurs de Molotov) tiennent le Caïd, les costauds et les tireurs ; deux attaques simultanées ne laissent donc jamais une manche sans tireur, costaud, Caïd ni meute. L’effectif d’une manche peut alors **dépasser 40 à partir de la manche 9** (41 en manche 9, une cinquantaine au pire avec deux gros bâtiments et le monument), mais le plafond de 40 hostiles actifs simultanés reste en vigueur.

**Numérotation et objectif des manches.** Les manches sont numérotées à partir de 1 dès le début de la partie ; le numéro n’affiche jamais 0. Chaque manche a un objectif « K/T » : T casseurs à neutraliser, K casseurs de cette manche déjà mis KO (borné entre 0 et T). Pendant l’intro de 4 s, aucun objectif n’est encore fixé (« Manche 1 »). **Modifié (v1.9.4, demande du porteur du projet : « ça ne peut pas être aléatoire ? ») :** la manche 1 est l’école puis le secours (apprentissage : premier Molotov, cinématique, renforts) ; **à partir de la manche 2, la casse phare est tirée au sort** (tirage déterministe par graine) parmi tous les lieux libres — debout, hors feu, sans attaque en cours : école, boutique, voitures, abribus — poids 2, poids 1 pour celui de la manche précédente (il peut revenir, rarement ; rien n’est imposé). Deuxième étape : le secours, ou dès la manche 4 le monument en alternance (section 11). Aucun lieu libre : la deuxième étape seule. Retournement (**modifié v1.9.12**) : une arme à chaque manche dès la manche 2 (le bouclier une fois sur deux dès la manche 3, section 8.9), plus une seconde urgence aux manches impaires dès la manche 3 quand le plafond d’urgences le permet. Attaque de la boutique : ses lanceurs de Molotov en tête, puis deux dégradeurs et un casseur au contact, plus min(6, 2 + pression ÷ 3) dégradeurs et casseurs au contact en alternance, comme l’école après la manche 1 ; variantes toujours mélangées.

**Flux régulier dans une manche, répit entre deux (RC-94).** À l’intérieur d’une manche, une fois l’intro terminée, il ne s’écoule jamais plus d’environ 3 s sans casseur actif sur la carte : si personne n’est actif pendant 1,5 s, le groupe suivant entre aussitôt, sinon une patrouille hors effectif. **Exception voulue :** les 6 s de répit entre deux manches sont un temps faible délibéré, sans aucune entrée, demandé par le porteur du projet ; elles remplacent l’ancienne règle « la manche suivante démarre pendant le bilan ».

Préparer au moins quatre compositions d’assaut et plusieurs points d’apparition. Aucun nouvel objectif ne doit se déclencher pendant une cinématique suspendue. Le panneau de bilan entre manches est un délai local d’affichage ; il n’impose pas un chronomètre de partie.

### 12.3 Directeur de pression

Le directeur suit la manche, ses groupes, les objectifs résolus, les KO, la file d’entrée et les agents actifs. La difficulté augmente avec la progression, pas uniquement avec le temps passé à attendre dans un coin.

Proposition de niveau de pression : `P = min(12, 1 + floor(manche / 2) + floor(KO / 30))`, où `manche` est le numéro de la manche en cours (v1.9). Elle remplace la formule de la révision 1.4 et reste un point de départ à tester. Elle rend le combat d’adversaires additionnels progressivement plus dangereux, même si le joueur retarde un objectif.

Les paramètres augmentent par paliers avec plafonds : nombre total de renforts par épisode, variantes de comportement, rapidité de décision, résistance de certains casseurs et dégâts. La vitesse d’animation ne doit jamais supprimer la lisibilité de la préparation d’attaque.

| Paramètre | Départ normal proposé | Plafond proposé |
| --- | --- | --- |
| Santé joueur | 100 | 100, sans hausse automatique par manche |
| Coups nécessaires par casseur | 2 à mains nues ; 1 avec une arme | 4 à mains nues pour les adversaires renforcés clairement signalés (à faire, section 12.14) ; toujours 1 avec une arme |
| Préparations simultanées contre le héros | 2 contacts + 2 lancers | min(4, 2 + ⌊P ÷ 4⌋) contacts et autant de lancers (pierres et bouteilles), avec fenêtres lisibles |
| Dégâts par coup ennemi au contact | 5 | min(12, 5 + ⌊P ÷ 2⌋) ; pierres : 5 fixes ; flaque de feu : 4 toutes les 0,5 s |
| Intervalle individuel d’attaque | 1,8 s au contact, 3 s entre deux pierres, 5 s entre deux bouteilles sur Paul | Fixe aujourd’hui ; pas moins de 1,2 s si on l’accélère ; préparation toujours visible |
| Casseurs de manche sur la carte | Entrée un par un toutes les 1,5 s | Entrée suspendue à 12 hostiles actifs ; plafond technique de 40 hostiles actifs, agresseurs compris |
| Étudiants en déplacement (à faire, section 10.8) | Jusqu’à 5 | 5 |

Les augmentations de dégâts ou de résistance sont annoncées par l’apparence, le statut ou la jauge, sans bonus aléatoire incompréhensible. Les statistiques des rôles renforcés sont une variation de difficulté séparée. Les rôles de lanceur ou de dégradeur sont indépendants de la variante visuelle.

Un plafond d’agents est un plafond de calcul, pas une fin d’assaut : le directeur garde des renforts en file d’entrée et les fait entrer après libération d’une place. Les agents survivants d’un objectif perdu occupent ces places. Aucun adversaire actif ne doit être supprimé silencieusement pour résoudre le problème.

### 12.4 Anti-stagnation

Le joueur peut quitter un objectif, mais pas attendre indéfiniment dans un refuge invulnérable en gagnant des points ou des soins. Les ennemis actifs poursuivent le héros selon leur rôle. **Modifié (v1.9.11, aligné sur le jeu) :** pendant une manche, si aucun hostile n’est actif ni en attente pendant 1,5 s, le directeur fait entrer aussitôt le groupe suivant, ou à défaut un casseur de patrouille hors effectif (RC-94), sous le même plafond d’agents ; la règle ne joue pas pendant la courte fin d’un secours sécurisé ni pendant le répit, où les patrouilles s’en vont. L’ancienne proposition d’une patrouille après 20 à 30 s d’inaction est remplacée.

La patrouille n’entraîne ni gain de points gratuit ni soin automatique. Les KO augmentent la pression. Les bonus d’objectifs restent liés à des occurrences uniques, pas au fait d’entrer et sortir d’un cercle.

### 12.5 Santé et petits soins

Santé maximale : 100. Aucune régénération passive automatique en normal. Le joueur doit repérer et atteindre des soins. Chaque ressource est un état de gameplay persistant pour la session, pas un effet qui réapparaît à chaque visite.

Deux points de soin sont proposés dans le quartier : trousse près d’un poste de secours et armoire ou trousse dans une arrière-boutique (livrés : deux stations « Soins », prises en passant à 28 px au plus). Les petits soins de terrain ci-dessous sont **livrés (v1.9.18)**. Ils sont signalés par un pictogramme médical accompagné d’un texte. Leur implantation laisse une voie de retrait sans garantir l’absence d’ennemis.

| Ressource proposée | Effet | Stock / obtention |
| --- | --- | --- |
| Point de soin | +25 PV appliqués au contact, sans dépasser 100 | Une charge par point et par manche, deux points au départ |
| Petit soin de terrain (livré, v1.9.18) | +10 PV (`CONFIG.fieldHeal`) | Un soin après chaque tranche de 8 KO éligibles (KO du remplissage de la manche, victimes de domino comprises, jamais les patrouilles ; le décompte repart de 0 à chaque manche, le compteur de tranches est conservé) ; au plus deux au sol ; chaque soin disparaît 20 s après sa pose |
| Réapprovisionnement de manche | Restaure les charges des deux points de soin | Une fois à la fin de la manche, pas au simple retour au point |

Les quantités sont à équilibrer. Les deux points ne donnent pas un soin complet ; la santé n’est pas remise à 100 après un objectif ou une manche.

### 12.6 Soin au contact

**Confirmé :** marcher sur un point de soin chargé applique immédiatement +25 PV, plafonnés à 100, et consomme sa charge de la manche. Aucune touche, aucun maintien, aucune interruption possible. La charge et le gain de santé sont appliqués ensemble, une seule fois, par identifiant de charge.

À pleine santé, aucune charge n’est consommée et l’interface indique « Santé au maximum ». Station utilisée : « Épuisé » jusqu’à la manche suivante. Une station ne remet pas les ennemis à zéro et ne suspend pas le combat.

Une trousse chargée flotte et pulse doucement (petite animation) pour être repérée de loin ; une station épuisée reste immobile.

**Livré (v1.9.18) :** le petit soin de terrain (trousse réduite à 0,625, lueur verte, étiquette « +10 », flottement) se pose sur une tuile dégagée à 48–112 px de Paul, à 14 px au moins de tout solide, hors du groupe pacifique, avec une ligne dégagée vers Paul et jamais sur un autre soin ; les tirages ont un flux aléatoire propre. Il se ramasse en passant à 20 px au plus, seulement sous la santé maximale (à pleine santé il reste au sol) ; le gain réel est plafonné à 100 PV, un « +N PV » vert flotte au-dessus de Paul et le son de ramassage retentit. Rien n’est pris si Paul est KO ou la session terminée. Il **expire 20 s après sa pose** : il clignote pendant les 3 dernières secondes, comme les armes, puis disparaît. Aucun indicateur de bord d’écran.

Quand deux petits soins sont déjà au sol, **un seul soin peut attendre** : la tranche suivante se pose dès qu’une place se libère. Le reste du compteur est conservé et plafonné à 15 KO (2 × 8 − 1), de sorte que libérer des places ne déclenche jamais une pile différée. Un objet porte un identifiant unique empêchant la double consommation.

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
| Manche terminée | Répit de 6 s avec le panneau « Manche N terminée » non bloquant, stations rechargées, puis manche suivante ; santé, score et arme conservés |
| Pause | Session suspendue, aucun résultat validé |
| Arrêt volontaire | Bilan marqué « Session interrompue volontairement » |
| Problème technique irrécupérable | Sortie technique signalée, pas de fausse défaite enregistrée |

Un KO ne doit pas être annulé par un soin traité plus tard dans le même pas. Ordonner les contacts, les dégâts, la vérification du KO, puis les interactions encore valides. Un événement terminal empêche les nouveaux gains après ce point.


### 12.10 Événements dynamiques de secours

Le terme de conception est **événement dynamique** ou **rencontre aléatoire**. Il s’agit d’un incident court qui apparaît pendant l’exploration et invite à changer temporairement de priorité.

Trois variantes proposées ; les deux variantes livrées sont tirées à pile ou face à chaque secours (**modifié v1.9.12 :** tirage fait à la préparation du secours, au début de la manche, pour que l’annonce d’une manche de secours nomme la bonne variante ; « RescueStarted » porte la même) :

| Rencontre | Mise en scène | Intervention |
| --- | --- | --- |
| Groupe pacifique harcelé (livré, « AGRESSION EN COURS ! ») | Deux à quatre casseurs en manche 1, trois ensuite, menacent une personne | Neutraliser les agresseurs ; la victime remercie (« MERCI ! ») |
| Personne âgée victime de vol (livré, « VOL EN COURS ! ») | Une personne âgée menacée, casseurs à proximité, objets personnels volés (section 12.12) | Neutraliser les agresseurs ; la victime remercie, sans action supplémentaire |
| Manifestante agressée ; couple âgé (à faire) | Victime en détresse, animation d’intimidation ou de recul ; deux civils pour le couple | Intervenir avant l’expiration puis prise en charge |

**Ajouté (v1.9.5, demande du porteur du projet) :** dans chaque secours, la victime se fait peu à peu voler ses affaires pendant l’agression, et Paul peut les lui rapporter (section 12.12, « Objets volés à rendre »). Uniquement des objets personnels ordinaires (sac, chapeau, canne, lunettes, écharpe, casquette, sac à dos) : jamais de vêtement porté, de déshabillage, de nudité ni rien de dégradant, ni dans les sprites, ni dans les textes, ni dans les bulles.

Ces rencontres sont fictives. Les anecdotes citées par l’utilisateur servent d’inspiration narrative ; le cahier ne les présente pas comme des faits historiques vérifiés. Le gameplay ne nécessite ni reproduction d’une blessure au visage, ni nudité, ni recette ou simulation détaillée d’un dispositif incendiaire. La violence est rendue par détresse, recul, appel à l’aide et menace lisible.

### 12.11 Déclenchement et équité

Le directeur choisit un emplacement atteignable, hors obstacle et hors groupe encombrant un passage obligatoire. L’événement n’apparaît pas sous les pieds de Paul. Alerte visuelle, direction, distance et délai sont disponibles dès le début, y compris hors écran : bannière d’alerte à l’apparition (« AGRESSION EN COURS ! » ou « VOL EN COURS ! ») puis indicateur en bord d’écran (section 14.1). Dès que Paul arrive, la victime affiche une bulle « À L’AIDE ! ».

Délai livré : 25 s de menace effective pour un secours (`rescue.threatSeconds` ; fourchette proposée de vingt à trente secondes). Le délai minimal doit couvrir le trajet praticable, une confrontation raisonnable et une marge de réaction. Le trajet est calculé sur la navigation, pas à travers les bâtiments : le lieu du secours est tiré parmi ceux situés à 300–900 px de trajet de Paul (à défaut, le plus proche au-delà de 300 px).

Plafond livré : un incident urgent à la fois en manches 1 et 2, puis au plus deux, bâtiments, secours et monument confondus. Ne pas déclencher deux incidents impossibles à atteindre successivement. Les objectifs ordinaires sans échéance peuvent rester actifs en parallèle.

Le directeur varie les types, lieux et groupes ; il évite de répéter immédiatement le même scénario. Les agresseurs utilisent le même plafond de quarante hostiles que les hordes. Les victimes sont prises dans un groupe existant si possible ; le nombre de personnages supplémentaires reste borné.

Une fenêtre de repos entre rencontres et une sélection pondérée suffisent en V1. L’apparition aléatoire est contrôlée : aucun besoin d’une génération procédurale complète ou d’un scénario tiré sans tenir compte de la position du joueur.

### 12.12 Détresse, secours et échec local

La protection contre Paul est permanente : ses coups et ses pierres ne blessent jamais ces victimes. En revanche, les agresseurs désignés peuvent faire avancer une **jauge de détresse / un compte à rebours de secours**, uniquement dans l’événement concerné. Les autres passants ne deviennent pas subitement vulnérables à toute la foule.

La menace à portée est un état continu pendant l’intimidation ou le cycle d’agression, pas seulement l’image d’impact. La jauge et le délai affiché représentent une seule réserve autoritaire, sans seconde santé cachée pour la victime.

Le délai décroît tant qu’au moins un agresseur de cet événement exécute une menace valide à portée de la victime ; il se suspend si cette menace est interrompue. Ne pas retirer une seconde barre de vie indépendante au même rythme : une source de vérité par incident.

Tous les agresseurs affectés KO avant zéro (coup ou pierre renvoyée, peu importe) : menace arrêtée, délai figé, et le secours se termine **automatiquement** : aucune touche, aucun maintien, aucune distance à respecter. La victime affiche une bulle « MERCI ! » environ 1,5 seconde (paramètre `rescue.thanksSec`), puis le secours est validé et le bonus accordé une seule fois, proposé à +6 par événement, indépendamment du nombre de victimes. La pause suspend aussi ce court délai.

Bulles de la victime (pixel art, police pixel, au-dessus de la tête) : « À L’AIDE ! » en rouge avec un léger rebond saccadé tant qu’elle est menacée ; « MERCI ! » en vert une fois sauvée, jusqu’à ce qu’elle s’éloigne ; aucune bulle en cas d’échec. Jamais de marqueur d’ennemi sur la victime.

**Objets volés à rendre (v1.9.5, demande du porteur du projet).** La victime porte trois objets personnels ordinaires : « sac à main », « chapeau », « canne » (personne âgée volée) ou « sac à dos », « écharpe », « casquette » (groupe harcelé). Quand la réserve de détresse passe à 75 %, 50 % puis 25 % (`rescue.theftAt`), l’agresseur actif le plus proche de la victime lui prend l’objet suivant et l’emporte (petite icône pixel au-dessus de sa tête) ; aucun vol sans agresseur debout à ce moment, donc des agresseurs neutralisés avant un seuil = objet jamais volé. Un voleur KO lâche l’objet au point libre le plus proche (jamais dans un obstacle) : l’objet flotte au sol avec un léger halo. Paul le ramasse en passant dessus (20 px, `rescue.pickupRadius`, jusqu’à trois, sans conflit avec l’arme ni la caisse à outils ; ligne « OBJETS N » de la liste de score) puis, à 48 px de la victime au plus (`rescue.returnRadius`), lui rend d’un coup tout ce qu’il porte : +2 par objet (`rescue.itemBonus`, une seule fois par objet et par secours) et bulle « MERCI ! ». Aucune touche.

Sécurisé alors qu’un objet volé n’est pas revenu (au sol ou porté par Paul) : la victime attend ses affaires jusqu’à 12 s (`rescue.returnSec` ; carte « Rends les objets · 8 s », indicateur en bord d’écran vers la victime tant qu’un objet est au sol ou porté), puis les 1,5 s de « MERCI ! » et le bonus de +6 une fois, comme avant ; tout rendu = les 1,5 s commencent aussitôt. Les objets non rendus à l’issue de l’attente sont simplement perdus, sans pénalité ; les objets au sol disparaissent quand le secours se termine. Secours manqué : les objets emportés, au sol ou portés sont perdus, rien d’autre ne change. Cette attente est une fin d’objectif minutée : elle n’ajoute aucun casseur et la manche se clôt toujours à K = T. La carte du secours affiche « Objets 1/3 rendus » (rendus / objets de la victime) dès le premier vol. Les agresseurs d’un secours ne quittent plus la victime d’eux-mêmes quand peu de casseurs restent (section 9.2, « Attirés par Paul ») : seul Paul qui s’approche les détourne. Bulles : « MON SAC ! » (« MON CHAPEAU ! », « MA CANNE ! », « MON SAC À DOS ! », « MON ÉCHARPE ! », « MA CASQUETTE ! ») environ 2 s après un vol, et pendant l’attente pour le premier objet manquant ; « MERCI ! » à chaque remise. Son de ramassage à la prise, carillon à la remise. Pas de nouvelle bannière.

À zéro avant sécurisation : secours manqué, bonus perdu, session continuée. La victime passe dans un état de repli ou de prise en charge par les secours ; pas de mort graphique ni de nudité. Les agresseurs restants redeviennent des hostiles ordinaires. L’échec n’incrémente pas le compteur de casseurs neutralisés et ne remet pas la santé de Paul à zéro.

Un secours ne réapparaît pas par entrée/sortie de zone. Une personne déjà secourue n’est pas choisie de nouveau immédiatement. Les KO des agresseurs sont comptés une seule fois, avec le barème ordinaire ; le bonus d’événement est distinct.

### 12.13 Délais locaux et mode arcade

Les délais de bâtiment, détresse, capture et interaction n’imposent aucune durée totale de partie. Leur expiration affecte seulement l’incident concerné. Pause, aide, cinématique et perte de focus suspendent tous les délais et toutes les actions hostiles.

La réduction de qualité graphique ne modifie pas ces délais. Un mode découverte peut les allonger explicitement avec record séparé. Le HUD réserve les nombres d’urgence aux incidents actifs, sans remettre une case globale « Temps restant ».

### 12.14 Nouveaux ennemis et armes de la phase B (livré)

Exigences issues de la conception de la tranche 2 « Fun » (sections 2, 4 et 5 de la [conception](superpowers/specs/2026-10-20-slice-2-fun-design.md)) ; les ennemis arrivent progressivement pour casser le « toujours plus de casseurs ». **Livré (v1.9.13) :** coureur, costaud et « Le Caïd », avec leurs règles de dégâts ; **livré (v1.9.15) :** tireur AK-47 cartoon et ses balles, flashball, gant de boxe à ressort ; les autres éléments déjà livrés de la phase B (bouclier, jauge d’énergie avec l’onde d’énergie et le mode furie — v1.9.14, ils ne se ramassent plus —, lanceurs sur Paul) sont décrits aux sections 8.8, 8.9 et 10.9. La phase B est entièrement livrée. Tous ces casseurs font partie de l’effectif de la manche et remplacent des places du remplissage sans l’augmenter (+1 chacun au KO, quelle que soit sa variante, sauf le bonus propre du Caïd) ; les variantes cosmétiques restent distribuées à tour de rôle, jamais liées à un rôle.

| Ennemi | À partir de | Comportement | Lisibilité | Statut |
| --- | --- | --- | --- | --- |
| Coureur (`runner`) | Manche 3 | Au contact, vitesse ×1,6, 1 PV. Chaque manche, une **meute** de 4 + (manche mod 3) coureurs (4 à 6) est prise sur le remplissage : un groupe à elle (le deuxième groupe quand le reste en fait au moins deux, sinon le premier), qui entre serrée (0,8 s d’intervalle), sans bannière ; lanceurs de pierres et lanceurs sur Paul sont répartis sur le reste du remplissage | Silhouette LPC plus claire à capuche (`rioter_runner_a/b`), marche accélérée, petites bouffées de poussière | Livré (v1.9.13) |
| Costaud (`brute`) | Manche 4 | Au contact, vitesse ×0,75, 4 PV ; un coup qui touche repousse Paul de 28 px (déplacement bloqué par les obstacles, aucun dégât en plus). Un par manche, deux dès la 6, trois dès la 8 (plafond), sur des places « contact » du remplissage | Sprite ×1,25, casque d’acier, barre de vie rouge dès qu’il est touché, impact plus grave | Livré (v1.9.13) |
| Tireur AK-47 (cartoon, `shooter`) | Manche 6 | Se tient à 220–300 px de Paul avec une ligne dégagée (sinon s’approche, recule s’il est trop près) ; vise 0,8 s l’endroit où se trouve Paul au début de la visée, puis tire une rafale de 3 balles espacées de 0,12 s **le long de cette ligne fixe** (Paul qui bouge l’esquive), recharge 3 s ; Paul à moins de 100 px : il se bat au contact ; 3 PV (une arme ordinaire le met KO d’un coup, trois coups à mains nues). 1 tireur aux manches 6–7, 2 aux manches 8–9, 3 dès la 10 (v1.9.24 ; 3 au plus par manche), sur des places « contact » du dernier groupe de remplissage (l’apogée) | Fusil pixel sombre dessiné à l’exécution, relevé le long de la ligne pendant la visée ; ligne de visée rouge fine avec une croix là où était Paul (et flèche de bord d’écran s’il est hors champ) ; « ! » au-dessus de la tête ; petite bouffée jaune à la bouche du canon ; balles en petits traits jaunes ; aucun sang, aucune douille | Livré (v1.9.15) |
| « Le Caïd » (`boss`, mini-boss) | Manche 3 | Au contact, vitesse ×0,9. **Modifié (v1.9.16, demande du porteur du projet : « pour les caïds, ils doivent être un peu plus résistants, là c’est un peu trop facile ») :** PV qui montent avec la manche, 14 + ⌊(manche − 3) / 2⌋ × 2, plafonnés à 26 (`caid.hp`, `hpStep`, `hpEvery`, `hpMax` : 14 en manches 3–4, 16 en 5–6, … 26 dès la 15) ; dégâts reçus selon la source (`caid.damageFrom`, ci-dessous) ; il frappe plus fort : dégâts au contact ×1,5 arrondis (`damageMul`), Paul repoussé de 52 px (`knockback`, 40 avant), un coup toutes les 0,85 × l’intervalle des casseurs (`attackIntervalMul`). Il **clôt chaque manche** dès la 3 : dernier casseur du dernier groupe de remplissage (il compte dans l’effectif ; si le remplissage est vide, il est ajouté comme dernier casseur et l’effectif augmente de 1). KO : +1 comme tout casseur, **+5** une fois (`caid#<manche>`, à sa position) et, **modifié (v1.9.16) :** une fois sur deux (tirage à graine, `caid.dropShare`), une arme ordinaire tirée au sort tombe à sa place (sans indicateur, disparaît après 15 s ; aucune si une arme est déjà au sol à 200 px de Paul). **Modifié (v1.9.20) :** un Caïd mis KO ne disparaît plus tout à fait : tant que la prison tient, un fourgon l’emmène et il est **enfermé** (section 12.17, quelle que soit la source du KO, y compris la police ou un gardien) ; si la prison est en ruine, il reste simplement KO comme avant. La prison détruite les libère : ils reviennent alors comme Caïds de la manche en cours | Sprite ×1,5, couronne dorée, barre de vie rouge toujours visible, **segmentée (v1.9.16)** : un segment par 2 PV (13 au plus) séparés d’un pixel sombre, pour lire la progression ; bref éclair blanc et impact plus grave à chaque coup reçu ; bannière courte sans flèche « LE CAÏD ARRIVE ! » / « Mets-le KO » à son entrée et indicateur de bord d’écran « CAÏD » (couronne) tant qu’il est debout, retirés à son KO ; fourgon de la prison et « BOUCLÉ ! » (v1.9.20) | Livré (v1.9.13) |

**Dégâts (v1.9.13, modifié v1.9.16).** Mains nues : 1 dégât par coup. Arme ordinaire tenue (bâton, marteau, panneau, gant, flashball) : KO en un coup, sauf sur un costaud ou le Caïd, qui ne prennent que 2 dégâts (`toughWeaponDamage` : deux coups pour un costaud). Mode furie et onde d’énergie : KO immédiat de tous (dégâts 99), sauf le Caïd. Pierre renvoyée : 1 dégât. La bulle du bouclier ne blesse personne (plus de coup de bouclier, v1.9.16). **Le Caïd** prend ses dégâts de la table `caid.damageFrom` : mains nues 1, coup d’arme tenue, tir de flashball ou coup de gant 2, pierre renvoyée 1, coup du mode furie 5, onde d’énergie 10, bulle 0 ; soit, en manche 3 (14 PV), 14 coups à mains nues, 7 au bâton, 3 en mode furie, 2 ondes. Les règles du costaud ne changent pas. Le `HitConfirmed` d’un costaud ou du Caïd est marqué « lourd » (son d’impact plus grave), et le `PlayerDamaged` d’un coup qui repousse porte le déplacement (`push`).

**Balles (v1.9.15).** 260 px/s, 3 px de rayon, 1,6 s de vol au plus ; 8 dégâts à Paul par le chemin normal des dégâts (images d’invulnérabilité : une balle qui arrive pendant celles-ci le traverse ; mode furie : moitié) ; arrêtées par bâtiments, mobilier, troncs, socle du monument (étincelle d’impact), par le groupe pacifique et la victime (sans les blesser) et par la bulle du bouclier de tous les côtés (`ShieldBlocked`, la balle disparaît) ; elles ne touchent jamais un casseur ; au plus 30 en vol (une balle au-delà n’est pas tirée).

**Armes (v1.9.15, valeurs de la section 8.7)** : armes ordinaires (sans indicateur de bord d’écran), avec la règle de dégâts ci-dessus (2 sur un costaud ou le Caïd, KO des autres). **Flashball** (« Flashball (6) ») : tir visé à la souris, vers l’orientation au tactile avec une légère aide à la visée, KO d’un coup, arrêté par les murs, le groupe pacifique et la victime ; un tir usé par appui, touché ou non. À l’entrée du **premier tireur de la partie** (manche 6), un flashball est posé à 120–220 px de Paul (il ne disparaît pas) avec une bannière courte d’une ligne « FLASHBALL AU SOL » (flèche et distance, retirée dès qu’il est ramassé). **Gant de boxe à ressort** (« Gant de boxe (6) ») : coup de poing à ressort de 160 px en ligne droite, KO et repoussement de 32 px du premier casseur touché (corps projeté), bulle « BOING ! ». En mode furie, Frapper reste le coup du mode furie avec ces deux armes (rien n’est usé). La règle « jamais d’arme à feu » est levée pour ces seuls éléments, en style cartoon, sans sang ni gore (EX-07).

### 12.15 Chutes de KO et effets de coups de la phase D (livré, v1.9.17)

Exigences issues de la section 6 de la [conception](superpowers/specs/2026-10-20-slice-2-fun-design.md). **Livré (v1.9.17) :** les chutes de KO par source, les chutes rares « WTF », l’effet domino, les onomatopées par source, la secousse, le gel d’impact doublé sur un KO « WTF » et le comportement `prefers-reduced-motion`. **Déjà livré avant :** l’envol en tourbillon des KO du mode furie (section 8.8), la satellisation de l’onde d’énergie (section 8.9), les bulles « POW ! » / « BOUM ! » du mode furie, les points flottants (section 14.1) et trois variantes de son d’impact. **Reste à faire :** la hauteur de son légèrement aléatoire et les étoiles d’étourdissement qui précèdent la disparition du corps (un corps KO reste allongé et atténué).

**Chute par source (simulation, `src/sim/falls.ts`).** Chaque `ActorKnockedOut` porte une `fall` (`kind`, `wtf`, `dir`), choisie par la simulation sur un **flux aléatoire séparé** (`fallRand`, graine `seed ^ 0x9e3779b1`) : trois tirages à chaque KO (jet « WTF », sous-type, variante), quelle que soit la branche, pour que le flux reste aligné. La source du KO est donnée par l’appelant du coup : mains nues, arme tenue, pierre renvoyée, mode furie, onde, flashball, gant ou corps tombant (domino). `dir` est la direction du lancer s’il y en a un, sinon la direction qui éloigne le corps de Paul (celle du coup pour une victime du domino).

| Source | Chute | Rendu |
| --- | --- | --- |
| Mains nues | `crumple` ou `spin` (variante, une chance sur deux) | tassement debout (écrasement) puis pose allongée ; ou un tour sur soi au sol |
| Panneau, bâton | `flyspin` | saut d’environ 70 px le long de `dir`, un tour et demi, poussière à l’atterrissage |
| Marteau | `pancake` | aplati (×1,5, ×0,15) 500 ms puis qui se redresse avec un rebond et un petit saut, « SPLOTCH » |
| Gant | `bounce` | le vol existant du lancer, avec « BOING ! » à l’atterrissage |
| Flashball | `backflip` | arc arrière de 40 px avec un tour complet |
| Pierre renvoyée | `wobble` | trois oscillations amorties debout puis bascule à 90° |
| Mode furie, onde | `flyspin` (inchangé : le vol du lancer, section 8.8 et 8.9, reste joué) | envol et satellisation existants |
| Caïd | toujours `crumple` | tassement, plus forte secousse ; son lancer éventuel (furie, onde) reste joué |

**Chutes rares « WTF » (`CONFIG.falls.wtfChance` = 0,1).** Un KO sur dix, jamais le Caïd, jamais un corps lancé (furie, onde, gant), jamais une victime de domino. Sous-type uniforme parmi cinq : `tripleflip` (trois saltos, arc de 60 px, 60 px de course), `helicopter` (monte de 60 px à la verticale en tournant cinq fois, puis retombe), `faceplant` (petit saut puis glissade à plat ventre d’environ 90 px avec traînée de poussière), `trashcan` (plonge la tête la première dans une poubelle dont les jambes dépassent environ 1,5 s, puis la poubelle s’efface et le corps reste à côté ; sans poubelle libre dans le réservoir de 3, le corps s’allonge simplement) et `domino`.

**Effet domino (seul effet de simulation).** Le corps `domino` vole de 80 px avec deux tours. Au moment de son KO, la simulation émet `DominoTriggered` (`from`, `lifeIds`) puis fait tomber jusqu’à `CONFIG.falls.dominoMax` = 2 casseurs vivants non boss à moins de `CONFIG.falls.dominoRadius` = 56 px du corps, les plus proches d’abord (égalité : plus petit `lifeId`). Chaque victime est un vrai KO (source « knocked », chute `knocked` : debout 150 ms puis bascule le long de `dir`), compté +1 et remplissant la jauge d’énergie (sauf en mode furie). **Pas de chaîne** : une victime ne déclenche pas d’autre domino. **Jamais le Caïd**. Sans voisin à portée, le domino devient un `faceplant`. Les victimes n’émettent pas de `HitConfirmed`. Bulle « DOMINO ×N ! » (grande).

**Onomatopées.** Une bulle pixel à chaque coup, selon la source : « POW ! » / « PAF ! » (mains nues), « BONK ! » / « TCHAC ! » (bâton), « SPLOTCH ! » / « SPLATCH ! » (marteau), « BOING ! » / « BOÏNG ! » (gant), « PIOU ! » / « PIOU PIOU ! » (flashball), « TOC ! » / « BLONK ! » (pierre), tirée dans le rendu seul (`Math.random`). Sur un coup qui met KO dans le même lot, le mot du KO remplace celui du coup ; l’onde et le gant ne disent rien au coup (rayon avec son effet, le coup du gant dit déjà « BOING ! »). Les chutes WTF affichent « WTF !? », « OUPS ! », « WOUAAH ! » ou « NOOON ! » en grande bulle (×1,5, durée plus longue).

**Secousse d’écran.** Mains nues : 1 px pendant 80 ms ; arme, pierre ou flashball : 2 px pendant 110 ms ; KO « WTF », KO du Caïd ou domino : 4 px pendant 240 ms. Une secousse plus faible ne coupe jamais une plus forte.

**Gel d’impact.** 60 ms à chaque coup ; **doublé (120 ms) sur un KO « WTF »**. La chute démarre à la fin du gel.

**Mouvement réduit (`prefers-reduced-motion`).** Aucune secousse ; tous les gels divisés par deux (30 ms, 60 ms sur un KO « WTF ») ; chutes à 0,6 de leur durée, sans tour, saut ni oscillation ; la course, la crêpe et la poubelle restent.

**Coût et plafonds.** Les chutes sont **cosmétiques**, sauf le domino (section 18.3) : elles ne changent ni la santé, ni le score propre au corps, ni l’IA. Au plus **8 corps animés** à la fois (`MAX_FALLS`) : au-delà, le corps reste allongé sans animation. 3 poubelles au plus dans le réservoir, 10 bulles de mots. La course d’une chute est limitée au sol libre (jamais dans un mur ni hors de la carte). Le calcul de pose (`src/game/render/fallMath.ts`) est pur et ne fait aucune allocation par image.


### 12.16 Services d’urgence : cabines, camion de pompiers et police (livré, v1.9.19)

Conception : [services d’urgence](superpowers/specs/2026-10-22-emergency-services-design.md), validée par le porteur du projet (« très bien, go pour ça » pour les pompiers ; « 3 de chaque » pour les utilisations). Valeurs de référence dans `CONFIG.services` (`src/sim/config.ts`) ; logique des appels dans `src/sim/services.ts`, des alliés dans `src/sim/allies.ts`, calculs de rendu dans `src/game/render/serviceMath.ts`. Les points marqués *(choix de Claude)* sont des propositions que le porteur n’a pas contredites. Anti-buts : aucun secours qui règle tout (appels limités), aucun camion ni policier invincible, aucune règle de maintien, aucun sang ni violence réaliste (matraque cartoon), aucune personne réelle.

**Cabines.** Deux cabines côte à côte : la **rouge** en R(4,22) appelle les pompiers, la **bleue** en R(5,22) appelle la police, sur la place dégagée du centre-ouest, présentes dès la manche 1 et utilisables à pied. *(emplacement : choix de Claude)* Elles sont des cibles comme un accessoire (« attaquées comme les autres constructions ») : 60 PV, points d’attaque, feu, ruine, réparation, points sauvé / perdu / réparé +4 / −2 / +3 *(valeurs : choix de Claude)*. Avant la manche 3 elles ne sont ni attaquées ni en feu ; elles entrent dans le tirage de la casse phare et de la seconde urgence dès la manche 3, et comptent comme des lieux pour la règle des deux urgences dès la manche 5. Une cabine en ruine ne s’utilise plus (« Cabine hors service ») ; les appels déjà dépensés ne sont pas rendus et, une fois réparée, la cabine redevient utilisable avec les appels qu’il lui restait.

**Appels.** 3 appels pompiers et 3 appels police par partie. Paul debout à 40 px au plus de la porte appuie une fois sur Agir (F, bouton « Appeler » sur téléphone) ; aucun maintien. Quand plusieurs actions sont possibles, la plus proche gagne ; à égalité, réparation > cabine rouge > cabine bleue ; si la cabine l’emporte, la caisse à outils ne reçoit pas l’appui. Une réparation ne compte contre une cabine que si elle pourrait démarrer (sans caisse à outils, une cabine rouge en feu appelle les pompiers). Refus, dans cet ordre, sans rien dépenser : « Cabine hors service », « Plus d’appels », « Déjà en route » (un camion ou un groupe de police du même type est encore sur la carte), « Aucun feu à éteindre » (pompiers : aucun lieu ne brûle, cabines comprises), « Pas assez de casseurs » (police : moins de 8 casseurs actifs, file d’entrée non comptée). Un appel accepté compte tout de suite, même si le camion est détruit ensuite. Un « ! » clignote sur la cabine quand l’appel serait accepté.

**Camion de pompiers.** Il arrive par un point d’entrée des casseurs tiré sur un flux aléatoire propre ; il suit le graphe de rues des casseurs avec une autre vitesse, sans bloquer personne (les casseurs peuvent le frapper au contact). Il roule jusqu’au lieu en feu le plus proche par chemin, se gare et lance sa lance : **tous les feux dans 80 px sont éteints ensemble** (deux cabines côte à côte d’un seul stationnement), 2 s par feu. Il enchaîne les feux tant qu’il en reste, puis repart par le bord le plus proche ; au plus 60 s sur la carte. **Il n’éteint que les feux** et ne répare jamais un lieu en ruine ; éteindre vaut les mêmes points « sauvé » que Paul (une seule fois par feu), et le lieu **garde les PV qui lui restent** (pas de remise à 100 %, contrairement à la caisse à outils). 60 PV : attaqué par les casseurs proches, il disparaît en fumée à 0 PV et l’appel est perdu. *(80 px, 60 s, 60 PV : choix de Claude)*

**Police.** 5 policiers de 1 PV arrivent d’un bord, sirène, courent sur les casseurs et les mettent KO à la matraque (+1 chacun, aucune énergie). Ils restent 40 s puis repartent ; un policier assommé est perdu, et le groupe s’en va dès que tous sont perdus. Lorsque le groupe a quitté la carte, la police est de nouveau appelable s’il reste des appels. *(40 s, fragilité : choix de Claude)*

**Ciblage et affrontements.** Rayon de 160 px pour le choix entre Paul, le camion et un policier ; priorité à l’objectif de lieu d’un casseur (RC-145). Les casseurs combattent donc la police d’eux-mêmes.

**Textes et signaux.** Alerte « CABINE SACCAGÉE ! » (section 14.1), sous-titre de manche « Cabine menacée », cartes HUD « Cabine rouge » / « Cabine bleue » ; invites « F — Appeler les pompiers » / « F — Appeler la police » ; lignes de la cabine « Pompiers en route ! », « Police en route ! » et les refus ci-dessus ; sirènes (section 16).

**Équilibre.** Les cabines changent le tirage dès la manche 3 : les graines existantes peuvent donner d’autres parties et les tests de tirage ont été réécrits. Plafonds existants (40 hostiles actifs) inchangés ; camion et policiers sont des alliés hors de ce plafond.

### 12.17 Prison : Caïds enfermés, gardiens et évasion (livré, v1.9.20 ; détenus visibles, v1.9.22)

Conception : [prison](superpowers/specs/2026-10-22-prison-design.md), validée par le porteur du projet (« c’est parfait »). Valeurs de référence dans `CONFIG.prison` et `CONFIG.casse` (`src/sim/config.ts`) ; logique dans `src/sim/prison.ts` (cellules, évasion, gardiens), `src/sim/allies.ts` (rôle `guard`) et `src/sim/director.ts` (`extend`) ; calculs de rendu dans `src/game/render/prisonMath.ts`. Les points marqués *(choix de Claude)* sont des propositions que le porteur n’a pas contredites. Anti-buts : prison indestructible ou trop facile à perdre, gardiens qui bloquent le jeu, aucune personne réelle ni référence à un individu.

**Pourquoi.** Le Caïd était un mini-boss qui disparaissait après son KO. La prison donne une suite à ce KO (les Caïds capturés sont conservés) et un enjeu : si elle tombe, tous les Caïds enfermés reviennent d’un coup.

**Bâtiment.** La prison est le bâtiment 11, au sud-est, R(38,36,6,6), seul bloc libre de ce côté de la carte, atteignable à pied depuis le point d’apparition de Paul et depuis chaque entrée des casseurs. Porte en C(41,42) sur la rangée de rue 42, points d’attaque en C(39|40|42|43, 42). *(emplacement : choix de Claude)* C’est un bâtiment, pas un accessoire, à **400 PV** (`CONFIG.prison.hp`, quatre fois un bâtiment). Attaque, feu, ruine, réparation comme un grand bâtiment (Molotov, dégradeurs, section 10) ; points sauvé / perdu / réparé **+8 / −3 / +5** (`CONFIG.casse.scores.prison`). Elle entre dans le tirage de la casse phare **dès la manche 4** (`CONFIG.casse.fromRound.prison` = 4, `CONFIG.prison.fromRound`) et dans la seconde urgence dès la manche 4 ; elle compte pour la règle des deux urgences de la manche 5 et suivantes (section 12.2). À la fin de chaque manche, une prison intacte retrouve ses 400 PV comme tout lieu intact.

**Emprisonnement.** Un Caïd mis KO **tant que la prison tient** est enfermé (`CaidJailed`, `lifeId`) : une seule fois par vie, **quelle que soit la source du KO** (Paul, la police de la cabine bleue, un gardien). Le +1 et le +5 du Caïd sont inchangés (section 13). Aucune règle de score nouvelle. Si la prison est en ruine au moment du KO, le Caïd est simplement KO comme avant et **n’est pas** enfermé. La prison compte les Caïds enfermés (`Snapshot.prison.jailed`) et garde **l’identité de chacun** (`Snapshot.prison.inmates`, dans l’ordre d’entrée : `id` stable jamais réutilisé dans la partie, `variant` = son apparence sur la carte, classique / palestinien / antifa, `round` = manche où il a été enfermé ; `jailed` vaut toujours le nombre de détenus) *(v1.9.22)* ; elle est vide au départ et après une reconstruction. **Le fourgon emporte le corps** *(v1.9.22)* : le corps KO d’un Caïd enfermé quitte la carte `CONFIG.prison.pickupSec` = 1,6 s après son KO (il sort de la liste des hostiles), même si la prison tombe entre-temps ; un Caïd KO alors que la prison est en ruine reste au sol comme avant.

**Évasion.** Au pas où la prison cesse de tenir (0 PV, par feu, bouteille ou casseurs), **tous** les Caïds enfermés sortent **en même temps** devant la porte, répartis sur deux rangées de 12 px d’écart (`PrisonBreakout`, `count`, `pos`), et visent Paul. Chacun a les PV d’un Caïd de la manche en cours, le rôle `boss` et **la même apparence (`variant`) qu’au moment de son KO**. Ils sont ajoutés à l’effectif T de la manche par `Director.extend(n)` (`RoundTotalChanged` ; K reste ≤ T et chaque Caïd libéré doit être mis KO de nouveau, avec le barème du KO d’avant : +1, et le +5 selon sa clé `caid#<manche>`) ; pendant le répit, ils sont étiquetés de la manche suivante et comptés dans son T quand elle commence. Ils rejoignent la liste des casseurs de la manche (pas le remplissage). Un Caïd que le plafond de 40 hostiles refuse sort à un pas suivant (il est déjà compté dans T). **Si personne n’est enfermé, la chute de la prison ne libère rien** (ni événement `PrisonBreakout`, ni changement de T).

**Gardiens.** 5 gardiens (`CONFIG.prison.guards`), alliés de rôle `guard`, postés aux cinq points de `PRISON_POSTS` autour du bloc, chacun à moins de 160 px de la porte : C(37,40), C(38,43), C(41,43), C(44,43), C(44,40). Ils ne font **rien d’autre** que défendre la prison : ils ne visent que les casseurs à moins de 160 px de leur poste (`postRadius`) et ne s’éloignent jamais de ce cercle. Vie = celle d’un Caïd de la manche en cours (`guardHp(manche)` = max(14, PV du Caïd), soit 14 en manches 1 à 4, 16 en 5–6, … 26 au plus), donc « la même barre de vie que les Caïds ». **À mains nues : 1 PV par coup** (`damageFrom.hands` du Caïd), et non à la matraque de la police. *Raison (choix de Claude, mesuré) :* avec la matraque, qui met un casseur ordinaire KO en un coup, les gardiens rendaient la prison intouchable dans les parties du robot de test (graines 1 à 6, manches 4 à 11 : jamais en feu, 399 PV au plus bas, aucun gardien KO, toutes les attaques sauvées), ce qui contredit l’anti-but « prison indestructible » ; à mains nues, le même essai donne des attaques sauvées, des feux qui couvent et 2 parties sur 9 où la prison tombe. Un gardien mis KO (`GuardDown`, `id`) est emporté après le délai habituel. **Au répit** (fin de chaque manche, `onBreather`), si la prison tient, tout gardien manquant ou KO revient à son poste (`GuardsBack`) et chaque gardien reçoit les PV de la manche suivante ; une prison en ruine n’en rappelle aucun, et ceux qui sont encore debout restent à leur poste (ils reviennent au répit suivant après reconstruction). Ils sont distincts de la police de la cabine bleue (qui reste à 1 PV, matraque et hors prison), présents dès la manche 1 (la première attaque de la prison est en manche 4, mais le premier Caïd tombe en manche 3), et **hors du plafond de 40 hostiles**.

**Reconstruction.** La caisse à outils reconstruit la prison comme tout bâtiment mais la **remet à 60 % de ses PV** (`CONFIG.prison.repairShare` = 0,6, soit 240 PV) ; les autres lieux restent remis à 100 %. *(60 % : choix de Claude, d’après le design ; propre à la prison.)* Les Caïds libérés **restent libres** ; la prison reconstruite est vide et enferme de nouveau un Caïd mis KO ensuite.

**Rendu et HUD.** Façade de béton gris à fenêtres à barreaux, porte d’acier, fil de fer barbelé, mirador avec projecteur qui balaie la rue (immobile avec la préférence de mouvement réduit) et drapeau, enseigne « PRISON » sur le toit ; variante en ruine (mirador réduit à un moignon, porte arrachée, barreaux tordus). Compteur « Caïds enfermés : N » sur le toit (il n’apparaît que tant que la prison tient et gonfle quand N monte). **Fourgon de la prison** sur `CaidJailed` : il s’arrête près du corps, là où il est dessiné (après sa chute ou son vol en mode furie), 600 ms après le KO ; **le corps est chargé** : le sprite couché disparaît de la rue quand le Caïd saute dans le fourgon (avec sa couronne), et il n’est plus jamais dessiné au sol (le simulateur le retire peu après, 1,6 s après le KO) *(v1.9.22 ; avant, le corps restait au sol et seule la couronne sautait)*. Le fourgon va ensuite à la porte et le dépose avec « BOUCLÉ ! » ; le compteur ne le compte qu’une fois entré (un Caïd en route n’en masque qu’un, et non deux comme avant la v1.9.22). Les fourgons en cours sont annulés si la prison tombe (le corps est alors retiré aussi). **Détenus visibles** *(v1.9.22, demande du porteur du projet)* : une cour de promenade au milieu du toit (`YARD`, `src/game/render/prisonMath.ts`), sol de béton et mur du fond, où les détenus se tiennent debout, face à la caméra, avec un léger balancement et un coup d’œil de côté de temps en temps (immobiles avec la préférence de mouvement réduit) : sprite du Caïd de sa variante à l’échelle 1 et sa couronne, **jusqu’à 8** sur deux rangées de 4 (centrées), « +N » à droite de la cour au-delà ; des barreaux sombres devant eux montrent qu’ils sont enfermés ; la cour et les détenus s’estompent avec le toit quand Paul passe dessous. Un Caïd n’y apparaît qu’une fois déposé à la porte. À l’évasion, les détenus de la cour courent vers la porte en 0,5 s (les vrais Caïds libérés y apparaissent), la cour reste vide, assombrie, barreaux arrachés au milieu et tordus, jusqu’à la reconstruction. **Point d’entrée des futurs skins :** `inmateTextureKey(inmate)` (`prisonMath.ts`) donne la planche de chaque détenu (aujourd’hui celle du Caïd de sa variante) ; c’est le seul endroit à changer pour des skins propres aux Caïds enfermés. Gardiens en uniforme gris, béret bordeaux, mains nues (poing levé au coup), avec une barre de vie segmentée verte d’un segment par 2 PV (toujours visible tant qu’ils sont debout). À `PrisonBreakout` : poussière, éclats d’acier, grosse secousse d’écran, bannière « ÉVASION ! » (sous-titre « N Caïds libérés », flèche et distance vers la porte, 3,6 s) ; chaque Caïd libéré a sa couronne, sa barre et son indicateur de bord d’écran « CAÏD » (aucune bannière « LE CAÏD ARRIVE ! » par Caïd). Alerte d’attaque « PRISON ATTAQUÉE ! » (section 14.1), sous-titre de manche « Prison menacée », carte HUD « Prison » avec la ligne « Caïds enfermés : N » tant que N > 0. Sirène de police au fourgon, choc lourd et alarme à l’évasion (section 16).

**Équilibre.** La prison change le tirage dès la manche 4 (graines existantes d’autres parties, tests de tirage réécrits) ; les gardiens sont toujours sur la carte (coût mesuré environ 0,25 ms par pas, section 19.2).

## 13. Score, compteur de casseurs neutralisés et bilan

### 13.1 Barème de référence

| Événement | Points | Statut |
| --- | ---: | --- |
| KO de casseur, quelle que soit sa variante ou son drapeau | +1 | Confirmé (révision 1.5), livré |
| Coup valide sur policier | −3 | Demande initiale ; sans objet tant qu’aucun PNJ touchable n’existe |
| Coup valide sur autre personne protégée hors groupe pacifique | −2 | Héritage conservé si ces PNJ sont touchables ; sans objet aujourd’hui |
| Tentative de coup ou renvoi vers groupe pacifique | 0 ; aucun contact de dégâts accepté | Protection confirmée dans la révision 1.2, livrée |
| École sauvée (tous ses casseurs KO sans feu) | +8 par occurrence | Livré |
| École détruite | −3 une fois par occurrence, sans fin de session | Livré |
| Boutique de jeux rétro sauvée / détruite | +6 / −2 par occurrence | Livré (v1.9.4) |
| Voiture ou abribus sauvé / détruit | +4 / −2 par occurrence | Livré (v1.9) |
| Réparation d’une ruine ou extinction d’un feu par caisse à outils | +5 école, +4 boutique, +3 voiture ou abribus ; une fois par ruine ou par feu, sans le bonus de sauvetage de la même occurrence | Livré (v1.9.1) |
| Secours réussi | +6 par événement, une seule fois | Livré |
| Objet volé rendu à la victime | +2 par objet, une fois par objet et par secours | Livré (v1.9.5) |
| Secours manqué | Aucun bonus ; pas de défaite globale | Livré |
| Monument défendu (tous les occupants KO avant le remplacement) | +4 par occurrence | Livré (v1.9.4) |
| Drapeau du monument remplacé | −3 une fois par occurrence | Livré (v1.9.4) |
| Drapeau du monument repris (capture) | +10 par remplacement | Livré (v1.9.4) |
| Boutique dégagée puis rouverte (rideau) | +4 puis +5 par occurrence | Brief initial, non livré (section 23.1) |
| Manche dont tous les objectifs sont réussis (un lieu qui brûle encore mais tient debout compte comme réussi) | +5 une fois à sa clôture | Livré (v1.9) |
| « Le Caïd » mis KO | +5 en plus du +1, une fois par manche (clé `caid#<manche>`) ; inchangé quand il est enfermé (v1.9.20) : aucun point de plus ni de moins pour l’emprisonnement, ni pour l’évasion | Livré (v1.9.13) |
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

Bilan livré (« Résumé de la partie », **modifié v1.9.12**) : cause (« KO » ou « Session interrompue volontairement »), score, record, manche atteinte, manches parfaites, casseurs neutralisés, lieux sauvés / détruits, lieux réparés, **école en comptes de session** (« 2 sauvées · 1 perdue » ; « — » si aucune attaque d’école n’est réglée), **secours en comptes** (« 3 réussis · 1 raté » ; « — »), objets rendus, défenses du monument, drapeaux perdus, drapeaux repris, soins utilisés, pierres ramassées / renvoyées / touchées, durée active, et « Nouveau record ! » (singulier pour 0 et 1). À faire : armes ramassées et brisées.

Le bilan affiche une ligne neutre, livrée sous la forme « Casseurs neutralisés : X » :

> X casseurs neutralisés

X est égal au compteur de la section 13.2. Les anciennes lignes satiriques du bilan sont supprimées (révision 1.5).

Un arrêt volontaire produit un bilan partiel identifié. Une proposition de record définitif de survie n’est validée qu’au KO ; un meilleur score provisoire d’une session arrêtée peut être conservé séparément, sans se confondre avec une session terminée par défaite.

### 13.4 Records

Records par version de règles et difficulté ; score comme classement principal, puis manche atteinte et éventuellement durée active en départage. Une durée plus longue n’apporte aucun point direct et ne doit pas encourager l’attente immobile. Les statistiques de projectiles récupérés, renvoyés et ayant touché peuvent figurer au bilan, sans gain de points par simple ramassage.

Le mode découverte et les réglages modifiant les soins ou la pression utilisent une catégorie distincte. Le record est local et modifiable dans le stockage du navigateur ; aucun classement mondial sécurisé n’est promis.

Dédupliquer le score par identifiants d’événements et d’occurrences d’objectif. Un recyclage de modèle ou de pool d’agent attribue un nouvel identifiant de vie, sans réutiliser à tort l’identité du casseur précédent.
