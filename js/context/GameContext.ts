// context/GameContext.ts
/**
 * GameContext - centralny kontener zależności i usług gry
 * Zastępuje globalne zmienne window.game, window.gameData, itd.
 */
export class GameContext {
    private static instance: GameContext;
    private services: Map<string, any>;
    
    constructor() {
        if (GameContext.instance) {
            return GameContext.instance;
        }
        
        this.services = new Map();
        GameContext.instance = this;
    }
    
    /**
     * Rejestruje usługę w kontekście
     */
    registerService<T>(name: string, instance: T): void {
        this.services.set(name, instance);
    }
    
    /**
     * Pobiera usługę z kontekstu
     */
    getService<T>(name: string): T {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service '${name}' not registered in GameContext`);
        }
        return service as T;
    }
    
    /**
     * Statyczna metoda dostępu do usługi (bezpieczniejsza niż globalne zmienne)
     */
    static getService<T>(name: string): T {
        if (!GameContext.instance) {
            throw new Error('GameContext not initialized');
        }
        return GameContext.instance.getService(name);
    }
}

// managers/GameStateManager.ts
/**
 * Menedżer stanu gry - zastępuje window.gameData
 */
export class GameStateManager {
    private state: GameData;
    private listeners: Array<(oldState: GameData, newState: GameData) => void>;
    
    constructor() {
        this.state = this.getInitialState();
        this.listeners = [];
    }
    
    /**
     * Zwraca początkowy stan gry
     */
    private getInitialState(): GameData {
        return {
            autoMode: false,
            enemiesKilled: 0,
            debugMode: false,
            performanceMode: false, 
            score: 0,
            wave: 1,
            heroLevel: 1,
            gold: 0
        };
    }
    
    /**
     * Pobiera aktualny stan gry
     */
    getState(): GameData {
        // Tworzymy kopię, aby uniknąć bezpośredniej modyfikacji
        return { ...this.state };
    }
    
    /**
     * Aktualizuje stan gry i powiadamia obserwatorów
     */
    setState(updates: Partial<GameData>): void {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };
        
        // Powiadamiamy słuchaczy tylko jeśli coś się zmieniło
        if (JSON.stringify(oldState) !== JSON.stringify(this.state)) {
            this.notifyListeners(oldState, this.state);
        }
    }
    
    /**
     * Rejestruje funkcję nasłuchującą na zmiany stanu
     * @returns Funkcja do wyrejestrowania nasłuchiwania
     */
    subscribe(listener: (oldState: GameData, newState: GameData) => void): () => void {
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

// Typy danych stanu gry
export interface GameData {
    autoMode: boolean;
    enemiesKilled: number;
    debugMode: boolean;
    performanceMode: boolean;
    score: number;
    wave: number;
    heroLevel: number;
    gold: number;
    [key: string]: any; // Dodatkowe pola, które mogą być potrzebne
}