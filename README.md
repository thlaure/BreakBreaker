# BreakBreaker — Paris (prototype 02)

Jeu web JavaScript / Three.js, troisième personne, un joueur. Paris uniquement : quartier fictif avec une école et un monument inspiré de Victor Hugo. Aucun compte, aucun tir, aucun gore. Aucune publication externe dans cette itération.

## Spécification de référence

Le [cahier des charges complet](docs/CAHIER_DES_CHARGES.md), version 1.4, décrit un jeu 2D en pixel art vu du dessus, non isométrique : Pierre comme héros unique, exploration libre, hordes, groupes pacifiques protégés, projectiles récupérables puis renvoyables, santé et soins, arcade sans limite jusqu’au KO. Il prévoit aussi des délais locaux de destruction, des kits de réparation, des secours dynamiques et une landing page légère avec accès séparé au jeu. Phaser 4 est proposé pour cette cible. Le document comprend les choix techniques, les budgets et 78 cas de recette à réaliser. **Le code du prototype 02 ci-dessous n’a pas été converti** : il reste en 3D, avec son choix de personnage et sa limite de 120 secondes. La nouvelle landing reste également à réaliser.

## Lancer

Node.js 20+ : `npm run dev`, puis http://127.0.0.1:53827. Aucune dépendance à installer. `npm run check` vérifie cinq modules et onze tests, dont le parcours complet du contrôleur de mission avec adaptateur visuel simulé.

`dist/` est un site statique autonome. Three.js 0.180.0 et sa licence MIT sont dans `dist/vendor/`. Les polices Google restent facultatives : les polices système prennent le relais hors connexion.

## Commandes

- ZQSD, WASD ou flèches : avancer, reculer, tourner ; gauche tourne à gauche.
- Maj : courir. Maintenir et glisser sur le décor : caméra.
- Espace : frapper ; maintenir pour enchaîner. Deux coups mettent un casseur au sol.
- Échap : pause. Clôturer ouvre la pause puis le bilan.
- Écran tactile : joystick, Frapper et Courir (maintenir), glissement à droite pour la caméra.

## Première boucle : école

La flèche et le cercle rouge indiquent l'école en feu. Trois casseurs frappent sa façade : classique, drapeau palestinien, drapeau Antifa. Entrer dans le cercle démarre la confrontation. Ils restent hostiles jusqu'au KO : aucune reddition ni interpellation. La peau varie indépendamment de la variante. Les habitants, étudiants et secours restent des personnages à protéger.

Après les trois premiers KO, une cinématique de quatre secondes annonce huit renforts. Les attaquants doivent atteindre la façade pour en réduire la résistance ; les proches attaquent le joueur au contact. Vague vaincue : reconstruction de trois secondes, extinction du feu, disparition des dégradations et retour du drapeau français. Les étudiants rentrent dans l'école ; chaque entrée alimente une projection accélérée d'ingénieurs et de scientifiques formés. Chaque étudiant ne compte qu'une fois.

## Deuxième boucle : monument

Après l'école, rejoindre le cercle du monument Victor Hugo. Six casseurs arrivent. La capture progresse uniquement à l'intérieur du cercle sans défenseur présent dans celui-ci ; elle se suspend hors zone ou en cas de contestation. Douze secondes de capture et tous les défenseurs au sol remplacent le drapeau palestinien par le drapeau français. Une courte période permet d'observer le quartier repris avant le bilan.

## Score

Casseur classique KO : +1 ; variante avec drapeau : +2. Chaque casseur KO incrémente le compteur OQTF fictif d'une unité. Un corps déjà au sol ne rapporte rien de plus. Innocent frappé : −2 ; policier : −3. École défendue et reconstruite : +16 ; monument repris : +10 ; intervention sans erreur avec au moins un KO : +5. Record propre à cette version enregistré dans le navigateur si le stockage est disponible.

## Rendu et limites

Architecture parisienne procédurale, pavés, toitures mansardées, fenêtres et balcons, personnages articulés aux proportions humaines, éclairage rasant, fumée, flammes, braises, drapeaux animés et réactions aux coups. Les modèles restent des modèles de prototype ; ce n'est pas un rendu photoréaliste ni une reproduction de GTA ou de The Division. Le monument et son emplacement sont fictifs.

Le compteur OQTF et les formations en temps accéléré appartiennent à la satire. Le jeu ne présente pas les scènes comme une reconstitution historique ou comme des affirmations sur un événement réel.
