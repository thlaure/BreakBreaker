# BreakBreaker — Spécifications : Direction artistique et son

> **Rôle du fichier :** direction artistique, ressources pixel art, animations et son.  
> Fait partie des spécifications de BreakBreaker (version 1.9.25), découpées en plusieurs fichiers. Retour à l’[index des spécifications](SPECS%20-%20Index.md) (sommaire général, historique des versions, conventions, plan des fichiers).

## 15. Direction artistique et ressources pixel art

### 15.1 Style

Pixel art dessiné, palette cohérente et sprites de même échelle. Vue du dessus orthogonale, sans isométrie. Paul conserve cheveux longs, lunettes rectangulaires noires (v1.9.10) et tenue noire ; l’écharpe ou le bavoir blanc et un contour contrasté le distinguent du sol et de la foule.

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

**Chutes de KO (v1.9.17).** Treize types de chute (`crumple`, `spin`, `flyspin`, `pancake`, `bounce`, `backflip`, `wobble`, `tripleflip`, `helicopter`, `faceplant`, `trashcan`, `domino`, `knocked`) jouées par transformation du sprite KO existant (pivot, écrasement, rotation, hauteur), sans nouvelle planche ; la poubelle est une texture créée à l’exécution (12×14, ×2). Détail en section 12.15.

### 15.5 Préparation

Sources éditables de sprites et carte ; exports PNG avec transparence ; atlas de textures et données d’animation ; carte en JSON de tuiles et objets ; validation des ancrages, collisions et cadres. Pas de pipeline de modèles GLB ou de squelette 3D dans cette version.

Registre des auteurs, licences, attributions, sources et modifications (`public/CREDITS.md`). Les ressources du prototype ne doivent pas être de simples carrés colorés présentés comme une direction pixel art finale. Une création ou adaptation artistique reste nécessaire.

## 16. Son

Le premier clic, toucher ou geste clavier pertinent autorise l’initialisation audio. Le son reste désactivable depuis l’accueil et la pause. L’échec de l’audio ne bloque pas le jeu.

Prévoir des groupes de volume séparés : ambiance, effets, musique éventuelle, voix. La musique est facultative ; la lisibilité du combat prime. Les sons proches sont spatialisés avec mesure et le nombre de voix simultanées plafonné.

Les sons de la première tranche proviennent de Kenney (CC0). Les pas suivent le rythme de déplacement ; les impacts correspondent au contact ; les alarmes ou crépitements indiquent la présence du feu. Les répétitions de coups utilisent plusieurs variantes pour éviter un effet mécanique. **Ajouté (v1.9.24) :** chaque son d’impact (coups `hit1`–`hit3`, « hurt », chocs sourds `land`, et les sons WebAudio « tock », « pop », « thump », « boing », « clank ») est joué avec une hauteur légèrement aléatoire, ±6 % (`PITCH_JITTER`, sur la vitesse de lecture ou les fréquences), tirée côté rendu uniquement (`Math.random`, jamais le tirage du simulateur) et seulement quand la voix joue vraiment (rien sans audio ni en mode muet) ; sirènes, alarme, carillons, bourdonnements du mode furie et de la charge gardent leur hauteur exacte.

Repères sonores de la tranche 2 (phase A) : alarme une fois par attaque, au moment où le lieu prend feu (v1.9.1), et une fois par secours, souffle bref à chaque lancer de Molotov (sur un lieu ou, v1.9.4, sur Paul), crépitement du feu qui suit le lieu le plus touché tant qu’un lieu est attaqué ou brûle, carillon bref (deux notes) quand un lieu est sauvé, éteint ou réparé et en fin de manche (un seul par image), son de ramassage pour la caisse à outils. **Ajouté (v1.9.11, aligné sur le jeu) :** alarme aussi au début d’une occupation du monument ; carillon quand le monument est défendu, quand le drapeau est repris et à chaque objet rendu ; son de chute quand le drapeau est remplacé et quand une arme se brise ; son de ramassage pour les pierres, armes, objets volés et soins ; trois variantes de son d’impact tirées au hasard. Souffle et carillon sont synthétisés (WebAudio), sans nouveau fichier. **Ajouté (v1.9.3) :** mode furie (section 8.8) : montée synthétique au ramassage, bourdonnement grave tant que le mode dure (une voix du plafond de huit, soumis à la sourdine et suspendu en pause), descente à la fin ; sans nouveau fichier. **Ajouté (v1.9.7) :** bourdonnement montant pendant la charge de l’onde d’énergie (coupé au tir ou à l’annulation), décharge au tir, choc métallique quand le bouclier bloque (section 8.9) ; synthétisés, dans le plafond de voix. **Ajouté (v1.9.14) :** jauge d’énergie (section 8.8) : petit « ping » doux (sinus) quand elle atteint 50, arpège plus brillant quand elle est pleine, une fois par remplissage ; « toc » sourd quand Furie ou Onde est refusé ; la montée du mode furie retentit à l’activation.

Repères sonores de la phase B (v1.9.15, WebAudio, dans le plafond de voix) : petit « pop » cartoon à chaque balle d’un tireur, « thump » grave au tir du flashball, « boing » à ressort quand le gant touche (souffle simple s’il frappe dans le vide).

Sirènes des services d’urgence (v1.9.19, WebAudio, par le même assistant de voix et dans le plafond de voix) : à `ServiceCalled`, sirène des pompiers (onde triangle, « pin-pon » à 580 / 435 Hz, 4 notes de 0,32 s) ou de la police (onde carrée filtrée passe-bas, 880 / 660 Hz, 6 notes de 0,18 s) ; à `ServiceRefused`, le « tock » existant ; à `TruckDestroyed`, un choc lourd d’atterrissage.

Sons de la prison (v1.9.20, WebAudio, dans le plafond de voix) : à `CaidJailed`, la sirène de police existante (le fourgon) ; à `PrisonBreakout`, un choc lourd suivi de l’alarme.

Une cinématique ne doit pas déclencher une seconde copie des sons de la scène à sa reprise. Retour d’onglet et reprise de contexte audio sont gérés explicitement.
