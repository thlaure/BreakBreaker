# BreakBreaker — Spécifications : Parcours, carte et Paul

> **Rôle du fichier :** parcours du joueur, carte et objectifs, Paul (déplacement et caméra), landing page et accès au jeu.  
> Fait partie des spécifications de BreakBreaker (version 1.9.25), découpées en plusieurs fichiers. Retour à l’[index des spécifications](SPECS%20-%20Index.md) (sommaire général, historique des versions, conventions, plan des fichiers).

## 4. Parcours du joueur

### 4.1 Accueil

Le site s’ouvre sur une landing page légère, distincte du jeu, volontairement sobre : titre, accroche, bouton « Jouer » (qui lance directement la partie) et bouton « Commandes » (modale des touches). **Confirmé (1.6) :** les règles et instructions de jeu ne sont pas sur la landing ; elles s’affichent au lancement du jeu (§26.4). Son contenu détaillé est défini en section 26. Aucun choix de sexe ou teint ; aucune limite globale de durée annoncée.

### 4.2 Entrée

**Confirmé :** « Jouer » ouvre `/jouer/?go`. La page du jeu affiche sa progression de chargement (moteur, sprites, tuiles, collisions, sons utiles et premiers adversaires), puis, dès que les ressources indispensables sont prêtes, la carte « Comment jouer » s’affiche : **modifié (v1.9.4)** elle est bloquante, la partie attend une touche, un clic ou un toucher (RC-70, RC-87), puis démarre (intro de 4 s, manche 1). Le son se déverrouille à ce premier geste. Une visite directe sur `/jouer/` (sans `?go`) affiche l’écran des règles avec l’action « Commencer ». Caméra du dessus dès la prise de contrôle, pas de cinématique derrière l’épaule ni de modèle 3D.

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

**Façades de décor (v1.9.25).** Deux bâtiments libres de la carte reçoivent une devanture purement décorative, sans aucune interaction : ce sont des bâtiments pleins ordinaires (obstacles pour Paul et les casseurs, comme les autres), jamais des lieux (`DISTRICT.decor`, hors de `DISTRICT.targets`) : ni casse, ni tirage, ni feu, ni barre de vie, ni ruine, ni réparation, et aucun casseur ne s’y dirige. Ils sont à au moins 64 px des apparitions, des soins, des secours, des caisses à outils, des postes des gardiens, des autres lieux et du monument, et leur porte donne sur la rue en contrebas de la façade.
- **« CAF »** (bâtiment 2, au nord, R(26,4,7,5), porte en C(29,9)) : façade sobre en pierre claire (assises, joints, corniche), deux petites fenêtres dépolies, un guichet vitré avec un agent derrière l’hygiaphone et une tablette de pierre, une porte vitrée en aluminium, un panneau d’affichage, et une petite file de cinq personnes qui attendent le long du mur, tournées vers la porte (léger balancement de respiration, immobiles avec la préférence de mouvement réduit) ; enseigne « CAF » bleu ardoise avec une chemise cartonnée sur le bord du toit.
- **« TASTY CROUSTY »** (bâtiment 8, à l’est du monument, R(38,16,6,6), porte en C(41,22)) : devanture de restauration rapide colorée (mur rouge tomate, liseré moutarde, plinthe à damier, store rayé), tableau du menu, comptoir éclairé avec un cuisinier à la friteuse et un plateau sur l’inox, porte vitrée rouge, salle avec table et tabourets, lumière chaude sur le trottoir ; enseigne lumineuse « TASTY CROUSTY » au halo qui pulse doucement (fixe avec la préférence de mouvement réduit), un gros pilon de poulet en pixel sur le toit et la fumée de la friteuse qui monte d’une cheminée (particules ; aucune avec la préférence de mouvement réduit).

Les noms ne sont que le texte des enseignes, dans notre style pixel et nos couleurs : aucun logo réel. L’enseigne, le pilon et la cheminée s’estompent avec le toit quand Paul passe dessous. Rendu : `src/game/render/decor.ts` et ses aides pures `decorMath.ts`.

### 5.2 Déplacement libre

Pas de murs ajoutés comme mécanique, pas de labyrinthes de ruelles imposés. Les empreintes de bâtiments, les troncs d’arbre et les objets solides restent des obstacles cohérents. Paul ne peut pas les traverser ; le feuillage dessiné peut être au-dessus du personnage sans agrandir artificiellement la collision du tronc. Les limites de carte sont lisibles et les accès ne forment pas de pièges involontaires.

Aucun objectif ne doit avoir un seul passage pouvant être entièrement condamné par un groupe pacifique. Les points de soin, caisses à outils et zones de secours ont des accès praticables. La distance de parcours réelle est utilisée pour planifier un événement urgent, pas seulement la distance à vol d’oiseau. Les groupes laissent plusieurs possibilités de contournement ; ils ne constituent pas des refuges fermés invulnérables.

### 5.3 Couches

Sol ; détails de sol ; empreintes solides ; objets ; personnages ; parties hautes des bâtiments ; effets ; marqueurs d’objectifs ; HUD. Ordre de profondeur lié à la position des pieds pour les éléments qui se chevauchent.

Les toits ou parties hautes qui masquent Paul deviennent transparents ou disparaissent localement. La collision d’un bâtiment suit son empreinte, pas toute la hauteur dessinée du sprite.

### 5.4 États

École dégradée/en feu, reconstruction, ouverte, perdue puis éventuellement reconquise. Monument au drapeau français, attaqué, drapeau remplacé, zone contestée, drapeau repris (v1.9.4). Boutique de jeux rétro, voitures et abribus : intacts, attaqués, en feu, en ruine, réparés (mêmes états que l’école). Soins chargés/épuisés ; armes au sol ; groupes pacifiques toujours reconnaissables.

Chaque nouvel assaut est annoncé et identifié ; les bonus ne sont pas rejoués par un changement purement graphique. Un lieu détruit reste en ruine tant qu’il n’a pas été réparé avec une caisse à outils ; une transition de manche ne le répare pas gratuitement.

## 6. Paul, déplacement et caméra

### 6.1 Héros

Sprite de Paul aux cheveux longs, **lunettes rectangulaires noires** (v1.9.10, demande du porteur du projet ; visibles dans les trois orientations de face et de profil, reprises dans l’icône du site et l’image de la landing) et vêtements noirs, avec un accent clair (écharpe ou bavoir blanc), lisible dans quatre orientations au minimum. Accent clair, silhouette, animation et contour doivent permettre de le distinguer des casseurs classiques également vêtus de couleurs sombres.

Sprite retenu : personnage composé à partir des spritesheets Universal LPC, cellules de 64 × 64 pixels pour une silhouette visible d’environ 32 × 48, avec variantes d’animation et accessoires séparés. Les pieds définissent l’ancrage et la petite zone de collision au sol.

### 6.2 Déplacement

Huit directions libres. Gauche déplace à gauche de la carte, haut vers le haut, indépendamment de l’orientation précédente. Le schéma 3D « gauche fait tourner le nez » est remplacé. Les diagonales sont normalisées pour ne pas accélérer.

Valeurs initiales proposées, adaptées aux tuiles de 32 pixels : 180 pixels logiques/seconde en déplacement, 250 en course. La vitesse exacte reste à équilibrer. Arrêt rapide et léger lissage, sans inertie qui empêche d’esquiver un caillou.

Pas de saut, de roulade ou de barre d’endurance indispensable en V1. L’esquive demandée repose d’abord sur le déplacement. Une roulade éventuelle est une extension, pas une condition implicite de la jouabilité.

### 6.3 Caméra

Caméra du dessus à orientation fixe, centrée avec une petite zone morte. Aucun contrôle de rotation et aucune perspective isométrique. Le suivi est fluide mais arrondi au pixel au rendu pour préserver la netteté ; le zoom de caméra est toujours entier.

La visibilité autour du héros doit laisser le temps de lire une préparation de lancer. Un indicateur de menace peut annoncer un lanceur hors écran ; un projectile ne doit pas atteindre Paul sans signal ou délai suffisant.

Adaptation paysage/portrait par cadrage et zones de HUD, sans étirer les sprites. Le changement d’orientation ne fait pas apparaître d’ennemis à portée immédiate et ne modifie pas leur vitesse.

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
- La partie avance par manches, avec un court répit entre deux : neutraliser l’effectif de la manche et traiter ses objectifs pour passer à la suivante. Les lieux attaqués ont une barre de santé et les secours un délai local. Manquer une intervention n’arrête pas la partie ; une caisse à outils et la touche F (bouton Agir) permettent d’éteindre un lieu en feu ou de réparer une ruine.
- Les groupes pacifiques et les victimes sont à protéger et à contourner. La frappe de Paul les exclut.
- Les projectiles ennemis tombés peuvent être récupérés puis renvoyés ; des armes et, quand ça chauffe, un bouclier apparaissent dans les rues ; chaque KO remplit une jauge d’énergie qui donne l’onde d’énergie (un appui sur C, dès la moitié) et le mode furie (R, jauge pleine) ; la santé et les soins sont limités, une station soigne quand on passe dessus.
- Les commandes affichées reprennent les affectations réellement livrées de la section 7 ; ne pas maintenir une seconde liste divergente. Présenter le clavier et le tactile sans laisser croire qu’une souris est obligatoire sur téléphone.

Le statut satirique du jeu est indiqué en une phrase lisible. Le site ne présente pas les scènes fictives comme une reconstitution ; Paul est un personnage fictif. Les marqueurs de gameplay et compteurs sont expliqués dans les règles et le bilan, sans leur attribuer une valeur documentaire.

### 26.4 Navigation et lancement

Routes proposées : **`/` pour la landing**, **`/jouer/` pour le jeu**. Elles peuvent être servies comme deux entrées statiques dans le même dépôt, sans framework de site supplémentaire. Les deux routes et leurs ressources doivent fonctionner après navigation directe et rechargement sur l’hébergement retenu.

**Confirmé :** « Jouer » est un vrai lien vers `/jouer/?go`, dans le même onglet. Le jeu ne commence pas à se charger au survol, au défilement ou à l’ouverture de la landing. Aucun préchargement automatique du moteur ou des atlas. La page de jeu affiche l’avancement, les erreurs et une action Réessayer en cas d’échec. Avec `?go`, dès que les ressources indispensables sont prêtes, **la carte « Comment jouer »** (objectif, touches principales, « Appuie sur une touche pour commencer » / « Touche l’écran pour commencer ») s’affiche par-dessus la partie ; **modifié (v1.9.4) :** elle est bloquante, la partie attend une touche, un clic ou un toucher pour démarrer, sans minuteur (RC-70, RC-87) ; un bouton **« Commandes »** reste dans l’interface et ouvre une modale (touches et règles) qui met la partie en pause jusqu’à sa fermeture. L’audio se déverrouille à la première touche, au premier clic ou au premier toucher.

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

La recette RC-69 à RC-78 et RC-86 à RC-90 complète la recette du jeu. Elle doit vérifier le trajet landing → jeu → bilan → landing, ainsi qu’une entrée directe sur le jeu. Le présent document décrit cette cible ; il ne constitue pas une preuve que la landing ou le nouveau jeu ont déjà été réalisés.
