// scenes/EnhancedGameScene.ts
import { EnhancedScene } from '../enhanced/EnhancedScene';
import { CONFIG } from '../config/gameConfig';
import { GameContext } from '../context/GameContext';

/**
 * Rozszerzona scena gry z wykorzystaniem wszystkich ulepszeń
 */
export default class EnhancedGameScene extends EnhancedScene {
    // Systemy gry
    private playerSystem: any;
    private enemySystem: any;
    private combatSystem: any;
    
    // Managers
    private inputManager: any;
    private resourceManager: any;
    
    // UI
    private infoPanel: Phaser.GameObjects.Container | null = null;
    private fpsText: Phaser.GameObjects.Text | null = null;
    private waveText: Phaser.GameObjects.Text | null = null;
    private heroHealthBar: Phaser.GameObjects.Rectangle | null = null;
    
    constructor() {
        super({ key: 'GameScene' });
    }
    
    preload(): void {
        // Standardowe preloadowanie będzie używać ResourceManager
        if (this.context) {
            try {
                const resourceManager = this.context.getService('resources');
                
                // Używamy ResourceManager do ładowania zasobów
                resourceManager.loadTexture(this, 'hero', 'hero.png')
                    .catch(error => console.error('Błąd ładowania tekstury hero:', error));
            } catch (error) {
                console.error('Błąd podczas dostępu do ResourceManager:', error);
            }
        }
    }
    
    create(): void {
        // W rozszerzonej scenie mamy dostęp do kontekstu
        if (!this.context) {
            console.error('Kontekst nie został ustawiony dla sceny');
            return;
        }
        
        const logger = this.context.getService('log');
        logger.info("EnhancedGameScene.create() rozpoczęte", "GAME_STATE");
        
        // Tworzymy tło
        this.createBackground();
        
        // Inicjalizujemy menadżerów
        this.initializeManagers();
        
        // Inicjalizujemy systemy gry
        this.initializeSystems();
        
        // Tworzymy UI
        this.createUI();
        
        // Dodajemy diagnostykę FPS w trybie debugowania
        if (this.debugMode) {
            this.createPerformanceMonitor();
        }
        
        // Wyświetlamy informacje o sterowaniu
        if (this.inputManager) {
            this.inputManager.showControlsInfo(this);
        }
        
        // Rejestrujemy globalne obsługi zdarzeń
        this.setupEventHandlers();
        
        logger.info("EnhancedGameScene.create() zakończone", "GAME_STATE");
    }
    
    /**
     * Tworzy tło gry
     */
    private createBackground(): void {
        // Tło (niebo)
        this.add.rectangle(
            CONFIG.GAME.WIDTH / 2, 
            CONFIG.GAME.HEIGHT / 2, 
            CONFIG.GAME.WIDTH, 
            CONFIG.GAME.HEIGHT, 
            CONFIG.GAME.BACKGROUND_COLOR
        );
        
        // Ziemia - brązowy prostokąt na dole ekranu
        this.safeRectangle(
            CONFIG.GAME.WIDTH / 2, 
            CONFIG.WORLD.GROUND_LEVEL + 50, 
            CONFIG.GAME.WIDTH, 
            100, 
            0x8B4513
        );
        
        // Linia trawy na ziemi
        this.safeRectangle(
            CONFIG.GAME.WIDTH / 2, 
            CONFIG.WORLD.GROUND_LEVEL, 
            CONFIG.GAME.WIDTH, 
            5, 
            0x00AA00
        );
    }
    
    /**
     * Inicjalizuje menadżerów
     */
    private initializeManagers(): void {
        if (!this.context) return;
        
        try {
            // Pobieramy potrzebnych menadżerów z kontekstu
            this.inputManager = this.context.getService('input');
            this.resourceManager = this.context.getService('resources');
            
            const logger = this.context.getService('log');
            logger.debug("Zainicjalizowano menadżerów", "GAME_STATE");
        } catch (error) {
            console.error('Błąd podczas inicjalizacji menadżerów:', error);
        }
    }
    
    /**
     * Inicjalizuje systemy gry
     */
    private initializeSystems(): void {
        // Tutaj będziemy inicjalizować nasze systemy używając wzorców z ulepszonego kodu
        // PlayerSystem, EnemySystem, CombatSystem
        // 
        // Możemy użyć istniejących klas systemów, dostosowując je do naszej architektury:
        
        // Przykładowa inicjalizacja systemów (w rzeczywistym kodzie można użyć istniejących klas)
        this.initializePlayerSystem();
        this.initializeEnemySystem();
        this.initializeCombatSystem();
        
        // Konfigurujemy kolizje między systemami
        this.setupCollisions();
    }
    
    /**
     * Inicjalizuje system gracza
     */
    private initializePlayerSystem(): void {
        const logger = this.context?.getService('log');
        logger?.debug("Inicjalizacja systemu gracza", "GAME_STATE");
        
        // Import PlayerSystem z odpowiednio dostosowanego modułu
        import('../systems/player/PlayerSystem').then(module => {
            try {
                // Tworzenie instancji systemu gracza
                this.playerSystem = new module.default(this);
                this.playerSystem.createHero();
                
                logger?.info("System gracza zainicjalizowany pomyślnie", "GAME_STATE");
            } catch (error) {
                logger?.error(`Błąd podczas inicjalizacji systemu gracza: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "GAME_STATE");
                
                // Awaryjne wyświetlenie komunikatu błędu
                this.showMessage("Nie można zainicjalizować bohatera. Spróbuj ponownie.");
            }
        }).catch(error => {
            logger?.error(`Błąd podczas importowania PlayerSystem: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "GAME_STATE");
        });
    }
    
    /**
     * Inicjalizuje system wrogów
     */
    private initializeEnemySystem(): void {
        const logger = this.context?.getService('log');
        logger?.debug("Inicjalizacja systemu wrogów", "GAME_STATE");
        
        // Import EnemySystem z odpowiednio dostosowanego modułu
        import('../systems/enemies/EnemySystem').then(module => {
            try {
                // Tworzenie instancji systemu wrogów
                this.enemySystem = new module.default(this);
                
                // Konfigurujemy system wrogów
                this.enemySystem.maxEnemiesOnScreen = CONFIG.ENEMIES.MAX_ON_SCREEN;
                
                // Inicjalizujemy system wrogów
                this.enemySystem.initialize();
                
                logger?.info("System wrogów zainicjalizowany pomyślnie", "GAME_STATE");
            } catch (error) {
                logger?.error(`Błąd podczas inicjalizacji systemu wrogów: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "GAME_STATE");
                
                // Awaryjne wyświetlenie komunikatu błędu
                this.showMessage("Nie można zainicjalizować wrogów. Spróbuj ponownie.");
            }
        }).catch(error => {
            logger?.error(`Błąd podczas importowania EnemySystem: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "GAME_STATE");
        });
    }
    
    /**
     * Inicjalizuje system walki
     */
    private initializeCombatSystem(): void {
        const logger = this.context?.getService('log');
        logger?.debug("Inicjalizacja systemu walki", "GAME_STATE");
        
        // Import CombatSystem z odpowiednio dostosowanego modułu
        import('../systems/combat/CombatSystem').then(module => {
            try {
                // Tworzenie instancji systemu walki
                this.combatSystem = new module.default(this);
                
                // Inicjalizujemy system walki
                this.combatSystem.initialize();
                
                logger?.info("System walki zainicjalizowany pomyślnie", "GAME_STATE");
            } catch (error) {
                logger?.error(`Błąd podczas inicjalizacji systemu walki: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "GAME_STATE");
                
                // Awaryjne wyświetlenie komunikatu błędu
                this.showMessage("Nie można zainicjalizować systemu walki. Spróbuj ponownie.");
            }
        }).catch(error => {
            logger?.error(`Błąd podczas importowania CombatSystem: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "GAME_STATE");
        });
    }
    
    /**
     * Konfiguruje kolizje pomiędzy obiektami
     */
    private setupCollisions(): void {
        // Będziemy ręcznie konfigurować kolizje w update() dla lepszej kontroli
        const logger = this.context?.getService('log');
        logger?.debug("Konfiguracja systemu kolizji", "GAME_STATE");
        
        // Dodajemy ręczne sprawdzanie kolizji co kilka klatek
        this.collisionCheckTimer = 0;
        this.collisionCheckInterval = 3; // Co 3 klatki
    }
    
    /**
     * Tworzy UI gry
     */
    private createUI(): void {
        // Panel informacyjny z falą i punktami
        this.infoPanel = this.add.container(400, 30);
        
        // Tło panelu
        const infoBg = this.add.rectangle(0, 0, 400, 50, 0x000000, 0.5);
        this.infoPanel.add(infoBg);
        
        // Tekst fali
        this.waveText = this.add.text(-150, 0, 'Fala: 1', {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        this.infoPanel.add(this.waveText);
        
        // Pasek zdrowia bohatera
        const healthBarBg = this.add.rectangle(100, 0, 150, 20, 0x333333);
        this.infoPanel.add(healthBarBg);
        
        this.heroHealthBar = this.add.rectangle(100, 0, 150, 20, 0xff0000);
        this.infoPanel.add(this.heroHealthBar);
        
        // Tekst zdrowia
        const healthText = this.add.text(100, 0, 'Zdrowie', {
            fontSize: '14px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.infoPanel.add(healthText);
    }
    
    /**
     * Tworzy monitor wydajności
     */
    private createPerformanceMonitor(): void {
        // FPS Counter
        this.fpsText = this.add.text(10, 10, 'FPS: 0', {
            fontSize: '12px',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 5, y: 2 }
        });
        
        // Wysoki depth, aby był zawsze widoczny
        this.fpsText.setDepth(1000);
    }
    
    /**
     * Konfiguruje globalne handlery zdarzeń
     */
    private setupEventHandlers(): void {
        // Nasłuchujemy zmian w stanie gry
        if (this.context) {
            try {
                const stateManager = this.context.getService('state');
                
                // Rejestrujemy obserwatora stanu
                this.stateUnsubscribe = stateManager.subscribe((oldState, newState) => {
                    // Obsługa zmiany trybu wydajności
                    if (oldState.performanceMode !== newState.performanceMode) {
                        this.handlePerformanceModeChange(newState.performanceMode);
                    }
                    
                    // Obsługa zmiany trybu automatycznego
                    if (oldState.autoMode !== newState.autoMode) {
                        this.handleAutoModeChange(newState.autoMode);
                    }
                });
                
                // Reagujemy na naciśnięcie klawiszy systemowych
                this.registerKeyHandlers();
            } catch (error) {
                console.error('Błąd podczas konfiguracji obsługi zdarzeń:', error);
            }
        }
    }
    
    /**
     * Rejestruje obsługę klawiszy
     */
    private registerKeyHandlers(): void {
        if (!this.inputManager) return;
        
        // Rejestrujemy obsługę klawiszy systemowych
        this.inputManager.onKey('SYSTEM_AUTO_MODE', 'justdown', () => {
            if (this.context) {
                const stateManager = this.context.getService('state');
                const state = stateManager.getState();
                stateManager.setState({ autoMode: !state.autoMode });
            }
        });
        
        this.inputManager.onKey('SYSTEM_PERFORMANCE_MODE', 'justdown', () => {
            if (this.context) {
                const stateManager = this.context.getService('state');
                const state = stateManager.getState();
                stateManager.setState({ performanceMode: !state.performanceMode });
            }
        });
        
        this.inputManager.onKey('SYSTEM_DEBUG', 'justdown', () => {
            if (this.context) {
                const stateManager = this.context.getService('state');
                const state = stateManager.getState();
                stateManager.setState({ debugMode: !state.debugMode });
                
                // Włączamy/wyłączamy wyświetlanie FPS
                if (this.fpsText) {
                    this.fpsText.setVisible(!state.debugMode);
                } else if (!state.debugMode) {
                    this.createPerformanceMonitor();
                }
            }
        });
        
        this.inputManager.onKey('SYSTEM_PAUSE', 'justdown', () => {
            this.handlePauseGame();
        });
    }
    
    /**
     * Obsługuje zmianę trybu wydajności
     */
    private handlePerformanceModeChange(enabled: boolean): void {
        // Wyświetlamy komunikat informacyjny
        const message = enabled 
            ? "Włączono tryb wysokiej wydajności"
            : "Wyłączono tryb wysokiej wydajności";
            
        this.showMessage(message);
        
        // Informujemy systemy o zmianie trybu
        this.scene.events.emit('performanceModeChanged', enabled);
    }
    
    /**
     * Obsługuje zmianę trybu automatycznego
     */
    private handleAutoModeChange(enabled: boolean): void {
        // Wyświetlamy komunikat informacyjny
        const message = enabled 
            ? "Włączono tryb automatyczny"
            : "Wyłączono tryb automatyczny";
            
        this.showMessage(message);
        
        // Informujemy systemy o zmianie trybu
        this.scene.events.emit('autoModeChanged', enabled);
    }
    
    /**
     * Obsługuje pauzowanie gry
     */
    private handlePauseGame(): void {
        // Tworzymy menu pauzy
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Warstwa przyciemnienia
        const overlay = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.7)
            .setInteractive()
            .setDepth(1000);
        
        // Panel menu
        const panel = this.add.rectangle(width/2, height/2, 300, 400, 0x333333, 0.9)
            .setDepth(1001);
        
        // Tytuł menu
        const title = this.add.text(width/2, height/2 - 150, 'PAUZA', {
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1002);
        
        // Przycisk kontynuacji
        const resumeButton = this.add.rectangle(width/2, height/2 - 50, 200, 50, CONFIG.UI.BUTTON_COLOR)
            .setInteractive()
            .setDepth(1002);
            
        const resumeText = this.add.text(width/2, height/2 - 50, 'Kontynuuj', {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(1003);
        
        // Efekt najechania na przycisk
        resumeButton.on('pointerover', () => {
            resumeButton.fillColor = CONFIG.UI.BUTTON_HOVER_COLOR;
        });
        
        resumeButton.on('pointerout', () => {
            resumeButton.fillColor = CONFIG.UI.BUTTON_COLOR;
        });
        
        // Przycisk opcji
        const optionsButton = this.add.rectangle(width/2, height/2 + 20, 200, 50, CONFIG.UI.BUTTON_COLOR)
            .setInteractive()
            .setDepth(1002);
            
        const optionsText = this.add.text(width/2, height/2 + 20, 'Opcje', {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(1003);
        
        // Efekt najechania na przycisk
        optionsButton.on('pointerover', () => {
            optionsButton.fillColor = CONFIG.UI.BUTTON_HOVER_COLOR;
        });
        
        optionsButton.on('pointerout', () => {
            optionsButton.fillColor = CONFIG.UI.BUTTON_COLOR;
        });
        
        // Przycisk wyjścia
        const exitButton = this.add.rectangle(width/2, height/2 + 90, 200, 50, CONFIG.UI.BUTTON_COLOR)
            .setInteractive()
            .setDepth(1002);
            
        const exitText = this.add.text(width/2, height/2 + 90, 'Wyjdź do menu', {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(1003);
        
        // Efekt najechania na przycisk
        exitButton.on('pointerover', () => {
            exitButton.fillColor = CONFIG.UI.BUTTON_HOVER_COLOR;
        });
        
        exitButton.on('pointerout', () => {
            exitButton.fillColor = CONFIG.UI.BUTTON_COLOR;
        });
        
        // Zatrzymujemy grę
        this.scene.pause();
        
        // Obsługa przycisków
        resumeButton.on('pointerup', () => {
            // Usuwamy menu pauzy
            overlay.destroy();
            panel.destroy();
            title.destroy();
            resumeButton.destroy();
            resumeText.destroy();
            optionsButton.destroy();
            optionsText.destroy();
            exitButton.destroy();
            exitText.destroy();
            
            // Wznawiamy grę
            this.scene.resume();
        });
        
        optionsButton.on('pointerup', () => {
            // Obsługa opcji - np. wyświetlenie podmenu opcji
            this.showMessage("Opcje: to jest tylko przykład");
        });
        
        exitButton.on('pointerup', () => {
            // Usuwamy menu pauzy
            overlay.destroy();
            panel.destroy();
            title.destroy();
            resumeButton.destroy();
            resumeText.destroy();
            optionsButton.destroy();
            optionsText.destroy();
            exitButton.destroy();
            exitText.destroy();
            
            // Przechodzimy do menu
            if (this.context) {
                const sceneManager = this.context.getService('scenes');
                sceneManager.transitionToScene('GameScene', 'BootScene', null, {
                    effect: 'FADE',
                    duration: 1000
                });
            } else {
                // Awaryjnie - jeśli nie ma SceneManager
                this.scene.start('BootScene');
            }
        });
    }
    
    /**
     * Sprawdza kolizje między obiektami
     */
    private checkCollisions(): void {
        // Jeśli nie ma wszystkich potrzebnych systemów, pomijamy sprawdzenie
        if (!this.playerSystem || !this.enemySystem) return;
        
        const hero = this.playerSystem.getHero();
        if (!hero || hero.isDead) return;
        
        const enemies = this.enemySystem.getEnemyGroup()?.getChildren();
        if (!enemies || enemies.length === 0) return;
        
        // Uproszczona logika kolizji
        for (const enemy of enemies) {
            if (!enemy.active || enemy.isDead) continue;
            
            // Sprawdzamy czy wróg jest wystarczająco blisko bohatera
            const dx = Math.abs(enemy.x - hero.x);
            const dy = Math.abs(enemy.y - hero.y);
            
            // Uproszczone sprawdzanie kolizji
            if (dx < 60 && dy < 60) {
                // Sprawdzamy czy wróg może zaatakować
                if (enemy.canAttack && enemy.canAttack()) {
                    // Zadajemy obrażenia bohaterowi
                    hero.takeDamage(enemy.attack || CONFIG.ENEMIES.BASE_DAMAGE);
                    
                    // Aktualizujemy UI zdrowia
                    this.updateHeroHealthBar();
                }
            }
        }
    }
    
    /**
     * Aktualizuje pasek zdrowia bohatera
     */
    private updateHeroHealthBar(): void {
        if (!this.heroHealthBar || !this.playerSystem) return;
        
        const hero = this.playerSystem.getHero();
        if (!hero) return;
        
        // Obliczamy procent zdrowia
        const healthPercent = hero.health / hero.maxHealth;
        
        // Aktualizujemy szerokość paska
        this.heroHealthBar.width = 150 * healthPercent;
        
        // Zmieniamy kolor w zależności od poziomu zdrowia
        if (healthPercent < 0.3) {
            this.heroHealthBar.fillColor = 0xff0000; // czerwony
        } else if (healthPercent < 0.6) {
            this.heroHealthBar.fillColor = 0xffff00; // żółty
        } else {
            this.heroHealthBar.fillColor = 0x00ff00; // zielony
        }
    }
    
    update(time: number, delta: number): void {
        // Aktualizujemy FPS w trybie debug
        if (this.debugMode && this.fpsText) {
            this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
        }
        
        // Aktualizujemy menadżera wejścia
        if (this.inputManager) {
            this.inputManager.update();
        }
        
        // Aktualizujemy systemy gry
        if (this.playerSystem) {
            // W ulepszonej wersji przekazujemy InputManager zamiast klawiszy
            this.playerSystem.update(time, delta, this.inputManager);
        }
        
        if (this.enemySystem) {
            this.enemySystem.update(time);
        }
        
        if (this.combatSystem) {
            this.combatSystem.update(time, delta);
        }
        
        // Sprawdzamy kolizje co kilka klatek dla lepszej wydajności
        if (this.collisionCheckTimer <= 0) {
            this.checkCollisions();
            this.collisionCheckTimer = this.collisionCheckInterval;
        } else {
            this.collisionCheckTimer--;
        }
    }
    
    /**
     * Metoda wywoływana przy zniszczeniu sceny
     */
    shutdown(): void {
        // Odłączamy nasłuchiwania
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
        }
        
        // Czyścimy zasoby systemów, jeśli trzeba
        
        // Wywołujemy oryginalną metodę, która zadba o zwolnienie zasobów
        super.shutdown();
    }
}