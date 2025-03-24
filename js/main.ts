// main.ts - główny plik wejściowy, zmodularyzowany i ulepszony
import { GameContext } from './context/GameContext';
import { GameStateManager } from './managers/GameStateManager';
import { ResourceManager } from './managers/ResourceManager';
import { PerformanceManager } from './managers/PerformanceManager';
import { ErrorHandler } from './managers/ErrorHandler';
import { DeviceCapabilities } from './utils/DeviceCapabilities';
import { SceneManager } from './managers/SceneManager';
import { LogManager } from './managers/LogManager';
import { CONFIG } from './config/gameConfig';

import BootScene from './scenes/BootScene';
import GameScene from './scenes/GameScene';
import UIScene from './scenes/UIScene';

/**
 * Główna funkcja inicjalizująca grę
 */
function startGame(): void {
    // Inicjalizacja kontekstu gry - centralne zarządzanie zależnościami i stanem
    const context = new GameContext();
    
    // Inicjalizacja menedżerów i usług
    const deviceCapabilities = new DeviceCapabilities();
    const stateManager = new GameStateManager();
    const errorHandler = new ErrorHandler();
    const logManager = new LogManager();
    
    // Konfigurowanie logowania na podstawie opcji i możliwości urządzenia
    logManager.configure({ 
        baseLevel: CONFIG.DEBUG ? 'debug' : 'info',
        disableCategories: deviceCapabilities.isLowEndDevice() ? ['ENEMY_POSITION', 'DEBUG'] : []
    });
    
    // Rejestracja menedżerów w kontekście aplikacji
    context.registerService('deviceCapabilities', deviceCapabilities);
    context.registerService('state', stateManager);
    context.registerService('log', logManager);
    context.registerService('error', errorHandler);
    
    // Inicjalizacja gry z konfiguracją dostosowaną do urządzenia
    const gameConfig = createPhaserConfig(deviceCapabilities);
    const game = new Phaser.Game(gameConfig);
    
    // Rejestracja instancji gry w kontekście
    context.registerService('game', game);
    
    // Inicjalizacja menedżerów zależnych od instancji gry
    const resourceManager = new ResourceManager(game, logManager);
    const performanceManager = new PerformanceManager(game, stateManager, deviceCapabilities);
    const sceneManager = new SceneManager(game, context);
    
    context.registerService('resources', resourceManager);
    context.registerService('performance', performanceManager);
    context.registerService('scenes', sceneManager);
    
    // Konfiguracja obsługi błędów
    errorHandler.configureGlobalErrorHandling(game, context);
    
    // Rozpoczęcie monitorowania wydajności
    performanceManager.startMonitoring();
    
    // Konfiguracja cyklu życia gry
    setupGameLifecycle(game, context);
    
    // Rejestracja scen
    sceneManager.registerScenes([
        { key: 'BootScene', sceneClass: BootScene },
        { key: 'GameScene', sceneClass: GameScene },
        { key: 'UIScene', sceneClass: UIScene }
    ]);
    
    // Nasłuchiwanie na zmiany stanu
    stateManager.subscribe(handleStateChange);
    
    // Ekspozycja API dla narzędzi deweloperskich w trybie debugowania
    if (CONFIG.DEBUG) {
        window.__gameDebug = {
            context,
            getState: () => stateManager.getState(),
            togglePerformanceMode: () => {
                const currentState = stateManager.getState();
                stateManager.setState({ performanceMode: !currentState.performanceMode });
            }
        };
    }
    
    logManager.info("Gra zainicjalizowana pomyślnie", "GAME_STATE");
}

/**
 * Tworzy konfigurację Phaser dostosowaną do urządzenia
 */
function createPhaserConfig(deviceCapabilities: DeviceCapabilities): Phaser.Types.Core.GameConfig {
    const settings = deviceCapabilities.getRecommendedSettings();
    
    return {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 0 },
                debug: CONFIG.DEBUG,
                fps: settings.fps,
                timeScale: 1,
                maxSubSteps: settings.lowEnd ? 1 : 3,
                skipQuadTree: settings.lowEnd,
                overlapBias: 4,
                tileBias: 4,
                forceX: false
            }
        },
        render: {
            pixelArt: false,
            antialias: settings.antialias,
            roundPixels: settings.roundPixels,
            disableContextMenu: true,
            powerPreference: settings.highPerformance ? 'high-performance' : 'default',
            batchSize: settings.lowEnd ? 2048 : 4096
        },
        fps: {
            target: settings.fps,
            forceSetTimeOut: settings.lowEnd,
            min: 20
        },
        zoom: 1,
        disableVisibilityChange: true,
        // Sceny zostaną dodane przez SceneManager
        scene: []
    };
}

/**
 * Obsługuje zmiany stanu gry
 */
function handleStateChange(oldState: GameData, newState: GameData): void {
    // Działania przy zmianie trybu wydajności
    if (oldState.performanceMode !== newState.performanceMode) {
        const logManager = GameContext.getService('log');
        logManager.info(`Zmieniono tryb wydajności na: ${newState.performanceMode ? 'włączony' : 'wyłączony'}`, "GAME_STATE");
    }
}

/**
 * Konfiguruje cykl życia gry (inicjalizacja, sprzątanie)
 */
function setupGameLifecycle(game: Phaser.Game, context: GameContext): void {
    // Obsługa zamykania gry
    window.addEventListener('beforeunload', () => {
        if (game) {
            const resourceManager = context.getService('resources');
            const logManager = context.getService('log');
            
            // Czyszczenie zasobów
            resourceManager.cleanupAllResources();
            
            // Zatrzymanie wszystkich scen
            Object.keys(game.scene.keys).forEach(key => {
                game.scene.stop(key);
            });
            
            // Zniszczenie instancji gry
            game.destroy(true);
            
            logManager.info("Gra zamknięta poprawnie", "GAME_STATE");
        }
    });
    
    // Awaryjne uruchomienie gry
    setupFallbackStartup(game, context);
}

/**
 * Konfiguruje awaryjny mechanizm uruchomienia gry
 */
function setupFallbackStartup(game: Phaser.Game, context: GameContext): void {
    let startupAttempts = 0;
    const maxAttempts = 3;
    const logManager = context.getService('log');
    
    const checkStartup = () => {
        // Sprawdzamy czy główna scena jest aktywna
        if (game && game.scene && game.scene.isActive('GameScene')) {
            logManager.info('GameScene uruchomiona pomyślnie', "GAME_STATE");
            return;
        }
        
        if (startupAttempts < maxAttempts) {
            startupAttempts++;
            logManager.warn(`Próba ${startupAttempts} awaryjnego uruchomienia gry...`, "GAME_STATE");
            
            try {
                // Jeśli BootScene utknęła, zatrzymujemy ją
                if (game.scene.isActive('BootScene')) {
                    logManager.info('BootScene utknęła - próba restartu', "GAME_STATE");
                    game.scene.stop('BootScene');
                }
                
                // Próbujemy uruchomić GameScene bezpośrednio
                game.scene.start('GameScene');
                
                // Sprawdzamy ponownie po krótkim czasie
                setTimeout(() => {
                    if (!game.scene.isActive('GameScene')) {
                        logManager.error('Nie udało się uruchomić GameScene', "GAME_STATE");
                        
                        // Ostatnia próba: restart całej gry
                        if (startupAttempts === maxAttempts) {
                            showStartupErrorMessage(game);
                        } else {
                            // Próbujemy ponownie z wykładniczym backoffem
                            setTimeout(checkStartup, Math.pow(2, startupAttempts) * 1000);
                        }
                    }
                }, 500);
            } catch (error) {
                logManager.error(`Błąd podczas awaryjnego uruchamiania: ${error instanceof Error ? error.message : String(error)}`, "ERROR");
                showStartupErrorMessage(game);
            }
        } else {
            showStartupErrorMessage(game);
        }
    };
    
    // Pierwsza kontrola po 2 sekundach
    setTimeout(checkStartup, 2000);
}

/**
 * Wyświetla przyjazny komunikat o błędzie podczas uruchamiania
 */
function showStartupErrorMessage(game: Phaser.Game): void {
    try {
        // Tworzymy prostą scenę z komunikatem o błędzie
        class ErrorScene extends Phaser.Scene {
            constructor() {
                super({ key: 'ErrorScene' });
            }
            
            create() {
                this.add.rectangle(400, 300, 800, 600, 0x000000);
                
                const title = this.add.text(400, 200, 'Wystąpił problem podczas uruchamiania gry', {
                    fontSize: '24px',
                    color: '#ff0000',
                    fontStyle: 'bold'
                }).setOrigin(0.5);
                
                const message = this.add.text(400, 250, 'Spróbuj odświeżyć stronę lub sprawdź zgodność przeglądarki.', {
                    fontSize: '18px',
                    color: '#ffffff'
                }).setOrigin(0.5);
                
                const retryButton = this.add.rectangle(400, 350, 200, 50, 0x4a4a4a).setInteractive();
                const retryText = this.add.text(400, 350, 'Spróbuj ponownie', {
                    fontSize: '18px',
                    color: '#ffffff'
                }).setOrigin(0.5);
                
                retryButton.on('pointerup', () => {
                    window.location.reload();
                });
                
                retryButton.on('pointerover', () => {
                    retryButton.fillColor = 0x666666;
                });
                
                retryButton.on('pointerout', () => {
                    retryButton.fillColor = 0x4a4a4a;
                });
            }
        }
        
        // Zatrzymujemy wszystkie sceny i uruchamiamy scenę błędu
        game.scene.scenes.forEach(scene => {
            game.scene.stop(scene.scene.key);
        });
        
        game.scene.add('ErrorScene', ErrorScene, true);
    } catch (error) {
        // Ostatnia deska ratunku - prosty alert
        console.error("Krytyczny błąd podczas uruchamiania gry", error);
        alert("Nie udało się uruchomić gry. Spróbuj odświeżyć stronę.");
    }
}

// Uruchamiamy grę po załadowaniu strony
window.onload = startGame;