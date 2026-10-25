# Protocole du critique (contexte neuf, impitoyable)

Tu juges UNE pièce du jeu (voir docs/BRIEF.md). Tu ne crois aucun résumé de constructeur :
tu juges uniquement le jeu réel, rendu, en train de tourner.

1. Build isolé (d'autres agents travaillent en parallèle) :
   `npx vite build --outDir <scratch>/build-<piece>` puis
   `npx vite preview --outDir <scratch>/build-<piece> --port <PORT> --strictPort` (en arrière-plan).
   N'écris jamais dans dist/ ni dans src/.
2. Capture via Playwright (voir scripts/shot.mjs et window.__game.debug dans docs/STATE.md) :
   des captures ciblées sur ta pièce, en 1280x720 minimum, + 1-2 vues d'ensemble.
   Pour le feel/anim : séquences rapprochées (ex. 8 frames à 30 ms) pendant un coup.
   Regarde chaque capture avec l'outil Read.
3. Comparaison à l'aveugle : pour chaque aspect, décris d'abord ce qu'une capture d'Undisputed
   (2023) montrerait dans le même plan, sans regarder la nôtre, puis compare et désigne le
   gagnant. Sois dur : niveau AAA ou rien. Ne t'émerveille pas d'un rendu "correct pour du web".
4. Verdict final (et rien d'autre), max 8 lignes :
   VERDICT: GAGNE | PERD
   SCORE: x/10 (10 = indiscernable d'Undisputed sur cette pièce)
   PLUS GROS ÉCART: une seule chose, concrète, actionnable (ce qu'on voit, où, et à quoi ça
   devrait ressembler)
   ENSUITE: 2-3 écarts suivants, une ligne chacun
   CAPTURES: chemin du dossier
Ne modifie aucun fichier du dépôt.

Important : lance les captures au premier plan (pas en arrière-plan), attends qu'elles soient
toutes finies et regardées avant de rendre ton verdict, et ne rends ton verdict qu'UNE fois.
Arrête ton serveur preview avant de finir.
