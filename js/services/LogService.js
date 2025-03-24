/**
 * Serwis zarządzający logowaniem w grze
 * Pozwala na centralne sterowanie logami, ich filtrowaniem i ograniczaniem
 */
export default class LogService {
    constructor() {
        // Poziomy logowania
        this.LEVELS = {
            DEBUG: 0,
            INFO: 1,
            WARNING: 2,
            ERROR: 3,
            NONE: 4 // Wyłączenie logów
        };
        
        // Domyślny poziom logowania (można zmienić w trakcie gry)
        this.currentLevel = this.LEVELS.INFO;
        
        // Włączenie/wyłączenie kategorii logów
        this.enabledCategories = {
            ENEMY_POSITION: false,    // Pozycje wrogów (domyślnie wyłączone)
            ENEMY_DAMAGE: true,       // Obrażenia wrogów
            ENEMY_SPAWN: true,        // Spawnowanie wrogów
            PLAYER_ATTACK: true,      // Ataki gracza
            PLAYER_DAMAGE: true,      // Obrażenia gracza
            GAME_STATE: true,         // Stan gry (fale, punkty)
            DEBUG: false              // Informacje debugowania
        };
        
        // Limity częstotliwości logowania dla kategorii (w ms)
        this.throttleTime = {
            ENEMY_POSITION: 5000,     // Loguj pozycje wrogów co 5 sekund
            ENEMY_SPAWN: 0,           // Bez ograniczeń
            ENEMY_DAMAGE: 0,          // Bez ograniczeń
            PLAYER_ATTACK: 0,         // Bez ograniczeń
            PLAYER_DAMAGE: 0,         // Bez ograniczeń
            GAME_STATE: 0,            // Bez ograniczeń
            DEBUG: 1000               // Ogranicz debugowanie do jednego logu na sekundę
        };
        
        // Czasy ostatniego logowania dla limitowanych kategorii
        this.lastLogTime = {
            ENEMY_POSITION: 0,
            ENEMY_SPAWN: 0,
            ENEMY_DAMAGE: 0,
            PLAYER_ATTACK: 0,
            PLAYER_DAMAGE: 0,
            GAME_STATE: 0,
            DEBUG: 0
        };
        
        console.log("LogService: Serwis logowania zainicjalizowany");
    }
    
    /**
     * Zapisuje log na poziomie DEBUG
     * @param {string} message - treść wiadomości
     * @param {string} category - kategoria logowania
     * @param {any} data - opcjonalne dane do zalogowania
     */
    debug(message, category = "DEBUG", data = null) {
        if (this.currentLevel <= this.LEVELS.DEBUG && this.shouldLog(category)) {
            this._log(message, category, data, "debug");
        }
    }
    
    /**
     * Zapisuje log na poziomie INFO
     * @param {string} message - treść wiadomości
     * @param {string} category - kategoria logowania
     * @param {any} data - opcjonalne dane do zalogowania
     */
    info(message, category = "GAME_STATE", data = null) {
        if (this.currentLevel <= this.LEVELS.INFO && this.shouldLog(category)) {
            this._log(message, category, data, "log");
        }
    }
    
    /**
     * Zapisuje log na poziomie WARNING
     * @param {string} message - treść wiadomości
     * @param {string} category - kategoria logowania
     * @param {any} data - opcjonalne dane do zalogowania
     */
    warn(message, category = "GAME_STATE", data = null) {
        if (this.currentLevel <= this.LEVELS.WARNING && this.shouldLog(category)) {
            this._log(message, category, data, "warn");
        }
    }
    
    /**
     * Zapisuje log na poziomie ERROR
     * @param {string} message - treść wiadomości
     * @param {string} category - kategoria logowania
     * @param {any} data - opcjonalne dane do zalogowania
     */
    error(message, category = "GAME_STATE", data = null) {
        if (this.currentLevel <= this.LEVELS.ERROR) {
            // Loguj błędy niezależnie od kategorii
            this._log(message, category, data, "error");
        }
    }
    
    /**
     * Sprawdza, czy dana kategoria powinna być zalogowana
     * @param {string} category - kategoria logowania
     * @returns {boolean} czy powinno się logować
     */
    shouldLog(category) {
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
     * Prywatna metoda do faktycznego zapisywania logów
     */
    _log(message, category, data, logType = "log") {
        const timestamp = new Date().toISOString().split("T")[1].split("Z")[0];
        const prefix = `[${timestamp}][${category}]`;
        
        if (data) {
            console[logType](`${prefix} ${message}`, data);
        } else {
            console[logType](`${prefix} ${message}`);
        }
    }
    
    /**
     * Włącza lub wyłącza kategorię logów
     * @param {string} category - kategoria logowania
     * @param {boolean} enabled - czy włączyć
     */
    setCategory(category, enabled) {
        if (this.enabledCategories.hasOwnProperty(category)) {
            this.enabledCategories[category] = enabled;
            console.log(`LogService: Kategoria ${category} ${enabled ? "włączona" : "wyłączona"}`);
        }
    }
    
    /**
     * Ustawia poziom logowania
     * @param {number} level - poziom z this.LEVELS
     */
    setLevel(level) {
        if (level >= this.LEVELS.DEBUG && level <= this.LEVELS.NONE) {
            this.currentLevel = level;
            const levelName = Object.keys(this.LEVELS).find(key => this.LEVELS[key] === level);
            console.log(`LogService: Poziom logowania zmieniony na ${levelName}`);
        }
    }
}

// Eksportujemy pojedynczą instancję serwisu (singleton)
export const logger = new LogService(); 