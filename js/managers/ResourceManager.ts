// managers/ResourceManager.ts
import { LogManager } from './LogManager';
import { AssetType } from '../types/AssetTypes';

/**
 * Zarządzanie zasobami gry z automatycznym śledzeniem i sprzątaniem
 */
export class ResourceManager {
    private game: Phaser.Game;
    private logger: LogManager;
    private loadedAssets: Map<string, AssetInfo>;
    private pendingLoads: Map<string, Promise<any>>;
    private isCleaningUp: boolean = false;
    
    constructor(game: Phaser.Game, logger: LogManager) {
        this.game = game;
        this.logger = logger;
        this.loadedAssets = new Map();
        this.pendingLoads = new Map();
        
        // Konfiguracja automatycznego śledzenia zasobów
        this.setupAssetTracking();
    }
    
    /**
     * Konfiguruje automatyczne śledzenie załadowanych zasobów
     */
    private setupAssetTracking(): void {
        // Monitoruj sceny dla wydarzeń ładowania zasobów
        this.game.scene.scenes.forEach(scene => {
            this.monitorSceneLoading(scene);
        });
        
        // Zachytuj dodawanie nowych scen
        this.game.scene.on('add', (key: string) => {
            const scene = this.game.scene.getScene(key);
            if (scene) {
                this.monitorSceneLoading(scene);
            }
        });
    }
    
    /**
     * Monitoruje zdarzenia ładowania zasobów dla danej sceny
     */
    private monitorSceneLoading(scene: Phaser.Scene): void {
        if (scene.load) {
            // Monitoruj zdarzenie ukończenia ładowania
            scene.load.on('complete', () => {
                // Śledź wszystkie nowo załadowane zasoby dla tej sceny
                this.trackNewAssets(scene);
            });
        }
    }
    
    /**
     * Śledzi nowo załadowane zasoby w danej scenie
     */
    private trackNewAssets(scene: Phaser.Scene): void {
        // Tekstury
        if (scene.textures) {
            scene.textures.getTextureKeys().forEach(key => {
                if (!this.loadedAssets.has(key)) {
                    this.trackAsset(key, AssetType.TEXTURE, scene);
                }
            });
        }
        
        // Dźwięki
        if (scene.sound && scene.sound.getAll) {
            scene.sound.getAll().forEach(sound => {
                const key = sound.key;
                if (!this.loadedAssets.has(key)) {
                    this.trackAsset(key, AssetType.AUDIO, scene);
                }
            });
        }
    }
    
    /**
     * Rejestruje zasób do śledzenia
     */
    trackAsset(key: string, type: AssetType, scene?: Phaser.Scene): void {
        const sceneKey = scene ? scene.sys.settings.key : 'global';
        
        this.loadedAssets.set(key, {
            key,
            type,
            sceneKey,
            loadTime: Date.now(),
            lastUsed: Date.now(),
            useCount: 0
        });
        
        this.logger.debug(`Załadowano zasób: ${key} (${AssetType[type]}) dla sceny ${sceneKey}`, 'RESOURCES');
    }
    
    /**
     * Ładuje teksturę z kodu (np. generowaną programowo)
     */
    createTextureFromGraphics(key: string, graphics: Phaser.GameObjects.Graphics, width: number, height: number): void {
        if (this.game.textures.exists(key)) {
            this.logger.warn(`Tekstura ${key} już istnieje - zostanie nadpisana`, 'RESOURCES');
        }
        
        graphics.generateTexture(key, width, height);
        this.trackAsset(key, AssetType.TEXTURE);
    }
    
    /**
     * Bezpieczne ładowanie tekstury z gwarancją pojedynczego ładowania
     */
    async loadTexture(scene: Phaser.Scene, key: string, url: string): Promise<boolean> {
        // Sprawdź, czy tekstura jest już załadowana
        if (this.game.textures.exists(key)) {
            return true;
        }
        
        // Sprawdź, czy trwa już ładowanie tej tekstury
        if (this.pendingLoads.has(key)) {
            try {
                await this.pendingLoads.get(key);
                return true;
            } catch (error) {
                this.logger.error(`Błąd podczas oczekiwania na teksturę ${key}: ${error instanceof Error ? error.message : String(error)}`, 'RESOURCES');
                return false;
            }
        }
        
        // Rozpocznij nowe ładowanie
        const loadPromise = new Promise<boolean>((resolve, reject) => {
            try {
                scene.load.once('complete', () => {
                    this.trackAsset(key, AssetType.TEXTURE, scene);
                    this.pendingLoads.delete(key);
                    resolve(true);
                });
                
                scene.load.once('loaderror', (fileObj: any) => {
                    if (fileObj.key === key) {
                        this.pendingLoads.delete(key);
                        reject(new Error(`Nie udało się załadować tekstury ${key}`));
                    }
                });
                
                scene.load.image(key, url);
                scene.load.start();
            } catch (error) {
                this.pendingLoads.delete(key);
                reject(error);
            }
        });
        
        this.pendingLoads.set(key, loadPromise);
        
        try {
            return await loadPromise;
        } catch (error) {
            this.logger.error(`Błąd podczas ładowania tekstury ${key}: ${error instanceof Error ? error.message : String(error)}`, 'RESOURCES');
            return false;
        }
    }
    
    /**
     * Oznacza zasób jako używany (aktualizacja czasu ostatniego użycia)
     */
    markAssetAsUsed(key: string): void {
        const asset = this.loadedAssets.get(key);
        if (asset) {
            asset.lastUsed = Date.now();
            asset.useCount++;
        }
    }
    
    /**
     * Usuwa nieużywane zasoby dla zwolnienia pamięci
     */
    cleanupUnusedAssets(unusedSince: number = 60000): void {
        if (this.isCleaningUp) return;
        
        this.isCleaningUp = true;
        const currentTime = Date.now();
        const unusedAssets: string[] = [];
        
        // Znajdź nieużywane zasoby
        this.loadedAssets.forEach((asset, key) => {
            if (currentTime - asset.lastUsed > unusedSince) {
                unusedAssets.push(key);
            }
        });
        
        // Usuń nieużywane zasoby
        unusedAssets.forEach(key => {
            this.unloadAsset(key);
        });
        
        if (unusedAssets.length > 0) {
            this.logger.info(`Usunięto ${unusedAssets.length} nieużywanych zasobów`, 'RESOURCES');
        }
        
        this.isCleaningUp = false;
    }
    
    /**
     * Wyładowuje pojedynczy zasób
     */
    unloadAsset(key: string): boolean {
        const asset = this.loadedAssets.get(key);
        if (!asset) return false;
        
        try {
            switch (asset.type) {
                case AssetType.TEXTURE:
                    if (this.game.textures.exists(key)) {
                        this.game.textures.remove(key);
                    }
                    break;
                    
                case AssetType.AUDIO:
                    this.game.sound.remove(key);
                    break;
                    
                case AssetType.JSON:
                    // Jeśli używamy cache dla JSON
                    if (this.game.cache && this.game.cache.json && typeof this.game.cache.json.remove === 'function') {
                        this.game.cache.json.remove(key);
                    }
                    break;
                    
                default:
                    this.logger.warn(`Nieobsługiwany typ zasobu dla ${key}: ${AssetType[asset.type]}`, 'RESOURCES');
                    return false;
            }
            
            this.loadedAssets.delete(key);
            this.logger.debug(`Usunięto zasób: ${key} (${AssetType[asset.type]})`, 'RESOURCES');
            return true;
        } catch (error) {
            this.logger.error(`Błąd podczas usuwania zasobu ${key}: ${error instanceof Error ? error.message : String(error)}`, 'RESOURCES');
            return false;
        }
    }
    
    /**
     * Wyładowuje wszystkie zasoby dla danej sceny
     */
    unloadSceneAssets(sceneKey: string): void {
        const assetsToUnload: string[] = [];
        
        this.loadedAssets.forEach((asset, key) => {
            if (asset.sceneKey === sceneKey) {
                assetsToUnload.push(key);
            }
        });
        
        assetsToUnload.forEach(key => {
            this.unloadAsset(key);
        });
        
        this.logger.info(`Usunięto ${assetsToUnload.length} zasobów dla sceny ${sceneKey}`, 'RESOURCES');
    }
    
    /**
     * Wyładowuje wszystkie zasoby (używane przy zamykaniu gry)
     */
    cleanupAllResources(): void {
        const totalAssets = this.loadedAssets.size;
        
        try {
            // Usuwamy wszystkie tekstury
            this.game.textures.getTextureKeys().forEach(key => {
                if (key !== '__DEFAULT' && key !== '__MISSING') {
                    this.game.textures.remove(key);
                }
            });
            
            // Usuwamy wszystkie dźwięki
            this.game.sound.getAll().forEach(sound => {
                this.game.sound.remove(sound.key);
            });
            
            // Czyścimy pamięć podręczną
            if (this.game.cache) {
                // Czyścimy cache JSON
                if (this.game.cache.json) {
                    this.game.cache.json.getKeys().forEach(key => {
                        this.game.cache.json.remove(key);
                    });
                }
                
                // Czyścimy inne typy cache, jeśli są dostępne
            }
            
            // Czyścimy własną mapę zasobów
            this.loadedAssets.clear();
            
            this.logger.info(`Wyczyszczono wszystkie zasoby (${totalAssets})`, 'RESOURCES');
        } catch (error) {
            this.logger.error(`Błąd podczas czyszczenia zasobów: ${error instanceof Error ? error.message : String(error)}`, 'RESOURCES');
        }
    }
    
    /**
     * Zwraca informacje o wszystkich załadowanych zasobach
     */
    getResourceStats(): ResourceStats {
        let textureCount = 0;
        let audioCount = 0;
        let jsonCount = 0;
        let otherCount = 0;
        
        this.loadedAssets.forEach(asset => {
            switch (asset.type) {
                case AssetType.TEXTURE: textureCount++; break;
                case AssetType.AUDIO: audioCount++; break;
                case AssetType.JSON: jsonCount++; break;
                default: otherCount++; break;
            }
        });
        
        return {
            totalAssets: this.loadedAssets.size,
            textureCount,
            audioCount,
            jsonCount,
            otherCount,
            pendingLoads: this.pendingLoads.size
        };
    }
}

// Informacje o zasobie
interface AssetInfo {
    key: string;
    type: AssetType;
    sceneKey: string;
    loadTime: number;
    lastUsed: number;
    useCount: number;
}

// Statystyki zasobów
interface ResourceStats {
    totalAssets: number;
    textureCount: number;
    audioCount: number;
    jsonCount: number;
    otherCount: number;
    pendingLoads: number;
}

// managers/ErrorHandler.ts
import { GameContext } from '../context/GameContext';

/**
 * Zaawansowany system obsługi błędów z kategoryzacją i odzyskiwaniem
 */
export class ErrorHandler {
    private errorListeners: Map<ErrorCategory, Array<(error: any, context: any) => void>>;
    private recoveryStrategies: Map<ErrorCategory, Array<(error: any, context: any) => Promise<boolean>>>;
    private errorHistory: ErrorRecord[];
    private maxHistorySize: number = 50;
    
    constructor() {
        this.errorListeners = new Map();
        this.recoveryStrategies = new Map();
        this.errorHistory = [];
        
        // Inicjalizacja kategorii błędów
        Object.values(ErrorCategory).forEach(category => {
            this.errorListeners.set(category, []);
            this.recoveryStrategies.set(category, []);
        });
    }
    
    /**
     * Konfiguruje globalne obsługi błędów
     */
    configureGlobalErrorHandling(game: Phaser.Game, context: GameContext): void {
        // Globalny handler błędów JavaScript
        window.onerror = (message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error): boolean => {
            const errorMessage = message instanceof Event ? 'Nieznany błąd' : message;
            
            this.handleError({
                message: errorMessage,
                source: source || 'unknown',
                line: lineno,
                column: colno,
                stack: error?.stack,
                time: new Date().toISOString(),
                category: this.categorizeError(error || errorMessage)
            }, { game, context });
            
            // Zwracamy true, aby zapobiec domyślnej obsłudze błędu przez przeglądarkę
            return true;
        };
        
        // Obsługa nieobsłużonych odrzuceń obietnic
        window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
            this.handleError({
                message: typeof event.reason === 'string' ? event.reason : 'Nieobsłużone odrzucenie obietnicy',
                source: 'promise',
                stack: event.reason?.stack,
                time: new Date().toISOString(),
                category: this.categorizeError(event.reason)
            }, { game, context });
        });
        
        // Monitoruj błędy w ładowaniu zasobów Phaser
        game.scene.scenes.forEach(scene => {
            if (scene.load) {
                scene.load.on('loaderror', (file: any) => {
                    this.handleError({
                        message: `Błąd ładowania zasobu: ${file.key}`,
                        source: file.url || 'unknown',
                        time: new Date().toISOString(),
                        category: ErrorCategory.ASSET_LOADING,
                        data: { fileKey: file.key, fileType: file.type }
                    }, { game, context, scene });
                });
            }
        });
        
        // Rejestracja domyślnych strategii odzyskiwania
        this.registerRecoveryStrategies();
        
        const logger = context.getService('log');
        logger.info("Skonfigurowano zaawansowaną obsługę błędów", "SYSTEM");
    }
    
    /**
     * Kategoryzuje błąd na podstawie jego treści i kontekstu
     */
    categorizeError(error: any): ErrorCategory {
        const errorStr = String(error).toLowerCase();
        
        // Błędy związane z zasobami
        if (
            errorStr.includes('failed to load') || 
            errorStr.includes('unable to load') ||
            errorStr.includes('load error') ||
            errorStr.includes('404') ||
            errorStr.includes('not found')
        ) {
            return ErrorCategory.ASSET_LOADING;
        }
        
        // Błędy renderowania
        if (
            errorStr.includes('webgl') ||
            errorStr.includes('render') ||
            errorStr.includes('canvas') ||
            errorStr.includes('texture') ||
            errorStr.includes('draw')
        ) {
            return ErrorCategory.RENDERING;
        }
        
        // Błędy fizyki
        if (
            errorStr.includes('physics') ||
            errorStr.includes('collision') ||
            errorStr.includes('arcade') ||
            errorStr.includes('body')
        ) {
            return ErrorCategory.PHYSICS;
        }
        
        // Błędy logiki gry
        if (
            errorStr.includes('game') ||
            errorStr.includes('scene') ||
            errorStr.includes('enemy') ||
            errorStr.includes('player') ||
            errorStr.includes('spawn')
        ) {
            return ErrorCategory.GAME_LOGIC;
        }
        
        // Błędy dźwięku
        if (
            errorStr.includes('audio') ||
            errorStr.includes('sound') ||
            errorStr.includes('music')
        ) {
            return ErrorCategory.AUDIO;
        }
        
        // Domyślnie zwracamy kategorię nieznanych błędów
        return ErrorCategory.UNKNOWN;
    }
    
    /**
     * Rejestruje domyślne strategie odzyskiwania dla różnych kategorii błędów
     */
    private registerRecoveryStrategies(): void {
        // Strategia odzyskiwania dla błędów ładowania zasobów
        this.registerRecoveryStrategy(ErrorCategory.ASSET_LOADING, async (error, context) => {
            const logger = GameContext.getService('log');
            logger.warn(`Próba odzyskania po błędzie ładowania zasobu: ${error.message}`, "ERROR");
            
            if (error.data && error.data.fileKey) {
                const fileKey = error.data.fileKey;
                
                // Spróbuj zastąpić brakujący zasób zaślepką
                try {
                    const game = context.game as Phaser.Game;
                    if (error.data.fileType === 'image' || error.data.fileType === 'spritesheet') {
                        if (!game.textures.exists('__ERROR_PLACEHOLDER')) {
                            // Tworzymy placeholder dla brakujących tekstur
                            const graphics = game.make.graphics({ x: 0, y: 0, add: false });
                            graphics.fillStyle(0xff00ff);
                            graphics.fillRect(0, 0, 32, 32);
                            graphics.lineStyle(2, 0x000000);
                            graphics.strokeRect(0, 0, 32, 32);
                            graphics.generateTexture('__ERROR_PLACEHOLDER', 32, 32);
                        }
                        
                        // Dodajemy placeholder do cache textur
                        try {
                            if (!game.textures.exists(fileKey)) {
                                game.textures.addKey(fileKey, '__ERROR_PLACEHOLDER');
                            }
                            logger.info(`Zastąpiono brakującą teksturę ${fileKey} zaślepką`, "ERROR_RECOVERY");
                            return true;
                        } catch (e) {
                            logger.error(`Nie można zastąpić brakującej tekstury: ${e instanceof Error ? e.message : String(e)}`, "ERROR_RECOVERY");
                        }
                    }
                    
                    if (error.data.fileType === 'audio') {
                        // Dla dźwięków po prostu dodajemy pustą funkcję play
                        try {
                            if (context.scene && context.scene.sound) {
                                context.scene.cache.audio.add(fileKey, {
                                    play: () => {}, stop: () => {}
                                });
                                logger.info(`Zastąpiono brakujący dźwięk ${fileKey} atrapą`, "ERROR_RECOVERY");
                                return true;
                            }
                        } catch (e) {
                            logger.error(`Nie można zastąpić brakującego dźwięku: ${e instanceof Error ? e.message : String(e)}`, "ERROR_RECOVERY");
                        }
                    }
                } catch (e) {
                    logger.error(`Błąd podczas odzyskiwania: ${e instanceof Error ? e.message : String(e)}`, "ERROR_RECOVERY");
                }
            }
            
            return false;
        });
        
        // Strategia odzyskiwania dla błędów renderowania
        this.registerRecoveryStrategy(ErrorCategory.RENDERING, async (error, context) => {
            const logger = GameContext.getService('log');
            logger.warn(`Próba odzyskania po błędzie renderowania: ${error.message}`, "ERROR");
            
            // Próbujemy włączyć tryb niskiej wydajności
            try {
                const stateManager = GameContext.getService('state');
                const state = stateManager.getState();
                
                if (!state.performanceMode) {
                    stateManager.setState({ performanceMode: true });
                    logger.info("Włączono tryb wysokiej wydajności po błędzie renderowania", "ERROR_RECOVERY");
                    return true;
                }
            } catch (e) {
                logger.error(`Błąd podczas zmiany trybu wydajności: ${e instanceof Error ? e.message : String(e)}`, "ERROR_RECOVERY");
            }
            
            return false;
        });
        
        // Strategia odzyskiwania dla błędów fizyki
        this.registerRecoveryStrategy(ErrorCategory.PHYSICS, async (error, context) => {
            const logger = GameContext.getService('log');
            logger.warn(`Próba odzyskania po błędzie fizyki: ${error.message}`, "ERROR");
            
            // Restartujemy silnik fizyki, jeśli to możliwe
            try {
                const game = context.game as Phaser.Game;
                
                if (game.physics && game.physics.world) {
                    // Zmniejszamy obciążenie silnika fizyki
                    game.physics.world.timeScale = 0.8; // Wolniejsza symulacja
                    
                    if (typeof game.physics.world.reset === 'function') {
                        game.physics.world.reset();
                        logger.info("Zresetowano silnik fizyki po błędzie", "ERROR_RECOVERY");
                        return true;
                    }
                }
            } catch (e) {
                logger.error(`Błąd podczas resetowania fizyki: ${e instanceof Error ? e.message : String(e)}`, "ERROR_RECOVERY");
            }
            
            return false;
        });
    }
    
    /**
     * Rejestruje strategię odzyskiwania dla danej kategorii błędów
     */
    registerRecoveryStrategy(category: ErrorCategory, strategy: (error: any, context: any) => Promise<boolean>): void {
        const strategies = this.recoveryStrategies.get(category) || [];
        strategies.push(strategy);
        this.recoveryStrategies.set(category, strategies);
    }
    
    /**
     * Rejestruje nasłuchiwanie na błędy danej kategorii
     */
    onError(category: ErrorCategory, listener: (error: any, context: any) => void): () => void {
        const listeners = this.errorListeners.get(category) || [];
        listeners.push(listener);
        this.errorListeners.set(category, listeners);
        
        // Zwracamy funkcję do wyrejestrowania nasłuchiwania
        return () => {
            const currentListeners = this.errorListeners.get(category) || [];
            this.errorListeners.set(
                category,
                currentListeners.filter(l => l !== listener)
            );
        };
    }
    
    /**
     * Główna metoda obsługi błędów z próbą odzyskania
     */
    async handleError(error: any, context: any): Promise<boolean> {
        const logger = GameContext.getService('log');
        let errorInfo = error;
        
        // Jeśli error nie jest obiektem, tworzymy obiekt z odpowiednimi informacjami
        if (typeof error !== 'object' || error === null) {
            errorInfo = {
                message: String(error),
                time: new Date().toISOString(),
                category: ErrorCategory.UNKNOWN
            };
        }
        
        // Jeśli kategoria nie jest określona, kategoryzujemy błąd
        if (!errorInfo.category) {
            errorInfo.category = this.categorizeError(error);
        }
        
        // Dodajemy błąd do historii
        this.addToErrorHistory(errorInfo);
        
        // Logujemy błąd
        logger.error(`Błąd [${ErrorCategory[errorInfo.category]}]: ${errorInfo.message}`, "ERROR");
        
        // Powiadamiamy nasłuchujących
        const listeners = this.errorListeners.get(errorInfo.category) || [];
        listeners.forEach(listener => {
            try {
                listener(errorInfo, context);
            } catch (listenerError) {
                logger.error(`Błąd w obsłudze nasłuchiwania: ${listenerError instanceof Error ? listenerError.message : String(listenerError)}`, "ERROR");
            }
        });
        
        // Próbujemy odzyskać po błędzie
        return this.attemptRecovery(errorInfo, context);
    }
    
    /**
     * Próbuje odzyskać po błędzie używając zarejestrowanych strategii
     */
    private async attemptRecovery(error: any, context: any): Promise<boolean> {
        const logger = GameContext.getService('log');
        const strategies = this.recoveryStrategies.get(error.category) || [];
        
        // Brak strategii odzyskiwania
        if (strategies.length === 0) {
            logger.warn(`Brak strategii odzyskiwania dla kategorii błędu ${ErrorCategory[error.category]}`, "ERROR");
            
            // Wyświetlamy komunikat o błędzie
            if (error.category !== ErrorCategory.UNKNOWN && error.category !== ErrorCategory.ASSET_LOADING) {
                this.displayErrorMessage(context.game, error);
            }
            
            return false;
        }
        
        // Próbujemy każdej strategii odzyskiwania
        for (const strategy of strategies) {
            try {
                const recovered = await strategy(error, context);
                if (recovered) {
                    logger.info(`Pomyślnie odzyskano po błędzie kategorii ${ErrorCategory[error.category]}`, "ERROR_RECOVERY");
                    return true;
                }
            } catch (strategyError) {
                logger.error(`Błąd w strategii odzyskiwania: ${strategyError instanceof Error ? strategyError.message : String(strategyError)}`, "ERROR");
            }
        }
        
        // Żadna strategia nie zadziałała - wyświetlamy komunikat o błędzie
        logger.warn(`Nie udało się odzyskać po błędzie kategorii ${ErrorCategory[error.category]}`, "ERROR");
        this.displayErrorMessage(context.game, error);
        
        return false;
    }
    
    /**
     * Dodaje błąd do historii
     */
    private addToErrorHistory(error: ErrorRecord): void {
        this.errorHistory.push(error);
        
        // Ograniczamy rozmiar historii
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
    }
    
    /**
     * Wyświetla przyjazny komunikat o błędzie
     */
    displayErrorMessage(game: Phaser.Game, error: any): void {
        if (!game || !game.scene || !game.scene.scenes || game.scene.scenes.length === 0) {
            return;
        }
        
        try {
            // Wybieramy aktywną scenę
            const activeScene = game.scene.scenes.find(scene => scene.sys.settings.active);
            if (!activeScene) return;
            
            // Tworzymy kontener dla komunikatu
            const width = activeScene.cameras.main.width;
            const height = activeScene.cameras.main.height;
            
            // Przyciemnienie tła
            const overlay = activeScene.add.rectangle(width/2, height/2, width, height, 0x000000, 0.7)
                .setDepth(1000);
            
            // Tło komunikatu
            const messageBg = activeScene.add.rectangle(width/2, height/2, 400, 200, 0x333333)
                .setDepth(1001);
            
            // Treść komunikatu
            let messageText: string;
            switch(error.category) {
                case ErrorCategory.RENDERING:
                    messageText = "Wystąpił problem z wyświetlaniem grafiki.\nSpróbuj włączyć tryb wysokiej wydajności.";
                    break;
                case ErrorCategory.PHYSICS:
                    messageText = "Wystąpił problem z fizyką gry.\nGra będzie kontynuowana z ograniczoną fizyką.";
                    break;
                case ErrorCategory.GAME_LOGIC:
                    messageText = "Wystąpił problem z logiką gry.\nMożesz kontynuować, ale niektóre funkcje mogą nie działać.";
                    break;
                case ErrorCategory.AUDIO:
                    messageText = "Wystąpił problem z dźwiękiem.\nGra będzie kontynuowana bez dźwięku.";
                    break;
                default:
                    messageText = "Wystąpił nieoczekiwany problem.\nGra spróbuje kontynuować działanie.";
            }
            
            const message = activeScene.add.text(width/2, height/2 - 30, messageText, {
                fontSize: '18px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5).setDepth(1002);
            
            // Przycisk kontynuacji
            const continueButton = activeScene.add.rectangle(width/2, height/2 + 50, 150, 40, 0x4a4a4a)
                .setInteractive()
                .setDepth(1002);
            
            const buttonText = activeScene.add.text(width/2, height/2 + 50, "Kontynuuj", {
                fontSize: '16px',
                color: '#ffffff'
            }).setOrigin(0.5).setDepth(1003);
            
            // Efekt interakcji z przyciskiem
            continueButton.on('pointerover', () => {
                continueButton.fillColor = 0x666666;
            });
            
            continueButton.on('pointerout', () => {
                continueButton.fillColor = 0x4a4a4a;
            });
            
            // Kliknięcie przycisku zamyka komunikat
            continueButton.on('pointerup', () => {
                overlay.destroy();
                messageBg.destroy();
                message.destroy();
                continueButton.destroy();
                buttonText.destroy();
            });
            
            // Automatyczne ukrycie po 10 sekundach
            activeScene.time.delayedCall(10000, () => {
                if (overlay.active) {
                    overlay.destroy();
                    messageBg.destroy();
                    message.destroy();
                    continueButton.destroy();
                    buttonText.destroy();
                }
            });
        } catch (displayError) {
            console.error("Nie udało się wyświetlić komunikatu o błędzie:", displayError);
        }
    }
    
    /**
     * Zwraca historię błędów
     */
    getErrorHistory(): ErrorRecord[] {
        return [...this.errorHistory];
    }
    
    /**
     * Czyści historię błędów
     */
    clearErrorHistory(): void {
        this.errorHistory = [];
    }
}

// Typy błędów podzielone na kategorie
export enum ErrorCategory {
    ASSET_LOADING = 'ASSET_LOADING',
    RENDERING = 'RENDERING',
    PHYSICS = 'PHYSICS',
    GAME_LOGIC = 'GAME_LOGIC',
    AUDIO = 'AUDIO',
    UNKNOWN = 'UNKNOWN'
}

// Rekord błędu
interface ErrorRecord {
    message: string;
    source?: string;
    line?: number;
    column?: number;
    stack?: string;
    time: string;
    category: ErrorCategory;
    data?: any;
}

// managers/LogManager.ts
/**
 * Rozszerzony menedżer logowania z poziomami i kategoriami
 */
export class LogManager {
    // Poziomy logowania
    static readonly LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        NONE: 4
    };
    
    private currentLevel: number;
    private enabledCategories: {[category: string]: boolean};
    private throttleTime: {[category: string]: number};
    private lastLogTime: {[category: string]: number};
    private logHistory: LogEntry[];
    private maxHistorySize: number = 1000;
    
    constructor() {
        // Domyślny poziom logowania
        this.currentLevel = LogManager.LEVELS.INFO;
        
        // Włączenie/wyłączenie kategorii logów
        this.enabledCategories = {
            ENEMY_POSITION: false,
            ENEMY_DAMAGE: true,
            ENEMY_SPAWN: true,
            PLAYER_ATTACK: true,
            PLAYER_DAMAGE: true,
            GAME_STATE: true,
            PERFORMANCE: true,
            RESOURCES: true,
            ERROR: true,
            ERROR_RECOVERY: true,
            DEBUG: false
        };
        
        // Limity częstotliwości logowania dla kategorii (w ms)
        this.throttleTime = {
            ENEMY_POSITION: 5000,
            ENEMY_SPAWN: 0,
            ENEMY_DAMAGE: 0,
            PLAYER_ATTACK: 0,
            PLAYER_DAMAGE: 0,
            GAME_STATE: 0,
            PERFORMANCE: 1000,
            RESOURCES: 1000,
            ERROR: 0,
            ERROR_RECOVERY: 0,
            DEBUG: 1000
        };
        
        // Czasy ostatniego logowania dla limitowanych kategorii
        this.lastLogTime = {
            ENEMY_POSITION: 0,
            ENEMY_SPAWN: 0,
            ENEMY_DAMAGE: 0,
            PLAYER_ATTACK: 0,
            PLAYER_DAMAGE: 0,
            GAME_STATE: 0,
            PERFORMANCE: 0,
            RESOURCES: 0,
            ERROR: 0,
            ERROR_RECOVERY: 0,
            DEBUG: 0
        };
        
        // Historia logów
        this.logHistory = [];
        
        console.log("LogManager: System logowania zainicjalizowany");
    }
    
    /**
     * Konfiguracja systemu logowania
     */
    configure(options: LogOptions): void {
        // Ustawiamy poziom logowania
        if (options.baseLevel) {
            const level = this.getLevelFromString(options.baseLevel);
            if (level !== undefined) {
                this.currentLevel = level;
            }
        }
        
        // Włączamy/wyłączamy kategorie
        if (options.enableCategories) {
            options.enableCategories.forEach(category => {
                this.setCategory(category, true);
            });
        }
        
        if (options.disableCategories) {
            options.disableCategories.forEach(category => {
                this.setCategory(category, false);
            });
        }
        
        // Ustawiamy limity throttlingu
        if (options.throttleLimits) {
            Object.entries(options.throttleLimits).forEach(([category, time]) => {
                if (this.throttleTime.hasOwnProperty(category)) {
                    this.throttleTime[category] = time;
                }
            });
        }
        
        console.log(`LogManager: System logowania skonfigurowany na poziomie ${this.getLevelName(this.currentLevel)}`);
    }
    
    /**
     * Konwertuje nazwę poziomu na wartość liczbową
     */
    private getLevelFromString(level: string): number | undefined {
        const levels: {[key: string]: number} = {
            'debug': LogManager.LEVELS.DEBUG,
            'info': LogManager.LEVELS.INFO,
            'warn': LogManager.LEVELS.WARN,
            'error': LogManager.LEVELS.ERROR,
            'none': LogManager.LEVELS.NONE
        };
        
        return levels[level.toLowerCase()];
    }
    
    /**
     * Zwraca nazwę poziomu
     */
    private getLevelName(level: number): string {
        const names = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'];
        return names[level] || 'UNKNOWN';
    }
    
    /**
     * Zapisuje log na poziomie DEBUG
     */
    debug(message: string, category: string = "DEBUG", data: any = null): void {
        if (this.currentLevel <= LogManager.LEVELS.DEBUG && this.shouldLog(category)) {
            this.log(message, category, data, "debug");
        }
    }
    
    /**
     * Zapisuje log na poziomie INFO
     */
    info(message: string, category: string = "GAME_STATE", data: any = null): void {
        if (this.currentLevel <= LogManager.LEVELS.INFO && this.shouldLog(category)) {
            this.log(message, category, data, "info");
        }
    }
    
    /**
     * Zapisuje log na poziomie WARN
     */
    warn(message: string, category: string = "GAME_STATE", data: any = null): void {
        if (this.currentLevel <= LogManager.LEVELS.WARN && this.shouldLog(category)) {
            this.log(message, category, data, "warn");
        }
    }
    
    /**
     * Zapisuje log na poziomie ERROR
     */
    error(message: string, category: string = "ERROR", data: any = null): void {
        if (this.currentLevel <= LogManager.LEVELS.ERROR) {
            // Loguj błędy niezależnie od kategorii
            this.log(message, category, data, "error");
        }
    }
    
    /**
     * Sprawdza, czy dana kategoria powinna być zalogowana
     */
    shouldLog(category: string): boolean {
        // Sprawdź czy kategoria jest włączona
        if (!this.enabledCategories[category]) {
            return false;
        }
        
        // Sprawdź limity częstotliwości
        const throttleLimit = this.throttleTime[category];
        if (throttleLimit > 0) {
            const currentTime = Date.now();
            if (currentTime - this.lastLogTime[category] < throttleLimit) {
                return false;
            }
            // Aktualizuj czas ostatniego logowania
            this.lastLogTime[category] = currentTime;
        }
        
        return true;
    }
    
    /**
     * Faktyczne zapisywanie logów
     */
    private log(message: string, category: string, data: any = null, logType: LogType = "info"): void {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp.split("T")[1].split("Z")[0]}][${category}]`;
        
        // Dodajemy do historii
        this.logHistory.push({
            message,
            category,
            level: logType,
            timestamp,
            data
        });
        
        // Ograniczamy rozmiar historii
        if (this.logHistory.length > this.maxHistorySize) {
            this.logHistory.shift();
        }
        
        // Logujemy do konsoli
        if (data) {
            console[logType](`${prefix} ${message}`, data);
        } else {
            console[logType](`${prefix} ${message}`);
        }
    }
    
    /**
     * Włącza lub wyłącza kategorię logów
     */
    setCategory(category: string, enabled: boolean): void {
        if (this.enabledCategories.hasOwnProperty(category)) {
            this.enabledCategories[category] = enabled;
            console.log(`LogManager: Kategoria ${category} ${enabled ? "włączona" : "wyłączona"}`);
        }
    }
    
    /**
     * Ustawia poziom logowania
     */
    setLevel(level: number): void {
        if (level >= LogManager.LEVELS.DEBUG && level <= LogManager.LEVELS.NONE) {
            this.currentLevel = level;
            console.log(`LogManager: Poziom logowania zmieniony na ${this.getLevelName(level)}`);
        }
    }
    
    /**
     * Zwraca historię logów
     */
    getHistory(options?: LogHistoryOptions): LogEntry[] {
        let filteredLogs = [...this.logHistory];
        
        // Filtrowanie po poziomie
        if (options?.level !== undefined) {
            const level = typeof options.level === 'string' 
                ? this.getLevelFromString(options.level) 
                : options.level;
                
            if (level !== undefined) {
                const levelMap: {[key: string]: number} = {
                    'debug': 0,
                    'info': 1,
                    'warn': 2,
                    'error': 3
                };
                
                filteredLogs = filteredLogs.filter(log => 
                    levelMap[log.level] >= level
                );
            }
        }
        
        // Filtrowanie po kategorii
        if (options?.category) {
            filteredLogs = filteredLogs.filter(log => 
                log.category === options.category
            );
        }
        
        // Filtrowanie po wiadomości
        if (options?.messageContains) {
            const searchTerm = options.messageContains.toLowerCase();
            filteredLogs = filteredLogs.filter(log => 
                log.message.toLowerCase().includes(searchTerm)
            );
        }
        
        // Ograniczenie liczby wyników
        if (options?.limit) {
            filteredLogs = filteredLogs.slice(-options.limit);
        }
        
        return filteredLogs;
    }
}

// Typy
type LogType = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    message: string;
    category: string;
    level: LogType;
    timestamp: string;
    data?: any;
}

interface LogOptions {
    baseLevel?: string;
    enableCategories?: string[];
    disableCategories?: string[];
    throttleLimits?: {[category: string]: number};
}

interface LogHistoryOptions {
    level?: number | string;
    category?: string;
    messageContains?: string;
    limit?: number;
}

// types/AssetTypes.ts
export enum AssetType {
    TEXTURE,
    AUDIO,
    JSON,
    XML,
    TEXT,
    BINARY,
    OTHER
}