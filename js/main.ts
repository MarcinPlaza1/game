import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import { logger } from './services/LogService.js';

// ==========================================
// Moduły zarządzające różnymi aspektami gry
// ==========================================

/**
 * Moduł zarządzający stanem gry
 */
class GameStateManager {
  private state: GameData;
  private listeners: Array<(oldState: GameData, newState: GameData) => void>;

  constructor() {
    this.state = {
      autoMode: false,
      enemiesKilled: 0,
      debugMode: false,
      performanceMode: false,
      score: 0,
      wave: 1,
      heroLevel: 1
    };
    
    this.listeners = [];
  }

  /**
   * Pobierz aktualny stan gry
   */
  getState(): GameData {
    return { ...this.state };
  }
  
  /**
   * Aktualizuje stan gry i powiadamia nasłuchujących
   */
  setState(updates: Partial<GameData>): void {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Powiadomienie nasłuchujących
    this.notifyListeners(oldState, this.state);
  }
  
  /**
   * Rejestracja obserwatorów zmian stanu
   * @returns Funkcja do wyrejestrowania nasłuchiwania
   */
  subscribe(listener: (oldState: GameData, newState: GameData) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Powiadamia wszystkich nasłuchujących o zmianie stanu
   */
  private notifyListeners(oldState: GameData, newState: GameData): void {
    this.listeners.forEach(listener => listener(oldState, newState));
  }
}

/**
 * Moduł wykrywania urządzeń i ich możliwości
 */
const DeviceDetector = {
  /**
   * Sprawdza czy urządzenie jest mobilne
   */
  isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },
  
  /**
   * Sprawdza czy urządzenie ma ograniczone możliwości
   */
  isLowEndDevice(): boolean {
    const cpuCores = navigator.hardwareConcurrency || 4;
    const hasSlowAPI = !window.requestAnimationFrame || !window.performance;
    const hasLowMemory = 'deviceMemory' in navigator && (navigator as any).deviceMemory < 4;
    
    return cpuCores <= 2 || hasSlowAPI || hasLowMemory;
  },
  
  /**
   * Zwraca zalecane ustawienia dla wykrytego urządzenia
   */
  getRecommendedSettings(): {
    fps: number;
    antialias: boolean;
    performance: boolean;
    roundPixels: boolean;
  } {
    const settings = {
      fps: 60,
      antialias: true,
      performance: false,
      roundPixels: false
    };
    
    if (this.isMobile() || this.isLowEndDevice()) {
      settings.fps = 30;
      settings.antialias = false;
      settings.performance = true;
    }
    
    return settings;
  }
};

/**
 * Moduł konfiguracji gry Phaser
 */
const GameConfig = {
  /**
   * Tworzy podstawową konfigurację Phaser dostosowaną do urządzenia
   */
  create(): Phaser.Types.Core.GameConfig {
    // Pobierz zalecane ustawienia dla urządzenia
    const deviceSettings = DeviceDetector.getRecommendedSettings();
    
    // Bazowa konfiguracja
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false,
          fps: deviceSettings.fps,
          timeScale: 1,
          maxSubSteps: 1,
          skipQuadTree: false,
          overlapBias: 4,
          tileBias: 4,
          forceX: false
        }
      },
      render: {
        pixelArt: false,
        antialias: deviceSettings.antialias,
        roundPixels: deviceSettings.roundPixels,
        disableContextMenu: true,
        powerPreference: 'high-performance',
        batchSize: 4096
      },
      fps: {
        target: deviceSettings.fps,
        forceSetTimeOut: false,
        min: 20
      },
      zoom: 1,
      disableVisibilityChange: true,
      scene: [BootScene, GameScene, UIScene]
    };
    
    return config;
  }
};

/**
 * Moduł zarządzania wydajnością
 */
class PerformanceManager {
  private game: Phaser.Game;
  private gameStateManager: GameStateManager;
  private lowFpsCount: number = 0;
  private maxEnemiesReduced: boolean = false;
  private lastCheckTime: number = 0;
  private checkInterval: number = 1000; // 1 sekunda
  private boundPerformanceCheck: () => void;
  
  constructor(game: Phaser.Game, gameStateManager: GameStateManager) {
    this.game = game;
    this.gameStateManager = gameStateManager;
    this.boundPerformanceCheck = this.checkPerformance.bind(this);
  }
  
  /**
   * Rozpoczyna monitorowanie wydajności
   */
  startMonitoring(): void {
    // Używamy zdarzenia postrender do monitorowania FPS
    // Jest to lepsze rozwiązanie niż setInterval, ponieważ jest zsynchronizowane z pętlą gry
    this.game.events.on('postrender', this.boundPerformanceCheck);
    logger.info("Rozpoczęto monitoring wydajności", "PERFORMANCE");
  }
  
  /**
   * Zatrzymuje monitorowanie wydajności
   */
  stopMonitoring(): void {
    this.game.events.off('postrender', this.boundPerformanceCheck);
    logger.info("Zatrzymano monitoring wydajności", "PERFORMANCE");
  }
  
  /**
   * Sprawdza wydajność i dostosowuje ustawienia gry
   */
  private checkPerformance(): void {
    const currentTime = performance.now();
    
    // Sprawdzamy tylko co checkInterval ms (domyślnie 1000ms)
    if (currentTime - this.lastCheckTime < this.checkInterval) {
      return;
    }
    
    this.lastCheckTime = currentTime;
    
    // Szacunkowy FPS
    const currentFps = this.game.loop.actualFps;
    const gameState = this.gameStateManager.getState();
    
    // Jeśli FPS spadł znacznie poniżej celu, włączamy tryb wydajności
    if (currentFps < 25 && !gameState.performanceMode) {
      this.lowFpsCount++;
      
      // Jeśli mamy niski FPS przez 3 kolejne pomiary, włączamy tryb wydajności
      if (this.lowFpsCount >= 3) {
        this.gameStateManager.setState({ performanceMode: true });
        logger.info(`Wykryto utrzymujący się niski FPS (${Math.round(currentFps)}), włączono tryb wysokiej wydajności`, "PERFORMANCE");
        this.showPerformanceMessage("Włączono tryb wysokiej wydajności");
      }
    } else if (currentFps >= 50 && gameState.performanceMode && this.lowFpsCount > 0) {
      // Jeśli FPS jest stabilny i wysoki, możemy zresetować licznik niskiego FPS
      this.lowFpsCount = Math.max(0, this.lowFpsCount - 1);
    }
    
    // Jeśli FPS nadal spada mimo włączonego trybu wydajności, redukujemy liczbę wrogów
    if (currentFps < 20 && gameState.performanceMode && !this.maxEnemiesReduced) {
      this.reduceEnemies();
    }
  }
  
  /**
   * Zmniejsza limit wrogów w przypadku bardzo niskiej wydajności
   */
  private reduceEnemies(): void {
    try {
      // Próbujemy uzyskać dostęp do systemu wrogów i zmniejszyć limit
      const gameScene = this.game.scene.scenes.find(
        scene => scene.sys.settings.key === 'GameScene'
      ) as GameSceneWithEnemySystem | undefined;
      
      if (gameScene && gameScene.enemySystem) {
        const originalLimit = gameScene.enemySystem.maxEnemiesOnScreen;
        gameScene.enemySystem.maxEnemiesOnScreen = Math.floor(originalLimit * 0.6); // Zmniejszamy limit o 40%
        
        logger.info(`Wykryto bardzo niski FPS (${Math.round(this.game.loop.actualFps)}), zmniejszono limit wrogów z ${originalLimit} do ${gameScene.enemySystem.maxEnemiesOnScreen}`, "PERFORMANCE");
        this.maxEnemiesReduced = true;
        this.showPerformanceMessage("Zmniejszono liczbę wrogów dla lepszej wydajności");
      }
    } catch (error) {
      logger.error(`Błąd podczas zmniejszania limitu wrogów: ${error instanceof Error ? error.message : 'Nieznany błąd'}`, "ERROR");
    }
  }
  
  /**
   * Wyświetla komunikat o zmianie wydajności w grze
   */
  private showPerformanceMessage(message: string): void {
    if (this.game.scene.scenes.length > 0) {
      try {
        const activeScene = this.game.scene.scenes.find(scene => scene.sys.settings.active);
        if (activeScene) {
          const performanceText = activeScene.add.text(400, 300, message, {
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
      } catch (error) {
        logger.error(`Błąd podczas wyświetlania komunikatu: ${error instanceof Error ? error.message : 'Nieznany błąd'}`, "ERROR");
      }
    }
  }
}

/**
 * Klasa bezpiecznych obiektów gry
 * Zamiast monkey-patchować metody Phaser, tworzymy własne wrappery
 */
class SafeGameObjectFactory {
  private scene: Phaser.Scene;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  /**
   * Bezpieczne tworzenie koła
   */
  circle(x: number, y: number, radius: number, fillColor?: number, fillAlpha?: number): Phaser.GameObjects.Arc {
    try {
      return this.scene.add.circle(x, y, radius, fillColor, fillAlpha);
    } catch (error) {
      logger.error(`Błąd podczas tworzenia koła: ${error instanceof Error ? error.message : 'Nieznany błąd'}`, "ERROR");
      
      // Zwracamy obiekt zastępczy z wymaganymi metodami
      const dummyObject = {
        x: x,
        y: y,
        setAlpha: function() { return this; },
        setDepth: function() { return this; },
        setOrigin: function() { return this; },
        destroy: function() {},
        destroyed: false
      } as unknown as Phaser.GameObjects.Arc;
      
      return dummyObject;
    }
  }
  
  // Można dodać podobne metody dla innych problematycznych obiektów
}

/**
 * Moduł obsługi błędów
 */
const ErrorHandler = {
  /**
   * Konfiguruje globalne handlery błędów
   */
  setup(game: Phaser.Game): void {
    // Globalny handler błędów, aby gra nie crashowała
    window.onerror = (message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error): boolean => {
      const errorMessage = message instanceof Event ? 'Nieznany błąd' : message;
      
      const errorInfo = {
        message: errorMessage,
        source: source || 'unknown',
        line: lineno,
        column: colno,
        stack: error?.stack,
        time: new Date().toISOString()
      };
      
      console.error(`Błąd w grze: ${errorMessage}`);
      logger.error(`Przechwycono błąd: ${JSON.stringify(errorInfo)}`, "ERROR");
      
      this.displayErrorMessage(game);
      
      // Zwracamy true, aby zapobiec domyślnej obsłudze błędu przez przeglądarkę
      return true;
    };
    
    // Dodajemy obsługę nieobsłużonych odrzuceń obietnic
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      logger.error(`Nieobsłużone odrzucenie obietnicy: ${event.reason}`, "ERROR");
    });
    
    logger.info("Skonfigurowano obsługę błędów", "SYSTEM");
  },
  
  /**
   * Wyświetla komunikat o błędzie w grze
   */
  displayErrorMessage(game: Phaser.Game): void {
    if (game && game.scene && game.scene.scenes) {
      try {
        const activeScene = game.scene.scenes.find(scene => scene.sys.settings.active);
        if (activeScene) {
          const errorText = activeScene.add.text(400, 300, "Wystąpił błąd. Odśwież stronę.", {
            fontSize: '18px',
            fill: '#ff0000',
            backgroundColor: '#000000',
            padding: { x: 10, y: 5 }
          }).setOrigin(0.5);
          
          errorText.setDepth(1000); // Na wierzchu wszystkiego
        }
      } catch (displayError) {
        console.error("Nie udało się wyświetlić komunikatu o błędzie:", displayError);
      }
    }
  }
};

/**
 * Moduł zarządzania logowaniem
 */
const LoggingManager = {
  /**
   * Konfiguruje system logowania
   */
  setup(gameStateManager: GameStateManager): void {
    // Domyślne ustawienia
    logger.setLevel(logger.LEVELS.INFO); // Domyślny poziom INFO
    
    // Sprawdzamy URL dla parametrów debugowania
    const urlParams = new URLSearchParams(window.location.search);
    
    // Włączanie/wyłączanie logów wrogów na podstawie parametru URL
    if (urlParams.has('debug')) {
      gameStateManager.setState({ debugMode: true });
      logger.setLevel(logger.LEVELS.DEBUG); // Włączamy wszystkie logi
      logger.setCategory('ENEMY_POSITION', true); // Włączamy pozycje wrogów
      logger.setCategory('DEBUG', true); // Włączamy debugowanie
      logger.info("Tryb debugowania włączony", "GAME_STATE");
    }
    
    // Sprawdzamy, czy tryb wydajności ma być wyłączony
    if (urlParams.has('performance') && urlParams.get('performance') === 'low') {
      gameStateManager.setState({ performanceMode: false });
      logger.info("Tryb wydajności wyłączony", "GAME_STATE");
    }
    
    // Rejestrujemy skrót klawiszowy do przełączania debugowania
    this.setupKeyboardShortcuts(gameStateManager);
    
    logger.info("Skonfigurowano system logowania", "SYSTEM");
  },
  
  /**
   * Konfiguruje skróty klawiszowe
   */
  setupKeyboardShortcuts(gameStateManager: GameStateManager): void {
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      // Przełączanie debugowania klawiszem F2
      if (event.key === 'F2') {
        const currentState = gameStateManager.getState();
        const newDebugMode = !currentState.debugMode;
        
        gameStateManager.setState({ debugMode: newDebugMode });
        
        if (newDebugMode) {
          logger.setLevel(logger.LEVELS.DEBUG);
          logger.setCategory('ENEMY_POSITION', true);
          logger.setCategory('DEBUG', true);
          logger.info("Tryb debugowania włączony (F2)", "GAME_STATE");
        } else {
          logger.setLevel(logger.LEVELS.INFO);
          logger.setCategory('ENEMY_POSITION', false);
          logger.setCategory('DEBUG', false);
          logger.info("Tryb debugowania wyłączony (F2)", "GAME_STATE");
        }
      }
      
      // Przełączanie logów pozycji wrogów klawiszem F3
      if (event.key === 'F3') {
        const enemyPosEnabled = !logger.enabledCategories.ENEMY_POSITION;
        logger.setCategory('ENEMY_POSITION', enemyPosEnabled);
        logger.info(`Logi pozycji wrogów ${enemyPosEnabled ? 'włączone' : 'wyłączone'} (F3)`, "GAME_STATE");
      }
      
      // Przełączanie trybu wydajności klawiszem F4
      if (event.key === 'F4') {
        const currentState = gameStateManager.getState();
        const newPerformanceMode = !currentState.performanceMode;
        
        gameStateManager.setState({ performanceMode: newPerformanceMode });
        logger.info(`Tryb wydajności ${newPerformanceMode ? 'włączony' : 'wyłączony'} (F4)`, "GAME_STATE");
      }
    });
    
    logger.info("Skonfigurowano skróty klawiszowe", "SYSTEM");
  }
};

/**
 * Moduł zarządzania cyklem życia gry
 */
const GameLifecycle = {
  /**
   * Konfiguruje obsługę zamknięcia gry
   */
  setupCleanup(game: Phaser.Game): void {
    window.addEventListener('beforeunload', () => {
      if (game) {
        // Zatrzymaj wszystkie sceny
        Object.keys(game.scene.keys).forEach(key => {
          game.scene.stop(key);
        });
        
        // Zniszcz grę
        game.destroy(true);
        
        logger.info("Gra zamknięta poprawnie", "GAME_STATE");
      }
    });
    
    logger.info("Skonfigurowano czyszczenie zasobów przy zamknięciu", "SYSTEM");
  },
  
  /**
   * Konfiguruje awaryjne uruchomienie gry
   */
  setupFallbackStartup(game: Phaser.Game): void {
    // Dodajemy awaryjny handler, który sprawdza czy gra zaczęła działać po określonym czasie
    setTimeout(() => {
      if (game && game.scene) {
        const activeScenes = Object.keys(game.scene.keys || {}).filter(key => 
          game.scene.isActive(key)
        );
        
        logger.info(`Aktywne sceny po 3 sekundach: ${activeScenes.join(', ')}`, "GAME_STATE");
        
        // Jeśli GameScene nie jest aktywna, spróbujmy ją uruchomić
        if (!game.scene.isActive('GameScene')) {
          logger.info('GameScene nie jest aktywna po 3 sekundach, próbuję uruchomić...', "GAME_STATE");
          
          if (game.scene.isActive('BootScene')) {
            logger.info('BootScene jest aktywna - zatrzymuję ją i uruchamiam GameScene', "GAME_STATE");
            game.scene.stop('BootScene');
          }
          
          game.scene.start('GameScene');
        }
      } else {
        logger.warn('Obiekt gry nie jest dostępny po 3 sekundach', "GAME_STATE");
      }
    }, 3000);
    
    logger.info("Skonfigurowano awaryjne uruchomienie gry", "SYSTEM");
  }
};

// ==========================================
// Definicje typów dla gry
// ==========================================

interface GameData {
    autoMode: boolean;
    enemiesKilled: number;
    debugMode?: boolean;
    performanceMode?: boolean;
    score?: number;
    wave?: number;
    heroLevel?: number;
}

interface EnemySystem {
    maxEnemiesOnScreen: number;
}

// Rozszerzenie interfejsu dla sceny
interface GameSceneWithEnemySystem extends Phaser.Scene {
    enemySystem?: EnemySystem;
}

// Deklaracja dla window.gameData
declare global {
    interface Window {
        gameData: GameData;
        game: Phaser.Game;
        gameStateManager: GameStateManager;
    }
}

// ==========================================
// Główna funkcja inicjalizująca grę
// ==========================================

/**
 * Inicjalizacja Phaser i uruchomienie gry
 */
function startGame(): void {
    // Inicjalizacja menedżera stanu gry
    const gameStateManager = new GameStateManager();
    window.gameStateManager = gameStateManager;
    window.gameData = gameStateManager.getState();
    
    // Konfiguracja logowania
    LoggingManager.setup(gameStateManager);
    
    // Tworzenie konfiguracji gry
    const config = GameConfig.create();
    
    // Tworzenie instancji gry
    const game = new Phaser.Game(config);
    window.game = game;
    
    // Konfiguracja obsługi błędów
    ErrorHandler.setup(game);
    
    // Inicjalizacja monitorowania wydajności
    const performanceManager = new PerformanceManager(game, gameStateManager);
    performanceManager.startMonitoring();
    
    // Konfiguracja cyklu życia gry
    GameLifecycle.setupCleanup(game);
    GameLifecycle.setupFallbackStartup(game);
    
    // Nasłuchiwanie na zmiany stanu gry
    gameStateManager.subscribe((oldState, newState) => {
      // Aktualizujemy window.gameData dla zgodności z istniejącym kodem
      Object.assign(window.gameData, newState);
      
      // Dodatkowe akcje przy zmianie stanu można dodać tutaj
      if (oldState.performanceMode !== newState.performanceMode) {
        logger.info(`Zmieniono tryb wydajności na: ${newState.performanceMode ? 'włączony' : 'wyłączony'}`, "GAME_STATE");
      }
    });
    
    logger.info("Gra zainicjalizowana", "GAME_STATE");
    
    // Wyświetlamy informację o sterowaniu
    console.log("Sterowanie:");
    console.log("- WASD: poruszanie się");
    console.log("- SPACJA: przełączanie trybu automatycznego");
    console.log("- F2: przełączanie trybu debugowania");
    console.log("- F3: przełączanie logów pozycji wrogów");
    console.log("- F4: przełączanie trybu wydajności");
}

// Rozszerza scenę o klasę SafeGameObjectFactory
Phaser.Scene.prototype.safeAdd = function() {
  if (!this._safeAdd) {
    this._safeAdd = new SafeGameObjectFactory(this);
  }
  return this._safeAdd;
};

// Uruchamiamy grę po załadowaniu strony
window.onload = startGame;