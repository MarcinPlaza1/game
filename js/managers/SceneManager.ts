// managers/SceneManager.ts
import { GameContext } from '../context/GameContext';

/**
 * Zarządza scenami gry, ich inicjalizacją oraz komunikacją między scenami
 */
export class SceneManager {
    private game: Phaser.Game;
    private context: GameContext;
    private registeredScenes: Map<string, {scene: any, class: any}>;
    private sceneData: Map<string, any>;
    private sceneTransitions: Map<string, SceneTransition>;
    
    constructor(game: Phaser.Game, context: GameContext) {
        this.game = game;
        this.context = context;
        this.registeredScenes = new Map();
        this.sceneData = new Map();
        this.sceneTransitions = new Map();
        
        // Monitorujemy scenę dla eventów
        this.setupSceneEventListeners();
    }
    
    /**
     * Konfiguruje nasłuchiwanie zdarzeń scen
     */
    private setupSceneEventListeners(): void {
        // Nasłuchuj na start sceny
        this.game.scene.on('start', (key: string) => {
            const logger = this.context.getService('log');
            logger.debug(`Scena ${key} uruchomiona`, "GAME_STATE");
            
            // Znalezienie sceny w rejestracji
            const registeredScene = this.registeredScenes.get(key);
            if (registeredScene) {
                const scene = this.game.scene.getScene(key);
                
                // Jeśli scena jest rozszerzoną sceną, inicjalizujemy jej kontekst
                if (scene instanceof EnhancedScene) {
                    scene.setContext(this.context);
                }
                
                // Zastosuj dane przekazane do sceny
                const data = this.sceneData.get(key);
                if (data) {
                    if (scene instanceof EnhancedScene) {
                        scene.setSceneData(data);
                    } else {
                        // W przypadku zwykłej sceny, przekazujemy dane do data
                        scene.sys.settings.data = data;
                    }
                }
            }
        });
        
        // Nasłuchuj na zatrzymanie sceny
        this.game.scene.on('stop', (key: string) => {
            const logger = this.context.getService('log');
            logger.debug(`Scena ${key} zatrzymana`, "GAME_STATE");
        });
        
        // Nasłuchuj na usunięcie sceny
        this.game.scene.on('remove', (key: string) => {
            const logger = this.context.getService('log');
            logger.debug(`Scena ${key} usunięta`, "GAME_STATE");
            
            // Usuń dane sceny
            this.sceneData.delete(key);
            this.registeredScenes.delete(key);
        });
    }
    
    /**
     * Rejestruje scenę w menedżerze
     */
    registerScene(sceneInfo: SceneInfo): void {
        if (this.registeredScenes.has(sceneInfo.key)) {
            const logger = this.context.getService('log');
            logger.warn(`Scena o kluczu ${sceneInfo.key} jest już zarejestrowana. Nadpisuję.`, "GAME_STATE");
        }
        
        // Dodajemy scenę do silnika Phaser
        this.game.scene.add(sceneInfo.key, sceneInfo.sceneClass);
        
        // Dodajemy scenę do naszej rejestracji
        this.registeredScenes.set(sceneInfo.key, {
            scene: null, // Scena zostanie utworzona przez Phaser
            class: sceneInfo.sceneClass
        });
        
        const logger = this.context.getService('log');
        logger.debug(`Zarejestrowano scenę: ${sceneInfo.key}`, "GAME_STATE");
    }
    
    /**
     * Rejestruje wiele scen na raz
     */
    registerScenes(scenes: SceneInfo[]): void {
        scenes.forEach(scene => this.registerScene(scene));
    }
    
    /**
     * Uruchamia scenę z podanymi danymi
     */
    startScene(key: string, data?: any): void {
        // Zapisujemy dane sceny do późniejszego użycia
        if (data) {
            this.sceneData.set(key, data);
        }
        
        // Uruchamiamy scenę
        this.game.scene.start(key);
        
        const logger = this.context.getService('log');
        logger.info(`Uruchamiam scenę: ${key}${data ? ' z danymi' : ''}`, "GAME_STATE");
    }
    
    /**
     * Wykonuje przejście między scenami
     */
    transitionToScene(from: string, to: string, data?: any, config?: SceneTransitionConfig): void {
        const logger = this.context.getService('log');
        
        // Zapisujemy dane sceny
        if (data) {
            this.sceneData.set(to, data);
        }
        
        const fromScene = this.game.scene.getScene(from);
        const transition: SceneTransition = {
            from,
            to,
            startTime: Date.now(),
            duration: config?.duration || 1000,
            status: "PENDING"
        };
        
        // Zapisujemy informacje o przejściu
        this.sceneTransitions.set(`${from}-${to}`, transition);
        
        if (!fromScene) {
            logger.error(`Nie można wykonać przejścia - scena ${from} nie istnieje`, "GAME_STATE");
            this.startScene(to, data);
            return;
        }
        
        // Jeśli mamy efekt przejścia, używamy go
        if (config?.effect) {
            try {
                switch (config.effect) {
                    case "FADE":
                        this.createFadeTransition(fromScene, to, transition, config);
                        break;
                    case "SLIDE":
                        this.createSlideTransition(fromScene, to, transition, config);
                        break;
                    default:
                        // Domyślnie wykonujemy proste przejście
                        this.game.scene.stop(from);
                        this.game.scene.start(to);
                }
            } catch (error) {
                logger.error(`Błąd podczas przejścia między scenami: ${error instanceof Error ? error.message : String(error)}`, "GAME_STATE");
                
                // Awaryjne uruchomienie docelowej sceny
                this.game.scene.stop(from);
                this.game.scene.start(to);
            }
        } else {
            // Bez efektu - proste przejście
            this.game.scene.stop(from);
            this.game.scene.start(to);
        }
        
        logger.info(`Przejście ze sceny ${from} do ${to}${config ? ' z efektem ' + config.effect : ''}`, "GAME_STATE");
    }
    
    /**
     * Tworzy przejście z efektem zanikania
     */
    private createFadeTransition(fromScene: Phaser.Scene, to: string, transition: SceneTransition, config: SceneTransitionConfig): void {
        // Tworzymy czarny ekran na wierzchu wszystkiego
        const width = fromScene.cameras.main.width;
        const height = fromScene.cameras.main.height;
        const fadeRect = fromScene.add.rectangle(width/2, height/2, width, height, 0x000000, 0);
        fadeRect.setDepth(1000);
        
        // Animujemy zanikanie
        fromScene.tweens.add({
            targets: fadeRect,
            alpha: 1,
            duration: transition.duration / 2,
            onComplete: () => {
                // Zatrzymujemy obecną scenę
                this.game.scene.stop(transition.from);
                
                // Uruchamiamy nową scenę
                this.game.scene.start(to);
                
                // Pobieramy nową scenę
                const toScene = this.game.scene.getScene(to);
                if (toScene) {
                    // Tworzymy obiekt zanikania w nowej scenie
                    const nextFadeRect = toScene.add.rectangle(width/2, height/2, width, height, 0x000000, 1);
                    nextFadeRect.setDepth(1000);
                    
                    // Animujemy wyłanianie się nowej sceny
                    toScene.tweens.add({
                        targets: nextFadeRect,
                        alpha: 0,
                        duration: transition.duration / 2,
                        onComplete: () => {
                            nextFadeRect.destroy();
                            transition.status = "COMPLETED";
                        }
                    });
                }
            }
        });
    }
    
    /**
     * Tworzy przejście z efektem przesuwania
     */
    private createSlideTransition(fromScene: Phaser.Scene, to: string, transition: SceneTransition, config: SceneTransitionConfig): void {
        // Uruchamiamy nową scenę pod spodem
        this.game.scene.launch(to);
        
        const toScene = this.game.scene.getScene(to);
        if (!toScene) {
            // Jeśli nie udało się uruchomić nowej sceny, używamy prostego przejścia
            this.game.scene.stop(transition.from);
            this.game.scene.start(to);
            return;
        }
        
        // Określamy kierunek przesunięcia
        const width = fromScene.cameras.main.width;
        const direction = config.direction || "LEFT";
        
        // Ustawiamy początkową pozycję nowej sceny
        if (toScene.cameras && toScene.cameras.main) {
            toScene.cameras.main.setPosition(
                direction === "LEFT" ? width : -width,
                0
            );
            
            // Animujemy przesunięcie starej sceny
            fromScene.tweens.add({
                targets: fromScene.cameras.main,
                x: direction === "LEFT" ? -width : width,
                duration: transition.duration,
                ease: 'Power2'
            });
            
            // Animujemy przesunięcie nowej sceny
            toScene.tweens.add({
                targets: toScene.cameras.main,
                x: 0,
                duration: transition.duration,
                ease: 'Power2',
                onComplete: () => {
                    this.game.scene.stop(transition.from);
                    transition.status = "COMPLETED";
                }
            });
        } else {
            // Brak kamer - używamy prostego przejścia
            this.game.scene.stop(transition.from);
            this.game.scene.start(to);
        }
    }
    
    /**
     * Zawiesza scenę
     */
    pauseScene(key: string): void {
        this.game.scene.pause(key);
        
        const logger = this.context.getService('log');
        logger.debug(`Scena ${key} została wstrzymana`, "GAME_STATE");
    }
    
    /**
     * Wznawia zawieszoną scenę
     */
    resumeScene(key: string): void {
        this.game.scene.resume(key);
        
        const logger = this.context.getService('log');
        logger.debug(`Scena ${key} została wznowiona`, "GAME_STATE");
    }
    
    /**
     * Zatrzymuje scenę i usuwa ją z pamięci
     */
    removeScene(key: string): void {
        this.game.scene.remove(key);
        this.sceneData.delete(key);
        
        const logger = this.context.getService('log');
        logger.debug(`Scena ${key} została usunięta`, "GAME_STATE");
    }
    
    /**
     * Restartuje scenę z podanymi danymi
     */
    restartScene(key: string, data?: any): void {
        if (data) {
            this.sceneData.set(key, data);
        }
        
        this.game.scene.stop(key);
        this.game.scene.start(key);
        
        const logger = this.context.getService('log');
        logger.debug(`Scena ${key} została zrestartowana`, "GAME_STATE");
    }
    
    /**
     * Zwraca aktualną scenę
     */
    getCurrentScene(): Phaser.Scene | null {
        const activeScenes = this.game.scene.scenes.filter(scene => scene.sys.settings.active);
        if (activeScenes.length > 0) {
            return activeScenes[0];
        }
        return null;
    }
    
    /**
     * Wysyła zdarzenie do wszystkich aktywnych scen
     */
    broadcastEvent(event: string, ...args: any[]): void {
        const activeScenes = this.game.scene.scenes.filter(scene => scene.sys.settings.active);
        
        activeScenes.forEach(scene => {
            scene.events.emit(event, ...args);
        });
        
        const logger = this.context.getService('log');
        logger.debug(`Rozgłoszono zdarzenie '${event}' do ${activeScenes.length} aktywnych scen`, "GAME_STATE");
    }
}

// Typy danych dla menedżera scen
interface SceneInfo {
    key: string;
    sceneClass: new (...args: any[]) => Phaser.Scene;
}

interface SceneTransition {
    from: string;
    to: string;
    startTime: number;
    duration: number;
    status: "PENDING" | "COMPLETED" | "FAILED";
}

interface SceneTransitionConfig {
    duration?: number;
    effect?: "FADE" | "SLIDE" | "NONE";
    direction?: "LEFT" | "RIGHT" | "UP" | "DOWN";
}

// enhanced/EnhancedScene.ts
import { GameContext } from '../context/GameContext';
import { SafeGameObjectFactory } from './SafeGameObjectFactory';

/**
 * Rozszerzona klasa sceny z bezpiecznymi rozszerzeniami
 * Zamiast modyfikować prototyp Phaser.Scene, tworzymy własną klasę dziedziczącą
 */
export class EnhancedScene extends Phaser.Scene {
    // Bezpieczne tworzenie obiektów
    protected safeAdd: SafeGameObjectFactory;
    
    // Kontekst gry
    protected context: GameContext | null = null;
    
    // Dane przekazywane między scenami
    protected sceneData: any = null;
    
    // Debug mode flag
    protected debugMode: boolean = false;
    
    constructor(config: string | Phaser.Types.Scenes.SettingsConfig) {
        super(config);
    }
    
    /**
     * Ustawia kontekst gry dla sceny
     */
    setContext(context: GameContext): void {
        this.context = context;
        
        // Po ustawieniu kontekstu możemy zainicjować safeAdd
        this.safeAdd = new SafeGameObjectFactory(this);
        
        // Pobieramy stan gry z kontekstu
        if (this.context) {
            try {
                const stateManager = this.context.getService('state');
                const state = stateManager.getState();
                this.debugMode = state.debugMode || false;
            } catch (e) {
                console.warn("Nie można pobrać stanu z kontekstu:", e);
            }
        }
    }
    
    /**
     * Ustawia dane przekazane do sceny
     */
    setSceneData(data: any): void {
        this.sceneData = data;
    }
    
    /**
     * Bezpieczne tworzenie koła
     */
    safeCircle(x: number, y: number, radius: number, fillColor?: number, fillAlpha?: number): Phaser.GameObjects.Arc {
        if (!this.safeAdd) {
            this.safeAdd = new SafeGameObjectFactory(this);
        }
        return this.safeAdd.circle(x, y, radius, fillColor, fillAlpha);
    }
    
    /**
     * Bezpieczne tworzenie tekstu
     */
    safeText(x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
        if (!this.safeAdd) {
            this.safeAdd = new SafeGameObjectFactory(this);
        }
        return this.safeAdd.text(x, y, text, style);
    }
    
    /**
     * Bezpieczne tworzenie prostokąta
     */
    safeRectangle(x: number, y: number, width: number, height: number, fillColor?: number, fillAlpha?: number): Phaser.GameObjects.Rectangle {
        if (!this.safeAdd) {
            this.safeAdd = new SafeGameObjectFactory(this);
        }
        return this.safeAdd.rectangle(x, y, width, height, fillColor, fillAlpha);
    }
    
    /**
     * Wyświetla komunikat dla użytkownika
     */
    showMessage(message: string, config?: MessageConfig): Phaser.GameObjects.Container {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Konfiguracja z wartościami domyślnymi
        const cfg: Required<MessageConfig> = {
            x: config?.x ?? width / 2,
            y: config?.y ?? height / 2,
            duration: config?.duration ?? 3000,
            backgroundColor: config?.backgroundColor ?? 0x000000,
            textColor: config?.textColor ?? '#ffffff',
            fontSize: config?.fontSize ?? '18px',
            alpha: config?.alpha ?? 0.7,
            padding: config?.padding ?? 10
        };
        
        // Tworzymy kontener
        const container = this.add.container(cfg.x, cfg.y);
        
        // Tło komunikatu
        const background = this.add.rectangle(0, 0, 0, 0, cfg.backgroundColor, cfg.alpha);
        container.add(background);
        
        // Tekst komunikatu
        const text = this.add.text(0, 0, message, {
            fontSize: cfg.fontSize,
            color: cfg.textColor,
            align: 'center'
        }).setOrigin(0.5);
        container.add(text);
        
        // Dopasowujemy tło do tekstu
        background.width = text.width + cfg.padding * 2;
        background.height = text.height + cfg.padding * 2;
        
        // Animujemy pojawienie się
        this.tweens.add({
            targets: container,
            alpha: { from: 0, to: 1 },
            y: { from: cfg.y - 20, to: cfg.y },
            duration: 200,
            ease: 'Sine.easeOut'
        });
        
        // Automatyczne ukrycie po określonym czasie
        this.time.delayedCall(cfg.duration, () => {
            this.tweens.add({
                targets: container,
                alpha: 0,
                y: cfg.y - 20,
                duration: 200,
                ease: 'Sine.easeIn',
                onComplete: () => {
                    container.destroy();
                }
            });
        });
        
        return container;
    }
    
    /**
     * Bezpieczne uwolnienie zasobów przy zniszczeniu sceny
     */
    shutdown(): void {
        // Jeśli mamy kontekst, informujemy ResourceManager o wyłączeniu sceny
        if (this.context) {
            try {
                const resourceManager = this.context.getService('resources');
                if (resourceManager) {
                    const sceneKey = this.sys.settings.key;
                    resourceManager.unloadSceneAssets(sceneKey);
                }
            } catch (e) {
                console.warn("Nie można zwolnić zasobów sceny:", e);
            }
        }
        
        // Wywołujemy oryginalną metodę shutdown
        super.shutdown();
    }
}

// enhanced/SafeGameObjectFactory.ts
/**
 * Bezpieczna fabryka obiektów gry
 * Zastępuje monkey-patching Phaser.Scene.prototype dodatkiem bezpiecznych metod
 */
export class SafeGameObjectFactory {
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
            console.error(`Błąd podczas tworzenia koła: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
            
            // Zwracamy obiekt zastępczy z wymaganymi metodami
            const dummyObject = {
                x: x,
                y: y,
                fillColor: fillColor,
                radius: radius,
                alpha: fillAlpha || 1,
                scene: this.scene,
                type: 'Arc',
                active: true,
                visible: true,
                
                // Podstawowe metody
                setActive: function(value: boolean) { this.active = value; return this; },
                setVisible: function(value: boolean) { this.visible = value; return this; },
                setAlpha: function(value: number) { this.alpha = value; return this; },
                setDepth: function(value: number) { this.depth = value; return this; },
                setOrigin: function(x: number, y?: number) { return this; },
                setScale: function(x: number, y?: number) { return this; },
                setPosition: function(x: number, y?: number) { this.x = x; this.y = y; return this; },
                destroy: function() { this.active = false; this.visible = false; },
                destroyed: false
            } as unknown as Phaser.GameObjects.Arc;
            
            return dummyObject;
        }
    }
    
    /**
     * Bezpieczne tworzenie tekstu
     */
    text(x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
        try {
            return this.scene.add.text(x, y, text, style);
        } catch (error) {
            console.error(`Błąd podczas tworzenia tekstu: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
            
            // Zwracamy obiekt zastępczy
            const dummyObject = {
                x: x,
                y: y,
                text: typeof text === 'string' ? text : text.join('\n'),
                style: style || {},
                scene: this.scene,
                type: 'Text',
                active: true,
                visible: true,
                alpha: 1,
                
                // Podstawowe metody
                setActive: function(value: boolean) { this.active = value; return this; },
                setVisible: function(value: boolean) { this.visible = value; return this; },
                setAlpha: function(value: number) { this.alpha = value; return this; },
                setDepth: function(value: number) { this.depth = value; return this; },
                setOrigin: function(x: number, y?: number) { return this; },
                setScale: function(x: number, y?: number) { return this; },
                setPosition: function(x: number, y?: number) { this.x = x; this.y = y; return this; },
                setText: function(value: string | string[]) { 
                    this.text = typeof value === 'string' ? value : value.join('\n'); 
                    return this;
                },
                setStyle: function(style: Phaser.Types.GameObjects.Text.TextStyle) { 
                    this.style = {...this.style, ...style};
                    return this;
                },
                destroy: function() { this.active = false; this.visible = false; },
                destroyed: false,
                width: 100,
                height: 20
            } as unknown as Phaser.GameObjects.Text;
            
            return dummyObject;
        }
    }
    
    /**
     * Bezpieczne tworzenie prostokąta
     */
    rectangle(x: number, y: number, width: number, height: number, fillColor?: number, fillAlpha?: number): Phaser.GameObjects.Rectangle {
        try {
            return this.scene.add.rectangle(x, y, width, height, fillColor, fillAlpha);
        } catch (error) {
            console.error(`Błąd podczas tworzenia prostokąta: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
            
            // Zwracamy obiekt zastępczy
            const dummyObject = {
                x: x,
                y: y,
                width: width,
                height: height,
                fillColor: fillColor,
                alpha: fillAlpha || 1,
                scene: this.scene,
                type: 'Rectangle',
                active: true,
                visible: true,
                
                // Podstawowe metody
                setActive: function(value: boolean) { this.active = value; return this; },
                setVisible: function(value: boolean) { this.visible = value; return this; },
                setAlpha: function(value: number) { this.alpha = value; return this; },
                setDepth: function(value: number) { this.depth = value; return this; },
                setOrigin: function(x: number, y?: number) { return this; },
                setScale: function(x: number, y?: number) { return this; },
                setPosition: function(x: number, y?: number) { this.x = x; this.y = y; return this; },
                setInteractive: function() { return this; },
                on: function(event: string, callback: Function) { return this; },
                destroy: function() { this.active = false; this.visible = false; },
                destroyed: false
            } as unknown as Phaser.GameObjects.Rectangle;
            
            return dummyObject;
        }
    }
    
    /**
     * Bezpieczne tworzenie kontenera
     */
    container(x: number, y: number, children?: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Container {
        try {
            return this.scene.add.container(x, y, children);
        } catch (error) {
            console.error(`Błąd podczas tworzenia kontenera: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
            
            // Zwracamy obiekt zastępczy
            const dummyObject = {
                x: x,
                y: y,
                list: children || [],
                scene: this.scene,
                type: 'Container',
                active: true,
                visible: true,
                alpha: 1,
                
                // Podstawowe metody
                setActive: function(value: boolean) { this.active = value; return this; },
                setVisible: function(value: boolean) { this.visible = value; return this; },
                setAlpha: function(value: number) { this.alpha = value; return this; },
                setDepth: function(value: number) { this.depth = value; return this; },
                setScale: function(x: number, y?: number) { return this; },
                setPosition: function(x: number, y?: number) { this.x = x; this.y = y; return this; },
                add: function(child: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]) { 
                    if (Array.isArray(child)) {
                        this.list = [...this.list, ...child];
                    } else {
                        this.list.push(child);
                    }
                    return this;
                },
                remove: function(child: Phaser.GameObjects.GameObject) {
                    const index = this.list.indexOf(child);
                    if (index !== -1) {
                        this.list.splice(index, 1);
                    }
                    return this;
                },
                removeAll: function() {
                    this.list = [];
                    return this;
                },
                destroy: function() { 
                    this.active = false; 
                    this.visible = false; 
                    this.list.forEach(child => {
                        if (child.destroy) child.destroy();
                    });
                },
                destroyed: false
            } as unknown as Phaser.GameObjects.Container;
            
            return dummyObject;
        }
    }
    
    // Można dodać więcej bezpiecznych metod tworzenia obiektów według potrzeb
}

// Typy
interface MessageConfig {
    x?: number;
    y?: number;
    duration?: number;
    backgroundColor?: number;
    textColor?: string;
    fontSize?: string;
    alpha?: number;
    padding?: number;
}

// config/gameConfig.ts
/**
 * Stałe konfiguracyjne
 */
export const CONFIG = {
    DEBUG: false,                 // Tryb debugowania
    WIDTH: 800,                   // Szerokość gry
    HEIGHT: 600,                  // Wysokość gry
    GROUND_LEVEL: 500,            // Poziom ziemi
    HERO_START_X: 200,            // Pozycja startowa bohatera
    ENEMY_SPAWN_X: 850,           // Pozycja spawnowania wrogów
    
    // Parametry wydajności
    FPS_TARGET_HIGH: 60,          // Docelowe FPS dla wysokiej wydajności
    FPS_TARGET_LOW: 30,           // Docelowe FPS dla niskiej wydajności
    
    // Limity zasobów
    MAX_ENEMIES: 30,              // Maksymalna liczba wrogów na ekranie
    PARTICLE_LIMIT: 100,          // Limit cząsteczek
    
    // Katalogi zasobów
    ASSETS_PATH: 'assets/',       // Ścieżka do katalogu zasobów
    
    // Inne ustawienia
    AUTO_SAVE: true,              // Automatyczne zapisywanie stanu gry
    MUSIC_VOLUME: 0.5,            // Głośność muzyki
    SFX_VOLUME: 0.7               // Głośność efektów dźwiękowych
};