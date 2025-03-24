import { logger } from '../../services/LogService.js';
import Hero from '../../entities/Hero.js';

export default class PlayerSystem {
    constructor(scene) {
        this.scene = scene;
        this.hero = null;
        
        // Stałe dla pozycji gracza
        this.GROUND_LEVEL = 500; // Poziom ziemi
        this.HERO_START_X = 200; // Pozycja startowa bohatera
        
        // Referencje do klawiszy sterowania
        this.jumpKey = null;
        this.dodgeKey = null;
        this.attackKey = null;  // Nowy klawisz do ataku
        this.weaponChangeKey = null; // Klawisz do zmiany broni
        
        // Debugowanie systemu ruchu
        this.debugMovement = false;
        this.debugText = null;
        
        // Dostępne bronie
        this.availableWeapons = ['sword', 'axe', 'staff', 'bow'];
        this.currentWeaponIndex = 0;
    }
    
    createHero() {
        // Tworzymy bohatera na ziemi - teraz synchronicznie
        this.hero = new Hero(this.scene, this.HERO_START_X, this.GROUND_LEVEL - 25);
        
        // Ograniczamy poruszanie bohatera tylko do lewej-prawej
        this.hero.setLimitedMovement(150, 600); // Pozwala poruszać się tylko w zakresie x od 150 do 600
        
        // Dodajemy niestandardowe klawisze sterowania
        this.setupControls();
        
        // Tworzymy platformę-podłoże dla bohatera, aby działała grawitacja
        this.createGround();
        
        // Ustawiamy domyślną broń
        this.hero.changeWeapon(this.availableWeapons[this.currentWeaponIndex]);
        
        // Tworzenie debugowego tekstu (opcjonalnie)
        if (this.debugMovement) {
            this.debugText = this.scene.add.text(10, 10, '', {
                fontSize: '14px',
                fill: '#ffffff'
            });
            this.debugText.setScrollFactor(0);
            this.debugText.setDepth(1000);
        }
        
        logger.info("PlayerSystem: Utworzono bohatera", "PLAYER_SYSTEM");
        
        return this.hero;
    }
    
    // Tworzy podłoże, po którym porusza się bohater
    createGround() {
        try {
            // Sprawdzamy, czy mamy dostęp do sceny i fizyki
            if (!this.scene || !this.scene.physics || !this.hero) {
                logger.warn("Nie można utworzyć podłoża - brak dostępu do sceny, fizyki lub bohatera", "PLAYER_SYSTEM");
                return;
            }

            // Tworzymy niewidoczną platformę na poziomie GROUND_LEVEL
            this.ground = this.scene.physics.add.staticGroup();
            
            // Tworzymy teksturę podłoża bezpośrednio za pomocą Graphics
            if (!this.scene.textures.exists('ground')) {
                const groundGraphics = this.scene.make.graphics({x: 0, y: 0, add: false});
                groundGraphics.fillStyle(0x8B4513); // Brązowy
                groundGraphics.fillRect(0, 0, 800, 20);
                groundGraphics.generateTexture('ground', 800, 20);
                logger.info("Utworzono tymczasową teksturę podłoża", "PLAYER_SYSTEM");
            }
            
            // Teraz możemy bezpiecznie utworzyć platformę
            this.ground.create(400, this.GROUND_LEVEL, 'ground')
                .setScale(2, 0.1) // Szeroka, ale cienka platforma
                .setVisible(false) // Niewidoczna, bo mamy już grafikę ziemi
                .refreshBody();
            
            // Dodajemy kolizję bohatera z podłożem
            this.scene.physics.add.collider(this.hero, this.ground, () => {
                // Resetujemy skok gdy bohater dotyka podłoża
                if (this.hero) {
                    this.hero.resetJump();
                }
            });
            
            logger.info("Utworzono podłoże dla bohatera", "PLAYER_SYSTEM");
        } catch (error) {
            logger.error(`Błąd podczas tworzenia podłoża: ${error.message}`, "PLAYER_SYSTEM");
            // Mimo błędu, próbujemy dodać resetowanie skoku przy kolizji z dolną granicą świata
            if (this.hero) {
                this.hero.onWorldBounds = function(body) {
                    if (body.blocked.down) {
                        this.resetJump();
                    }
                };
            }
        }
    }
    
    // Konfiguruje dodatkowe klawisze sterowania dla nowych mechanik
    setupControls() {
        if (!this.scene.input || !this.scene.input.keyboard) {
            logger.error("Nie można skonfigurować klawiszy - brak dostępu do klawiatury", "PLAYER_SYSTEM");
            return;
        }
        
        // Klawisz W do skoku
        this.jumpKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        
        // Klawisz SPACJA do uniku
        this.dodgeKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Klawisz E do ataku
        this.attackKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        
        // Klawisz Q do zmiany broni
        this.weaponChangeKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.weaponChangeKey.on('down', () => {
            // Zmieniamy broń na następną z listy
            this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.availableWeapons.length;
            if (this.hero) {
                this.hero.changeWeapon(this.availableWeapons[this.currentWeaponIndex]);
            }
            
            // Wyświetlamy informację o zmianie broni
            const weaponText = this.scene.add.text(this.hero.x, this.hero.y - 80, 
                `Broń: ${this.availableWeapons[this.currentWeaponIndex].toUpperCase()}`, {
                fontSize: '18px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
            
            // Animacja tekstu
            this.scene.tweens.add({
                targets: weaponText,
                y: weaponText.y - 30,
                alpha: 0,
                duration: 1000,
                onComplete: () => weaponText.destroy()
            });
        });
        
        // Klawisz F5 do przełączania debugowania (opcjonalnie)
        const debugKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F5);
        debugKey.on('down', () => {
            this.debugMovement = !this.debugMovement;
            if (this.debugText) {
                this.debugText.setVisible(this.debugMovement);
            } else if (this.debugMovement) {
                this.debugText = this.scene.add.text(10, 10, '', {
                    fontSize: '14px',
                    fill: '#ffffff'
                });
                this.debugText.setScrollFactor(0);
                this.debugText.setDepth(1000);
            }
        });
        
        // Wyświetlamy informację o nowych sterowaniach
        const controlsInfo = this.scene.add.text(400, 200, 
            'STEROWANIE:\n' +
            'A/D - ruch w lewo/prawo\n' +
            'W - skok (podwójny skok)\n' +
            'SPACJA - unik\n' +
            'E - atak\n' +
            'Q - zmiana broni\n' +
            'F5 - debugowanie ruchu',
            {
                fontSize: '18px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            }
        ).setOrigin(0.5);
        
        // Animacja znikania
        this.scene.tweens.add({
            targets: controlsInfo,
            alpha: 0,
            y: 180,
            delay: 5000,
            duration: 1000,
            onComplete: () => {
                controlsInfo.destroy();
            }
        });
    }
    
    getHero() {
        return this.hero;
    }
    
    update(time, delta, cursors) {
        if (this.hero) {
            // Przekazujemy czas i delta do aktualizacji bohatera
            this.hero.update(time, delta, cursors);
            
            // Obsługa ruchu w lewo i prawo
            if (!window.gameData.autoMode && cursors) {
                // Sterowanie tylko jeśli bohater nie jest odrzucany
                if (!this.hero.isKnockingBack && !this.hero.isDodging) {
                    if (cursors.left && cursors.left.isDown) {
                        // Ruch w lewo
                        this.hero.setVelocityX(-this.hero.speed);
                        this.hero.flipX = true;
                    } else if (cursors.right && cursors.right.isDown) {
                        // Ruch w prawo
                        this.hero.setVelocityX(this.hero.speed);
                        this.hero.flipX = false;
                    } else {
                        // Zatrzymanie, gdy nie naciskamy klawiszy
                        this.hero.setVelocityX(0);
                    }
                }
            }
            
            // Obsługujemy skok - tylko jeśli klawiatura jest dostępna i nie jesteśmy w trybie auto
            if (!window.gameData.autoMode && this.jumpKey) {
                // Zamiast używać JustDown, które może powodować błędy, używamy własnej logiki
                const isJumpKeyDown = this.jumpKey.isDown;
                
                if (isJumpKeyDown && !this._jumpKeyWasDown) {
                    this.hero.jump();
                }
                
                this._jumpKeyWasDown = isJumpKeyDown;
            }
            
            // Obsługujemy unik - tylko jeśli klawiatura jest dostępna i nie jesteśmy w trybie auto
            if (!window.gameData.autoMode && this.dodgeKey) {
                // Zamiast używać JustDown, które może powodować błędy, używamy własnej logiki
                const isDodgeKeyDown = this.dodgeKey.isDown;
                
                if (isDodgeKeyDown && !this._dodgeKeyWasDown) {
                    // Określamy kierunek uniku na podstawie aktualnego kierunku bohatera
                    let dodgeDirection = 0;
                    
                    if (cursors && cursors.left && cursors.left.isDown) {
                        dodgeDirection = -1;
                    } else if (cursors && cursors.right && cursors.right.isDown) {
                        dodgeDirection = 1;
                    } else {
                        dodgeDirection = this.hero.flipX ? -1 : 1;
                    }
                    
                    this.hero.dodge(dodgeDirection);
                }
                
                this._dodgeKeyWasDown = isDodgeKeyDown;
            }
            
            // Obsługujemy atak - tylko jeśli klawiatura jest dostępna i nie jesteśmy w trybie auto
            if (!window.gameData.autoMode && this.attackKey) {
                const isAttackKeyDown = this.attackKey.isDown;
                
                if (isAttackKeyDown && !this._attackKeyWasDown && this.hero.canAttack()) {
                    this.hero.attack();
                }
                
                this._attackKeyWasDown = isAttackKeyDown;
            }
            
            // Aktualizacja debugowego tekstu
            if (this.debugMovement && this.debugText) {
                this.debugText.setText([
                    `Pozycja: (${Math.floor(this.hero.x)}, ${Math.floor(this.hero.y)})`,
                    `Prędkość: (${Math.floor(this.hero.body.velocity.x)}, ${Math.floor(this.hero.body.velocity.y)})`,
                    `Na ziemi: ${this.hero.isGrounded}`,
                    `Skok: ${this.hero.jumpCount}/${this.hero.maxJumps}`,
                    `Coyote Time: ${Math.floor(this.hero.coyoteTimer)}ms`,
                    `Jump Buffer: ${Math.floor(this.hero.jumpBufferTimer)}ms`,
                    `Broń: ${this.availableWeapons[this.currentWeaponIndex]}`
                ]);
            }
            
            // Tryb automatyczny - bohater sam podąża do najbliższego wroga
            if (window.gameData.autoMode && this.scene.enemySystem) {
                const closestEnemy = this.scene.enemySystem.findClosestEnemy(this.hero);
                if (closestEnemy) {
                    this.hero.moveToEnemyHorizontal(closestEnemy);
                    
                    // W trybie auto, wykonujemy skok, gdy wróg jest blisko
                    const distanceX = Math.abs(this.hero.x - closestEnemy.x);
                    if (distanceX < 200 && this.hero.isGrounded && Math.random() < 0.01) {
                        this.hero.jump();
                    }
                    
                    // W trybie auto, wykonujemy unik, gdy wróg jest bardzo blisko
                    if (distanceX < 80 && Math.random() < 0.005) {
                        // Kierunek uniku zależy od pozycji wroga
                        const dodgeDirection = closestEnemy.x < this.hero.x ? 1 : -1;
                        this.hero.dodge(dodgeDirection);
                    }
                    
                    // W trybie auto, atakujemy gdy wróg jest w zasięgu
                    if (distanceX < this.hero.attackRange && this.hero.canAttack()) {
                        this.hero.attack();
                    }
                } else {
                    // Jeśli nie ma wrogów, wróć do pozycji startowej
                    this.hero.returnToStartPosition(this.HERO_START_X);
                }
            }
        }
    }
} 