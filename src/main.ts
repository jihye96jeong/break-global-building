import './style.css';
import { Game } from './game/Game';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const game = new Game(canvas);
void game.boot();
// stop pinch-zoom / double-tap zoom and long-press menus from interrupting play
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
(window as unknown as { __game?: Game }).__game = game; // QA hook for automated playtests
