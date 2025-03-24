import { logger } from '../services/LogService.js';

/**
 * Klasa HeroModel - odpowiada za wizualną reprezentację bohatera
 * Implementuje styl podobny do Castle Crashers z warstwowym systemem grafiki
 */
export default class HeroModel {
    constructor(scene, x, y, config = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        
        // Konfiguracja wyglądu bohatera
        this.config = {
            scale: 1.5,                      // Skala bohatera
            bodyColor: 0x3498db,           // Kolor ciała (niebieski)
            outlineColor: 0x000000,        // Kolor konturu
            outlineThickness: 2,           // Grubość konturu
            eyeColor: 0xffffff,            // Kolor oczu
            shadowAlpha: 0.3,              // Przezroczystość cienia
            ...config
        };
        
        // Container przechowujący wszystkie elementy modelu
        this.container = scene.add.container(x, y);
        
        // Bazowa skala
        this.baseScale = this.config.scale;
        
        // Tworzenie warstw graficznych (w kolejności od tyłu do przodu)
        this.layers = {
            shadow: null,     // Cień
            legs: null,       // Nogi
            body: null,       // Ciało
            head: null,       // Głowa
            helmet: null,     // Hełm
            cape: null,       // Peleryna
            weapon: null,     // Broń
            shield: null,     // Tarcza
            effects: null     // Efekty specjalne
        };
        
        // Aktualny stan animacji
        this.animState = {
            current: 'idle',
            frame: 0,
            elapsed: 0,
            duration: 0,
            loop: true,
            flipped: false
        };
        
        // Tworzymy podstawowe kształty bohatera
        this.createBasicShapes();
        
        // Tworzymy system efektów wizualnych
        this.createEffects();
        
        // Konfigurujemy animacje
        this.setupAnimations();
        
        // Domyślna broń (miecz)
        this.currentWeapon = 'sword';
        this.changeWeapon(this.currentWeapon);
        
        // Dodajemy model do sceny
        scene.add.existing(this.container);
        
        // Debugowanie
        this.debugMode = false;
        this.debugText = null;
        this.debugGraphics = null;
    }
    
    /**
     * Tworzy podstawowe kształty bohatera używając grafiki Phaser
     */
    createBasicShapes() {
        const { bodyColor, outlineColor, outlineThickness, eyeColor } = this.config;
        
        // Wyczyść wszystkie istniejące warstwy
        Object.keys(this.layers).forEach(key => {
            if (this.layers[key]) {
                this.layers[key].destroy();
                this.layers[key] = null;
            }
        });
        
        // Tworzymy cień
        const shadow = this.scene.add.graphics();
        shadow.fillStyle(0x000000, this.config.shadowAlpha);
        shadow.fillEllipse(0, 35, 30, 10);
        shadow.setPosition(0, 0);
        this.layers.shadow = shadow;
        
        // Tworzymy nogi
        const legs = this.scene.add.graphics();
        legs.fillStyle(bodyColor, 1);
        legs.lineStyle(outlineThickness, outlineColor, 1);
        legs.fillRect(-10, 12, 20, 25);
        legs.strokeRect(-10, 12, 20, 25);
        this.layers.legs = legs;
        
        // Tworzymy ciało
        const body = this.scene.add.graphics();
        body.fillStyle(bodyColor, 1);
        body.lineStyle(outlineThickness, outlineColor, 1);
        body.fillRect(-15, -10, 30, 25);
        body.strokeRect(-15, -10, 30, 25);
        this.layers.body = body;
        
        // Tworzymy głowę (duża, w stylu Castle Crashers)
        const head = this.scene.add.graphics();
        head.fillStyle(bodyColor, 1);
        head.lineStyle(outlineThickness, outlineColor, 1);
        head.fillCircle(0, -25, 20);
        head.strokeCircle(0, -25, 20);
        
        // Dodajemy oczy
        head.fillStyle(eyeColor, 1);
        head.fillCircle(-8, -25, 4);
        head.fillCircle(8, -25, 4);
        
        // Dodajemy źrenice (domyślnie patrzą w prawo)
        head.fillStyle(0x000000, 1);
        head.fillCircle(-6, -25, 2);
        head.fillCircle(10, -25, 2);
        
        this.layers.head = head;
        
        // Dodajemy wszystkie warstwy do kontenera w odpowiedniej kolejności
        this.container.add([
            this.layers.shadow,
            this.layers.legs,
            this.layers.body,
            this.layers.head
        ]);
        
        // Ustawiamy skalę
        this.container.setScale(this.baseScale);
        
        // Wyłączamy wszelkie elementy debugowania
        Object.values(this.layers).forEach(layer => {
            if (layer) {
                // Wyłączamy wszelkie hitboxy i elementy debugowania
                if (layer.input) {
                    layer.input.hitArea = null;
                    layer.input.hitAreaDebug = null;
                }
                
                // Usuwamy wszelkie pozostałości po debugowaniu
                if (layer.debugGraphics) {
                    layer.debugGraphics.clear();
                    layer.debugGraphics.destroy();
                    layer.debugGraphics = null;
                }
                
                // Upewniamy się, że każda warstwa jest widoczna
                layer.setAlpha(1);
            }
        });
    }
    
    /**
     * Tworzy system efektów wizualnych
     */
    createEffects() {
        // Kontener na efekty
        this.layers.effects = this.scene.add.container(0, 0);
        this.container.add(this.layers.effects);
        
        // Tworzymy emiter cząsteczek dla efektów
        if (this.scene.textures.exists('particle')) {
            // Emiter do efektów ogólnych (zostanie użyty później)
            this.effectsEmitter = this.scene.add.particles(0, 0, 'particle', {
                scale: { start: 0.5, end: 0 },
                speed: { min: 50, max: 100 },
                lifespan: 500,
                frequency: -1, // Na żądanie
                gravityY: 200,
                emitting: false
            });
            
            // Dodajemy metodę explode do emitera cząsteczek
            this.effectsEmitter.explode = (count) => {
                this.effectsEmitter.emitParticle(count);
            };
            
            this.layers.effects.add(this.effectsEmitter);
        } else {
            logger.warn("Brak tekstury 'particle' dla efektów!", "HERO_MODEL");
        }
    }
    
    /**
     * Konfiguruje animacje dla bohatera
     */
    setupAnimations() {
        // Definicje animacji
        this.animations = {
            idle: {
                frames: 4,
                frameDuration: 200,
                loop: true,
                update: (progress, frame) => {
                    // Lekkie przesunięcie góra-dół dla animacji oddychania
                    const offset = Math.sin(progress * Math.PI * 2) * 2;
                    this.layers.head.y = offset - 3;
                    this.layers.body.y = offset / 2;
                }
            },
            run: {
                frames: 6,
                frameDuration: 100,
                loop: true,
                update: (progress, frame) => {
                    // Dynamiczne przesunięcie nóg i ciała
                    const legOffset = Math.sin(progress * Math.PI * 2) * 3;
                    this.layers.legs.y = Math.abs(legOffset);
                    this.layers.body.y = Math.sin(progress * Math.PI * 2) * 1.5;
                    this.layers.head.y = Math.sin(progress * Math.PI * 2) * 1 - 3;
                    
                    // Efekt biegu - cząsteczki pyłu pod stopami
                    if (frame % 3 === 0 && this.effectsEmitter) {
                        this.effectsEmitter.setPosition(0, 30);
                        this.effectsEmitter.explode(3);
                    }
                }
            },
            jump: {
                frames: 3,
                frameDuration: 150,
                loop: false,
                update: (progress, frame) => {
                    // Przygotowanie do skoku
                    if (progress < 0.3) {
                        this.layers.legs.y = 3;
                        this.layers.body.y = 1;
                        this.layers.head.y = 0;
                    } 
                    // Aktywny skok
                    else {
                        this.layers.legs.y = -2;
                        this.layers.body.y = -1;
                        this.layers.head.y = -4;
                    }
                }
            },
            fall: {
                frames: 2,
                frameDuration: 200,
                loop: true,
                update: (progress, frame) => {
                    // Animacja spadania
                    this.layers.legs.y = 4;
                    this.layers.body.y = 1;
                    this.layers.head.y = -2;
                }
            },
            land: {
                frames: 2,
                frameDuration: 100,
                loop: false,
                update: (progress, frame) => {
                    // Przysiad po lądowaniu
                    if (progress < 0.5) {
                        this.layers.legs.y = 5;
                        this.layers.body.y = 3;
                        this.layers.head.y = 0;
                        
                        // Efekt lądowania - pył
                        if (frame === 0 && this.effectsEmitter) {
                            this.effectsEmitter.setPosition(0, 30);
                            this.effectsEmitter.explode(8);
                        }
                    } else {
                        this.layers.legs.y = 2;
                        this.layers.body.y = 1;
                        this.layers.head.y = -3;
                    }
                }
            },
            attack: {
                frames: 4,
                frameDuration: 100,
                loop: false,
                update: (progress, frame) => {
                    if (this.currentWeapon === 'sword' || this.currentWeapon === 'axe') {
                        // Animacja zamachu mieczem lub toporem
                        if (progress < 0.25) {
                            // Zamach w tył
                            this.layers.weapon.angle = -45;
                            this.layers.body.angle = -5;
                        } else if (progress < 0.5) {
                            // Zamach do przodu
                            this.layers.weapon.angle = 60;
                            this.layers.body.angle = 10;
                            
                            // Efekt uderzenia mieczem
                            if (frame === 1 && this.effectsEmitter) {
                                const direction = this.animState.flipped ? -1 : 1;
                                this.effectsEmitter.setPosition(direction * 30, 0);
                                this.effectsEmitter.explode(5);
                            }
                        } else {
                            // Powrót do normalnej pozycji
                            this.layers.weapon.angle = this.animState.flipped ? 135 : 45;
                            this.layers.body.angle = 0;
                        }
                    } else if (this.currentWeapon === 'bow') {
                        // Animacja strzału z łuku
                        if (progress < 0.3) {
                            // Naciąganie
                            this.layers.body.angle = 5;
                        } else if (progress < 0.5) {
                            // Strzał
                            this.layers.body.angle = -5;
                            
                            // Efekt strzału
                            if (frame === 1 && this.effectsEmitter) {
                                const direction = this.animState.flipped ? -1 : 1;
                                this.effectsEmitter.setPosition(direction * 30, 0);
                                this.effectsEmitter.explode(3);
                            }
                        } else {
                            // Powrót do normalnej pozycji
                            this.layers.body.angle = 0;
                        }
                    } else if (this.currentWeapon === 'staff') {
                        // Animacja czarowania
                        if (progress < 0.3) {
                            // Wznoszenie różdżki
                            this.layers.weapon.angle = -30;
                            this.layers.body.angle = -5;
                        } else if (progress < 0.6) {
                            // Czarowanie
                            this.layers.weapon.angle = -60;
                            this.layers.body.angle = -10;
                            
                            // Efekt magii
                            if (frame === 1 && this.effectsEmitter) {
                                const direction = this.animState.flipped ? -1 : 1;
                                this.effectsEmitter.setPosition(direction * 20, -20);
                                
                                // Zmiana koloru cząsteczek na niebieski
                                this.effectsEmitter.setTint(0x00ffff);
                                this.effectsEmitter.explode(10);
                                
                                // Powrót do normalnego koloru
                                setTimeout(() => this.effectsEmitter.setTint(0xffffff), 100);
                            }
                        } else {
                            // Powrót do normalnej pozycji
                            this.layers.weapon.angle = this.animState.flipped ? 135 : 45;
                            this.layers.body.angle = 0;
                        }
                    }
                }
            },
            damage: {
                frames: 2,
                frameDuration: 100,
                loop: false,
                update: (progress, frame) => {
                    // Odrzut przy otrzymaniu obrażeń
                    if (progress < 0.5) {
                        this.layers.body.angle = this.animState.flipped ? 10 : -10;
                        this.layers.head.angle = this.animState.flipped ? 15 : -15;
                        
                        // Mruganie na czerwono
                        this.container.setTint(0xff0000);
                    } else {
                        this.layers.body.angle = 0;
                        this.layers.head.angle = 0;
                        
                        // Powrót do normalnego koloru
                        this.container.clearTint();
                    }
                }
            },
            death: {
                frames: 4,
                frameDuration: 150,
                loop: false,
                update: (progress, frame) => {
                    // Animacja śmierci
                    this.layers.body.angle = 90;
                    this.layers.head.angle = 45;
                    this.layers.legs.angle = 45;
                    
                    // Upadek
                    this.layers.body.y = 5 + progress * 10;
                    this.layers.head.y = progress * 10;
                    this.layers.legs.y = 5 + progress * 10;
                    
                    // Zanikanie
                    this.container.alpha = 1 - progress * 0.7;
                    
                    // Efekty śmierci
                    if (frame === 0 && this.effectsEmitter) {
                        this.effectsEmitter.setPosition(0, 0);
                        this.effectsEmitter.explode(15);
                    }
                }
            },
            dodge: {
                frames: 4,
                frameDuration: 75,
                loop: false,
                update: (progress, frame) => {
                    // Animacja uniku (obrót ciała)
                    if (progress < 0.5) {
                        this.layers.body.angle = this.animState.flipped ? 30 : -30;
                        this.layers.head.angle = this.animState.flipped ? 15 : -15;
                        this.layers.legs.angle = this.animState.flipped ? 15 : -15;
                        
                        // Efekt uniku - cząsteczki
                        if (frame === 0 && this.effectsEmitter) {
                            this.effectsEmitter.setPosition(0, 15);
                            this.effectsEmitter.explode(8);
                        }
                    } else {
                        // Powrót do normalnej pozycji
                        this.layers.body.angle = 0;
                        this.layers.head.angle = 0;
                        this.layers.legs.angle = 0;
                    }
                }
            }
        };
    }
    
    /**
     * Odtwarza określoną animację
     * @param {string} animation - nazwa animacji do odtworzenia
     */
    playAnimation(animation) {
        if (!this.animations[animation]) {
            logger.warn(`Animacja '${animation}' nie istnieje!`, "HERO_MODEL");
            return;
        }
        
        // Nie restartujemy tej samej animacji zapętlonej
        if (this.animState.current === animation && this.animState.loop) {
            return;
        }
        
        const anim = this.animations[animation];
        
        this.animState = {
            current: animation,
            frame: 0,
            elapsed: 0,
            duration: anim.frameDuration,
            loop: anim.loop,
            flipped: this.animState.flipped
        };
        
        logger.debug(`Odtwarzam animację: ${animation}`, "HERO_ANIMATION");
    }
    
    /**
     * Aktualizuje animację postaci w każdej klatce
     * @param {number} delta - czas od ostatniej klatki w ms
     */
    update(delta) {
        if (!this.animState.current) return;
        
        const anim = this.animations[this.animState.current];
        if (!anim) return;
        
        // Aktualizujemy stan animacji
        this.animState.elapsed += delta;
        
        // Sprawdzamy czy czas na następną klatkę
        if (this.animState.elapsed >= this.animState.duration) {
            this.animState.frame++;
            this.animState.elapsed = 0;
            
            // Zapętlanie lub zatrzymanie
            if (this.animState.frame >= anim.frames) {
                if (anim.loop) {
                    this.animState.frame = 0;
                } else {
                    this.animState.frame = anim.frames - 1;
                    
                    // Przełączamy na idle po zakończeniu niezapętlonej animacji
                    if (this.animState.current !== 'idle' && this.animState.current !== 'death') {
                        this.scene.time.delayedCall(100, () => {
                            this.playAnimation('idle');
                        });
                    }
                }
            }
        }
        
        // Aktualizujemy wygląd na podstawie aktualnej klatki animacji
        if (anim.update) {
            anim.update(this.animState.frame / anim.frames, this.animState.frame);
        }
        
        // Aktualizujemy pozycję kontenera
        this.container.x = this.x;
        this.container.y = this.y;
        
        // Upewniamy się, że wszystkie warstwy są prawidłowo widoczne i ustawione
        Object.values(this.layers).forEach(layer => {
            if (layer && layer.setVisible) {
                layer.setVisible(true);
            }
        });
        
        // Czyszczenie wszystkich elementów debugowania
        if (this.debugGraphics) {
            this.debugGraphics.clear();
            this.debugGraphics.visible = false;
        }
    }
    
    /**
     * Ustala kierunek bohatera na podstawie prędkości
     * @param {number} velocityX - prędkość pozioma
     */
    setDirection(velocityX) {
        const wasFlipped = this.animState.flipped;
        
        // Zmieniamy kierunek tylko gdy mamy wyraźny ruch
        if (Math.abs(velocityX) > 1) {
            this.animState.flipped = velocityX < 0;
            
            // Odbicie wszystkich warstw
            if (wasFlipped !== this.animState.flipped) {
                Object.values(this.layers).forEach(layer => {
                    if (layer) {
                        layer.scaleX = this.animState.flipped ? -1 : 1;
                    }
                });
                
                // Korekcja pozycji broni przy odbiciu
                if (this.layers.weapon) {
                    this.layers.weapon.angle = this.animState.flipped ? 135 : 45;
                }
            }
        }
    }
    
    /**
     * Aktualizuje stan modelu na podstawie stanu bohatera
     * @param {object} heroState - stan bohatera
     */
    updateFromHeroState(heroState) {
        // Aktualizujemy pozycję
        this.x = heroState.x;
        this.y = heroState.y;
        
        // Aktualizujemy kierunek na podstawie prędkości
        this.setDirection(heroState.velocityX);
        
        // Wybieramy odpowiednią animację na podstawie stanu
        if (heroState.isDead) {
            this.playAnimation('death');
        }
        else if (heroState.isAttacking) {
            this.playAnimation('attack');
        }
        else if (heroState.isDodging) {
            this.playAnimation('dodge');
        }
        else if (heroState.isTakingDamage) {
            this.playAnimation('damage');
        }
        else if (!heroState.isGrounded) {
            if (heroState.velocityY < 0) {
                this.playAnimation('jump');
            } else {
                this.playAnimation('fall');
            }
        }
        else if (Math.abs(heroState.velocityX) > 10) {
            this.playAnimation('run');
        }
        else if (heroState.justLanded) {
            this.playAnimation('land');
        }
        else {
            this.playAnimation('idle');
        }
    }
    
    /**
     * Zmienia broń bohatera
     * @param {string} weaponType - typ broni ('sword', 'axe', 'bow', 'staff')
     */
    changeWeapon(weaponType) {
        // Usuwamy istniejącą broń
        if (this.layers.weapon) {
            this.layers.weapon.destroy();
            this.container.remove(this.layers.weapon);
            this.layers.weapon = null;
        }
        
        // Ustawiamy nową broń
        this.currentWeapon = weaponType;
        
        // Tworzymy nową broń
        const weapon = this.scene.add.graphics();
        const { outlineColor, outlineThickness } = this.config;
        
        // Ustawiamy kolor broni w zależności od typu
        let weaponColor;
        switch (weaponType) {
            case 'axe':
                weaponColor = 0xB8B8B8; // Srebrny
                break;
            case 'bow':
                weaponColor = 0x8B4513; // Brązowy
                break;
            case 'staff':
                weaponColor = 0x9370DB; // Fioletowy
                break;
            case 'sword':
            default:
                weaponColor = 0xC0C0C0; // Srebrny
                break;
        }
        
        // Rysujemy broń
        weapon.clear();  // Wyczyść grafikę przed rysowaniem
        weapon.fillStyle(weaponColor, 1);
        weapon.lineStyle(outlineThickness, outlineColor, 1);
        
        if (weaponType === 'sword') {
            // Miecz
            weapon.fillRect(-2, -25, 4, 30);
            weapon.strokeRect(-2, -25, 4, 30);
            // Rękojeść
            weapon.fillStyle(0x8B4513, 1);
            weapon.fillRect(-5, 5, 10, 5);
            weapon.lineStyle(outlineThickness, outlineColor, 1);
            weapon.strokeRect(-5, 5, 10, 5);
        } else if (weaponType === 'axe') {
            // Trzonek topora
            weapon.fillRect(-2, -20, 4, 30);
            weapon.strokeRect(-2, -20, 4, 30);
            // Ostrze topora
            weapon.fillRect(-2, -20, 15, 15);
            weapon.strokeRect(-2, -20, 15, 15);
            // Rękojeść
            weapon.fillStyle(0x8B4513, 1);
            weapon.fillRect(-5, 10, 10, 5);
            weapon.lineStyle(outlineThickness, outlineColor, 1);
            weapon.strokeRect(-5, 10, 10, 5);
        } else if (weaponType === 'bow') {
            // Łuk
            weapon.lineStyle(3, 0x8B4513, 1);
            weapon.beginPath();
            weapon.arc(-5, 0, 15, -Math.PI * 0.3, Math.PI * 0.3, false);
            weapon.strokePath();
            // Cięciwa
            weapon.lineStyle(1, 0xffffff, 1);
            weapon.lineBetween(0, -9, 0, 9);
            // Strzała
            weapon.lineStyle(2, 0xB8860B, 1);
            weapon.lineBetween(0, 0, 15, 0);
            // Grot strzały
            weapon.fillStyle(0x808080, 1);
            weapon.fillTriangle(15, 0, 20, -3, 20, 3);
            weapon.lineStyle(outlineThickness, outlineColor, 1);
            weapon.strokeTriangle(15, 0, 20, -3, 20, 3);
        } else if (weaponType === 'staff') {
            // Różdżka/kostur
            weapon.fillRect(-2, -30, 4, 40);
            weapon.strokeRect(-2, -30, 4, 40);
            // Kula na końcu
            weapon.fillStyle(0x9370DB, 1);
            weapon.fillCircle(0, -30, 8);
            weapon.lineStyle(outlineThickness, outlineColor, 1);
            weapon.strokeCircle(0, -30, 8);
        }
        
        // Dodajemy broń do warstw
        this.layers.weapon = weapon;
        this.container.add(weapon);
        
        // Ustawiamy pozycję i rotację broni
        weapon.x = 20;
        weapon.y = 0;
        weapon.angle = this.animState.flipped ? 135 : 45;
        weapon.scaleX = this.animState.flipped ? -1 : 1;
        
        // Wyłączamy wszelkie elementy debugowania
        if (weapon.input) {
            weapon.input.hitArea = null;
            weapon.input.hitAreaDebug = null;
        }
        
        // Usuwamy wszelkie obiekty debugowania, które mogą być dołączone do broni
        if (weapon.debugGraphics) {
            weapon.debugGraphics.clear();
            weapon.debugGraphics.destroy();
            weapon.debugGraphics = null;
        }
        
        // Wyłączamy automatyczne wysyłanie inputów
        if (weapon.inputEnabled) {
            weapon.inputEnabled = false;
        }
        
        logger.debug(`Zmieniono broń na: ${weaponType}`, "HERO_MODEL");
        
        return this;
    }
    
    /**
     * Włącza/wyłącza tryb debugowania
     * @param {boolean} enabled - czy tryb debugowania ma być włączony
     */
    setDebug(enabled) {
        this.debugMode = enabled;
        
        // Usuń wszelkie elementy debugowania
        if (this.debugText) {
            this.debugText.destroy();
            this.debugText = null;
        }
        
        // Usuń wszelkie granice pomocnicze
        if (this.debugGraphics) {
            this.debugGraphics.destroy();
            this.debugGraphics = null;
        }
        
        if (enabled) {
            this.debugText = this.scene.add.text(this.x - 50, this.y - 100, '', {
                fontSize: '12px',
                fill: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 5, y: 5 }
            });
            
            // Tworzenie nowej grafiki debugowania bez hitboxów
            this.debugGraphics = this.scene.add.graphics();
            this.debugGraphics.setDepth(100); // Ustawiamy wysoką wartość głębi
        }
    }
    
    /**
     * Niszczy model i zwalnia zasoby
     */
    destroy() {
        // Niszczymy wszystkie warstwy
        Object.values(this.layers).forEach(layer => {
            if (layer) layer.destroy();
        });
        
        // Niszczymy kontener
        this.container.destroy();
        
        // Niszczymy tekst debugowania
        if (this.debugText) this.debugText.destroy();
        
        // Niszczymy grafikę debugowania
        if (this.debugGraphics) this.debugGraphics.destroy();
        
        logger.debug("Model bohatera zniszczony", "HERO_MODEL");
    }
} 