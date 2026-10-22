# BreakBreaker — Prison (design)

Date : 2026-10-22. Statut : décrit en chat et validé (« c'est parfait »). Les points marqués *(choix de Claude)* sont des propositions non contredites. Dépend du design `2026-10-22-emergency-services-design.md` (alliés, cibles accessoires) : à construire après.

## 1. Pourquoi

Le Caïd est un mini-boss qui disparaît après son KO. La prison donne une suite à ce KO (les Caïds capturés sont conservés) et un enjeu : la défendre pour ne pas libérer tous les Caïds d'un coup. Succès : le joueur se dit « si la prison tombe, je suis dans le pétrin ».

**Anti-buts :** prison indestructible ou trop facile à perdre ; gardiens qui bloquent le jeu ; aucune personne réelle ni référence à un individu.

## 2. Règles (porteur du projet)

- Un bâtiment **prison**, destructible, **beaucoup plus résistant** que les autres.
- Elle sert à mettre **les Caïds** en prison.
- **5 policiers** la défendent et ne font **rien d'autre** que la défendre.
- Détruite, elle **libère tous les Caïds** emprisonnés, qui peuvent alors attaquer.
- On peut la **reconstruire**.
- Les policiers peuvent être KO ; ils ont **la même barre de vie que les Caïds**.

## 3. Précisions (choix de Claude)

- **Emprisonnement :** un Caïd mis KO par Paul est emmené par un fourgon cartoon et entre en prison (+5 comme aujourd'hui). Compteur « Caïds enfermés : N » sur la prison. Sans prison debout, le Caïd est simplement KO comme avant.
- **Attaque :** elle entre dans le tirage des casses (même mécanique que les autres lieux) dès la manche 4 ; 400 PV (quatre fois un bâtiment) ; feu, ruine, points sauvé / perdu / réparé comme un grand bâtiment (+8 / −3 / +5). Elle compte pour la règle des deux urgences.
- **Libération :** à 0 PV, tous les Caïds enfermés sortent d'un coup devant la prison et attaquent Paul ; leur vie est celle de la manche de libération. Ils comptent dans l'effectif de la manche en cours (ajoutés à T). Aucun nouvel emprisonnement tant que la prison est en ruine.
- **Reconstruction :** par la caisse à outils, comme tout bâtiment ; les Caïds libérés restent libres ; remise à 60 % des PV comme les autres.
- **Gardiens :** 5 policiers à matraque (même sprite que la police des cabines, une casquette différente), postés autour de la prison, qui frappent les casseurs à moins de 160 px sans s'éloigner de plus de 160 px de leur poste. Vie = celle d'un Caïd de la manche en cours (`CONFIG.caid.hp` à la manche courante, mini 14). Un gardien KO revient à la fin de la manche (pendant le répit) sauf si la prison est en ruine. Distincts des policiers de la cabine bleue ; hors plafond de 40 hostiles.
- **Emplacement :** un grand bâtiment libre du côté est ou sud-est de la carte, atteignable, avec une porte sur la rue, à choisir par le constructeur.

## 4. Contraintes

Simulation pure et déterministe (aucun `Math.random`), TDD, typecheck / vitest / bench ≤ 0,3 ms/pas / build verts, cahier mis à jour (v1.9.20), UI en français, pixel art, tout KO = +1, compteur neutre.

## 5. Laissé au constructeur

Valeurs exactes (PV, rayons, vitesses), dessin du bâtiment (murs gris, barreaux, miradors, drapeau), fourgon et animation d'entrée, textes de bannière (« PRISON ATTAQUÉE ! », « ÉVASION ! »), sons, équilibrage au robot de test.
