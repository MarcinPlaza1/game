// managers/InputManager.ts
import { CONFIG } from '../config/gameConfig';
import { GameContext } from '../context/GameContext';

/**
 * Menadżer obsługi wejścia - usprawnia i centralizuje zarządzanie wejściem
 * Rozwiązuje problemy z nasłuchiwaniem klawiszy i zapewnia spójne API
 */
export class InputManager {
    private game: Phaser.Game;
    private context: GameContext;
    private keys: Map<string, Phaser.Input.Keyboard.Key>;
    private previousKeyStates: Map<string, boolean>;
    private keyListeners: Map<string, Array<(event: KeyboardEvent) => void>>;
    private pointerListeners: Map<string, Array<(x: number, y: number, pointer: Phaser.Input.Pointer) => void>>;
    private gamepadEnabled: boolean;
    private gamepads: Gamepad[];
    private activeScene: Phaser.Scene | null;
    
    // Kontrolki klawiatury i gamepad
    private movementKeys: {
        up: Phaser.Input.Keyboard.Key | null,
        down: Phaser.Input.Keyboard.Key | null,
        left: Phaser.Input.Keyboard.Key | null,
        right: Phaser.Input.Keyboard.Key | null
    };
    
    private actionKeys: {
        jump: Phaser.Input.Keyboard.Key | null,
        attack: Phaser.Input.Keyboard.Key | null,
        dodge: Phaser.Input.Keyboard.Key | null,
        weaponChange: Phaser.Input.Keyboard.Key | null
    };
    
    private systemKeys: {
        autoMode: Phaser.Input.Keyboard.Key | null,
        performanceMode: Phaser.Input.Keyboard.Key | null,
        debug: Phaser.Input.Keyboard.Key | null,
        pause: Phaser.Input.Keyboard.Key | null
    };
    
    constructor(game: Phaser.Game, context: GameContext) {
        this.game = game;
        this.context = context;
        this.keys = new Map();
        this.previousKeyStates = new Map();
        this.keyListeners = new Map();
        this.pointerListeners = new Map();
        this.gamepadEnabled = false;
        this.gamepads = [];
        this.activeScene = null;
        
        // Inicjalizujemy klawisze jako null (zostaną ustawione w setupKeys)
        this.movementKeys = { up: null, down: null, left: null, right: null };
        this.actionKeys = { jump: null, attack: null, dodge: null, weaponChange: null };
        this.systemKeys = { autoMode: null, performanceMode: null, debug: null, pause: null };
        
        // Konfiguracja obsługi wejścia
        this.setupGamepadSupport();
        
        // Nasłuchiwanie na zmianę aktywnej sceny
        this.game.scene.on('start', (key: string) => {
            this.activeScene = this.game.scene.getScene(key);
            this.setupKeys();
        });
    }
    
    /**
     * Konfiguruje obsługę gamepada
     */
    private setupGamepadSupport(): void {
        // Sprawdzamy czy API Gamepad jest dostępne
        if (navigator.getGamepads) {
            this.gamepadEnabled = true;
            
            // Nasłuchiwanie na podłączenie gamepada
            window.addEventListener('gamepadconnected', (e) => {
                const logger = this.context.getService('log');
                logger.info(`Gamepad podłączony: ${e.gamepad.id}`, "INPUT");
                
                // Aktualizujemy listę gamepadów
                this.updateGamepads();
            });
            
            // Nasłuchiwanie na odłączenie gamepada
            window.addEventListener('gamepaddisconnected', (e) => {
                const logger = this.context.getService('log');
                logger.info(`Gamepad odłączony: ${e.gamepad.id}`, "INPUT");
                
                // Aktualizujemy listę gamepadów
                this.updateGamepads();
            });
        }
    }
    
    /**
     * Inicjalizuje lub aktualizuje klawisze
     */
    setupKeys(): void {
        if (!this.activeScene) return;
        
        const keyboard = this.activeScene.input.keyboard;
        if (!keyboard) return;
        
        // Zwalniamy istniejące klawisze
        this.releaseKeys();
        
        // Ustawiamy klawisze ruchu
        this.movementKeys.up = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[CONFIG.KEYS.MOVEMENT.UP]);
        this.movementKeys.down = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[CONFIG.KEYS.MOVEMENT.DOWN]);
        this.movementKeys.left = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[CONFIG.KEYS.MOVEMENT.LEFT]);
        this.movementKeys.right = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[CONFIG.KEYS.MOVEMENT.RIGHT]);
        
        // Ustawiamy klawisze akcji
        this.actionKeys.jump = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[CONFIG.KEYS.ACTIONS.JUMP]);
        this.actionKeys.attack = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[CONFIG.KEYS.ACTIONS.ATTACK]);
        this.actionKeys.dodge = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[CONFIG.KEYS.ACTIONS.DODGE]);
        this.actionKeys.weaponChange = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[CONFIG.KEYS.ACTIONS.WEAPON_CHANGE]);
        
        // Ustawiamy klawisze systemowe
        this.systemKeys.autoMode = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[CONFIG.KEYS.SYSTEM.AUTO_MODE]);
        this.systemKeys.performanceMode = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[CONFIG.KEYS.SYSTEM.PERFORMANCE_MODE]);
        this.systemKeys.debug = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[CONFIG.KEYS.SYSTEM.DEBUG]);
        this.systemKeys.pause = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[CONFIG.KEYS.SYSTEM.PAUSE]);
        
        // Kopiujemy wszystkie klawisze do mapy keys
        Object.entries(this.movementKeys).forEach(([key, value]) => {
            if (value) this.keys.set(`MOVEMENT_${key.toUpperCase()}`, value);
        });
        
        Object.entries(this.actionKeys).forEach(([key, value]) => {
            if (value) this.keys.set(`ACTION_${key.toUpperCase()}`, value);
        });
        
        Object.entries(this.systemKeys).forEach(([key, value]) => {
            if (value) this.keys.set(`SYSTEM_${key.toUpperCase()}`, value);
        });
        
        // Inicjalizujemy stan poprzedni dla wszystkich klawiszy
        this.keys.forEach((key, keyName) => {
            this.previousKeyStates.set(keyName, false);
        });
        
        const logger = this.context.getService('log');
        logger.debug("Konfiguracja klawiszy zakończona", "INPUT");
    }
    
    /**
     * Zwalnia zasoby klawiszy
     */
    private releaseKeys(): void {
        // Zwolnienie wszystkich klawiszy
        this.keys.clear();
        this.previousKeyStates.clear();
        
        // Resetowanie referencji do klawiszy
        this.movementKeys = { up: null, down: null, left: null, right: null };
        this.actionKeys = { jump: null, attack: null, dodge: null, weaponChange: null };
        this.systemKeys = { autoMode: null, performanceMode: null, debug: null, pause: null };
    }
    
    /**
     * Aktualizuje stan wejścia - należy wywoływać w metodzie update sceny
     */
    update(): void {
        // Obsługa klawiszy - wykrywanie JustDown/JustUp bez problematycznych metod Phaser
        this.keys.forEach((key, keyName) => {
            const wasDown = this.previousKeyStates.get(keyName);
            const isDown = key.isDown;
            
            // JustDown - klawisz został naciśnięty w tej klatce
            if (isDown && !wasDown) {
                this.fireKeyEvent(keyName, 'justdown');
            }
            
            // JustUp - klawisz został zwolniony w tej klatce
            if (!isDown && wasDown) {
                this.fireKeyEvent(keyName, 'justup');
            }
            
            // Aktualizujemy stan poprzedni
            this.previousKeyStates.set(keyName, isDown);
        });
        
        // Obsługa gamepadów
        if (this.gamepadEnabled) {
            this.updateGamepads();
            this.processGamepadInput();
        }
    }
    
    /**
     * Aktualizuje listę podłączonych gamepadów
     */
    private updateGamepads(): void {
        // getGamepads() może zwrócić null dla nieużywanych slotów
        const gamepads = navigator.getGamepads();
        this.gamepads = Array.from(gamepads).filter(gamepad => gamepad !== null) as Gamepad[];
    }
    
    /**
     * Przetwarza wejście z gamepada
     */
    private processGamepadInput(): void {
        if (this.gamepads.length === 0) return;
        
        // Używamy tylko pierwszego gamepada
        const gamepad = this.gamepads[0];
        if (!gamepad) return;
        
        // Analog lewy - ruch
        const leftX = gamepad.axes[0]; // -1 (lewo) do 1 (prawo)
        const leftY = gamepad.axes[1]; // -1 (góra) do 1 (dół)
        
        // Emulujemy klawisze ruchu na podstawie gałki analogowej
        const threshold = 0.2;
        
        // Symulujemy naciśnięcie klawiszy kierunkowych
        if (Math.abs(leftX) > threshold) {
            if (leftX < -threshold) {
                // Lewo
                if (!this.previousKeyStates.get('GAMEPAD_LEFT')) {
                    this.fireKeyEvent('GAMEPAD_LEFT', 'justdown');
                    this.previousKeyStates.set('GAMEPAD_LEFT', true);
                }
            } else {
                // Prawo
                if (this.previousKeyStates.get('GAMEPAD_LEFT')) {
                    this.fireKeyEvent('GAMEPAD_LEFT', 'justup');
                    this.previousKeyStates.set('GAMEPAD_LEFT', false);
                }
            }
            
            if (leftX > threshold) {
                // Prawo
                if (!this.previousKeyStates.get('GAMEPAD_RIGHT')) {
                    this.fireKeyEvent('GAMEPAD_RIGHT', 'justdown');
                    this.previousKeyStates.set('GAMEPAD_RIGHT', true);
                }
            } else {
                // Nie-prawo
                if (this.previousKeyStates.get('GAMEPAD_RIGHT')) {
                    this.fireKeyEvent('GAMEPAD_RIGHT', 'justup');
                    this.previousKeyStates.set('GAMEPAD_RIGHT', false);
                }
            }
        } else {
            // Zerowa pozycja X
            if (this.previousKeyStates.get('GAMEPAD_LEFT')) {
                this.fireKeyEvent('GAMEPAD_LEFT', 'justup');
                this.previousKeyStates.set('GAMEPAD_LEFT', false);
            }
            if (this.previousKeyStates.get('GAMEPAD_RIGHT')) {
                this.fireKeyEvent('GAMEPAD_RIGHT', 'justup');
                this.previousKeyStates.set('GAMEPAD_RIGHT', false);
            }
        }
        
        // Podobnie dla góra/dół
        if (Math.abs(leftY) > threshold) {
            if (leftY < -threshold) {
                // Góra
                if (!this.previousKeyStates.get('GAMEPAD_UP')) {
                    this.fireKeyEvent('GAMEPAD_UP', 'justdown');
                    this.previousKeyStates.set('GAMEPAD_UP', true);
                }
            } else {
                if (this.previousKeyStates.get('GAMEPAD_UP')) {
                    this.fireKeyEvent('GAMEPAD_UP', 'justup');
                    this.previousKeyStates.set('GAMEPAD_UP', false);
                }
            }
            
            if (leftY > threshold) {
                // Dół
                if (!this.previousKeyStates.get('GAMEPAD_DOWN')) {
                    this.fireKeyEvent('GAMEPAD_DOWN', 'justdown');
                    this.previousKeyStates.set('GAMEPAD_DOWN', true);
                }
            } else {
                if (this.previousKeyStates.get('GAMEPAD_DOWN')) {
                    this.fireKeyEvent('GAMEPAD_DOWN', 'justup');
                    this.previousKeyStates.set('GAMEPAD_DOWN', false);
                }
            }
        } else {
            // Zerowa pozycja Y
            if (this.previousKeyStates.get('GAMEPAD_UP')) {
                this.fireKeyEvent('GAMEPAD_UP', 'justup');
                this.previousKeyStates.set('GAMEPAD_UP', false);
            }
            if (this.previousKeyStates.get('GAMEPAD_DOWN')) {
                this.fireKeyEvent('GAMEPAD_DOWN', 'justup');
                this.previousKeyStates.set('GAMEPAD_DOWN', false);
            }
        }
        
        // Przyciski gamepada (A, B, X, Y, L, R, etc.)
        // Przypisanie: A=Jump, B=Dodge, X=Attack, Y=Weapon Change
        this.processGamepadButton(gamepad, 0, 'GAMEPAD_A', 'ACTION_JUMP');
        this.processGamepadButton(gamepad, 1, 'GAMEPAD_B', 'ACTION_DODGE');
        this.processGamepadButton(gamepad, 2, 'GAMEPAD_X', 'ACTION_ATTACK');
        this.processGamepadButton(gamepad, 3, 'GAMEPAD_Y', 'ACTION_WEAPON_CHANGE');
        this.processGamepadButton(gamepad, 9, 'GAMEPAD_START', 'SYSTEM_PAUSE');
    }
    
    /**
     * Przetwarza pojedynczy przycisk gamepada
     */
    private processGamepadButton(gamepad: Gamepad, buttonIndex: number, gamepadKey: string, equivalentKey: string): void {
        if (buttonIndex >= gamepad.buttons.length) return;
        
        const button = gamepad.buttons[buttonIndex];
        const wasPressed = this.previousKeyStates.get(gamepadKey) || false;
        const isPressed = button.pressed;
        
        // JustDown - przycisk został naciśnięty w tej klatce
        if (isPressed && !wasPressed) {
            this.fireKeyEvent(gamepadKey, 'justdown');
            this.fireKeyEvent(equivalentKey, 'justdown'); // Symulujemy również klawisz
        }
        
        // JustUp - przycisk został zwolniony w tej klatce
        if (!isPressed && wasPressed) {
            this.fireKeyEvent(gamepadKey, 'justup');
            this.fireKeyEvent(equivalentKey, 'justup'); // Symulujemy również klawisz
        }
        
        // Aktualizujemy stan poprzedni
        this.previousKeyStates.set(gamepadKey, isPressed);
    }
    
    /**
     * Rejestruje nasłuchiwanie na zdarzenie klawisza
     */
    onKey(keyName: string, eventType: KeyEventType, callback: (event: KeyboardEvent) => void): () => void {
        const eventKey = `${keyName}_${eventType}`;
        
        if (!this.keyListeners.has(eventKey)) {
            this.keyListeners.set(eventKey, []);
        }
        
        const listeners = this.keyListeners.get(eventKey)!;
        listeners.push(callback);
        
        // Zwraca funkcję do anulowania nasłuchiwania
        return () => {
            const listeners = this.keyListeners.get(eventKey);
            if (listeners) {
                const index = listeners.indexOf(callback);
                if (index !== -1) {
                    listeners.splice(index, 1);
                }
            }
        };
    }
    
    /**
     * Rejestruje nasłuchiwanie na zdarzenie wskaźnika (myszka, dotyk)
     */
    onPointer(eventType: PointerEventType, callback: (x: number, y: number, pointer: Phaser.Input.Pointer) => void): () => void {
        if (!this.pointerListeners.has(eventType)) {
            this.pointerListeners.set(eventType, []);
            
            // Dodajemy nasłuchiwanie do aktywnej sceny
            if (this.activeScene) {
                switch (eventType) {
                    case 'down':
                        this.activeScene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                            this.firePointerEvent('down', pointer.x, pointer.y, pointer);
                        });
                        break;
                        
                    case 'up':
                        this.activeScene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
                            this.firePointerEvent('up', pointer.x, pointer.y, pointer);
                        });
                        break;
                        
                    case 'move':
                        this.activeScene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
                            this.firePointerEvent('move', pointer.x, pointer.y, pointer);
                        });
                        break;
                }
            }
        }
        
        const listeners = this.pointerListeners.get(eventType)!;
        listeners.push(callback);
        
        // Zwraca funkcję do anulowania nasłuchiwania
        return () => {
            const listeners = this.pointerListeners.get(eventType);
            if (listeners) {
                const index = listeners.indexOf(callback);
                if (index !== -1) {
                    listeners.splice(index, 1);
                }
            }
        };
    }
    
    /**
     * Wywołuje zdarzenie klawisza
     */
    private fireKeyEvent(keyName: string, eventType: KeyEventType): void {
        const eventKey = `${keyName}_${eventType}`;
        const listeners = this.keyListeners.get(eventKey);
        
        if (listeners && listeners.length > 0) {
            // Tworzymy sztuczne zdarzenie dla wywołania nasłuchiwań
            const event = {
                key: keyName,
                type: eventType,
                preventDefault: () => {},
                stopPropagation: () => {}
            } as KeyboardEvent;
            
            listeners.forEach(listener => {
                try {
                    listener(event);
                } catch (error) {
                    const logger = this.context.getService('log');
                    logger.error(`Błąd w obsłudze zdarzenia klawisza ${keyName}: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "INPUT");
                }
            });
        }
    }
    
    /**
     * Wywołuje zdarzenie wskaźnika
     */
    private firePointerEvent(eventType: PointerEventType, x: number, y: number, pointer: Phaser.Input.Pointer): void {
        const listeners = this.pointerListeners.get(eventType);
        
        if (listeners && listeners.length > 0) {
            listeners.forEach(listener => {
                try {
                    listener(x, y, pointer);
                } catch (error) {
                    const logger = this.context.getService('log');
                    logger.error(`Błąd w obsłudze zdarzenia wskaźnika ${eventType}: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "INPUT");
                }
            });
        }
    }
    
    /**
     * Sprawdza czy klawisz jest wciśnięty
     */
    isKeyDown(keyName: string): boolean {
        // Mapa potencjalnych aliasów dla klawiszy (np. UP może oznaczać MOVEMENT_UP lub GAMEPAD_UP)
        const aliases = new Map<string, string[]>([
            ['UP', ['MOVEMENT_UP', 'GAMEPAD_UP']],
            ['DOWN', ['MOVEMENT_DOWN', 'GAMEPAD_DOWN']],
            ['LEFT', ['MOVEMENT_LEFT', 'GAMEPAD_LEFT']],
            ['RIGHT', ['MOVEMENT_RIGHT', 'GAMEPAD_RIGHT']],
            ['JUMP', ['ACTION_JUMP', 'GAMEPAD_A']],
            ['ATTACK', ['ACTION_ATTACK', 'GAMEPAD_X']],
            ['DODGE', ['ACTION_DODGE', 'GAMEPAD_B']],
            ['WEAPON_CHANGE', ['ACTION_WEAPON_CHANGE', 'GAMEPAD_Y']]
        ]);
        
        // Najpierw sprawdzamy bezpośrednio klawisz
        const key = this.keys.get(keyName);
        if (key && key.isDown) {
            return true;
        }
        
        // Jeśli nie znaleziono klawisza bezpośrednio, sprawdzamy aliasy
        const aliasKeys = aliases.get(keyName);
        if (aliasKeys) {
            for (const aliasKey of aliasKeys) {
                const key = this.keys.get(aliasKey);
                if (key && key.isDown) {
                    return true;
                }
                
                // Sprawdzamy również stan gamepada
                if (this.previousKeyStates.get(aliasKey)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Sprawdza czy klawisz został właśnie wciśnięty
     */
    isKeyJustDown(keyName: string): boolean {
        // Mapa potencjalnych aliasów dla klawiszy
        const aliases = new Map<string, string[]>([
            ['UP', ['MOVEMENT_UP', 'GAMEPAD_UP']],
            ['DOWN', ['MOVEMENT_DOWN', 'GAMEPAD_DOWN']],
            ['LEFT', ['MOVEMENT_LEFT', 'GAMEPAD_LEFT']],
            ['RIGHT', ['MOVEMENT_RIGHT', 'GAMEPAD_RIGHT']],
            ['JUMP', ['ACTION_JUMP', 'GAMEPAD_A']],
            ['ATTACK', ['ACTION_ATTACK', 'GAMEPAD_X']],
            ['DODGE', ['ACTION_DODGE', 'GAMEPAD_B']],
            ['WEAPON_CHANGE', ['ACTION_WEAPON_CHANGE', 'GAMEPAD_Y']]
        ]);
        
        // Sprawdzamy bezpośrednio klawisz
        const key = this.keys.get(keyName);
        if (key && key.isDown && !this.previousKeyStates.get(keyName)) {
            return true;
        }
        
        // Sprawdzamy aliasy
        const aliasKeys = aliases.get(keyName);
        if (aliasKeys) {
            for (const aliasKey of aliasKeys) {
                const key = this.keys.get(aliasKey);
                // Sprawdzamy naszą implementację JustDown
                if (key && key.isDown && !this.previousKeyStates.get(aliasKey)) {
                    return true;
                }
                
                // Sprawdzamy również wirtualne klawisze gamepad
                if (aliasKey.startsWith('GAMEPAD_') && !this.previousKeyStates.get(aliasKey) && this.isKeyDown(aliasKey)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Pobiera wektor kierunkowy na podstawie klawiszy ruchu
     */
    getMovementVector(): { x: number, y: number } {
        let x = 0;
        let y = 0;
        
        if (this.isKeyDown('LEFT')) x -= 1;
        if (this.isKeyDown('RIGHT')) x += 1;
        if (this.isKeyDown('UP')) y -= 1;
        if (this.isKeyDown('DOWN')) y += 1;
        
        // Normalizujemy wektor dla ruchu po przekątnej
        if (x !== 0 && y !== 0) {
            const length = Math.sqrt(x * x + y * y);
            x /= length;
            y /= length;
        }
        
        return { x, y };
    }
    
    /**
     * Pobiera pozycję wskaźnika
     */
    getPointerPosition(): { x: number, y: number } {
        if (!this.activeScene || !this.activeScene.input) {
            return { x: 0, y: 0 };
        }
        
        const pointer = this.activeScene.input.activePointer;
        return { x: pointer.x, y: pointer.y };
    }
    
    /**
     * Sprawdza czy wskaźnik jest wciśnięty
     */
    isPointerDown(): boolean {
        if (!this.activeScene || !this.activeScene.input) {
            return false;
        }
        
        return this.activeScene.input.activePointer.isDown;
    }
    
    /**
     * Wyświetla informacje o sterowaniu
     */
    showControlsInfo(scene: Phaser.Scene): void {
        const controls = [
            `${CONFIG.KEYS.MOVEMENT.UP}/${CONFIG.KEYS.MOVEMENT.DOWN}/${CONFIG.KEYS.MOVEMENT.LEFT}/${CONFIG.KEYS.MOVEMENT.RIGHT} - ruch`,
            `${CONFIG.KEYS.ACTIONS.JUMP} - skok`,
            `${CONFIG.KEYS.ACTIONS.ATTACK} - atak`,
            `${CONFIG.KEYS.ACTIONS.DODGE} - unik`,
            `${CONFIG.KEYS.ACTIONS.WEAPON_CHANGE} - zmiana broni`,
            `${CONFIG.KEYS.SYSTEM.AUTO_MODE} - tryb auto`,
            `${CONFIG.KEYS.SYSTEM.PERFORMANCE_MODE} - tryb wydajności`,
            `${CONFIG.KEYS.SYSTEM.DEBUG} - debugowanie`
        ];
        
        // Wyświetlamy informacje o sterowaniu klawiaturą
        const container = scene.add.container(scene.cameras.main.width / 2, 200);
        
        // Tło
        const bg = scene.add.rectangle(0, 0, 400, 50 + controls.length * 20, 
            0x000000, 0.7);
        container.add(bg);
        
        // Nagłówek
        const title = scene.add.text(0, -bg.height / 2 + 15, 'STEROWANIE', {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        container.add(title);
        
        // Lista klawiszy
        controls.forEach((control, index) => {
            const y = -bg.height / 2 + 40 + index * 20;
            const text = scene.add.text(0, y, control, {
                fontSize: '14px',
                color: '#ffffff'
            }).setOrigin(0.5);
            container.add(text);
        });
        
        // Dostosowujemy wysokość tła
        bg.height = 50 + controls.length * 20;
        
        // Animujemy pojawienie się i zniknięcie
        scene.tweens.add({
            targets: container,
            alpha: { from: 0, to: 1 },
            duration: 500
        });
        
        scene.time.delayedCall(5000, () => {
            scene.tweens.add({
                targets: container,
                alpha: 0,
                y: 180,
                duration: 500,
                onComplete: () => container.destroy()
            });
        });
    }
}

// Typy zdarzeń klawiszy
type KeyEventType = 'justdown' | 'justup';

// Typy zdarzeń wskaźnika
type PointerEventType = 'down' | 'up' | 'move';