# BRIEF — "Iron Pit" : boxe hyper-réaliste dans le navigateur (Three.js)

## Vision
Un combat de boxe 1v1, tendu, beau, rejouable, au niveau AAA. Ambiance : salle de boxe
clandestine délabrée (béton fissuré, peinture écaillée, néons qui grésillent, fumée,
poussière dans les faisceaux, ring usé, cordes tachées, foule dans la pénombre).
Référence de comparaison (validée par l'utilisateur) : **Undisputed (Steel City Interactive, 2023)**.
Le critique compare nos captures réelles avec ce qu'il sait d'Undisputed (visuels, feel, poids
des coups, réactions, éclairage, caméra, HUD minimaliste).

## Tech
- Three.js (npm) + Vite. Tout procédural ou généré en code (pas d'assets externes téléchargés,
  le réseau est limité ; npm fonctionne). Textures générées par canvas/shaders.
- `npm run dev` (port 5173), `npm run build` -> `dist/`. Le build doit marcher hors-ligne,
  sans CDN (il sera publié comme page web sandboxée : pas de fetch externe).
- Code modulaire dans `src/` : un dossier par pièce (voir ci-dessous) pour que plusieurs
  agents puissent travailler en parallèle sans conflits. `src/main.js` reste mince.
- 60 fps visés sur un laptop correct. Réglage qualité auto si besoin.
- Hook de test : `window.__game` expose l'état (round, santé, endurance, positions) et des
  helpers de debug (`__game.debug.*`, ex. forcer un coup, un KO, une position caméra) pour que
  le critique puisse capturer des moments précis via Playwright.
- Chromium + Playwright préinstallés : `require('playwright')`, `chromium.launch()` sans options
  (lancer avec `--use-gl=angle --use-angle=swiftshader` ou `--enable-unsafe-swiftshader` si WebGL manque).

## Pièces (chacune jugée séparément)
1. fondations — boucle, scène, input, états du jeu, hook `__game`
2. arene — salle délabrée, ring, cordes, poteaux, foule, décor
3. lumiere — éclairage, ombres, post-process (bloom, grain, vignette, DOF, color grading), fumée
4. boxeurs-modele — corps, peau (SSS fake), muscles, shorts, gants, visage, sueur, blessures
5. boxeurs-anim — garde, déplacements, jabs/crochets/uppercuts/corps, esquives, réactions, IK
6. combat-feel — impacts, hit-stop, secousse caméra, ralenti, particules sueur/sang, contres
7. ia — adversaire crédible, styles, adaptation, difficulté
8. regles — endurance, dégâts localisés, knockdown/compte, rounds, juges, KO, victoire
9. audio — WebAudio procédural : impacts, foule réactive, cloche, souffle, ambiance
10. hud-menus — HUD minimal façon diffusion TV, menu titre, pause, fin de combat, réglages
11. camera — caméra de combat, intro de combat, replays/ralenti KO, entre-rounds

## Règles pour les agents
- Lire ce fichier + `docs/STATE.md` (état courant) avant de travailler.
- Ne PAS committer : l'orchestrateur committe.
- Ne toucher que les fichiers de sa pièce, sauf intégration minimale nécessaire (signaler).
- À la fin, mettre à jour la section de sa pièce dans `docs/STATE.md` (3-5 lignes max).
- Réponse finale à l'orchestrateur : 5 lignes max.
