# BreakBreaker — Services d'urgence (cabines, pompiers, police) design

Date : 2026-10-22. Statut : décrit en chat, validé par le porteur du projet (« très bien, go pour ça » pour les pompiers ; « 3 de chaque » pour les utilisations). Les points marqués *(choix de Claude)* sont des propositions que le porteur n'a pas contredites.

## 1. Pourquoi

Les manches 5 à 9 sont plus denses (deux urgences à la fois, effectifs plus gros). Le joueur n'a aujourd'hui aucun moyen d'obtenir de l'aide extérieure. Deux appels de secours donnent une soupape (feux trop nombreux, foule trop grosse) et un nouvel objet à défendre. Succès : le joueur se dit « il me faut les pompiers » ou « j'appelle la police » à un moment précis, et trouve ça drôle à regarder.

**Anti-buts :** un secours qui règle tout sans effort (nombre d'appels limité) ; un camion ou des policiers invincibles ; une règle de maintien d'une touche ; du sang ou de la violence réaliste (matraque cartoon, rien de plus) ; aucune mention de personnes réelles.

## 2. Les cabines

- Un îlot de **deux cabines côte à côte** : une **rouge** (pompiers), une **bleue** (police). Sur une place dégagée du centre-ouest de la carte, présent dès la manche 1, à pied. *(choix de Claude pour l'emplacement et la présence dès la manche 1)*
- Appel : Paul se place devant la cabine, une pression sur **F / Agir** (aucun maintien). Bouton Agir sur mobile.
- **3 appels pompiers et 3 appels police par partie** (porteur du projet). Une pastille de compteur est dessinée sur chaque cabine ; une cabine épuisée est grisée.
- **Les cabines sont des cibles comme un accessoire** (porteur du projet : « attaquées comme les autres constructions ») : 60 PV, points d'attaque, feu possible, ruine, réparation par la caisse à outils, points sauvé / perdu / réparé comme voiture, abribus et kiosque. *(valeurs de points : choix de Claude, celles des accessoires : +4 / −2 / +3)* Une cabine en ruine ne s'utilise plus ; les utilisations déjà dépensées ne sont pas rendues.
- Les deux cabines entrent dans le tirage des casses (même mécanique que les autres lieux, ouvertes dès la manche 3 pour ne pas gêner l'apprentissage). *(choix de Claude)*

## 3. Le camion de pompiers (porteur du projet pour le comportement)

- Appel possible dès qu'au moins un lieu brûle. Sirène à l'appel.
- Le camion **arrive de n'importe quelle direction** : un bord de carte tiré au hasard (graine), parmi les entrées des casseurs. *(choix de Claude pour le tirage)*
- Il roule jusqu'au lieu en feu le plus proche, se gare, lance sa lance à eau et **éteint un feu à la fois, ou plusieurs si les lieux sont côte à côte** (portée d'extinction autour du camion, rayon à régler). *(rayon : choix de Claude)*
- Il enchaîne les feux tant qu'il en reste, puis repart par le bord le plus proche. Au plus 60 s sur la carte. *(choix de Claude)*
- **Il n'éteint que les feux.** Il ne répare jamais un bâtiment détruit (porteur du projet).
- Éteindre un feu = mêmes points « sauvé » que l'extinction par Paul ; le lieu garde les PV qu'il lui reste (pas de remise à 100 %, contrairement à la caisse à outils). *(choix de Claude)*
- **Il peut être attaqué** (porteur du projet : « il faut les défendre ») : les casseurs proches le prennent pour cible, il a une barre de vie (≈ 60 PV, à régler). À 0 PV il disparaît en fumée, l'appel est perdu. *(PV : choix de Claude)*

## 4. La police (porteur du projet : jusqu'à 5 policiers)

- Appel possible quand **au moins 8 casseurs sont actifs** sur la carte. *(seuil : choix de Claude, « trop de casseurs » étant le critère du porteur)*
- **5 policiers** arrivent d'un bord de carte, sirène. Ils courent sur les casseurs et les mettent KO à la matraque (cartoon). Chaque KO vaut +1 comme tout KO de casseur. *(+1 : décision durable « tout KO = +1 »)*
- Ils restent 40 s puis repartent. Les casseurs peuvent les assommer ; un policier assommé est perdu. *(durée et fragilité : choix de Claude)*
- Policiers : pixel art cartoon, uniforme bleu, casquette, aucune arme à feu.

## 5. Contraintes

- Simulation pure et déterministe dans `src/sim` (aucun Phaser, aucun `Math.random`, flux aléatoire séparé pour le bord d'arrivée) ; le rendu et le HUD ne lisent que le `Snapshot` et les événements.
- Tests TDD, `npm run typecheck`, `npx vitest run`, `npm run bench` (moyenne ≤ 0,3 ms/pas), `npm run build` doivent passer.
- Décisions durables : Paul ; tout KO = +1 ; compteur neutre « Casseurs neutralisés » ; UI en français ; pixel art ; aucune personne réelle.
- Plafonds existants (40 hostiles actifs) inchangés ; policiers et camion comptent comme des alliés hors de ce plafond.
- Le cahier des charges est mis à jour (v1.9.19) avec ce design.

## 6. Laissé au constructeur

Valeurs exactes (rayon d'extinction, vitesse du camion et des policiers, PV, durées), emplacement précis de l'îlot de cabines (place libre, atteignable), sprites, sons de sirène synthétisés, textes de bannières et d'alertes, indicateurs de bord, intégration au tirage des casses, équilibrage avec le robot de test.

## 7. Précisions après relecture du constructeur (choix de Claude, à vérifier par le porteur)

1. **Déplacement du camion :** il suit le graphe de passages existant (celui des casseurs) pour aller du bord d'entrée à un point de stationnement libre près du lieu en feu ; il ne bloque ni Paul ni les casseurs (il passe « au-dessus » comme un allié sans collision), mais les casseurs peuvent le frapper au contact. Si aucun chemin n'existe, il apparaît au bord le plus proche d'un point atteignable. Pas de couche de déplacement nouvelle : on réutilise le déplacement des casseurs avec une autre vitesse.
2. **Ciblage des casseurs :** le camion et les policiers sont des cibles supplémentaires, au même rang que Paul : un casseur dont l'objectif est un lieu continue ; un casseur sans objectif de lieu ou « attiré par Paul » prend le plus proche entre Paul, le camion ou un policier dans un rayon de 160 px. Les casseurs combattent donc la police d'eux-mêmes ; un coup assomme un policier (il est perdu), un casseur frappé par un policier est KO. L'équilibre existant (deux urgences, tirage pondéré) ne change pas.
3. **Compte des appels :** 3 + 3 par partie, remis à zéro à chaque nouvelle partie. Un appel compte dès qu'il est accepté, même si le camion est détruit. Un seul camion et un seul groupe de police à la fois : appeler est refusé tant que le précédent est sur la carte.
4. **Accepter ou refuser un appel :** refus (court message sous la cabine, ex. « Aucun feu à éteindre », « Pas assez de casseurs », « Plus d'appels ») et petit son ; la cabine est utilisable seulement debout et Paul à moins de 40 px de sa porte. Une pastille « ! » clignote sur la cabine quand l'appel est utile (un feu brûle ; 8 casseurs ou plus). Le seuil de 8 compte les hostiles actifs (hors file d'attente d'entrée). Priorité d'Agir quand plusieurs actions sont possibles : la plus proche gagne ; à égalité, réparation (caisse à outils) > cabine rouge > cabine bleue.
5. **Équilibre :** les graines existantes peuvent changer : les cabines s'ajoutent au tirage à partir de la manche 3, les tests de tirage sont réécrits, pas préservés. La référence du banc est mise à jour si besoin (≤ 0,3 ms/pas).
6. **Cabines avant la manche 3 :** non attaquables et jamais en feu avant la manche 3 ; elles comptent comme des lieux pour la règle des deux urgences dès la manche 5.
7. **Cabine réparée :** redevient utilisable avec les utilisations qu'il lui restait.
