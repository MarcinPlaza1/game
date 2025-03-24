// utils/DeviceCapabilities.ts
/**
 * Klasa wykrywająca możliwości urządzenia zamiast polegania na user-agent
 */
export class DeviceCapabilities {
    private _hasTouch: boolean;
    private _hasWeakGPU: boolean;
    private _hasLowMemory: boolean;
    private _hasLowCPU: boolean;
    private _isLowEndDevice: boolean;
    
    constructor() {
        // Sprawdzamy funkcje, a nie identyfikatory urządzenia
        this._hasTouch = this.detectTouchSupport();
        this._hasWeakGPU = this.detectWeakGPU();
        this._hasLowMemory = this.detectLowMemory();
        this._hasLowCPU = this.detectLowCPU();
        
        // Określamy, czy urządzenie jest ogólnie słabe
        this._isLowEndDevice = this._hasLowCPU || this._hasLowMemory || this._hasWeakGPU;
        
        // Logowanie wykrytych możliwości w trybie deweloperskim
        if (this.isDevMode()) {
            console.log('Device capabilities detected:', {
                touch: this._hasTouch,
                weakGPU: this._hasWeakGPU,
                lowMemory: this._hasLowMemory,
                lowCPU: this._hasLowCPU,
                isLowEnd: this._isLowEndDevice
            });
        }
    }
    
    /**
     * Wykrywa obsługę dotyku
     */
    private detectTouchSupport(): boolean {
        return 'ontouchstart' in window || 
               navigator.maxTouchPoints > 0 || 
               (navigator as any).msMaxTouchPoints > 0;
    }
    
    /**
     * Wykrywa słabą kartę graficzną na podstawie dostępnych wskazówek
     */
    private detectWeakGPU(): boolean {
        // Tworzymy testowy canvas do sprawdzenia możliwości WebGL
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) {
                return true; // Brak WebGL wskazuje na słabą grafikę
            }
            
            // Sprawdzamy rozszerzenia WebGL jako wskaźnik możliwości
            const extensions = gl.getSupportedExtensions();
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            
            if (debugInfo) {
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                
                // Sprawdzamy znaną listę słabych kart graficznych
                const weakGPUPatterns = [
                    /Intel HD Graphics/i,
                    /GMA/i,
                    /Mali-4/i,
                    /PowerVR/i,
                    /Adreno 3/i,
                    /Mobile Intel/i
                ];
                
                if (weakGPUPatterns.some(pattern => pattern.test(renderer))) {
                    return true;
                }
            }
            
            // Sprawdź maksymalny rozmiar tekstury jako wskaźnik możliwości GPU
            const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            return maxTextureSize < 4096; // Stare lub słabe GPU często mają limit < 4096
            
        } catch (e) {
            return true; // W razie błędu zakładamy słabe GPU dla bezpieczeństwa
        }
    }
    
    /**
     * Wykrywa niską ilość pamięci
     */
    private detectLowMemory(): boolean {
        // Użyj API deviceMemory, jeśli jest dostępne
        if ('deviceMemory' in navigator) {
            return (navigator as any).deviceMemory < 4;
        }
        
        // Sprawdź, czy jesteśmy na urządzeniu mobilnym (zazwyczaj mają mniej RAM)
        const isMobileByScreen = window.innerWidth < 768 && this._hasTouch;
        
        // Sprawdź informacje o limitach pamięci w przeglądarce, jeśli są dostępne
        const lowMemoryLimit = 'performance' in window && (performance as any).memory
            ? (performance as any).memory.jsHeapSizeLimit < 536870912 // < 512 MB
            : false;
            
        return isMobileByScreen || lowMemoryLimit;
    }
    
    /**
     * Wykrywa słabe CPU
     */
    private detectLowCPU(): boolean {
        // Sprawdź liczbę rdzeni CPU
        const cpuCores = navigator.hardwareConcurrency || 2;
        
        // Prosty test wydajności CPU
        const startTime = performance.now();
        let count = 0;
        
        // Wykonujemy proste operacje matematyczne przez 5ms
        while (performance.now() - startTime < 5) {
            Math.sin(count) * Math.cos(count);
            count++;
        }
        
        // Jeśli wykonaliśmy mniej niż oczekiwana liczba operacji, CPU może być wolne
        const isSlow = count < 10000;
        
        return cpuCores <= 2 || isSlow;
    }
    
    /**
     * Sprawdza, czy jesteśmy w trybie deweloperskim
     */
    private isDevMode(): boolean {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.search.includes('debug=true');
    }
    
    /**
     * Zwraca zalecane ustawienia dla wykrytego urządzenia
     */
    getRecommendedSettings(): GameSettings {
        const settings: GameSettings = {
            fps: 60,
            antialias: true,
            roundPixels: false,
            lowEnd: false,
            particleEffects: true,
            shadowEffects: true,
            highPerformance: true
        };
        
        if (this._isLowEndDevice) {
            settings.fps = 30;
            settings.antialias = false;
            settings.roundPixels = true;
            settings.lowEnd = true;
            settings.particleEffects = false;
            settings.shadowEffects = false;
            settings.highPerformance = false;
        }
        
        return settings;
    }
    
    // Publiczne gettery
    hasTouch(): boolean { return this._hasTouch; }
    hasWeakGPU(): boolean { return this._hasWeakGPU; }
    hasLowMemory(): boolean { return this._hasLowMemory; }
    hasLowCPU(): boolean { return this._hasLowCPU; }
    isLowEndDevice(): boolean { return this._isLowEndDevice; }
}

// Typy dla ustawień gry
export interface GameSettings {
    fps: number;
    antialias: boolean;
    roundPixels: boolean;
    lowEnd: boolean;
    particleEffects: boolean;
    shadowEffects: boolean;
    highPerformance: boolean;
}

// managers/PerformanceManager.ts
import { GameStateManager } from './GameStateManager';
import { DeviceCapabilities } from '../utils/DeviceCapabilities';
import { GameContext } from '../context/GameContext';

/**
 * Rozszerzony menedżer wydajności z wielopoziomowymi optymalizacjami
 */
export class PerformanceManager {
    private game: Phaser.Game;
    private stateManager: GameStateManager;
    private deviceCapabilities: DeviceCapabilities;
    
    // Parametry monitorowania wydajności
    private readonly TARGET_FPS: number;
    private readonly MIN_ACCEPTABLE_FPS: number;
    private readonly CRITICAL_FPS: number;
    private fpsHistory: number[] = [];
    private frameTimeHistory: number[] = [];
    private measurementInterval: number = 1000; // ms
    private lastMeasurementTime: number = 0;
    
    // Poziomy optymalizacji
    private currentOptimizationLevel: number = 0;
    private maxOptimizationLevel: number = 3;
    
    // Dane o zredukowanych zasobach
    private originalEnemyLimit: number | null = null;
    private reducedEnemyLimit: number | null = null;
    
    // Obsługa pomiaru wydajności
    private boundPerformanceCheck: () => void;
    
    constructor(game: Phaser.Game, stateManager: GameStateManager, deviceCapabilities: DeviceCapabilities) {
        this.game = game;
        this.stateManager = stateManager;
        this.deviceCapabilities = deviceCapabilities;
        
        // Ustawiamy docelowe FPS w zależności od urządzenia
        const settings = deviceCapabilities.getRecommendedSettings();
        this.TARGET_FPS = settings.fps;
        this.MIN_ACCEPTABLE_FPS = Math.floor(this.TARGET_FPS * 0.8); // 80% docelowego FPS
        this.CRITICAL_FPS = Math.floor(this.TARGET_FPS * 0.5); // 50% docelowego FPS
        
        // Bindujemy metodę, aby zachować kontekst this
        this.boundPerformanceCheck = this.checkPerformance.bind(this);
    }
    
    /**
     * Rozpoczyna monitorowanie wydajności
     */
    startMonitoring(): void {
        // Używamy zdarzenia postrender do monitorowania FPS
        this.game.events.on('postrender', this.boundPerformanceCheck);
        
        const logger = GameContext.getService('log');
        logger.info(`Rozpoczęto monitoring wydajności. Docelowe FPS: ${this.TARGET_FPS}`, "PERFORMANCE");
    }
    
    /**
     * Zatrzymuje monitorowanie wydajności
     */
    stopMonitoring(): void {
        this.game.events.off('postrender', this.boundPerformanceCheck);
        
        const logger = GameContext.getService('log');
        logger.info("Zatrzymano monitoring wydajności", "PERFORMANCE");
    }
    
    /**
     * Sprawdza wydajność i dostosowuje ustawienia gry
     */
    private checkPerformance(): void {
        const currentTime = performance.now();
        
        // Aktualizujemy historię tylko co określony interwał
        if (currentTime - this.lastMeasurementTime < this.measurementInterval) {
            return;
        }
        
        // Zbieramy metryki wydajności
        const metrics = this.gatherPerformanceMetrics();
        
        // Określamy potrzebny poziom optymalizacji
        const requiredOptimizationLevel = this.determineOptimizationLevel(metrics);
        
        // Jeśli potrzebny poziom optymalizacji jest inny niż obecny, stosujemy zmiany
        if (requiredOptimizationLevel !== this.currentOptimizationLevel) {
            this.applyOptimizations(requiredOptimizationLevel);
            this.currentOptimizationLevel = requiredOptimizationLevel;
        }
        
        // Aktualizujemy czas ostatniego pomiaru
        this.lastMeasurementTime = currentTime;
    }
    
    /**
     * Zbiera kompleksowe metryki wydajności
     */
    private gatherPerformanceMetrics(): PerformanceMetrics {
        const currentFps = this.game.loop.actualFps;
        const frameTime = performance.now() - this.lastMeasurementTime;
        
        // Aktualizujemy historię FPS i czasu klatki
        this.fpsHistory.push(currentFps);
        this.frameTimeHistory.push(frameTime);
        
        // Zachowujemy tylko ostatnie N pomiarów
        const maxHistoryLength = 10;
        if (this.fpsHistory.length > maxHistoryLength) {
            this.fpsHistory.shift();
            this.frameTimeHistory.shift();
        }
        
        // Obliczamy średnie i stabilność
        const avgFps = this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length;
        const avgFrameTime = this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length;
        
        // Obliczamy stabilność FPS (odchylenie standardowe)
        const fpsVariance = this.fpsHistory.reduce((sum, fps) => sum + Math.pow(fps - avgFps, 2), 0) / this.fpsHistory.length;
        const fpsStability = 1 - Math.min(1, Math.sqrt(fpsVariance) / avgFps);
        
        // Próbujemy uzyskać informacje o pamięci, jeśli są dostępne
        let memoryUsage = 0;
        try {
            if (performance.memory) {
                memoryUsage = performance.memory.usedJSHeapSize;
            }
        } catch (e) {
            // Ignorujemy błędy związane z dostępem do performance.memory
        }
        
        return {
            currentFps,
            avgFps,
            avgFrameTime,
            fpsStability,
            memoryUsage,
            targetFps: this.TARGET_FPS
        };
    }
    
    /**
     * Określa wymagany poziom optymalizacji na podstawie metryk
     */
    private determineOptimizationLevel(metrics: PerformanceMetrics): number {
        // Poziom 0: Brak optymalizacji, wszystko działa dobrze
        if (metrics.avgFps >= this.TARGET_FPS * 0.95 && metrics.fpsStability > 0.9) {
            return 0;
        }
        
        // Poziom 1: Lekkie optymalizacje - FPS lekko poniżej celu
        if (metrics.avgFps >= this.MIN_ACCEPTABLE_FPS) {
            return 1;
        }
        
        // Poziom 2: Średnie optymalizacje - FPS znacząco poniżej celu
        if (metrics.avgFps >= this.CRITICAL_FPS) {
            return 2;
        }
        
        // Poziom 3: Ciężkie optymalizacje - FPS krytycznie niski
        return 3;
    }
    
    /**
     * Stosuje optymalizacje odpowiednie dla danego poziomu
     */
    private applyOptimizations(level: number): void {
        const logger = GameContext.getService('log');
        const gameState = this.stateManager.getState();
        
        // Zapamiętujemy czy musimy włączyć tryb wydajności
        let enablePerformanceMode = false;
        
        switch(level) {
            case 0: // Brak optymalizacji
                if (gameState.performanceMode) {
                    // Wyłączamy tryb wydajności, jeśli jest włączony
                    enablePerformanceMode = false;
                    
                    // Przywracamy oryginalne limity
                    this.restoreOriginalSettings();
                    logger.info("Wydajność jest dobra - wyłączam tryb wysokiej wydajności", "PERFORMANCE");
                }
                break;
                
            case 1: // Lekkie optymalizacje
                // Redukujemy efekty cząsteczkowe i cienie
                this.optimizeGraphics(true, false); // redukuj cząsteczki, zachowaj cienie
                
                // Wyświetlamy komunikat tylko raz
                if (this.currentOptimizationLevel === 0) {
                    logger.info("Zastosowano lekkie optymalizacje graficzne dla lepszej wydajności", "PERFORMANCE");
                    this.showPerformanceMessage("Zoptymalizowano efekty graficzne");
                }
                break;
                
            case 2: // Średnie optymalizacje
                // Włączamy tryb wydajności
                enablePerformanceMode = true;
                
                // Redukujemy efekty cząsteczkowe i cienie
                this.optimizeGraphics(true, true); // redukuj cząsteczki i cienie
                
                // Wyświetlamy komunikat tylko raz
                if (this.currentOptimizationLevel < 2) {
                    logger.info("Zastosowano średnie optymalizacje - włączono tryb wydajności", "PERFORMANCE");
                    this.showPerformanceMessage("Włączono tryb wysokiej wydajności");
                }
                break;
                
            case 3: // Ciężkie optymalizacje
                // Włączamy tryb wydajności
                enablePerformanceMode = true;
                
                // Redukujemy efekty cząsteczkowe i cienie
                this.optimizeGraphics(true, true); // redukuj cząsteczki i cienie
                
                // Redukujemy liczbę wrogów
                this.reduceEnemies();
                
                // Wyświetlamy komunikat tylko raz
                if (this.currentOptimizationLevel < 3) {
                    logger.warn("Zastosowano głębokie optymalizacje - zredukowano liczbę wrogów", "PERFORMANCE");
                    this.showPerformanceMessage("Zredukowano liczbę wrogów dla lepszej wydajności");
                }
                break;
        }
        
        // Aktualizujemy stan trybu wydajności tylko jeśli potrzeba
        if (gameState.performanceMode !== enablePerformanceMode) {
            this.stateManager.setState({ performanceMode: enablePerformanceMode });
        }
    }
    
    /**
     * Optymalizuje ustawienia graficzne
     */
    private optimizeGraphics(reduceParticles: boolean, reduceShadows: boolean): void {
        try {
            // Funkcja do zastosowania ustawień do wszystkich aktywnych scen
            this.game.scene.scenes.forEach(scene => {
                // Informowanie scen o zmianie ustawień graficznych
                scene.events.emit('graphicsSettingsChanged', { 
                    reduceParticles, 
                    reduceShadows 
                });
            });
        } catch (error) {
            const logger = GameContext.getService('log');
            logger.error(`Błąd podczas optymalizacji grafiki: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "PERFORMANCE");
        }
    }
    
    /**
     * Zmniejsza limit wrogów w przypadku bardzo niskiej wydajności
     */
    private reduceEnemies(): void {
        try {
            // Próbujemy uzyskać dostęp do systemu wrogów
            const gameScene = this.game.scene.scenes.find(
                scene => scene.sys.settings.key === 'GameScene'
            ) as any;
            
            if (gameScene && gameScene.enemySystem) {
                // Zapamiętujemy oryginalny limit tylko raz
                if (this.originalEnemyLimit === null) {
                    this.originalEnemyLimit = gameScene.enemySystem.maxEnemiesOnScreen;
                }
                
                // Obliczamy nowy limit wrogów (60% oryginalnego)
                const newLimit = Math.floor(this.originalEnemyLimit * 0.6);
                
                // Stosujemy nowy limit tylko jeśli jest inny od obecnego
                if (this.reducedEnemyLimit !== newLimit) {
                    gameScene.enemySystem.maxEnemiesOnScreen = newLimit;
                    this.reducedEnemyLimit = newLimit;
                    
                    const logger = GameContext.getService('log');
                    logger.info(`Zmniejszono limit wrogów z ${this.originalEnemyLimit} do ${newLimit}`, "PERFORMANCE");
                }
            }
        } catch (error) {
            const logger = GameContext.getService('log');
            logger.error(`Błąd podczas zmniejszania limitu wrogów: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "PERFORMANCE");
        }
    }
    
    /**
     * Przywraca oryginalne ustawienia
     */
    private restoreOriginalSettings(): void {
        try {
            // Przywracamy oryginalny limit wrogów
            if (this.originalEnemyLimit !== null && this.reducedEnemyLimit !== null) {
                const gameScene = this.game.scene.scenes.find(
                    scene => scene.sys.settings.key === 'GameScene'
                ) as any;
                
                if (gameScene && gameScene.enemySystem) {
                    gameScene.enemySystem.maxEnemiesOnScreen = this.originalEnemyLimit;
                    this.reducedEnemyLimit = null;
                    
                    const logger = GameContext.getService('log');
                    logger.info(`Przywrócono oryginalny limit wrogów: ${this.originalEnemyLimit}`, "PERFORMANCE");
                }
            }
            
            // Przywracamy pełne efekty graficzne
            this.optimizeGraphics(false, false);
            
        } catch (error) {
            const logger = GameContext.getService('log');
            logger.error(`Błąd podczas przywracania ustawień: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "PERFORMANCE");
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
                    }).setOrigin(0.5).setDepth(1000);
                    
                    activeScene.tweens.add({
                        targets: performanceText,
                        alpha: 0,
                        y: 280,
                        duration: 3000,
                        onComplete: () => performanceText.destroy()
                    });
                }
            } catch (error) {
                const logger = GameContext.getService('log');
                logger.error(`Błąd podczas wyświetlania komunikatu: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "PERFORMANCE");
            }
        }
    }
}

// Typy dla metryk wydajności
interface PerformanceMetrics {
    currentFps: number;
    avgFps: number;
    avgFrameTime: number;
    fpsStability: number;
    memoryUsage: number;
    targetFps: number;
}