import { logger } from '../services/LogService.js';
import PlayerSystem from '../systems/player/PlayerSystem.js';
import EnemySystem from '../systems/enemies/EnemySystem.js';
import CombatSystem from '../systems/combat/CombatSystem.js';

// Definicja typu dla prostokąta używanego do kolizji
interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Typ dla bohatera
interface Hero {
    x: number;
    y: number;
    width: number;
    height: number;
    isDead: boolean;
    takeDamage: (amount: number) => void;
    updateHealthBar?: () => void;
}

export default class GameScene extends Phaser.Scene {
    private playerSystem: PlayerSystem | null;
    private enemySystem: EnemySystem | null;
    private combatSystem: CombatSystem | null;
    
    private GROUND_LEVEL: number;
    private collisionsAdded: boolean;
    
    private lastCollisionCheck: number;
    private collisionCheckInterval: number;
    private lastAttackingEnemies: Map<string | number, number>;
    
    private ground!: Phaser.GameObjects.Rectangle;
    private grassLine!: Phaser.GameObjects.Rectangle;
    private cursors!: {
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
        space: Phaser.Input.Keyboard.Key;
    };
    private autoModeKey!: Phaser.Input.Keyboard.Key;
    private performanceModeKey!: Phaser.Input.Keyboard.Key;
    private bgMusic!: Phaser.Sound.BaseSound;
    
    private lastUpdateTime: number = 0;
    private updateCounter: number = 0;
    private heroEnemyCollider?: Phaser.Physics.Arcade.Collider;
    private heroEnemyOverlap?: Phaser.Physics.Arcade.Collider;

    constructor() {
        super({ key: 'GameScene' });
        
        // Inicjalizacja systemów jako null - będą utworzone w create()
        this.playerSystem = null;
        this.enemySystem = null;
        this.combatSystem = null;
        
        // Stałe dla nowego układu mapy
        this.GROUND_LEVEL = 500; // Poziom ziemi
        
        // Flaga określająca czy kolizje zostały już dodane
        this.collisionsAdded = false;
        
        // Optymalizacja kolizji
        this.lastCollisionCheck = 0;
        this.collisionCheckInterval = 50; // Sprawdzaj kolizje co 50ms zamiast w każdej klatce
        this.lastAttackingEnemies = new Map(); // Mapa wrogów, którzy ostatnio atakowali bohatera
    }
    
    preload(): void {
        // Wczytujemy zasoby potrzebne do wizualizacji bohatera
        // W rzeczywistej implementacji powinny być to sprite'y dla różnych części ciała
        // i broni, ale teraz stworzymy je dynamicznie
        
        // Tworzymy placeholder dla tekstury bohatera
        if (!this.textures.exists('hero')) {
            const heroGraphics = this.make.graphics({ x: 0, y: 0, add: false });
            heroGraphics.fillStyle(0x3498db, 1);
            heroGraphics.fillRect(0, 0, 32, 32);
            heroGraphics.generateTexture('hero', 32, 32);
            logger.debug("Utworzono tymczasową teksturę bohatera", "GAME_ASSETS");
        }
        
        // Tworzymy placeholder dla cząsteczek
        if (!this.textures.exists('particle')) {
            const particleGraphics = this.make.graphics({ x: 0, y: 0, add: false });
            particleGraphics.fillStyle(0xffffff, 1);
            particleGraphics.fillCircle(4, 4, 4);
            particleGraphics.generateTexture('particle', 8, 8);
            logger.debug("Utworzono tymczasową teksturę cząsteczek", "GAME_ASSETS");
        }
        
        // Wczytujemy dźwięki (opcjonalnie)
        try {
            // W rzeczywistej implementacji wczytywalibyśmy prawdziwe pliki dźwiękowe
            if (!this.cache.audio.exists('attack')) {
                this.cache.audio.add('attack', null);
                this.cache.audio.add('playerHit', null);
                this.cache.audio.add('jump', null);
                this.cache.audio.add('dodge', null);
                logger.debug("Dodano placeholdery dla dźwięków", "GAME_ASSETS");
            }
        } catch (error) {
            logger.warn(`Błąd wczytywania dźwięków: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "GAME_ASSETS");
        }
    }

    create(): void {
        // Wyłączamy tryb debugowania fizyki
        this.physics.world.drawDebug = false;
        // Sprawdzamy czy debugGraphic istnieje przed użyciem metody clear()
        if (this.physics.world.debugGraphic) {
            this.physics.world.debugGraphic.clear();
        }
        
        // Przypisujemy poziom ziemi - stała wysokość dla uproszczenia
        this.GROUND_LEVEL = 500;
        
        // Tworzymy dane gry
        if (!window.gameData) {
            window.gameData = {
                score: 0,
                wave: 1,
                autoMode: false,
                heroLevel: 1,
                enemiesKilled: 0
            };
        }
        
        logger.info("GameScene.create() wywołane", "GAME_STATE");
        
        // Uruchamiamy scenę UI
        this.scene.launch('UIScene');
        
        // Dodajemy tło (niebo)
        this.add.image(400, 300, 'background');
        
        // Dodajemy ziemię - brązowy prostokąt na dole ekranu
        this.ground = this.add.rectangle(400, this.GROUND_LEVEL + 50, 800, 100, 0x8B4513);
        
        // Dodajemy linię trawy na ziemi
        this.grassLine = this.add.rectangle(400, this.GROUND_LEVEL, 800, 5, 0x00AA00);
        
        // Tworzymy systemy gry
        this.initializeSystems();
        
        // Dodajemy obsługę klawiszy WASD
        this.cursors = {
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        };
        
        // Dodajemy klawisz do przełączania trybu automatycznego
        this.autoModeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
        this.autoModeKey.on('down', () => {
            window.gameData.autoMode = !window.gameData.autoMode;
            this.events.emit('autoModeChanged', window.gameData.autoMode);
            
            // Wyświetlamy informację o trybie
            const modeText = this.add.text(400, 300, 
                `Tryb auto: ${window.gameData.autoMode ? 'WŁĄCZONY' : 'WYŁĄCZONY'}`, {
                fontSize: '24px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
            
            // Animacja tekstu
            this.tweens.add({
                targets: modeText,
                alpha: 0,
                y: 280,
                duration: 1500,
                onComplete: () => modeText.destroy()
            });
        });
        
        // NIE odtwarzamy dźwięku w tle - to powodowało błąd
        // Zamiast tego tylko zapisujemy referencję do dźwięku (bez odtwarzania)
        this.bgMusic = this.sound.add('bgMusic', {
            volume: 0,
            loop: true
        });
        
        // Dodajemy klawisz do przełączania trybu wydajności
        this.performanceModeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
        this.performanceModeKey.on('down', () => {
            window.gameData.performanceMode = !window.gameData.performanceMode;
            
            // Wyświetlamy informację o trybie
            const modeText = this.add.text(400, 300, 
                `Tryb wydajności: ${window.gameData.performanceMode ? 'WŁĄCZONY' : 'WYŁĄCZONY'}`, {
                fontSize: '24px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
            
            // Animacja tekstu
            this.tweens.add({
                targets: modeText,
                alpha: 0,
                y: 280,
                duration: 1500,
                onComplete: () => modeText.destroy()
            });
        });
        
        // Wyświetlamy informację o sterowaniu
        console.log("Sterowanie:");
        console.log("- WASD: poruszanie się");
        console.log("- SPACJA: unik");
        console.log("- E: atak");
        console.log("- Q: zmiana broni");
        console.log("- T: przełączanie trybu automatycznego");
        console.log("- P: przełączanie trybu wydajności");
        console.log("- F5: przełączanie debugowania");
        
        logger.info("GameScene.create() zakończone pomyślnie", "GAME_STATE");
    }
    
    // Inicjalizacja wszystkich systemów gry
    initializeSystems(): void {
        try {
            // System gracza
            this.playerSystem = new PlayerSystem(this);
            this.playerSystem.createHero();
            
            // System wrogów
            this.enemySystem = new EnemySystem(this);
            this.enemySystem.initialize();
            
            // System walki
            this.combatSystem = new CombatSystem(this);
            this.combatSystem.initialize();
            
            // Sprawdzamy czy możemy dodać kolizje
            this.setupCollisions();
        } catch (error) {
            logger.error(`Błąd podczas inicjalizacji systemów: ${error instanceof Error ? error.message : 'nieznany błąd'}`, "GAME_STATE");
            console.error("Szczegóły błędu:", error);
        }
    }
    
    // Ustawia kolizje między obiektami z różnych systemów
    setupCollisions(): void {
        if (this.playerSystem && this.playerSystem.getHero() && 
            this.enemySystem && this.enemySystem.getEnemyGroup()) {
            
            const hero = this.playerSystem.getHero();
            const enemyGroup = this.enemySystem.getEnemyGroup();
            
            // Usuwamy poprzednie kolizje, jeśli istnieją
            if (this.heroEnemyCollider) {
                this.heroEnemyCollider.destroy();
            }
            
            if (this.heroEnemyOverlap) {
                this.heroEnemyOverlap.destroy();
            }
            
            // Zamiast używać wbudowanego systemu kolizji Phaser,
            // będziemy ręcznie sprawdzać kolizje w metodzie update
            // aby mieć większą kontrolę nad wydajnością
            
            console.log("Ręczne sprawdzanie kolizji skonfigurowane");
            this.collisionsAdded = true;
            logger.info("Ręczne sprawdzanie kolizji między systemami zostało skonfigurowane", "GAME_STATE");
        } else {
            logger.warn("Nie można dodać kolizji - niektóre systemy nie są gotowe", "GAME_STATE");
        }
    }
    
    // Ręczne sprawdzanie kolizji z optymalizacją
    checkCollisions(time: number): void {
        // Sprawdzamy kolizje tylko co określony interwał czasu
        if (time < this.lastCollisionCheck + this.collisionCheckInterval) {
            return;
        }
        
        this.lastCollisionCheck = time;
        
        const hero = this.playerSystem?.getHero() as Hero | undefined;
        if (!hero || hero.isDead) return;
        
        const enemies = this.enemySystem?.getEnemyGroup().getChildren();
        if (!enemies || enemies.length === 0) return;
        
        // Optymalizacja - tworzymy obszar kolizji bohatera tylko raz na ramkę
        const heroRect: Rect = {
            x: hero.x - hero.width / 3, // Zwiększamy obszar kolizji bohatera
            y: hero.y - hero.height / 3,
            width: hero.width / 1.5,
            height: hero.height / 1.5
        };
        
        // Sprawdzamy tylko aktywnych wrogów
        const activeEnemies = enemies.filter(enemy => enemy.active && !enemy.isDead);
        
        // Limit jednoczesnych ataków na bohatera
        const maxSimultaneousAttacks = 3;
        let attackingEnemiesCount = 0;
        
        // Czyszczenie mapy nieaktywnych wrogów
        for (const [enemyId, lastAttackTime] of this.lastAttackingEnemies.entries()) {
            // Jeśli minęło więcej niż 5 sekund od ostatniego ataku, usuń z mapy
            if (time - lastAttackTime > 5000) {
                this.lastAttackingEnemies.delete(enemyId);
            }
        }
        
        // Aktualizujemy listę wrogów, którzy mogą atakować
        for (const enemy of activeEnemies) {
            // Uproszczone sprawdzanie kolizji na podstawie odległości
            const dx = Math.abs(enemy.x - hero.x);
            const dy = Math.abs(enemy.y - hero.y);
            
            // Jeśli wróg jest wystarczająco blisko bohatera, sprawdzamy dokładniej kolizję
            if (dx < 80 && dy < 80) { // Zwiększony promień detekcji ataku
                // Określamy uproszczony obszar kolizji wroga
                const enemyRect: Rect = {
                    x: enemy.x - enemy.width / 3,
                    y: enemy.y - enemy.height / 3,
                    width: enemy.width / 1.5,
                    height: enemy.height / 1.5
                };
                
                // Sprawdzamy, czy prostokąty się przecinają lub czy są wystarczająco blisko
                const distanceX = Math.abs(hero.x - enemy.x);
                const distanceY = Math.abs(hero.y - enemy.y);
                const closeEnoughToAttack = distanceX < 60 && distanceY < 60;
                
                if (this.rectsIntersect(heroRect, enemyRect) || closeEnoughToAttack) {
                    attackingEnemiesCount++;
                    
                    // Ograniczamy liczbę jednoczesnych ataków
                    if (attackingEnemiesCount <= maxSimultaneousAttacks) {
                        this.handleHeroEnemyCollision(hero, enemy);
                    }
                } else {
                    // Jeśli wróg nie koliduje już z bohaterem, usuwamy go z listy
                    this.lastAttackingEnemies.delete(enemy.id);
                }
            }
        }
    }
    
    // Pomocnicza funkcja sprawdzająca, czy dwa prostokąty się przecinają
    rectsIntersect(rect1: Rect, rect2: Rect): boolean {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }
    
    // Obsługuje kolizję między bohaterem a wrogiem
    handleHeroEnemyCollision(hero: Hero, enemy: any): void {
        // Sprawdzamy podstawowe warunki
        if (hero.isDead || enemy.isDead) {
            return;
        }
        
        // Sprawdzamy czy wróg może zaatakować (cooldown)
        const canAttack = enemy.canAttack && typeof enemy.canAttack === 'function' && enemy.canAttack();
        
        if (canAttack) {
            // Sprawdzamy, czy ten wróg już ostatnio atakował
            if (this.lastAttackingEnemies.has(enemy.id)) {
                const lastAttack = this.lastAttackingEnemies.get(enemy.id);
                if (lastAttack && this.time.now - lastAttack < enemy.attackCooldown) {
                    return; // Jeszcze nie minął czas cooldownu
                }
            }
            
            // Pobieramy wartość obrażeń z wroga
            let damageAmount = 10; // Domyślna wartość obrażeń
            if (typeof enemy.attack === 'number') {
                damageAmount = enemy.attack;
            }
            
            // Ograniczamy efekty wizualne w trybie wysokiej wydajności
            if (!window.gameData.performanceMode) {
                // Efekt wizualny ataku - tworzymy tylko jeden efekt
                const attackEffect = this.add.circle(
                    enemy.x + (enemy.flipX ? 30 : -30),
                    enemy.y,
                    15,
                    0xff0000,
                    0.5
                );
                
                this.tweens.add({
                    targets: attackEffect,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => attackEffect.destroy()
                });
            }
            
            // Zadajemy obrażenia bohaterowi
            try {
                // Wywołujemy metodę takeDamage
                hero.takeDamage(damageAmount);
                
                // Aktualizujemy UI
                if (hero.updateHealthBar) {
                    hero.updateHealthBar();
                }
            } catch (error) {
                console.error('Błąd podczas zadawania obrażeń:', error);
            }
            
            // Ustawiamy czas ostatniego ataku wroga
            enemy.lastAttackTime = this.time.now;
            
            // Zapisujemy ten atak w mapie
            this.lastAttackingEnemies.set(enemy.id, this.time.now);
        }
    }

    update(time: number, delta: number): void {
        // Śledzenie częstotliwości wywołań update
        if (!this.lastUpdateTime) {
            this.lastUpdateTime = time;
            this.updateCounter = 0;
        } else {
            this.updateCounter++;
            if (time - this.lastUpdateTime > 1000) {  // Co sekundę
                console.log(`GameScene.update(): ${this.updateCounter} wywołań w ciągu ostatniej sekundy`);
                this.lastUpdateTime = time;
                this.updateCounter = 0;
            }
        }
        
        // Sprawdź czy kolizje zostały już dodane, jeśli nie - spróbuj ponownie
        if (!this.collisionsAdded) {
            this.setupCollisions();
        }
        
        // Aktualizujemy poszczególne systemy
        if (this.playerSystem) {
            this.playerSystem.update(time, delta, this.cursors);
        }
        
        if (this.enemySystem) {
            // Dodaję jawne wywołanie metody update z przekazaniem czasu
            console.log(`GameScene wywołuje enemySystem.update(${time})`);
            this.enemySystem.update(time);
        }
        
        if (this.combatSystem) {
            this.combatSystem.update(time);
        }
        
        // Ręczne sprawdzanie kolizji z optymalizacją
        if (this.collisionsAdded) {
            this.checkCollisions(time);
        }
    }
} 