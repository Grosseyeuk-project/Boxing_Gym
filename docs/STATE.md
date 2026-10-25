# STATE — état courant (vague 0)

## Lancer / capturer
- `npm install` puis `npm run dev` (http://localhost:5173) ; `npm run build` → `dist/index.html` **autonome** (JS+CSS inlinés par vite-plugin-singlefile, aucun fetch externe) ; `npm run preview` (4173).
- Paramètres d'URL : `?quality=low|medium|high` (désactive la qualité auto), `seed=N`, `difficulty=facile|normal|difficile`, `roundTime=S`, `nointro`.
- Captures : `node scripts/shot.mjs <dossier> [--dev] [--url=...] [--quality=high] [--size=1280x720]` (build si besoin, lance `vite preview`, Chromium/SwiftShader, gèle la sim et l'avance de façon déterministe ; 12 captures titre → KO + état final dans la console). ~3-4 min sous SwiftShader.
- Hook : `window.__game.state` (état, phase, round, chrono, caméra, fps, boxeurs : santé/endurance/état/position), `window.__game.events` (200 derniers événements du bus), `window.__game.debug.*` : `startFight() skipIntro() punch(type, who, body) block(on, who) dodge(dir, who) knockdown(who) ko(who, instant) setCamera(preset) cameraPresets() setAI(bool) setDifficulty(d) advance(s) setPositions(dist, angle) setHealth(who, v) pause(p) freeze(on) setQuality(q) setTimeScale(t) hideUI(on)`. `who` = `'player'|'opponent'`.

## Architecture / contrats
- `src/main.js` mince → `src/fondations/game.js` crée et câble toutes les pièces. Chaque pièce n'expose qu'une fabrique (`buildArena`, `createLighting`, `createFighterModel`, `createAnimator`, `createFeel`, `AIController`, `Match`, `createAudio`, `createHUD`, `CameraRig`).
- Bus (`src/fondations/events.js`, liste des événements + payloads en tête de fichier) : `punchStart whiff dodge block hit knockdown count getUp ko fightEnd roundStart roundEnd bell hudMessage stateChange pause`. audio / caméra / hud / feel / anim n'écoutent que le bus.
- Simulation à pas fixe 60 Hz (`loop.js`), rendu interpolé (`prevPos/pos`, `alpha`), `loop.timeScale` (ralenti) et `loop.hitstop(s)`. L'animation est purement visuelle : elle lit `fighter.state/action` et ne modifie jamais la simulation.
- Intention de contrôle commune joueur/IA : `{ moveF, moveS, punch: {type, body} | null, block, dodge: 'left'|'right'|'back'|'duck' | null }`.
- Repère : ring centré en (0,0), tapis à y = `RING.floorY` (1.0 m) ; boxeur local : regarde +Z, gauche = +X, garde orthodoxe (main gauche = lead).

## 1. fondations — `src/fondations/`
`game.js` (états title→intro→fight→ended, pause, qualité auto selon fps), `loop.js`, `events.js`, `input.js` (clavier/souris, tampon d'entrées 250 ms, table `CONTROLS` affichée dans les menus), `fighter.js` (entité : état, déplacement, orientation, séparation), `rng.js` (seedé), `debug.js`, `constants.js`.
Limites : pas de manette ; pas de rebinding des touches ; la qualité auto ne descend que (pas de remontée).

## 2. arene — `src/arene/`
`index.js` : salle 26×22 m béton + briques à peinture écaillée, poutres/tuyaux/piliers, ring surélevé (toile usée avec logo délavé, jupe, poteaux, coussins rouge/bleu/neutres, 4 cordes affaissées en tubes, sangles, marches), chaises, table des juges, barrières, sacs, affiches, 3 néons (dont un qui grésille), rampe lumineuse, ampoules ; foule instanciée (~200 silhouettes, sautillent avec l'excitation audio). `textures.js` : textures canvas procédurales. Expose `lightAnchors` (néons/ampoules/rampe, intensité animée) consommés par lumiere.
Limites : silhouettes de foule très simples ; pas de normal maps ; pas de détritus/fumée de cigarette.

## 3. lumiere — `src/lumiere/`
`index.js` : hémisphère faible, spot principal ombré (PCF soft) sous la rampe, 2 spots de modelé, point lights sur les ancres (néons), brouillard exp2, presets `QUALITY`. `atmosphere.js` : poussière (Points additifs) + cône volumétrique factice (shader additif, s'efface près de la caméra). `post.js` : EffectComposer Render → UnrealBloom → OutputPass (ACES + sRGB) → pass "grade" (aberration, étalonnage, vignette, grain, uniformes `uImpact/uDamage/uDesat` pilotés par combat-feel).
Limites : pas de DOF, pas de SSAO, rendu un peu voilé/laiteux, ombres d'un seul spot.

## 4. boxeurs-modele — `src/boxeurs-modele/`
`index.js` : rig d'Object3D (hips, spine, chest, neck, head, shoulder/elbow/wrist, hip/knee/ankle L/R) + segments rigides sculptés par `loft` d'anneaux superelliptiques (`geometry.js`) : torse avec pectoraux/abdos/trapèzes/dorsaux, deltoïdes, biceps, mollets, short satiné + liserés, bottines, gants avec pouce et liseré, bandes, tête sculptée (mâchoire, arcades, pommettes), nez, oreilles, yeux, sourcils, cheveux ras. `materials.js` : peau MeshPhysical (sheen rougeâtre = faux SSS, clearcoat = sueur), satin, cuir. 2 presets (`PRESETS.player/opponent`). API : `getPartWorld(part)`, `setSweat(v)`, `setDamage(head, body)`.
Limites : pas de skinning (jonctions visibles aux articulations), visage simplifié, blessures = simple rougeur globale.

## 5. boxeurs-anim — `src/boxeurs-anim/`
`index.js` : pose procédurale en couches (garde de profil, respiration/rebond, inclinaison selon la vitesse), coups jab/cross/crochet/uppercut (+ corps) avec rotation hanches/torse et courbe d'extension, blocage, esquives (gauche/droite/duck/recul), garde qui tombe quand sonné, ressorts de réaction à l'impact (tête/torse/bassin), chute/KO et relevé (FK mélangé). `ik.js` : IK 2 os ; bras = cibles de gants (visent le menton/corps adverse), jambes = pieds plantés avec pas automatiques.
Limites : pas de transfert de poids sur les pieds, crochet peu arqué, chute toujours vers l'arrière, pas d'anim de victoire/coin.

## 6. combat-feel — `src/combat-feel/`
`index.js` : hit-stop proportionnel à la puissance (+contre), trauma caméra, flash/aberration d'impact, voile rouge quand le joueur est touché/bas, ralenti + désaturation au knockdown/KO. `particles.js` : gouttelettes de sueur/sang (pool de Points, gravité, se posent sur le tapis).
Limites : pas de déformation du visage, pas de décalques de sang persistants, pas de replay.

## 7. ia — `src/ia/`
`index.js` : `AIController` (gestion de distance, tournoiement, retour au centre près des cordes, combos prédéfinis, blocage/esquive réactifs avec délai de réaction, recul quand fatiguée), difficultés `facile/normal/difficile`.
Limites : pas de styles distincts, pas d'adaptation au joueur, pas de feintes ni de contres délibérés.

## 8. regles — `src/regles/`
`moves.js` (timings/dégâts/portée des coups, esquive, blocage), `stats.js` (santé + plafond récupérable, endurance, dégâts tête/corps, récupération), `combat.js` (résolution à l'entrée en phase active : portée, angle, esquive, blocage, contre ×1.5), `match.js` (3 rounds × 90 s, repos 8 s, knockdown + compte de 10, se relève ou non selon dégâts, 3 knockdowns/round = TKO, 3 juges 10-point-must, décision/nul).
Limites : pas d'arbitre visuel, pas de clinch, relevé automatique (pas de mini-jeu), durée des rounds raccourcie.

## 9. audio — `src/audio/`
`index.js` : WebAudio procédural (démarre au 1er geste) : impacts tête/corps, blocage, whoosh + souffle, cloche (1/2/3 coups), rumeur de foule modulée par l'excitation, bourdonnement des néons, chute au tapis, tic du compte.
Limites : pas de voix d'arbitre/commentaire, pas de spatialisation, pas de réverbération de salle.

## 10. hud-menus — `src/hud-menus/`
`index.js` + `style.js` : HUD TV (plaques noms + santé/plafond/endurance, chrono/round), messages centraux (ROUND, FIGHT, KNOCKDOWN, K.O.), compte, menu titre (difficulté + table des contrôles), pause (qualité, volume, difficulté, contrôles), écran de fin (résultat, méthode, cartes des juges).
Limites : pas de stats de fin de combat détaillées, pas de navigation clavier des menus (Entrée/Échap seulement).

## 11. camera — `src/camera/`
`index.js` : `CameraRig` presets `broadcast` (défaut, côté du joueur, suit l'axe des boxeurs), `close`, `player` (épaule), `overhead`, `ringside`, `intro` (orbite), `ko`, `corner` ; lissage exponentiel, secousse par trauma ; `bindCameraEvents` (plan KO au knockdown/KO, plan large entre les rounds).
Limites : pas de replay, pas de détection de collision avec les cordes/poteaux, intro sans présentation individuelle des boxeurs.

## Contrôles
WASD/flèches (ZQSD en AZERTY) déplacement · clic gauche/J jab · clic droit/K direct · U crochet · I uppercut · Maj + coup = au corps · Espace (maintenir) garde · L ou C esquive (+ direction) · Échap/P pause · Entrée lance le combat.
