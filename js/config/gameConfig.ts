// config/gameConfig.ts
/**
 * Centralna konfiguracja gry - zbiera wszystkie ustawienia w jednym miejscu
 * Zamiast rozproszonych stałych w kodzie.
 */
export const CONFIG = {
    // Ustawienia gry
    GAME: {
        WIDTH: 800,
        HEIGHT: 600,
        TITLE: "Tower Defense 2D",
        VERSION: "1.0.0",
        FPS_TARGET: 60,
        BACKGROUND_COLOR: 0x87CEEB, // Niebieskie niebo
        DEBUG: false,             // Tryb debugowania
        AUTO_SAVE: true,          // Automatyczny zapis
        PAUSE_ON_BLUR: true,      // Pauzowanie gry przy utracie fokusa
    },
    
    // Ustawienia świata
    WORLD: {
        GROUND_LEVEL: 500,        // Poziom ziemi
        GRAVITY: 1200,            // Siła grawitacji
        BOUNDS: {                 // Granice świata
            X: 0,
            Y: 0,
            WIDTH: 800,
            HEIGHT: 600
        }
    },
    
    // Ustawienia bohatera
    HERO: {
        START_X: 200,             // Pozycja startowa X
        START_Y: 470,             // Pozycja startowa Y
        MAX_HEALTH: 200,          // Maksymalne zdrowie
        BASE_ATTACK: 25,          // Bazowa wartość ataku
        BASE_DEFENSE: 10,         // Bazowa obrona
        SPEED: 300,               // Prędkość ruchu
        JUMP_POWER: -600,         // Siła skoku
        MAX_JUMPS: 2,             // Maksymalna liczba skoków
        ATTACK_RANGE: 100,        // Zasięg ataku
        ATTACK_COOLDOWN: 800,     // Czas odnowienia ataku (ms)
        DODGE_COOLDOWN: 1000,     // Czas odnowienia uniku (ms)
        DODGE_DISTANCE: 150,      // Dystans uniku
        EXP_TO_LEVEL: 100         // Bazowe doświadczenie na poziom
    },
    
    // Ustawienia wrogów
    ENEMIES: {
        SPAWN_X: 850,             // Pozycja spawnowania wrogów (poza ekranem)
        BASE_HEALTH: 100,         // Bazowe zdrowie wrogów
        BASE_DAMAGE: 10,          // Bazowe obrażenia wrogów
        BASE_SPEED: 50,           // Bazowa prędkość wrogów
        SPAWN_INTERVAL: 7000,     // Bazowy interwał pojawiania się wrogów (ms)
        MAX_ON_SCREEN: 30,        // Maksymalna liczba wrogów na ekranie
        WAVE_DURATION: 30000,     // Czas trwania fali (30 sekund)
        MIN_SPAWN_INTERVAL: 1000, // Minimalny interwał pojawiania się wrogów
        TYPES: {                  // Definicje typów wrogów
            MINION: {
                NAME: 'Pajątek',
                HEALTH_MULT: 0.6,
                DAMAGE_MULT: 0.7,
                SPEED_MULT: 1.5,
                EXP_MULT: 0.5,
                CHANCE: 0.40,
                COLOR: 0x88ff88,
                SCALE: 0.6
            },
            STANDARD: {
                NAME: 'Goblin',
                HEALTH_MULT: 1.0,
                DAMAGE_MULT: 1.0,
                SPEED_MULT: 1.0,
                EXP_MULT: 1.0,
                CHANCE: 0.25,
                COLOR: 0xffffff,
                SCALE: 0.8
            },
            TANK: {
                NAME: 'Ork',
                HEALTH_MULT: 2.0,
                DAMAGE_MULT: 0.8,
                SPEED_MULT: 0.6,
                EXP_MULT: 1.5,
                CHANCE: 0.20,
                COLOR: 0xff8844,
                SCALE: 1.0
            },
            BERSERKER: {
                NAME: 'Berserker',
                HEALTH_MULT: 0.8,
                DAMAGE_MULT: 1.7,
                SPEED_MULT: 1.3,
                EXP_MULT: 1.3,
                CHANCE: 0.10,
                COLOR: 0xff5555,
                SCALE: 0.85
            },
            RANGED: {
                NAME: 'Łucznik',
                HEALTH_MULT: 0.7,
                DAMAGE_MULT: 1.2,
                SPEED_MULT: 0.9,
                EXP_MULT: 1.2,
                CHANCE: 0.15,
                COLOR: 0x5555ff,
                SCALE: 0.75
            },
            BOSS: {
                NAME: 'BOSS',
                HEALTH_MULT: 4.0,
                DAMAGE_MULT: 2.0,
                SPEED_MULT: 0.7,
                EXP_MULT: 3.0,
                CHANCE: 0.05,
                COLOR: 0xffcc00,
                SCALE: 1.2
            }
        }
    },
    
    // Ustawienia wydajności
    PERFORMANCE: {
        LOW_FPS_THRESHOLD: 25,    // Próg niskiego FPS
        CRITICAL_FPS_THRESHOLD: 15, // Krytyczny próg FPS
        EFFECTS_THROTTLE: 3,      // Ograniczenie efektów w trybie wysokiej wydajności
        MAX_PARTICLES: 100,       // Maksymalna liczba cząsteczek
        REDUCED_PARTICLES: 30,    // Zredukowana liczba cząsteczek w trybie wydajności
        FRAME_HISTORY_SIZE: 60,   // Liczba klatek do śledzenia wydajności
    },
    
    // Ustawienia dźwięku
    AUDIO: {
        MUSIC_VOLUME: 0.5,        // Głośność muzyki tła
        SFX_VOLUME: 0.7,          // Głośność efektów dźwiękowych
        MUTE_ON_BLUR: true,       // Wyciszenie przy utracie fokusa
    },
    
    // Ustawienia interfejsu
    UI: {
        FONT_FAMILY: 'Arial, sans-serif',
        TEXT_COLOR: '#ffffff',
        TEXT_SHADOW: '#000000',
        HEADER_FONT_SIZE: '24px',
        NORMAL_FONT_SIZE: '18px',
        SMALL_FONT_SIZE: '14px',
        BUTTON_COLOR: 0x4a4a4a,
        BUTTON_HOVER_COLOR: 0x666666,
        PANEL_BACKGROUND: 0x333333,
        PANEL_ALPHA: 0.7,
        MESSAGE_DURATION: 3000   // Czas wyświetlania komunikatów (ms)
    },
    
    // Skróty klawiszowe
    KEYS: {
        MOVEMENT: {
            UP: 'W',
            DOWN: 'S',
            LEFT: 'A',
            RIGHT: 'D'
        },
        ACTIONS: {
            JUMP: 'W',
            ATTACK: 'E',
            DODGE: 'SPACE',
            WEAPON_CHANGE: 'Q'
        },
        SYSTEM: {
            AUTO_MODE: 'T',
            PERFORMANCE_MODE: 'P',
            DEBUG: 'F5',
            PAUSE: 'ESC'
        }
    },
    
    // Ścieżki do zasobów
    ASSETS: {
        ROOT: 'assets/',
        TEXTURES: 'assets/textures/',
        AUDIO: 'assets/audio/',
        FONTS: 'assets/fonts/'
    }
};

// Typ dla sceny dziedziczącej zmienne z konfiguracji
export interface ConfigAwareScene {
    CONFIG: typeof CONFIG;
}

// Środowiska pracy
export enum Environment {
    DEVELOPMENT = 'development',
    PRODUCTION = 'production',
    TESTING = 'testing'
}

// Aktualne środowisko
let currentEnvironment = Environment.DEVELOPMENT;

// Ustawia środowisko pracy
export function setEnvironment(env: Environment): void {
    currentEnvironment = env;
    
    // Dostosowujemy konfigurację w zależności od środowiska
    if (env === Environment.DEVELOPMENT) {
        CONFIG.GAME.DEBUG = true;
    } else {
        CONFIG.GAME.DEBUG = false;
    }
    
    // W trybie testowym zmniejszamy liczbę wrogów
    if (env === Environment.TESTING) {
        CONFIG.ENEMIES.MAX_ON_SCREEN = 5;
        CONFIG.ENEMIES.SPAWN_INTERVAL = 10000;
    }
    
    console.log(`Ustawiono środowisko: ${env}`);
}

// Zwraca aktualne środowisko
export function getEnvironment(): Environment {
    return currentEnvironment;
}

// Tworzy konfigurację Phaser na podstawie CONFIG
export function createPhaserConfig(debug: boolean = false): Phaser.Types.Core.GameConfig {
    return {
        type: Phaser.AUTO,
        width: CONFIG.GAME.WIDTH,
        height: CONFIG.GAME.HEIGHT,
        backgroundColor: CONFIG.GAME.BACKGROUND_COLOR,
        title: CONFIG.GAME.TITLE,
        version: CONFIG.GAME.VERSION,
        disableContextMenu: true,
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: CONFIG.WORLD.GRAVITY },
                debug: debug,
                fps: CONFIG.GAME.FPS_TARGET,
                timeScale: 1,
                maxSubSteps: debug ? 1 : 3,
                skipQuadTree: false,
                overlapBias: 4,
                tileBias: 4,
                forceX: false
            }
        },
        render: {
            pixelArt: false,
            antialias: true,
            roundPixels: false,
            powerPreference: 'high-performance',
        },
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            parent: 'game-container'
        },
        audio: {
            disableWebAudio: false,
            noAudio: false
        },
        fps: {
            target: CONFIG.GAME.FPS_TARGET,
            forceSetTimeOut: false,
            min: 20
        },
        dom: {
            createContainer: false
        },
        disableVisibilityChange: !CONFIG.GAME.PAUSE_ON_BLUR,
        scene: [] // Sceny są dodawane przez SceneManager
    };
}

// Metody pomocnicze dla konfiguracji
export const ConfigUtils = {
    // Oblicza wartość statystyki wroga na podstawie typu i poziomu fali
    calculateEnemyStat(
        baseStat: number, 
        enemyType: keyof typeof CONFIG.ENEMIES.TYPES, 
        multiplierType: 'HEALTH_MULT' | 'DAMAGE_MULT' | 'SPEED_MULT' | 'EXP_MULT',
        waveNumber: number
    ): number {
        const typeConfig = CONFIG.ENEMIES.TYPES[enemyType];
        const typeMultiplier = typeConfig[multiplierType];
        const waveMultiplier = Math.pow(1.1, waveNumber - 1); // 10% wzrost na falę
        
        return Math.floor(baseStat * typeMultiplier * waveMultiplier);
    },
    
    // Zwraca zmodyfikowaną konfigurację dla określonej wydajności
    getPerformanceAdjustedConfig(performanceLevel: 'HIGH' | 'MEDIUM' | 'LOW'): typeof CONFIG {
        // Klonujemy konfigurację aby nie modyfikować oryginału
        const adjustedConfig = JSON.parse(JSON.stringify(CONFIG));
        
        switch (performanceLevel) {
            case 'LOW':
                // Niskie ustawienia wydajności
                adjustedConfig.GAME.FPS_TARGET = 30;
                adjustedConfig.PERFORMANCE.MAX_PARTICLES = 10;
                adjustedConfig.ENEMIES.MAX_ON_SCREEN = 10;
                break;
                
            case 'MEDIUM':
                // Średnie ustawienia wydajności
                adjustedConfig.GAME.FPS_TARGET = 45;
                adjustedConfig.PERFORMANCE.MAX_PARTICLES = 30;
                adjustedConfig.ENEMIES.MAX_ON_SCREEN = 20;
                break;
                
            case 'HIGH':
            default:
                // Domyślne, wysokie ustawienia - bez zmian
                break;
        }
        
        return adjustedConfig;
    },
    
    // Tworzy konfigurację dla wczytywania zasobów
    getAssetLoadingConfig(assetKey: string, assetType: 'texture' | 'audio' | 'font'): string {
        const paths = {
            'texture': CONFIG.ASSETS.TEXTURES,
            'audio': CONFIG.ASSETS.AUDIO,
            'font': CONFIG.ASSETS.FONTS
        };
        
        return `${paths[assetType]}${assetKey}`;
    }
};