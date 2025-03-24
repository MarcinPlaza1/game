"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BootScene_1 = __importDefault(require("./scenes/BootScene"));
const GameScene_1 = __importDefault(require("./scenes/GameScene"));
const UIScene_1 = __importDefault(require("./scenes/UIScene"));
const LogService_1 = require("./services/LogService");
// Konfiguracja Phaser
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false,
            // Optymalizacja fizyki dla lepszej wydajności
            fps: 60, // Limit FPS dla fizyki
            timeScale: 1, // Normalna prędkość symulacji
            maxSubSteps: 1, // Ograniczenie podkroków fizyki
            skipQuadTree: false, // Używamy quadtree dla kolizji, lepsze dla wielu obiektów
            overlapBias: 4, // Mniejsza wartość, mniej dociekliwe sprawdzanie kolizji
            tileBias: 4, // Mniejsza wartość, mniej dociekliwe sprawdzanie kolizji
            forceX: false // Nie wymuszamy kolizji w osi X
        }
    },
    render: {
        pixelArt: false, // Nie używamy pixel artu
        antialias: false, // Wyłączamy antyaliasing dla lepszej wydajności
        roundPixels: false, // Nie zaokrąglamy pikseli
        disableContextMenu: true, // Wyłączamy menu kontekstowe
        powerPreference: 'high-performance', // Preferuj wydajność nad oszczędzaniem energii
        batchSize: 4096 // Większy rozmiar wsadu dla szybszego renderowania
    },
    fps: {
        target: 60, // Cel 60 FPS
        forceSetTimeOut: false, // Używaj requestAnimationFrame zamiast setTimeout
        min: 20 // Minimalna akceptowalna liczba FPS
    },
    zoom: 1, // Brak zoomu
    disableVisibilityChange: true, // Kontynuuj działanie, gdy okno traci fokus
    scene: [BootScene_1.default, GameScene_1.default, UIScene_1.default]
};
// Zainicjowanie danych globalnych
window.gameData = {
    autoMode: false,
    enemiesKilled: 0
};
// Inicjalizacja systemu logowania
function setupLogging() {
    // Domyślne ustawienia
    LogService_1.logger.setLevel(LogService_1.logger.LEVELS.INFO); // Domyślny poziom INFO
    // Sprawdzamy URL dla parametrów debugowania
    const urlParams = new URLSearchParams(window.location.search);
    // Włączanie/wyłączanie logów wrogów na podstawie parametru URL
    if (urlParams.has('debug')) {
        window.gameData.debugMode = true;
        LogService_1.logger.setLevel(LogService_1.logger.LEVELS.DEBUG); // Włączamy wszystkie logi
        LogService_1.logger.setCategory('ENEMY_POSITION', true); // Włączamy pozycje wrogów
        LogService_1.logger.setCategory('DEBUG', true); // Włączamy debugowanie
        LogService_1.logger.info("Tryb debugowania włączony", "GAME_STATE");
    }
    // Sprawdzamy, czy tryb wydajności ma być wyłączony
    if (urlParams.has('performance') && urlParams.get('performance') === 'low') {
        window.gameData.performanceMode = false;
        LogService_1.logger.info("Tryb wydajności wyłączony", "GAME_STATE");
    }
    // Rejestrujemy skrót klawiszowy do przełączania debugowania
    document.addEventListener('keydown', (event) => {
        // Przełączanie debugowania klawiszem F2
        if (event.key === 'F2') {
            window.gameData.debugMode = !window.gameData.debugMode;
            if (window.gameData.debugMode) {
                LogService_1.logger.setLevel(LogService_1.logger.LEVELS.DEBUG);
                LogService_1.logger.setCategory('ENEMY_POSITION', true);
                LogService_1.logger.setCategory('DEBUG', true);
                LogService_1.logger.info("Tryb debugowania włączony (F2)", "GAME_STATE");
            }
            else {
                LogService_1.logger.setLevel(LogService_1.logger.LEVELS.INFO);
                LogService_1.logger.setCategory('ENEMY_POSITION', false);
                LogService_1.logger.setCategory('DEBUG', false);
                LogService_1.logger.info("Tryb debugowania wyłączony (F2)", "GAME_STATE");
            }
        }
        // Przełączanie logów pozycji wrogów klawiszem F3
        if (event.key === 'F3') {
            const enemyPosEnabled = !LogService_1.logger.enabledCategories.ENEMY_POSITION;
            LogService_1.logger.setCategory('ENEMY_POSITION', enemyPosEnabled);
            LogService_1.logger.info(`Logi pozycji wrogów ${enemyPosEnabled ? 'włączone' : 'wyłączone'} (F3)`, "GAME_STATE");
        }
        // Przełączanie trybu wydajności klawiszem F4
        if (event.key === 'F4') {
            window.gameData.performanceMode = !window.gameData.performanceMode;
            LogService_1.logger.info(`Tryb wydajności ${window.gameData.performanceMode ? 'włączony' : 'wyłączony'} (F4)`, "GAME_STATE");
        }
    });
}
// Funkcja ograniczająca efekty wizualne i cząsteczki w trybie niskiej wydajności
function setupPerformanceControl(game) {
    // Zmienne monitorujące wydajność
    let lowFpsCount = 0;
    let lastFps = 60;
    let maxEnemiesReduced = false;
    // Co 1 sekundę sprawdzamy FPS i dostosowujemy efekty wizualne
    setInterval(() => {
        // Szacunkowy FPS
        const currentFps = game.loop.actualFps;
        // Jeśli FPS spadł znacznie poniżej celu, włączamy tryb wydajności
        if (currentFps < 25 && !window.gameData.performanceMode) {
            lowFpsCount++;
            // Jeśli mamy niski FPS przez 3 kolejne pomiary, włączamy tryb wydajności
            if (lowFpsCount >= 3) {
                window.gameData.performanceMode = true;
                LogService_1.logger.info(`Wykryto utrzymujący się niski FPS (${Math.round(currentFps)}), włączono tryb wysokiej wydajności`, "PERFORMANCE");
                // Wyświetlamy komunikat w grze
                if (game.scene.scenes.length > 0) {
                    try {
                        const activeScene = game.scene.scenes.find(scene => scene.sys.settings.active);
                        if (activeScene) {
                            const performanceText = activeScene.add.text(400, 300, "Włączono tryb wysokiej wydajności", {
                                fontSize: '18px',
                                fill: '#ffffff',
                                backgroundColor: '#000000',
                                padding: { x: 10, y: 5 }
                            }).setOrigin(0.5);
                            activeScene.tweens.add({
                                targets: performanceText,
                                alpha: 0,
                                y: 280,
                                duration: 3000,
                                onComplete: () => performanceText.destroy()
                            });
                        }
                    }
                    catch (error) {
                        console.error("Błąd podczas wyświetlania komunikatu:", error);
                    }
                }
            }
        }
        else if (currentFps >= 50 && window.gameData.performanceMode && lowFpsCount > 0) {
            // Jeśli FPS jest stabilny i wysoki, możemy zresetować licznik niskiego FPS
            lowFpsCount = Math.max(0, lowFpsCount - 1);
        }
        // Jeśli FPS nadal spada mimo włączonego trybu wydajności, redukujemy liczbę wrogów
        if (currentFps < 20 && window.gameData.performanceMode && !maxEnemiesReduced) {
            try {
                // Próbujemy uzyskać dostęp do systemu wrogów i zmniejszyć limit
                const gameScene = game.scene.scenes.find(scene => scene.sys.settings.key === 'GameScene');
                if (gameScene && gameScene.enemySystem) {
                    const originalLimit = gameScene.enemySystem.maxEnemiesOnScreen;
                    gameScene.enemySystem.maxEnemiesOnScreen = Math.floor(originalLimit * 0.6); // Zmniejszamy limit o 40%
                    LogService_1.logger.info(`Wykryto bardzo niski FPS (${Math.round(currentFps)}), zmniejszono limit wrogów z ${originalLimit} do ${gameScene.enemySystem.maxEnemiesOnScreen}`, "PERFORMANCE");
                    maxEnemiesReduced = true;
                }
            }
            catch (error) {
                console.error("Błąd podczas zmniejszania limitu wrogów:", error);
            }
        }
        // Zapisujemy ostatni FPS
        lastFps = currentFps;
    }, 1000);
}
// Inicjalizacja Phaser i uruchomienie gry
function startGame() {
    // Konfiguracja logowania
    setupLogging();
    // Globalny handler błędów, aby gra nie crashowała
    window.onerror = function (message, source, lineno, colno, error) {
        console.error(`Błąd w grze: ${message}`);
        LogService_1.logger.error(`Przechwycono błąd: ${message} (${source}:${lineno}:${colno})`, "ERROR");
        // Wyświetlamy komunikat o błędzie, jeśli gra już jest uruchomiona i scena jest dostępna
        if (window.game && window.game.scene && window.game.scene.scenes) {
            try {
                const activeScene = window.game.scene.scenes.find(scene => scene.sys.settings.active);
                if (activeScene) {
                    const errorText = activeScene.add.text(400, 300, "Wystąpił błąd. Odśwież stronę.", {
                        fontSize: '18px',
                        fill: '#ff0000',
                        backgroundColor: '#000000',
                        padding: { x: 10, y: 5 }
                    }).setOrigin(0.5);
                    errorText.setDepth(1000); // Na wierzchu wszystkiego
                }
            }
            catch (displayError) {
                console.error("Nie udało się wyświetlić komunikatu o błędzie:", displayError);
            }
        }
        // Zwracamy true, aby zapobiec domyślnej obsłudze błędu przez przeglądarkę
        return true;
    };
    // Dodatkowe zabezpieczenie dla obiektu cooldownRing w przypadku problemu
    const originalAddCircle = Phaser.GameObjects.GameObjectFactory.prototype.circle;
    Phaser.GameObjects.GameObjectFactory.prototype.circle = function (x, y, radius, fillColor, fillAlpha) {
        try {
            return originalAddCircle.call(this, x, y, radius, fillColor, fillAlpha);
        }
        catch (error) {
            console.error("Błąd podczas tworzenia koła:", error);
            LogService_1.logger.error(`Błąd podczas tworzenia koła: ${error instanceof Error ? error.message : 'Unknown error'}`, "ERROR");
            // Zwracamy pusty obiekt z niezbędnymi metodami, aby gra się nie crashowała
            return {
                x: x,
                y: y,
                setAlpha: function () { return this; },
                setDepth: function () { return this; },
                setOrigin: function () { return this; },
                destroy: function () { },
                destroyed: false
            };
        }
    };
    // Automatycznie włączamy tryb wysokiej wydajności na urządzeniach mobilnych
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        // Dla urządzeń mobilnych zmniejszamy jakość grafiki
        config.render.antialias = false;
        config.render.roundPixels = false;
        config.fps.target = 30; // Obniżamy cel FPS dla urządzeń mobilnych
        window.gameData.performanceMode = true;
    }
    // Wykrywamy starsze przeglądarki i słabsze urządzenia
    const isLowEndDevice = () => {
        // Sprawdzamy ilość rdzeni procesora (jeśli jest dostępna)
        const cpuCores = navigator.hardwareConcurrency || 4;
        // Sprawdzamy czy przeglądarka ma opóźnione API - wskazówka starszego urządzenia
        const hasSlowAPI = !window.requestAnimationFrame || !window.performance;
        return cpuCores <= 2 || hasSlowAPI;
    };
    // Jeśli wykryto słabe urządzenie, włączamy tryb wydajności
    if (isLowEndDevice()) {
        window.gameData.performanceMode = true;
        LogService_1.logger.info("Wykryto słabe urządzenie, włączono tryb wysokiej wydajności", "PERFORMANCE");
    }
    // Inicjalizacja gry
    window.game = new Phaser.Game(config);
    // Konfiguracja monitorowania wydajności
    setupPerformanceControl(window.game);
}
// Uruchamiamy grę
startGame();
//# sourceMappingURL=main.js.map