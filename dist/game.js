"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BootScene_1 = __importDefault(require("./scenes/BootScene"));
const GameScene_1 = __importDefault(require("./scenes/GameScene"));
const UIScene_1 = __importDefault(require("./scenes/UIScene"));
window.gameData = {
    autoMode: false,
    enemiesKilled: 0,
    performanceMode: false // Tryb wydajności - mniej efektów wizualnych
};
// Konfiguracja gry
const config = {
    type: Phaser.CANVAS,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // Grawitacja ustawiana indywidualnie per obiekt dla lepszej kontroli
            debug: false,
            tileBias: 16, // Pomaga zapobiegać "zapadaniu się" w podłoże
            fps: 60 // Ustalamy stałą liczbę klatek dla fizyki
        }
    },
    scene: [BootScene_1.default, GameScene_1.default, UIScene_1.default],
    canvasStyle: 'display: block; margin: 0 auto;',
    render: {
        pixelArt: false,
        antialias: true,
        roundPixels: true
    },
    contextCreation: {
        willReadFrequently: true
    }
};
// Dodajemy obsługę błędów
window.addEventListener('error', function (event) {
    console.error('Error caught:', event.error);
});
// Inicjalizacja gry
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicjalizacja gry...');
    try {
        // Zapisujemy referencję do obiektu gry w globalnym obiekcie window
        window.game = new Phaser.Game(config);
        console.log('Gra zainicjowana pomyślnie');
        // Dodajemy awaryjny handler, który sprawdza czy gra zaczęła działać po określonym czasie
        setTimeout(() => {
            if (window.game && window.game.scene) {
                const activeScenes = Object.keys(window.game.scene.keys).filter(key => window.game.scene.isActive(key));
                console.log('Aktywne sceny po 3 sekundach:', activeScenes);
                // Jeśli GameScene nie jest aktywna, spróbujmy ją uruchomić
                if (!window.game.scene.isActive('GameScene')) {
                    console.log('GameScene nie jest aktywna po 3 sekundach, próbuję uruchomić...');
                    if (window.game.scene.isActive('BootScene')) {
                        console.log('BootScene jest aktywna - zatrzymuję ją i uruchamiam GameScene');
                        window.game.scene.stop('BootScene');
                    }
                    window.game.scene.start('GameScene');
                }
            }
            else {
                console.log('Obiekt gry nie jest dostępny po 3 sekundach');
            }
        }, 3000);
    }
    catch (error) {
        console.error('Błąd inicjalizacji gry:', error);
    }
});
//# sourceMappingURL=game.js.map