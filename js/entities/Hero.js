import { logger } from '../services/LogService.js';
import HeroModel from './HeroModel.js';

export default class Hero extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, config = {}) {
        super(scene, x, y, 'hero');
        
        // Dodajemy sprite'a do sceny i włączamy fizykę
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Ukrywamy domyślny sprite, ponieważ będziemy używać naszego modelu
        this.setVisible(false);
        
        // Statystyki bohatera
        this.maxHealth = 200;
        this.health = this.maxHealth;
        this.attack = 25;      // Wartość ataku bohatera
        this.defense = 10;     // Obrona bohatera - zmniejsza otrzymywane obrażenia
        this.level = 1;        // Poziom bohatera
        this.experience = 0;   // Doświadczenie
        this.experienceToNextLevel = 100; // Ilość doświadczenia potrzebna do awansu
        
        // Inne właściwości bohatera
        this.speed = 300;      // Zwiększona prędkość bazowa
        this.maxSpeed = 300;   // Maksymalna prędkość
        this.acceleration = 1200; // Przyspieszenie (pxls/s²)
        this.friction = 1200;  // Tarcie/opór powietrza (pxls/s²)
        this.velocityX = 0;    // Aktualna prędkość w osi X
        this.attackCooldown = 800; // czas w ms między atakami
        this.lastAttackTime = 0;
        this.attackRange = 100; // zasięg ataku
        this.isDead = false;
        
        // Ograniczenia ruchu dla stylu Grow Castle
        this.minX = 0;
        this.maxX = 800;
        this.limitMovement = false;
        
        // ULEPSZONY SYSTEM SKOKÓW
        this.jumpPower = -600; // Zwiększona siła skoku (ujemna wartość, bo y skierowane w dół)
        this.jumpCount = 0;    // Licznik skoków
        this.maxJumps = 2;     // Maksymalna liczba skoków (podwójny skok)
        this.isJumping = false;
        this.isGrounded = true;
        
        // Coyote Time - możliwość skoku krótko po spadnięciu z platformy
        this.coyoteTime = 150; // czas w ms, kiedy można jeszcze skoczyć po opuszczeniu platformy
        this.coyoteTimer = 0;  // licznik czasu coyote time
        
        // Jump Buffer - możliwość zarejestrowania skoku tuż przed wylądowaniem
        this.jumpBufferTime = 150; // czas w ms, przez który zapamiętywane jest wciśnięcie klawisza skoku
        this.jumpBufferTimer = 0;  // licznik czasu jump buffer
        this.jumpRequested = false; // flaga wskazująca, czy gracz zażądał skoku
        
        // Parametry uników
        this.dodgeCooldown = 1000; // czas w ms między unikami
        this.lastDodgeTime = 0;
        this.dodgeDistance = 150;  // dystans uniku
        this.dodgeDuration = 300;  // czas trwania uniku w ms
        this.isDodging = false;
        this.invincibleTime = 0;   // czas nietykalności po uniku
        this.isKnockingBack = false; // flaga pokazująca czy bohater jest odrzucany
        
        // Ustawienia kolizji
        this.setCollideWorldBounds(true);
        this.setSize(40, 40);
        this.setOffset(4, 8);
        
        // Ustawiamy grawitację dla bohatera
        this.body.setGravityY(1200); // Zwiększona wartość grawitacji dla lepszego feelingu
        
        // Zapisujemy referencje do dźwięków, ale ich nie odtwarzamy
        try {
            // Zamiast próbować tworzyć dźwięki, które mogą być niedostępne, tworzymy atrapy od razu
            this.attackSound = { 
                play: function() { 
                    console.log('Dźwięk ataku (atrapa)'); 
                } 
            };
            this.hitSound = { 
                play: function() { 
                    console.log('Dźwięk otrzymania obrażeń (atrapa)'); 
                } 
            };
            this.jumpSound = { 
                play: function() { 
                    console.log('Dźwięk skoku (atrapa)'); 
                } 
            };
            this.dodgeSound = { 
                play: function() { 
                    console.log('Dźwięk uniku (atrapa)'); 
                } 
            };
            
            // Spróbujmy załadować rzeczywiste dźwięki tylko jeśli są dostępne
            if (scene.sound && typeof scene.sound.add === 'function') {
                const testSound = scene.sound.add('attack', { volume: 0 });
                // Jeśli udało się stworzyć obiekt dźwiękowy, zastępujemy atrapy
                this.attackSound = testSound;
                this.hitSound = scene.sound.add('playerHit', { volume: 0 });
                this.jumpSound = scene.sound.add('jump', { volume: 0 });
                this.dodgeSound = scene.sound.add('dodge', { volume: 0 });
            }
        } catch (error) {
            logger.warn(`Nie można załadować dźwięków: ${error.message}`, "GAME_STATE");
            // Atrapy już są zdefiniowane powyżej, więc nie trzeba tu nic robić
        }
        
        // Dostosowujemy rozmiar sprite'a
        this.setScale(0.8);
        
        // Tworzymy wizualny model bohatera (Castle Crashers style)
        this.model = new HeroModel(scene, x, y);
        
        // Tworzymy pasek statystyk
        this.createStatsBar();
        
        // Tworzymy efekty ruchu
        this.createMovementEffects();
        
        // Dodajemy obserwatora kolizji z podłożem
        this.scene.physics.world.on('worldbounds', this.onWorldBounds, this);
        
        logger.info("Bohater utworzony", "GAME_STATE");
    }
    
    /**
     * Tworzy pasek statystyk nad bohaterem
     */
    createStatsBar() {
        // Tworzymy kontener na pasek statystyk
        this.statsBar = this.scene.add.container(0, -80);
        
        // Tło paska życia
        this.healthBarBg = this.scene.add.rectangle(0, 0, 50, 6, 0x000000);
        this.healthBarBg.setOrigin(0.5, 0.5);
        
        // Pasek życia
        this.healthBar = this.scene.add.rectangle(0, 0, 48, 4, 0xff0000);
        this.healthBar.setOrigin(0.5, 0.5);
        
        // Tło paska doświadczenia
        this.expBarBg = this.scene.add.rectangle(0, 8, 50, 4, 0x000000);
        this.expBarBg.setOrigin(0.5, 0.5);
        
        // Pasek doświadczenia
        this.expBar = this.scene.add.rectangle(0, 8, 0, 2, 0x00ff00);
        this.expBar.setOrigin(0.5, 0.5);
        
        // Tekst poziomu
        this.levelText = this.scene.add.text(0, -10, `Lvl ${this.level}`, {
            fontSize: '10px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0.5);
        
        // Dodajemy elementy do kontenera
        this.statsBar.add([
            this.healthBarBg,
            this.healthBar,
            this.expBarBg,
            this.expBar,
            this.levelText
        ]);
    }
    
    /**
     * Aktualizuje pasek statystyk na podstawie bieżących wartości zdrowia i doświadczenia
     */
    updateStatsBar() {
        if (!this.statsBar) return;
        
        // Aktualizacja paska zdrowia
        if (this.healthBar) {
            const healthPercent = this.health / this.maxHealth;
            this.healthBar.width = 48 * healthPercent;
        }
        
        // Aktualizacja paska doświadczenia
        if (this.expBar) {
            const expPercent = this.experience / this.experienceToNextLevel;
            this.expBar.width = 48 * expPercent;
        }
        
        // Aktualizacja tekstu poziomu
        if (this.levelText) {
            this.levelText.setText(`Lvl ${this.level}`);
        }
        
        // Aktualizacja pozycji kontenera statystyk
        this.statsBar.x = this.x;
        this.statsBar.y = this.y - 80;
    }
    
    /**
     * Tworzy efekty ruchu (cząsteczki)
     */
    createMovementEffects() {
        // Sprawdź czy tekstura cząsteczek istnieje
        if (this.scene.textures.exists('particle')) {
            // Emiter cząsteczek do efektów ruchu
            this.movementEmitter = this.scene.add.particles(0, 0, 'particle', {
                scale: { start: 0.5, end: 0 },
                speed: { min: 50, max: 100 },
                angle: { min: 230, max: 310 },
                lifespan: 500,
                frequency: -1, // Na żądanie
                gravityY: 200,
                emitting: false
            });
        } else {
            logger.warn("Brak tekstury 'particle' dla efektów ruchu!", "HERO");
        }
    }
    
    // Ustawia ograniczenia ruchu dla bohatera (w stylu Grow Castle)
    setLimitedMovement(minX, maxX) {
        this.minX = minX;
        this.maxX = maxX;
        this.limitMovement = true;
        logger.debug(`Ustawiono ograniczenie ruchu bohatera: ${minX} - ${maxX}`, "GAME_STATE");
    }
    
    // Callback do obsługi kolizji z granicami świata
    onWorldBounds(body) {
        if (body.gameObject === this && body.blocked.down) {
            this.resetJump();
        }
    }
    
    // Resetuje skok, gdy bohater dotyka podłoża
    resetJump() {
        this.isJumping = false;
        this.jumpCount = 0;
        this.isGrounded = true;
        this.coyoteTimer = this.coyoteTime; // Resetujemy licznik coyote time
        
        // Efekt lądowania - kurz przy kontakcie z podłożem
        if (this.body.velocity.y > 200) { // Tylko gdy lądowanie z dużej wysokości
            this.createLandingEffect();
        }
        
        // Sprawdzamy, czy gracz nacisnął skok przed lądowaniem (jump buffering)
        if (this.jumpRequested && this.jumpBufferTimer > 0) {
            this.performJump();
        }
    }
    
    // Tworzy efekt kurzu przy lądowaniu
    createLandingEffect() {
        // Emitujemy cząsteczki kurzu przy lądowaniu
        this.movementEmitter.setPosition(this.x, this.y + 20);
        this.movementEmitter.explode(10);
    }
    
    // Nowa metoda: żąda wykonania skoku
    requestJump() {
        this.jumpRequested = true;
        this.jumpBufferTimer = this.jumpBufferTime;
    }
    
    /**
     * Wykonuje skok
     */
    performJump() {
        // Sprawdzamy czy możemy skoczyć (czy nie wykorzystaliśmy już max skoków)
        if (this.jumpCount < this.maxJumps && !this.isDodging) {
            this.jumpCount++;
            this.isJumping = true;
            this.isGrounded = false;
            this.jumpRequested = false;
            
            // Aplikujemy siłę skoku
            this.setVelocityY(this.jumpPower);
            
            // Odtwarzamy animację skoku
            this.model.playAnimation('jump');
            
            // Log informacyjny
            logger.debug(`Bohater wykonuje skok (${this.jumpCount}/${this.maxJumps})`, "PLAYER_MOVEMENT");
            return true;
        }
        return false;
    }
    
    // Nowa metoda: wykonuje skok
    jump() {
        // Jeśli stoimy na ziemi lub mamy jeszcze coyote time, wykonujemy skok od razu
        if ((this.isGrounded || this.coyoteTimer > 0) && this.jumpCount < this.maxJumps) {
            return this.performJump();
        } else {
            // W przeciwnym razie zapamiętujemy żądanie skoku (jump buffering)
            this.requestJump();
            return false;
        }
    }
    
    /**
     * Wykonuje unik
     */
    dodge() {
        const time = this.scene.time.now;
        
        // Sprawdzamy, czy unik jest dostępny
        if (time > this.lastDodgeTime + this.dodgeCooldown && !this.isDodging) {
            this.lastDodgeTime = time;
            this.isDodging = true;
            
            // Ustawiamy nietykalsność po uniku
            this.invincibleTime = time + this.dodgeDuration;
            
            // Odtwarzamy animację uniku
            this.model.playAnimation('dodge');
            
            // Efekty uniku tylko w normalnym trybie wydajności
            if (!window.gameData.performanceMode && this.movementEmitter) {
                this.movementEmitter.setPosition(this.x, this.y + 20);
                this.movementEmitter.explode(10);
            }
            
            // Upewniamy się, że flaga odrzutu jest wyłączona
            this.isKnockingBack = false;
            
            // Po zakończeniu uniku, resetujemy flagę
            this.scene.time.delayedCall(this.dodgeDuration, () => {
                this.isDodging = false;
            });
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Atakuje w określonym kierunku
     * @param {number} direction - kierunek ataku (1 = prawo, -1 = lewo)
     */
    attack(direction = 1) {
        const time = this.scene.time.now;
        
        // Sprawdzamy, czy bohater może zaatakować (upłynął cooldown)
        if (time > this.lastAttackTime + this.attackCooldown) {
            this.lastAttackTime = time;
            
            // Odtwarzamy animację ataku
            this.model.playAnimation('attack');
            
            return true;
        }
        
        return false;
    }
    
    canAttack() {
        const time = this.scene.time.now;
        return time > this.lastAttackTime + this.attackCooldown;
    }
    
    /**
     * Otrzymuje obrażenia
     * @param {number} damage - ilość obrażeń
     * @param {object} source - źródło obrażeń (np. wróg)
     */
    takeDamage(damage, source = null) {
        const time = this.scene.time.now;
        
        // Sprawdzamy czy bohater nie jest nietykalny po uniku
        if (time < this.invincibleTime) {
            // Pokazujemy komunikat o uniknięciu obrażeń - tylko w trybie niskiej wydajności
            if (!window.gameData.performanceMode) {
                const dodgeText = this.scene.add.text(this.x, this.y - 40, 'UNIK!', {
                    fontSize: '16px',
                    fill: '#00ffff',
                    stroke: '#000000',
                    strokeThickness: 3
                }).setOrigin(0.5);
                
                this.scene.tweens.add({
                    targets: dodgeText,
                    y: this.y - 70,
                    alpha: 0,
                    duration: 700,
                    onComplete: () => dodgeText.destroy()
                });
            }
            
            return;
        }
        
        // Obliczamy faktyczne obrażenia po uwzględnieniu obrony
        const actualDamage = Math.max(1, damage - this.defense);
        
        // Zmniejszamy zdrowie
        this.health = Math.max(0, this.health - actualDamage);
        
        logger.info(`Hero otrzymuje obrażenia: ${damage}, po obronie: ${actualDamage}, pozostałe HP: ${this.health}`, "PLAYER_DAMAGE");
        
        // Aktualizujemy pasek zdrowia
        this.updateStatsBar();
        
        // Odtwarzamy animację obrażeń
        this.model.playAnimation('damage');
        
        // Efekty otrzymania obrażeń tylko w normalnym trybie wydajności
        if (!window.gameData.performanceMode) {
            // 1. Efekt odrzucenia
            const knockbackForce = 100;
            const currentVelocityX = this.body.velocity.x;
            
            // Określamy kierunek odrzutu na podstawie pozycji źródła obrażeń lub aktualnego kierunku patrzenia bohatera
            let knockbackDirection;
            
            if (source && typeof source.x === 'number') {
                // Jeśli znamy źródło obrażeń, odrzut jest w przeciwnym kierunku
                knockbackDirection = source.x < this.x ? 1 : -1;
            } else {
                // W przeciwnym razie, używamy przeciwnego kierunku do aktualnego kierunku patrzenia
                knockbackDirection = this.flipX ? 1 : -1;
            }
            
            // Aplikujemy siłę odrzutu (tylko chwilowo)
            this.setVelocityX(currentVelocityX + (knockbackDirection * knockbackForce));
            
            // Ustawiamy flagę, że bohater jest odrzucany (podobnie jak przy uniku)
            this.isKnockingBack = true;
            
            // Przywracamy kontrolę nad postacią po 300 ms
            this.scene.time.delayedCall(300, () => {
                this.isKnockingBack = false;
            });
            
            // 2. Efekt wibracji ekranu dla mocnych uderzeń (tylko w trybie niskiej wydajności)
            if (actualDamage > 15) {
                try {
                    this.scene.cameras.main.shake(200, 0.005 * actualDamage);
                } catch (error) {
                    logger.warn(`Błąd efektu trzęsienia kamery: ${error.message}`, "PLAYER_DAMAGE");
                }
            }
            
            // 3. Wyświetlenie wartości obrażeń
            const damageText = this.scene.add.text(this.x, this.y - 30, `-${actualDamage}`, {
                fontSize: '20px',
                fill: '#ff0000',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
            
            this.scene.tweens.add({
                targets: damageText,
                y: this.y - 60,
                alpha: 0,
                duration: 1000,
                onComplete: () => damageText.destroy()
            });
            
            // 4. Efekt czerwonego rozbłysku przy mocnych uderzeniach
            if (actualDamage > 10) {
                this.setTint(0xff0000);
                this.scene.time.delayedCall(100, () => this.clearTint());
            }
        }
        
        // Odtwarzamy dźwięk obrażeń (jeśli istnieje)
        try {
            if (this.scene.sound.get('playerHit')) {
                this.scene.sound.play('playerHit', { volume: 0.3 });
            }
        } catch (e) {
            logger.warn(`Błąd odtwarzania dźwięku obrażeń: ${e.message}`, "AUDIO");
        }
        
        // Sprawdzamy czy bohater zginął
        if (this.health <= 0 && !this.isDead) {
            this.die();
        }
    }
    
    // Dodaje punkty doświadczenia
    addExperience(amount) {
        this.experience += amount;
        logger.info(`Dodano ${amount} doświadczenia, łącznie: ${this.experience}`, "PLAYER_ATTACK");
        
        // Sprawdzamy, czy bohater awansował na wyższy poziom
        if (this.experience >= this.experienceToNextLevel) {
            this.levelUp();
        }
    }
    
    // Awans na wyższy poziom
    levelUp() {
        this.level++;
        this.experience -= this.experienceToNextLevel;
        this.experienceToNextLevel = Math.floor(this.experienceToNextLevel * 1.5);
        
        // Zwiększamy statystyki
        this.maxHealth += 20;
        this.health = this.maxHealth; // Pełne życie po awansie
        this.attack += 5;
        this.defense += 2;
        
        // Przy nowych poziomach poprawiamy również mechanikę ruchu
        if (this.level % 3 === 0) {
            this.jumpPower -= 50; // Silniejszy skok
            this.speed += 20;     // Większa prędkość
        }
        
        if (this.level % 5 === 0) {
            this.maxJumps += 1;   // Dodatkowy skok na poziomach 5, 10, 15...
        }
        
        // Aktualizujemy wyświetlanie statystyk
        this.updateStatsBar();
        
        // Pokazujemy efekt aury na chwilę
        if (this.model) {
            this.model.toggleEffect('aura', true);
            this.scene.time.delayedCall(2000, () => {
                this.model.toggleEffect('aura', false);
            });
        }
        
        logger.info(`LEVEL UP! Nowy poziom: ${this.level}, atak: ${this.attack}, obrona: ${this.defense}`, "PLAYER_ATTACK");
        
        // Efekt wizualny awansu
        const levelUpText = this.scene.add.text(this.x, this.y - 80, 'LEVEL UP!', {
            fontSize: '24px',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Animacja tekstu awansu
        this.scene.tweens.add({
            targets: levelUpText,
            y: this.y - 120,
            alpha: 0,
            duration: 1500,
            onComplete: () => {
                levelUpText.destroy();
            }
        });
    }
    
    // Zmienia broń postaci
    changeWeapon(weaponType) {
        if (this.model) {
            this.model.changeWeapon(weaponType);
        }
    }
    
    // Bohater umiera
    die() {
        if (this.isDead) return;
        
        this.isDead = true;
        this.body.enable = false;
        
        logger.warn("Hero zginął!", "PLAYER_DAMAGE");
        
        // Zatrzymujemy bohatera
        this.setVelocity(0, 0);
        
        // Odtwarzamy animację śmierci
        if (this.model) {
            this.model.playAnimation('death');
        }
        
        // Dodajemy tekst śmierci
        const deathText = this.scene.add.text(400, 300, 'GAME OVER', {
            fontSize: '64px',
            fill: '#ff0000',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Animacja tekstu śmierci
        this.scene.tweens.add({
            targets: deathText,
            scale: 1.2,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
        
        // Zatrzymujemy spawning wrogów
        if (this.scene.enemySpawnTimer) {
            this.scene.enemySpawnTimer.remove();
        }
    }
    
    /**
     * Aktualizuje bohatera w każdej klatce
     * @param {number} time - aktualny czas
     * @param {number} delta - czas od ostatniej klatki
     */
    update(time, delta) {
        // Aktualizujemy model wizualny
        if (this.model) {
            // Przekazujemy aktualny stan bohatera do modelu
            this.model.updateFromHeroState({
                x: this.x,
                y: this.y,
                velocityX: this.body.velocity.x,
                velocityY: this.body.velocity.y,
                isGrounded: this.isGrounded,
                isAttacking: time < this.lastAttackTime + this.attackCooldown / 2,
                isDodging: this.isDodging,
                isTakingDamage: false,
                isDead: this.isDead,
                justLanded: this.wasInAir && this.isGrounded
            });
            
            // Aktualizujemy model
            this.model.update(delta);
        }
        
        // Resetujemy flagę wylądowania
        this.wasInAir = !this.isGrounded;
        
        // Aktualizujemy timeoutów i efektów
        if (this.coyoteTimer > 0) {
            this.coyoteTimer -= delta;
        }
        
        if (this.jumpBufferTimer > 0) {
            this.jumpBufferTimer -= delta;
        }
        
        // Aktualizujemy pasek statystyk
        this.updateStatsBar();
    }
    
    // Nowa metoda do poruszania się do wroga tylko w osi X (w stylu Grow Castle)
    moveToEnemyHorizontal(enemy) {
        // Jeśli bohater wykonuje unik, nie zmieniamy jego kierunku
        if (this.isDodging) return;
        
        // Sprawdzamy odległość w poziomie
        const distanceX = enemy.x - this.x;
        
        // Jeśli jesteśmy wystarczająco blisko, zatrzymujemy się
        if (Math.abs(distanceX) <= this.attackRange) {
            this.setVelocityX(0);
            // Ustawiamy właściwy kierunek bohatera
            this.flipX = distanceX < 0;
            return;
        }
        
        // Poruszamy się tylko w poziomie
        const direction = Math.sign(distanceX); // 1 dla ruchu w prawo, -1 dla ruchu w lewo
        this.setVelocityX(direction * this.speed);
        this.flipX = direction < 0;
        
        // Ograniczamy pozycję zgodnie z limitami
        if (this.limitMovement) {
            this.x = Phaser.Math.Clamp(this.x, this.minX, this.maxX);
        }
    }
    
    // Powrót do pozycji startowej
    returnToStartPosition(startX) {
        // Jeśli bohater wykonuje unik, nie zmieniamy jego kierunku
        if (this.isDodging) return;
        
        const distanceX = startX - this.x;
        
        // Jeśli jesteśmy blisko pozycji startowej, zatrzymujemy się
        if (Math.abs(distanceX) < 10) {
            this.setVelocityX(0);
            return;
        }
        
        // Poruszamy się w kierunku pozycji startowej
        const direction = Math.sign(distanceX);
        this.setVelocityX(direction * this.speed);
        this.flipX = direction < 0;
    }
} 