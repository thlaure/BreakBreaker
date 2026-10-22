# BreakBreaker — Spécifications : Technique

> **Rôle du fichier :** choix techniques, architecture et données, performances, stockage, chargement et diffusion.  
> Fait partie des spécifications de BreakBreaker (version 1.9.25), découpées en plusieurs fichiers. Retour à l’[index des spécifications](SPECS%20-%20Index.md) (sommaire général, historique des versions, conventions, plan des fichiers).

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

**Modifié (v1.9.11) :** catalogue livré (`src/sim/types.ts`, type `SimEvent`) :

- Manches : `RoundStarted` (avec `rescueKind` quand la casse phare est le secours, v1.9.12), `RoundTotalChanged`, `TwistStarted` (aux manches impaires dès la 3, deux à la suite : `weaponDrop` puis `secondUrgency`, v1.9.12), `RoundCompleted`, `StationsRecharged`.
- Combat et projectiles : `HitConfirmed`, `ActorKnockedOut` (porte `fall` depuis v1.9.17), `DominoTriggered` (`from`, `lifeIds`, v1.9.17), `PlayerDamaged`, `PlayerKnockedOut`, `EnemyThrowStarted`, `EnemyRockThrown`, `ProjectileLanded`, `ProjectilePickedUp`, `ProjectileReturned`, `ProtectedGroupBlockedImpact`, `ShieldBlocked`.
- Lieux : `SchoolStarted` et `CasseStarted` (position), `MolotovThrown`, `TargetIgnited`, `BuildingThreatStarted`, `BuildingThreatPaused`, `TargetSaved`, `SchoolRestored`, `BuildingDestroyed`, `FirebombThrown`, `FirePatchStarted`.
- Petits soins de terrain (v1.9.18) : `SmallHealDropped` (`id`, `pos`), `SmallHealPicked` (`id`, `amount` = PV réellement gagnés). L’instantané ajoute `fieldHeals` (`id`, `pos`, `expiresAt`).
- Services d’urgence (v1.9.19) : `ServiceCalled` (`kind` 'fire' ou 'police'), `ServiceRefused` (`kind`, `reason` parmi `noFire`, `fewRioters`, `noCalls`, `busy`, `ruined`), `TruckArrived` (`from`), `TruckSprayed` (`target`, une fois par lieu), `TruckDestroyed` (`pos`), `TruckLeft`, `PoliceArrived` (`from`, `count`), `PoliceDown` (`id`), `PoliceLeft`. L’instantané ajoute `services` (`calls` { fire, police } = appels restants ; `hint` { fire, police } = un appel serait accepté à l’instant) et `allies` (`truck` : `pos`, `hp`, `maxHp`, `state` 'arriving' / 'spraying' / 'leaving', `target`, ou null ; `police` : liste d’agents `id`, `role`, `pos`, `hp`, `maxHp`, `state` 'run' / 'strike' / 'down').
- Prison (v1.9.20) : `CaidJailed` (`lifeId`, une fois par vie de Caïd enfermé), `PrisonBreakout` (`count` Caïds libérés, `pos` = la porte ; jamais émis si personne n’est enfermé), `GuardDown` (`id`, un gardien KO ; un policier de la cabine donne `PoliceDown`), `GuardsBack` (au répit, des gardiens reviennent). `Director.extend` émet `RoundTotalChanged` quand T grandit. L’instantané ajoute `prison` (`jailed` = Caïds enfermés ; `guards` : liste de `id`, `pos`, `hp`, `maxHp`, `state` ; `standing`). `allies.police` ne liste que la police, jamais les gardiens.
- Caisses à outils : `ToolboxSpawned`, `ToolboxPickedUp`, `FireOut`, `TargetRepaired`.
- Secours : `RescueStarted` (position et type, émis une fois ; il déclenche l’alerte), `ItemStolen`, `ItemDropped`, `ItemPickedUp`, `ItemReturned`, `RescueSecured`, `RescueCompleted`, `RescueFailed`.
- Monument : `MonumentAttacked`, `FlagSwapped`, `MonumentDefended`, `FlagCaptured`.
- Armes et spéciaux : `WeaponSpawned`, `WeaponPickedUp`, `WeaponBroken`, `FurieStarted`, `FurieEnded`, `BeamCharging`, `BeamCancelled`, `BeamFired`, `ShieldBlocked`.
- Tireurs et armes de la phase B (v1.9.15) : `ShooterAimStarted` (`lifeId`, `from`, `to`, `until`), `BulletFired` (`id`), `BulletImpact` (`pos`, `owner`), `FlashballFired` (`id`, `from`, `dir`), `FlashballDropped` (`pos`), `GlovePunched` (`from`, `to`, `lifeId`) ; `HitConfirmed.source` vaut aussi 'gant' ou 'flashball'. L’instantané ajoute `aims`, `bullets`, `flashballs` et `hostiles[].aiming`.
- Jauge d’énergie (v1.9.14) : `EnergyReady` (`level` 'onde' ou 'furie', une fois par franchissement), `EnergyRefused` (`need`). L’entrée `InputFrame` porte `chargeHeld` (C ou bouton Onde enfoncé ; **modifié v1.9.23 :** seul son front montant compte, la charge se termine ensuite seule) et `furie` (appui sur R ou Furie) ; `strikeHeld` est retiré.
- Soins et score : `HealCompleted`, `ScoreChanged` (points et position, section 14.1).

Les événements de la cible initiale non repris (`SessionStarted`, `SessionEnded`, `ObjectiveActivated`, `ObjectiveLost`, `RepairStarted`, `RepairCancelled`, `StudentEnteredSchool`, `WaveStarted`) restent à ajouter si un besoin apparaît ; la fin de session passe par l’état `ended` de la simulation.

Le système de règles est seul auteur du score et du compteur de casseurs neutralisés. Les KO, consommations de soins, ramassages et bonus d’objectif sont dédupliqués. Les groupes pacifiques et victimes ne peuvent jamais émettre un KO valide. Les santés de lieu, délais de secours, consommation de caisse à outils, réparation et bonus de secours sont dédupliqués par identifiant propre. Une ancienne perte encore réparable garde seulement son état minimal ; elle n’oblige pas à conserver tout le journal historique.

### 18.4 Configuration cible

```json
{
  "rulesVersion": "slice-0.2.0",
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
  "captureSeconds": 8,
  "maxCarriedProjectiles": 3,
  "recoverFlyingProjectiles": false,
  "recoverReturnedProjectiles": false,
  "pacifistGroupsTargetable": false,
  "pacifistGroupsDamageableByPlayer": false,
  "rescueVictimsThreatenedByHostiles": true,
  "rescueUsesDistressMeter": true,
  "buildingHealth": 100,
  "propHealth": 60,
  "fireDamagePerSecond": 2,
  "degraderDamagePerSecond": 1.2,
  "smoulderDamagePerSecond": 0.7,
  "rescueThreatSeconds": 25,
  "maxUrgentIncidents": 2,
  "destroyedBuildingsPersistAcrossRounds": true,
  "maxCarriedRepairKits": 1,
  "maxGroundRepairKits": 2,
  "repairApplicationSeconds": 2,
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
  "firstWeaponSpawnSeconds": 20,
  "weaponSpawnIntervalSeconds": [30, 45],
  "weaponSpawnDistance": [160, 480],
  "maxGroundWeapons": 1,
  "weaponClearRadius": 200,
  "twistRegularWeaponShare": 0.5,
  "breatherWeaponEveryRounds": 2,
  "shieldSeconds": 20,
  "caidHealth": { "base": 14, "step": 2, "everyRounds": 2, "max": 26 },
  "caidDamageFrom": { "hands": 1, "weapon": 2, "rock": 1, "furie": 5, "beam": 10, "bubble": 0 },
  "caidContactDamageMultiplier": 1.5,
  "caidKnockback": 52,
  "caidAttackIntervalMultiplier": 0.85,
  "caidWeaponDropShare": 0.5,
  "prison": { "hp": 400, "guards": 5, "postRadius": 160, "fromRound": 4, "repairShare": 0.6 },
  "roundEnemyCounts": [10, 14, 18, 22],
  "roundEnemyIncrement": 4,
  "maxRoundEnemies": 40,
  "maxRoundEnemiesOnMap": 12,
  "enemyEntryIntervalSeconds": 1.5,
  "waveRestSeconds": 6,
  "smallHealAmount": 10
}
```

**Modifié (v1.9.11) :** ce bloc est un résumé ; la source de vérité des paramètres est `CONFIG` dans `src/sim/config.ts` (ancienne réserve de 30 s remplacée par la santé des lieux, capture de 8 s, réparation de 2 s ; `repairBonus` est la valeur de l’école ; `smallHealAmount` correspond aux petits soins livrés en v1.9.18, `CONFIG.fieldHeal`). Les valeurs sont proposées. Les caps de simulation sont communs aux profils graphiques ; un réglage de difficulté distinct peut changer les effectifs, pas une baisse automatique de qualité.

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
| Hostiles actifs | 40 au maximum ; entrée de la file suspendue à 12 hostiles actifs (l’effectif d’une manche peut dépasser 40 dès la manche 9, v1.9.18, sans changer ce plafond) |
| Groupes pacifiques | 3 groupes de 6 à 8 sprites dans la carte de référence (1 groupe de 6 livré) |
| Étudiants actifs | 5 au maximum (à faire) |
| Projectiles en vol | 24 pierres au maximum, plus 30 balles des tireurs (v1.9.15) et les tirs de flashball de Paul |
| Pierres récupérables au sol | 16 au maximum |
| Flaques de feu | 6 au maximum |
| Petits soins au sol | 2 au maximum, 20 s de vie (v1.9.18) |
| Alliés des services d’urgence | 1 camion et 5 policiers au maximum à la fois (v1.9.19), hors du plafond de 40 hostiles actifs ; coût mesuré d’environ 0,02 ms par pas avec le camion, 5 policiers et 40 casseurs, banc complet ≤ 0,3 ms par pas |
| Prison (v1.9.20) | 5 gardiens toujours sur la carte, hors du plafond de 40 hostiles actifs, plus au plus les Caïds libérés (comptés dans l’effectif de la manche) ; banc complet mesuré de 0,248 à 0,253 ms par pas sous charge (0,233 sans la prison, même charge), sous la limite de 0,3 ms par pas |
| Armes au sol | 1 apparition chronométrée au maximum (v1.9.16), plus les dépôts du retournement, du répit et du Caïd (15 s) ; aucun dépôt ordinaire à 200 px de Paul d’une arme déjà au sol |
| Caisses à outils au sol / portées | 2 au sol et 1 portée au maximum |
| Incidents urgents simultanés | 1 en manches 1 et 2, puis 2 au maximum (deux dès le début de la manche à partir de la manche 5, v1.9.18) |
| Effets purement visuels | 16 casseurs satellisés en vol, 24 points flottants à la fois |
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
