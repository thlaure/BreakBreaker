# Changelog

Notes de version de BreakBreaker, de la plus récente à la plus ancienne.
Ce fichier est lu à la compilation : il alimente le bloc « Nouveautés » et la fenêtre « Changelog » de la page d'accueil.

Format : un titre `## <version> - <date AAAA-MM-JJ>` par version, puis une liste de points `- ` courts, du plus important au moins important.
Les trois premiers points de la version la plus récente sont affichés sur la page d'accueil.

## 1.5.10 - 2026-10-24

- Les bulles de dialogue sont deux fois plus petites sur téléphone et ne sont plus recadrées dans l'écran : elles suivent leur personnage et peuvent être coupées au bord, au lieu de masquer la vue.

## 1.5.9 - 2026-10-24

- Petit nettoyage après la série de correctifs de fluidité : les images figées des décors sont libérées à chaque nouvelle partie au lieu de s'accumuler en mémoire.

## 1.5.8 - 2026-10-24

- Le jeu est beaucoup plus fluide : tes mesures montraient qu'il suffisait de couper l'une des couches « dessins », « formes » ou « tuiles » pour retrouver presque 60 images par seconde. Ces trois types d'objets cassaient le regroupement des dessins du navigateur. Les murs, toits, rectangles et ombres sont maintenant des images, et les décors fixes sont figés une fois pour toutes : de 173 à 60 appels de dessin par image dans mon test.

## 1.5.7 - 2026-10-24

- Le compteur `?perf` mesure maintenant aussi le temps de la carte graphique (avec les navigateurs qui le permettent) et accepte `&off=hud,graphics,shapes,particles,texts,images,tiles` pour couper une couche à la fois et trouver ce qui coûte du temps sur une machine donnée.
- Le texte « Caïds enfermés » de la prison n'est plus redessiné à chaque image (une petite image était renvoyée à la carte graphique 60 fois par seconde pour rien).

## 1.5.6 - 2026-10-24

- Les têtes de citrouille d'Halloween sont de vraies têtes : la tête du casseur ou du Caïd est remplacée par une citrouille qui bouge avec son corps (de dos, elle n'a pas de visage), au lieu d'un masque posé dessus.
- Le jeu est un peu plus léger : les ombres des objets, les pierres et les décors utilisent des images au lieu de formes redessinées à chaque image.
- Le compteur `?perf` indique aussi le temps de travail du jeu, le nombre d'objets et la taille de l'écran, pour mieux cerner d'où vient un manque de fluidité.

## 1.5.5 - 2026-10-24

- Nouvel outil de mesure : en ajoutant `?perf` à l'adresse du jeu, un petit compteur s'affiche en bas à gauche (images par seconde, durée des images, images ratées, et délai entre une touche et l'image qui la prend en compte). Il sert à trouver d'où vient une sensation de retard. Sans `?perf`, rien ne change.

## 1.5.4 - 2026-10-24

- Le jeu est plus fluide : les façades des bâtiments, qui ne changent jamais, étaient redessinées rectangle par rectangle à chaque image (près de 20 000 commandes de dessin par image). Elles sont maintenant figées en images une fois pour toutes, ce qui allège beaucoup le travail du navigateur et réduit le retard entre une touche et l'action.

## 1.5.3 - 2026-10-24

- Pendant Halloween, certains casseurs et certains Caïds (environ un sur quatre, un sur trois pour les Caïds) ont une tête de citrouille souriante, grimaçante ou surprise, qui les rend facilement reconnaissables.
- Les zombies ne portent plus de drapeau de leur camp : certains brandissent à la place un drapeau noir à tête de mort, comme un drapeau de pirates.

## 1.5.2 - 2026-10-24

- Les zombies d'Halloween sont de vrais personnages, plus de simples skins : peau verte, yeux jaunes brillants, vêtements déchirés, cheveux flashy ou capuche.
- Nouveaux zombies lanceurs de sort : des zombies en robe à capuche qui lancent des boules magiques vertes à la place des pierres. C'est seulement visuel, rien ne change dans les règles.
- Ces images ne se téléchargent que pendant l'événement ; le reste de l'année, le jeu ne charge rien de plus.

## 1.5.1 - 2026-10-24

- La page d'accueil se met aussi aux couleurs d'Halloween : une nouvelle illustration de nuit (zombies, citrouilles, fantômes, chauves-souris, guirlandes) remplace le fond pendant l'événement, avec des couleurs orange et violettes.

## 1.5.0 - 2026-10-24

- Halloween arrive, du 24 octobre au 2 novembre : environ un casseur sur deux devient un zombie rigolo (peau vert-gris, cheveux bleus, roses, violets, turquoise ou jaunes, certains avec un cône de chantier ou un seau sur la tête). Rien ne change dans le jeu : mêmes règles, mêmes scores.
- La carte se pare pour l'occasion : guirlandes de fanions sur les façades, citrouilles souriantes devant les bâtiments, petits fantômes qui flottent et chauves-souris qui tournent (immobiles avec mouvement réduit).
- Le thème s'allume et s'éteint tout seul selon la date, chaque année. Pour le forcer ou le couper : `?event=halloween` ou `?event=none` dans l'adresse du jeu.

## 1.4.5 - 2026-10-24

- Le sauna devient une cabine vitrée à trois places : les trois invités sont de vrais personnages, dessinés avec les mêmes éléments que ceux qui se promènent sur la carte, distingués seulement par leurs accessoires (casquette et longue cravate, ceinture de judo, chapeau de feutre).

## 1.4.4 - 2026-10-24

- Le jeu consomme beaucoup moins quand il est en pause (menu pause, commandes, carte d'instructions, fin de partie) : l'écran figé n'est plus redessiné qu'à faible cadence, ce qui économise processeur, carte graphique et batterie.

## 1.4.3 - 2026-10-24

- Le jeu se charge plus vite : les images pèsent six fois moins (1,8 Mo → 0,3 Mo), sans aucune différence visible.
- Le moteur du jeu est dans un fichier à part que le navigateur garde en cache : les prochaines mises à jour se téléchargent beaucoup plus vite.

## 1.4.2 - 2026-10-24

- L'ancienne adresse /jouer/ n'existe plus : le jeu est uniquement sur /play/.

## 1.4.1 - 2026-10-24

- Le changelog de la page d'accueil suit la langue : la page /en/ affiche les notes en anglais.

## 1.4.0 - 2026-10-24

- Une scène de rock au nord-est de la carte : un groupe de cinq squelettes en tenue de rock, des projecteurs de couleur et un chanteur qui lance des répliques de ras-le-bol, dans les deux langues.
- Une musique originale qui monte quand on s'approche de la scène et s'éteint quand on s'éloigne ; elle respecte le bouton Son, la pause et la fin de partie.
- Les cabines d'urgence (pompiers et police) passent au bord de la grande place, à côté de la mairie  : on les appelle comme avant, mais en pleine action.
- Avec le mouvement réduit, les squelettes restent immobiles et les projecteurs ne clignotent plus.

## 1.3.0 - 2026-10-23

- Le jeu est disponible en anglais américain : deux petits drapeaux (français, américain) en haut à gauche de la page d'accueil, alignés sur le premier « B », et dans le menu pause.
- Les répliques sont adaptées en anglais (le Président, les Caïds, la foule), pas traduites mot à mot.
- La langue choisie est mémorisée, et on peut en changer en pleine partie, sans rien perdre.
- Deux pages d'accueil : / en français et /en/ en anglais.

## 1.2.1 - 2026-10-23

- Quand Paul est touché pendant une réparation (coup, pierre, tir, feu), la réparation s'arrête, mais il garde sa caisse à outils.

## 1.2.0 - 2026-10-23

- Les Caïds ont du style : cinq looks de meneurs (le tribun, la cheffe de cortège, le camarade en costume, le vieux briscard, le jeune agitateur).
- Chacun a son accessoire (mégaphone, banderole, mallette du « COMITÉ », sifflet, rouleau d'affiches) et ses slogans dans une bulle.
- Un Caïd garde son look jusque dans la cour de la prison.

## 1.1.4 - 2026-10-23

- Le sauna : la troisième silhouette porte un turban sombre et une barbe grise.

## 1.1.3 - 2026-10-23

- Mobile : les bulles de dialogue (manifestants, Président) ne sont plus coupées au bord de l'écran.

## 1.1.2 - 2026-10-23

- Le sauna : les trois silhouettes dans la vapeur ont chacune leurs accessoires (casquette et longue cravate, ceinture de judo et crosse, lunettes et fanion).

## 1.1.1 - 2026-10-23

- Équilibrage des manches 1 à 9 : une difficulté qui monte plus régulièrement, des manches 5 à 9 moins chargées.
- À partir de la manche 5, plus de troisième lieu attaqué en milieu de manche : les deux attaques du début suffisent.
- Les brutes et les tireurs arrivent un par un : la deuxième brute en manche 7, le deuxième tireur en manche 9.

## 1.1.0 - 2026-10-23

- Une grande place au cœur du quartier : l'église, la mairie et le château l'entourent.
- L'église est un nouveau lieu à défendre (feu, ruine, réparation), à partir de la manche 3.
- Le château du Président : un Président inventé s'agite au balcon et lance des répliques décalées.
- Trois groupes de manifestants pacifiques sur la place.
- Un sauna mystérieux avec trois silhouettes dans la vapeur.
- La mairie change de place ; l'arrêt de bus et quelques bâtiments aussi.

## 1.0.2 - 2026-10-23

- L'adresse du jeu devient /play/ (l'ancienne adresse /jouer/ redirige).
- La boutique « Jeux Rétro » devient « Micro Rétro ».
- Phrase d'accueil raccourcie : « Défends le quartier aussi longtemps que possible. »

## 1.0.1 - 2026-10-23

- Affichage mobile : stats, alertes, bandeaux et indicateurs de bord plus petits ; menu pause sur deux colonnes en paysage.
- La devanture « Tasty Crousty » devient « Poulet Crousti ».
- Nouveau : ce changelog, visible sur la page d'accueil.

## 1.0.0 - 2026-10-22

- Première version publique : défends le quartier avec Paul, aide les passants et renvoie les projectiles.
- Prison : les Caïds mis KO y sont enfermés ; si elle tombe, ils s'évadent. Cinq gardiens la défendent et elle se reconstruit.
- Services d'urgence : cabines rouge et bleue pour appeler un camion de pompiers ou la police (3 appels de chaque).
- Nouveaux lieux à défendre : crèche, kiosque, mairie et bibliothèque ; soins sur le terrain.
- Onde d'énergie en une seule pression et mode furie plus long (18 s).
- Chutes de KO selon l'arme, avec de rares chutes WTF, onomatopées, tremblements et arrêts sur image.
- Alertes plus visibles, invite d'action « F » et guidage pour réparer.
- Façades de décor : CAF et Poulet Crousti.
- Les records repartent à zéro avec la version 1.0.0.
