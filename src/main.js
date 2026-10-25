// Point d'entrée mince : crée le jeu, installe le hook de debug, démarre la boucle.
import { Game } from './fondations/game.js';
import { installDebug } from './fondations/debug.js';

const game = new Game(document.getElementById('app'));
installDebug(game);
game.start();
