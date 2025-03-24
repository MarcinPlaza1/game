import { logger } from '../services/LogService.js';

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, health = 100, damage = 10, speed = 50) {
        super(scene, x, y, 'enemy');
        
        // Dodajemy sprite'a do sceny i włączamy fizykę
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Tworzymy grafikę dla wroga bezpośrednio w scenie zamiast jako dziecko
        this.enemyBody = scene.add.rectangle(x, y, 40, 40, 0xffffff);
        
        // Statystyki wroga
        this.health = health;
        this.maxHealth = health;
        this.attack = damage;  // Wartość ataku wroga
        this.defense = 5;      // Obrona wroga - dodajemy nową statystykę
        this.speed = speed;
        this.experienceValue = 20; // Wartość doświadczenia za pokonanie tego wroga
        this.attackCooldown = 1000; // czas w ms między atakami
        this.lastAttackTime = 0;
        this.isDead = false;
        
        // Właściwości typu wroga
        this.enemyType = 'STANDARD'; // Domyślnie standardowy wróg
        this.specialAbilityCooldown = 5000; // 5 sekund między użyciem specjalnych zdolności
        this.lastSpecialAbilityTime = 0;
        
        // Właściwości dla przeciwnika dystansowego
        this.isRanged = false;          // Czy wróg jest dystansowy
        this.projectileSpeed = 150;     // Prędkość pocisków
        this.attackRange = 250;         // Zasięg ataku - domyślnie
        this.projectiles = [];          // Tablica przechowująca aktywne pociski
        this.shootCooldown = 2000;      // Czas odnowienia strzału (ms)
        this.lastShootTime = 0;         // Czas ostatniego strzału
        this.stopDistance = 350;        // Odległość, w której wróg się zatrzymuje, żeby strzelać
        
        // Ustawienia dla ruchu w stylu Grow Castle
        this.horizontalMovementOnly = false;
        this.targetX = 0; // Cel w kierunku zamku (lewo)
        
        // Ustawienia kolizji
        this.setCollideWorldBounds(false); // Wyłączamy kolizję z granicami, aby wrogi mogły zniknąć poza ekranem
        this.setSize(40, 40);
        this.setOffset(4, 8);
        
        // Zapisujemy referencje do dźwięków, ale ich nie odtwarzamy
        try {
            // Tworzymy atrapy dźwięków
            this.attackSound = { 
                play: function() { 
                    console.log('Dźwięk ataku wroga (atrapa)'); 
                } 
            };
            this.deathSound = { 
                play: function() { 
                    console.log('Dźwięk śmierci wroga (atrapa)'); 
                } 
            };
            
            // Próbujemy załadować rzeczywiste dźwięki tylko jeśli są dostępne
            if (scene.sound && typeof scene.sound.add === 'function') {
                const testSound = scene.sound.add('attack', { volume: 0 });
                // Jeśli udało się stworzyć obiekt dźwiękowy, zastępujemy atrapy
                this.attackSound = testSound;
                this.deathSound = scene.sound.add('enemyDeath', { volume: 0 });
            }
        } catch (error) {
            logger.warn(`Nie można załadować dźwięków: ${error.message}`, "ENEMY_SPAWN");
            // Atrapy już są zdefiniowane powyżej, więc nie trzeba tu nic robić
        }
        
        // Pasek zdrowia
        this.healthBarBg = scene.add.rectangle(x, y - 30, 40, 5, 0x333333);
        this.healthBar = scene.add.rectangle(x, y - 30, 40, 5, 0x00ff00);
        
        // Etykieta z nazwą typu wroga
        this.levelText = scene.add.text(x, y - 40, `Wróg`, {
            fontSize: '12px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        // Dodajemy efekt cząsteczkowy dla BOSS-a i innych specjalnych typów
        this.particles = null;
        this.effectTimers = []; // Tablica do przechowywania timerów efektów
        this.effectObjects = []; // Tablica do przechowywania obiektów efektów
        
        // Dostosowujemy rozmiar sprite'a
        this.setScale(0.8);
        
        // W stylu Grow Castle wrogowie idą od prawej do lewej
        this.flipX = true;
        
        // Logowanie utworzenia nowego wroga
        logger.info(`Nowy wróg utworzony: x=${x}, y=${y}, health=${health}, speed=${speed}`, "ENEMY_SPAWN");
    }
    
    // Ustawia typ wroga i aktualizuje jego wygląd
    setEnemyType(enemyType) {
        this.enemyType = enemyType;
        const enemyTypeData = this.getEnemyTypeData();
        
        if (enemyTypeData) {
            // Aktualizuj kolor i rozmiar wroga
            if (this.enemyBody) {
                this.enemyBody.fillColor = enemyTypeData.color;
                this.enemyBody.width = 40 * enemyTypeData.scale;
                this.enemyBody.height = 40 * enemyTypeData.scale;
            }
            
            this.setTint(enemyTypeData.color);
            this.setScale(enemyTypeData.scale);
            
            // Aktualizuj nazwę
            if (this.levelText) {
                this.levelText.setText(enemyTypeData.name);
            }
        }
    }
    
    // Zwraca dane typu wroga z definicji
    getEnemyTypeData() {
        const ENEMY_TYPES = {
            MINION: {
                name: 'Pajątek',
                healthMultiplier: 0.6,
                damageMultiplier: 0.7,
                speedMultiplier: 1.5,
                experienceMultiplier: 0.5,
                color: 0x88ff88, // Jasnozielony
                scale: 0.6
            },
            STANDARD: {
                name: 'Goblin',
                healthMultiplier: 1.0,
                damageMultiplier: 1.0,
                speedMultiplier: 1.0,
                experienceMultiplier: 1.0,
                color: 0xffffff, // Biały (domyślny)
                scale: 0.8
            },
            TANK: {
                name: 'Ork',
                healthMultiplier: 2.0,
                damageMultiplier: 0.8,
                speedMultiplier: 0.6,
                experienceMultiplier: 1.5,
                color: 0xff8844, // Pomarańczowy
                scale: 1.0
            },
            BERSERKER: {
                name: 'Berserker',
                healthMultiplier: 0.8,
                damageMultiplier: 1.7,
                speedMultiplier: 1.3,
                experienceMultiplier: 1.3,
                color: 0xff5555, // Czerwony
                scale: 0.85
            },
            RANGED: {
                name: 'Łucznik',
                healthMultiplier: 0.7,
                damageMultiplier: 1.2,
                speedMultiplier: 0.9,
                experienceMultiplier: 1.2,
                color: 0x5555ff, // Niebieski
                scale: 0.75
            },
            BOSS: {
                name: 'BOSS',
                healthMultiplier: 4.0,
                damageMultiplier: 2.0,
                speedMultiplier: 0.7,
                experienceMultiplier: 3.0,
                color: 0xffcc00, // Złoty
                scale: 1.2
            }
        };
        
        return ENEMY_TYPES[this.enemyType];
    }
    
    // Nowa metoda resetująca wroga - używana przy poolingu obiektów
    reset(x, y, health, damage, speed) {
        // Resetujemy pozycję
        this.setPosition(x, y);
        
        // Zawsze tworzymy nowy element graficzny, jeśli nie istnieje
        if (!this.enemyBody || this.enemyBody.destroyed) {
            this.enemyBody = this.scene.add.rectangle(x, y, 40, 40, 0xffffff);
        } else {
            // W przeciwnym razie aktualizujemy pozycję istniejącego
            this.enemyBody.x = x;
            this.enemyBody.y = y;
            this.enemyBody.fillColor = 0xffffff;
            this.enemyBody.setVisible(true);
            this.enemyBody.setAlpha(1);
        }
        
        // Resetujemy statystyki
        this.health = health;
        this.maxHealth = health;
        this.attack = damage;
        this.speed = speed;
        this.isDead = false;
        this.lastAttackTime = 0;
        this.lastSpecialAbilityTime = 0;
        
        // Resetujemy prędkość
        this.setVelocity(0, 0);
        
        // Resetujemy wygląd
        this.setAlpha(1);
        
        // Upewniamy się, że ciało wroga jest widoczne
        if (this.enemyBody) {
            this.enemyBody.fillColor = 0xffffff;
            this.enemyBody.setVisible(true);
        }
        
        // Tworzymy nowe obiekty UI, jeśli poprzednie zostały zniszczone
        if (!this.healthBarBg) {
            this.healthBarBg = this.scene.add.rectangle(x, y - 30, 40, 5, 0x333333);
        } else {
            this.healthBarBg.setPosition(x, y - 30);
            this.healthBarBg.width = 40;
            this.healthBarBg.setVisible(true);
        }
        
        if (!this.healthBar) {
            this.healthBar = this.scene.add.rectangle(x, y - 30, 40, 5, 0x00ff00);
        } else {
            this.healthBar.setPosition(x, y - 30);
            this.healthBar.width = 40;
            this.healthBar.setVisible(true);
        }
        
        if (!this.levelText) {
            this.levelText = this.scene.add.text(x, y - 40, 'Wróg', {
                fontSize: '12px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);
        } else {
            this.levelText.setPosition(x, y - 40);
            this.levelText.setText('Wróg');
            this.levelText.setVisible(true);
        }
        
        // Kasujemy efekty specjalne
        this.clearEffects();
        
        // Jeśli to wróg dystansowy, czyścimy pociski
        if (this.isRanged) {
            // Usuwamy wszystkie pociski
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const projData = this.projectiles[i];
                
                // Zatrzymujemy emiter śladu
                if (projData.trailEmitter) {
                    projData.trailEmitter.remove();
                }
                
                // Niszczymy pocisk
                if (projData.projectile && projData.projectile.active) {
                    projData.projectile.destroy();
                }
            }
            this.projectiles = [];
        }
        
        return this;
    }
    
    // Metoda czyszcząca wszystkie efekty
    clearEffects() {
        // Zatrzymujemy wszystkie timery efektów
        this.effectTimers.forEach(timer => {
            if (timer && timer.remove) {
                timer.remove();
            }
        });
        this.effectTimers = [];
        
        // Usuwamy wszystkie obiekty efektów
        this.effectObjects.forEach(effect => {
            if (effect && !effect.destroyed) {
                effect.destroy();
            }
        });
        this.effectObjects = [];
        
        // Usuwamy tarczę, jeśli istnieje
        if (this.shield && !this.shield.destroyed) {
            this.shield.destroy();
            this.shield = null;
        }
        
        // Usuwamy emiter cząstek, jeśli istnieje
        if (this.particles) {
            this.particles.destroy();
            this.particles = null;
        }
    }
    
    // Ustawia ruch tylko w poziomie dla stylu Grow Castle
    setHorizontalMovement(enabled) {
        this.horizontalMovementOnly = enabled;
        logger.debug(`Ustawiono horizontalMovementOnly na ${enabled}`, "ENEMY_SPAWN");
    }
    
    createAnimations() {
        // Usunięte animacje, ponieważ używamy statycznego obrazu
    }
    
    // Inicjalizuje efekty specjalne dla danego typu wroga
    initSpecialEffects() {
        // Usuwamy istniejące efekty
        this.clearEffects();
        
        // Dodajemy efekty cząsteczkowe w zależności od typu wroga
        switch (this.enemyType) {
            case 'BOSS':
                // Złote cząsteczki wokół bossa - uproszczona wersja z ograniczoną częstotliwością
                const bossTimer = this.scene.time.addEvent({
                    delay: 250, // Zwiększona przerwa między cząsteczkami z 100 do 250ms
                    callback: () => {
                        if (!this.isDead && this.active) {
                            const particle = this.scene.add.circle(
                                this.x + Phaser.Math.Between(-20, 20),
                                this.y + Phaser.Math.Between(-20, 20),
                                Phaser.Math.Between(3, 8),
                                0xffcc00,
                                0.7
                            );
                            
                            this.effectObjects.push(particle);
                            
                            this.scene.tweens.add({
                                targets: particle,
                                alpha: 0,
                                scale: 0.5,
                                duration: 500,
                                onComplete: () => {
                                    particle.destroy();
                                    // Usuwamy z tablicy
                                    const index = this.effectObjects.indexOf(particle);
                                    if (index > -1) {
                                        this.effectObjects.splice(index, 1);
                                    }
                                }
                            });
                        }
                    },
                    callbackScope: this,
                    loop: true
                });
                this.effectTimers.push(bossTimer);
                break;
                
            case 'BERSERKER':
                // Czerwone ślady wściekłości - zredukowana częstotliwość
                const berserkerTimer = this.scene.time.addEvent({
                    delay: 400, // Zwiększona przerwa z 200 do 400ms
                    callback: () => {
                        if (!this.isDead && this.active) {
                            const rage = this.scene.add.circle(this.x, this.y, 10, 0xff0000, 0.3);
                            this.effectObjects.push(rage);
                            
                            this.scene.tweens.add({
                                targets: rage,
                                alpha: 0,
                                scale: 0.5,
                                duration: 500,
                                onComplete: () => {
                                    rage.destroy();
                                    const index = this.effectObjects.indexOf(rage);
                                    if (index > -1) {
                                        this.effectObjects.splice(index, 1);
                                    }
                                }
                            });
                        }
                    },
                    callbackScope: this,
                    loop: true
                });
                this.effectTimers.push(berserkerTimer);
                break;
                
            case 'RANGED':
                // Efekt łuku - niebieska poświata
                const bow = this.scene.add.rectangle(this.x, this.y, 25, 3, 0x5555ff, 0.4);
                bow.setDepth(this.depth - 1); // Pod wrogiem
                bow.setAngle(90); // Pionowo
                
                // Animacja naciągania łuku
                this.scene.tweens.add({
                    targets: bow,
                    scaleY: 1.2,
                    scaleX: 0.8,
                    yoyo: true,
                    duration: 1000,
                    repeat: -1
                });
                
                this.effectObjects.push(bow);
                
                // Dodajemy delikatny efekt "aury" wokół łucznika
                const rangedTimer = this.scene.time.addEvent({
                    delay: 800,
                    callback: () => {
                        if (!this.isDead && this.active) {
                            const aura = this.scene.add.circle(this.x, this.y, 15, 0x5555ff, 0.2);
                            this.effectObjects.push(aura);
                            
                            this.scene.tweens.add({
                                targets: aura,
                                alpha: 0,
                                scale: 1.5,
                                duration: 700,
                                onComplete: () => {
                                    aura.destroy();
                                    const index = this.effectObjects.indexOf(aura);
                                    if (index > -1) {
                                        this.effectObjects.splice(index, 1);
                                    }
                                }
                            });
                        }
                    },
                    callbackScope: this,
                    loop: true
                });
                this.effectTimers.push(rangedTimer);
                break;
                
            case 'TANK':
                // Efekt tarczy - ale półprzezroczysty, aby był widoczny kształt Orka
                const shield = this.scene.add.circle(this.x, this.y, 25, 0x0088ff, 0.15);
                shield.setDepth(this.depth - 1); // Pod wrogiem, aby nie zasłaniał
                
                // Upewniamy się, że główne ciało wroga ma odpowiedni kolor i rozmiar
                if (this.enemyBody) {
                    // Zwiększamy wyraźnie kolor i rozmiar, żeby był lepiej widoczny
                    this.enemyBody.fillColor = 0xff8844; // Pomarańczowy kolor dla Orka
                    this.enemyBody.setAlpha(1); // Pełna nieprzezroczystość
                    this.enemyBody.width = 50; // Większy rozmiar
                    this.enemyBody.height = 50;
                    this.enemyBody.setDepth(this.depth + 1); // Na pewno na wierzchu
                }
                
                this.shield = shield;
                this.effectObjects.push(shield);
                break;
                
            case 'MINION':
                // Mały zielony ślad - zredukowana częstotliwość
                const minionTimer = this.scene.time.addEvent({
                    delay: 800, // Zwiększona przerwa z 400 do 800ms
                    callback: () => {
                        if (!this.isDead && this.active) {
                            const slime = this.scene.add.circle(this.x, this.y + 15, 5, 0x88ff88, 0.4);
                            slime.setDepth(this.depth - 1);
                            this.effectObjects.push(slime);
                            
                            this.scene.tweens.add({
                                targets: slime,
                                alpha: 0,
                                y: slime.y + 10,
                                duration: 2000,
                                onComplete: () => {
                                    slime.destroy();
                                    const index = this.effectObjects.indexOf(slime);
                                    if (index > -1) {
                                        this.effectObjects.splice(index, 1);
                                    }
                                }
                            });
                        }
                    },
                    callbackScope: this,
                    loop: true
                });
                this.effectTimers.push(minionTimer);
                break;
        }
    }
    
    update() {
        // Nie aktualizujemy martwych lub nieaktywnych wrogów
        if (this.isDead || !this.active) return;
        
        // Synchronizujemy pozycję grafiki wroga z głównym sprite'm
        if (this.enemyBody) {
            this.enemyBody.x = this.x;
            this.enemyBody.y = this.y;
            
            // Upewniamy się, że grafika jest widoczna
            if (!this.enemyBody.visible) {
                this.enemyBody.setVisible(true);
                this.enemyBody.setAlpha(1);
            }
        } else {
            // Jeśli z jakiegoś powodu enemyBody nie istnieje, tworzymy je
            this.enemyBody = this.scene.add.rectangle(this.x, this.y, 40, 40, 0xffffff);
            // Używamy koloru odpowiadającego typowi wroga
            const enemyTypeData = this.getEnemyTypeData();
            if (enemyTypeData) {
                this.enemyBody.fillColor = enemyTypeData.color;
                this.enemyBody.width = 40 * enemyTypeData.scale;
                this.enemyBody.height = 40 * enemyTypeData.scale;
            }
        }
        
        // Aktualizujemy pozycję paska zdrowia i etykiety tylko jeśli istnieją
        if (this.healthBarBg && this.healthBar && this.levelText) {
            this.healthBarBg.x = this.x;
            this.healthBarBg.y = this.y - 30;
            this.healthBar.x = this.x - (this.healthBarBg.width - this.healthBar.width) / 2;
            this.healthBar.y = this.y - 30;
            this.levelText.x = this.x;
            this.levelText.y = this.y - 40;
        }
        
        // Aktualizujemy pozycję tarczy, jeśli istnieje
        if (this.shield) {
            this.shield.x = this.x;
            this.shield.y = this.y;
        }
        
        // Aktualizujemy pociski dla dystansowych przeciwników
        if (this.isRanged) {
            this.updateProjectiles();
        }
        
        // Ograniczamy logowanie pozycji
        if (Math.random() < 0.05) { // Tylko 5% szansy na zalogowanie w danej klatce
            logger.debug(`Pozycja wroga: x=${this.x}, y=${this.y}, prędkość=${this.body.velocity.x}`, "ENEMY_POSITION");
        }
        
        // Sprawdzamy czy wróg wyszedł poza lewą krawędź ekranu
        if (this.x < -50) {
            // Wróg wyszedł poza ekran - po prostu znika
            logger.info("Wróg wyszedł poza ekran i znika", "ENEMY_POSITION");
            this.die();
            return;
        }
        
        // Używamy specjalnych zdolności w zależności od typu wroga
        // Ograniczamy częstotliwość sprawdzania specjalnych zdolności
        const time = this.scene.time.now;
        if (time > this.lastSpecialAbilityTime + 2000) { // Sprawdzamy co 2 sekundy zamiast w każdej klatce
            this.useSpecialAbility();
            this.lastSpecialAbilityTime = time;
        }
        
        // Znajdź bohatera
        const hero = this.scene.playerSystem?.getHero();
        
        if (hero && !hero.isDead) {
            // Obliczamy kierunek do bohatera
            const dx = hero.x - this.x;
            const dy = hero.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const direction = Math.sign(dx); // -1 lewo, 1 prawo
            
            // Odległość od bohatera w poziomie
            const absDistanceX = Math.abs(dx);
            
            // Ustaw kierunek animacji zgodnie z kierunkiem ruchu
            this.flipX = direction < 0;
            
            // Specjalne zachowanie dla przeciwników dystansowych
            if (this.isRanged) {
                // Jeśli dystans jest w zasięgu ataku, zatrzymaj się i strzelaj
                if (distance <= this.attackRange && distance >= 100) {
                    // Zatrzymaj się
                    this.setVelocity(0, 0);
                    
                    // Próbuj strzelać
                    this.shootProjectile();
                } else if (distance < 100) {
                    // Za blisko - próbuj się oddalić
                    this.setVelocityX(-direction * this.speed);
                    
                    // Jeśli nie mamy włączonego ruchu tylko w poziomie, dostosowujemy też pozycję Y
                    if (!this.horizontalMovementOnly && Math.abs(dy) > 20) {
                        this.setVelocityY(-Math.sign(dy) * this.speed * 0.5);
                    } else {
                        this.setVelocityY(0);
                    }
                } else {
                    // Za daleko - podejdź bliżej
                    this.setVelocityX(direction * this.speed * 0.7); // Wolniej niż zwykli wrogowie
                    
                    // Jeśli nie mamy włączonego ruchu tylko w poziomie, dostosowujemy też pozycję Y
                    if (!this.horizontalMovementOnly && Math.abs(dy) > 20) {
                        this.setVelocityY(Math.sign(dy) * this.speed * 0.5);
                    } else {
                        this.setVelocityY(0);
                    }
                }
                
                return; // Zakończ metodę update dla dystansowych przeciwników
            }
            
            // Normalne zachowanie dla pozostałych wrogów
            if (absDistanceX < 50) {
                // Jesteśmy przy bohaterze - zatrzymujemy się i atakujemy
                this.setVelocityX(0);
                
                // Atakujemy bohatera, gdy jesteśmy wystarczająco blisko
                if (distance < 60) {
                    // Sprawdzamy, czy możemy zaatakować (cooldown)
                    if (this.canAttack()) {
                        // Wykonujemy atak - wywołujemy metodę performAttack z klasy
                        this.performAttack();
                        
                        // Zadajemy obrażenia bohaterowi - używamy wartości this.attack (liczba obrażeń)
                        if (typeof hero.takeDamage === 'function') {
                            const damageValue = this.attack; // Wartość liczbowa obrażeń
                            hero.takeDamage(damageValue);
                        }
                    }
                }
            } else {
                // Poruszamy się w kierunku bohatera z odpowiednią prędkością
                this.setVelocityX(direction * this.speed);
            }
            
            // Jeśli nie mamy włączonego ruchu tylko w poziomie, dostosowujemy też pozycję Y
            if (!this.horizontalMovementOnly) {
                // Jeśli różnica wysokości jest znacząca, dostosuj pozycję Y
                if (Math.abs(dy) > 20) {
                    this.setVelocityY(Math.sign(dy) * this.speed * 0.5);
                } else {
                    this.setVelocityY(0);
                }
            }
            
            return;
        }
        
        // Jeśli nie ma bohatera lub bohater jest martwy, poruszamy się w lewo
        this.setVelocityX(-this.speed);
    }
    
    // Używa specjalnej zdolności w zależności od typu wroga
    useSpecialAbility() {
        const time = this.scene.time.now;
        if (time < this.lastSpecialAbilityTime + this.specialAbilityCooldown) {
            return false; // Jeszcze nie możemy użyć specjalnej zdolności
        }
        
        // Tylko bossy i specjalne typy wrogów mają zdolności
        switch (this.enemyType) {
            case 'BOSS':
                // Boss tworzy falę uderzeniową
                this.lastSpecialAbilityTime = time;
                
                // Efekt fali uderzeniowej
                const wave = this.scene.add.circle(this.x, this.y, 20, 0xffcc00, 0.7);
                this.scene.tweens.add({
                    targets: wave,
                    radius: 100,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => wave.destroy()
                });
                
                // Wyświetlamy komunikat o specjalnej zdolności
                const bossText = this.scene.add.text(this.x, this.y - 70, "FALA UDERZENIOWA!", {
                    fontSize: '14px',
                    fill: '#ffcc00',
                    stroke: '#000000',
                    strokeThickness: 3
                }).setOrigin(0.5);
                
                this.scene.tweens.add({
                    targets: bossText,
                    y: this.y - 100,
                    alpha: 0,
                    duration: 1500,
                    onComplete: () => bossText.destroy()
                });
                
                // Zwiększamy chwilowo obronę
                const originalDefense = this.defense;
                this.defense += 20;
                this.scene.time.delayedCall(2000, () => {
                    if (this.active && !this.isDead) {
                        this.defense = originalDefense;
                    }
                });
                break;
                
            case 'BERSERKER':
                // Berserker zwiększa prędkość ataku
                this.lastSpecialAbilityTime = time;
                
                // Efekt przyśpieszenia
                const rage = this.scene.add.circle(this.x, this.y, 30, 0xff0000, 0.5);
                this.scene.tweens.add({
                    targets: rage,
                    alpha: 0,
                    scale: 2,
                    duration: 500,
                    onComplete: () => rage.destroy()
                });
                
                // Zwiększamy prędkość na chwilę
                const originalSpeed = this.speed;
                this.speed = this.speed * 2;
                this.setVelocityX(-this.speed);
                
                this.scene.time.delayedCall(1500, () => {
                    if (this.active && !this.isDead) {
                        this.speed = originalSpeed;
                        this.setVelocityX(-this.speed);
                    }
                });
                break;

            case 'RANGED':
                // Łucznik wystrzeliwuje serię strzał
                this.lastSpecialAbilityTime = time;
                
                // Efekt przygotowania serii strzał
                const chargeEffect = this.scene.add.circle(this.x, this.y, 15, 0x5555ff, 0.5);
                this.scene.tweens.add({
                    targets: chargeEffect,
                    scale: 1.5,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => chargeEffect.destroy()
                });
                
                // Wyświetlamy komunikat o specjalnej zdolności
                const rangedText = this.scene.add.text(this.x, this.y - 70, "SERIA STRZAŁ!", {
                    fontSize: '14px',
                    fill: '#5555ff',
                    stroke: '#000000',
                    strokeThickness: 3
                }).setOrigin(0.5);
                
                this.scene.tweens.add({
                    targets: rangedText,
                    y: this.y - 100,
                    alpha: 0,
                    duration: 1500,
                    onComplete: () => rangedText.destroy()
                });
                
                // Wystrzeliwujemy serię 3 strzał w różnych kierunkach
                const hero = this.scene.playerSystem?.getHero();
                if (hero && !hero.isDead) {
                    // Szybka seria strzał
                    for (let i = 0; i < 3; i++) {
                        this.scene.time.delayedCall(i * 300, () => {
                            if (this.active && !this.isDead) {
                                const deviation = (i - 1) * 0.2; // -0.2, 0, 0.2 dla łuku strzał
                                
                                // Obliczamy kierunek do bohatera
                                const dx = hero.x - this.x;
                                const dy = hero.y - this.y;
                                const distance = Math.sqrt(dx * dx + dy * dy);
                                
                                // Normalizujemy wektor kierunku z odchyleniem
                                const dirX = dx / distance;
                                const dirY = (dy / distance) + deviation;
                                
                                // Tworzymy pocisk
                                const projectile = this.scene.add.circle(this.x, this.y, 6, 0x5555ff, 0.8);
                                
                                // Dodajemy właściwości fizyki do pocisku
                                this.scene.physics.add.existing(projectile);
                                
                                // Ustawiamy prędkość pocisku - szybszy niż normalny
                                projectile.body.setVelocity(dirX * this.projectileSpeed * 1.3, dirY * this.projectileSpeed * 1.3);
                                
                                // Dodajemy dodatkowe właściwości do pocisku
                                projectile.damage = this.attack * 0.8; // Mniejsze obrażenia niż standardowy strzał
                                projectile.lifespan = 3000;
                                projectile.creationTime = time;
                                
                                // Dodajemy efekt "śladu" za pociskiem
                                const trailEmitter = this.scene.time.addEvent({
                                    delay: 100,
                                    callback: () => {
                                        if (projectile.active) {
                                            const trail = this.scene.add.circle(projectile.x, projectile.y, 3, 0x5555ff, 0.4);
                                            this.scene.tweens.add({
                                                targets: trail,
                                                alpha: 0,
                                                scale: 0.5,
                                                duration: 300,
                                                onComplete: () => trail.destroy()
                                            });
                                        }
                                    },
                                    callbackScope: this,
                                    loop: true
                                });
                                
                                // Dodajemy pocisk do tablicy aktywnych pocisków
                                this.projectiles.push({ 
                                    projectile, 
                                    trailEmitter, 
                                    creationTime: time 
                                });
                                
                                // Dodajemy kolizję pocisku z bohaterem
                                this.scene.physics.add.overlap(projectile, hero, (proj, hero) => {
                                    // Zadajemy obrażenia bohaterowi
                                    if (typeof hero.takeDamage === 'function') {
                                        hero.takeDamage(projectile.damage);
                                    }
                                    
                                    // Efekt trafienia
                                    const hitEffect = this.scene.add.circle(projectile.x, projectile.y, 10, 0xff0000, 0.7);
                                    this.scene.tweens.add({
                                        targets: hitEffect,
                                        alpha: 0,
                                        scale: 2,
                                        duration: 200,
                                        onComplete: () => hitEffect.destroy()
                                    });
                                    
                                    // Usuwamy pocisk
                                    this.destroyProjectile(projectile);
                                });
                            }
                        });
                    }
                }
                break;
                
            case 'TANK':
                // Tank regeneruje zdrowie
                this.lastSpecialAbilityTime = time;
                
                // Nie regenerujemy pełnego zdrowia
                const healAmount = Math.floor(this.maxHealth * 0.1); // 10% regeneracji
                this.health = Math.min(this.maxHealth, this.health + healAmount);
                
                // Aktualizujemy pasek zdrowia
                this.updateHealthBar();
                
                // Efekt regeneracji
                const heal = this.scene.add.text(this.x, this.y - 60, `+${healAmount} HP`, {
                    fontSize: '14px',
                    fill: '#00ff00',
                    stroke: '#000000',
                    strokeThickness: 2
                }).setOrigin(0.5);
                
                this.scene.tweens.add({
                    targets: heal,
                    y: this.y - 80,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => heal.destroy()
                });
                break;
                
            case 'MINION':
                // Minion teleportuje się do przodu
                this.lastSpecialAbilityTime = time;
                
                // Efekt teleportacji
                const flash = this.scene.add.circle(this.x, this.y, 20, 0xffffff, 0.8);
                this.scene.tweens.add({
                    targets: flash,
                    alpha: 0,
                    scale: 2,
                    duration: 200,
                    onComplete: () => flash.destroy()
                });
                
                // Teleportujemy się do przodu
                this.x -= 100;
                
                // Efekt pojawienia się
                const appear = this.scene.add.circle(this.x, this.y, 20, 0xffffff, 0.8);
                this.scene.tweens.add({
                    targets: appear,
                    alpha: 0,
                    scale: 2,
                    duration: 200,
                    onComplete: () => appear.destroy()
                });
                break;
        }
        
        return true;
    }
    
    // Metoda sprawdzająca czy wróg może zaatakować
    canAttack() {
        const time = this.scene.time.now;
        // Bez logowania za każdym razem - powoduje to spam w konsoli
        return time > this.lastAttackTime + this.attackCooldown;
    }
    
    // Wykonuje atak (tylko wizualne i dźwiękowe efekty)
    performAttack() {
        const time = this.scene.time.now;
        
        // Sprawdzamy, czy wróg może zaatakować (upłynął cooldown)
        if (time > this.lastAttackTime + this.attackCooldown) {
            this.lastAttackTime = time;
            
            // Odtwarzamy dźwięk ataku - bezpiecznie
            try {
                if (this.attackSound && typeof this.attackSound.play === 'function') {
                    this.attackSound.play();
                }
            } catch (error) {
                console.warn('Nie można odtworzyć dźwięku ataku wroga:', error);
            }
            
            // Logujemy informację o ataku - zmieniamy this.attack na this.attack (wartość obrażeń)
            const attackValue = this.attack; // Zapisujemy wartość obrażeń do zmiennej
            logger.info(`Enemy typu ${this.enemyType} wykonuje atak z siłą: ${attackValue}`, "ENEMY_DAMAGE");
            
            // Tworzymy efekt wizualny ataku
            this.scene.time.delayedCall(100, () => {
                // Dostosowujemy efekt ataku do typu wroga
                let attackColor = 0xff0000; // domyślny czerwony
                let attackSize = 15;
                let attackDuration = 200;
                let attackAlpha = 0.5;
                
                switch (this.enemyType) {
                    case 'BOSS':
                        attackColor = 0xffcc00; // złoty
                        attackSize = 25;
                        attackDuration = 300;
                        attackAlpha = 0.7;
                        
                        // Dodatkowy efekt fali uderzeniowej dla bossa
                        const shockwave = this.scene.add.circle(
                            this.flipX ? this.x + 30 : this.x - 30,
                            this.y,
                            attackSize * 1.5,
                            attackColor,
                            0.3
                        );
                        
                        this.scene.tweens.add({
                            targets: shockwave,
                            scale: 2,
                            alpha: 0,
                            duration: 500,
                            onComplete: () => shockwave.destroy()
                        });
                        break;
                        
                    case 'BERSERKER':
                        attackColor = 0xff0000; // czerwony
                        attackSize = 20;
                        attackDuration = 250;
                        attackAlpha = 0.6;
                        
                        // Dodatkowy efekt krwi dla berserkera
                        for (let i = 0; i < 5; i++) {
                            const blood = this.scene.add.circle(
                                this.flipX ? this.x + 30 + Phaser.Math.Between(-10, 10) : this.x - 30 + Phaser.Math.Between(-10, 10),
                                this.y + Phaser.Math.Between(-10, 10),
                                Phaser.Math.Between(3, 6),
                                0xaa0000,
                                0.7
                            );
                            
                            this.scene.tweens.add({
                                targets: blood,
                                y: blood.y + Phaser.Math.Between(10, 20),
                                alpha: 0,
                                duration: Phaser.Math.Between(300, 500),
                                onComplete: () => blood.destroy()
                            });
                        }
                        break;
                        
                    case 'RANGED':
                        attackColor = 0x5555ff; // niebieski
                        attackSize = 12;
                        attackDuration = 180;
                        attackAlpha = 0.6;
                        
                        // Efekt przygotowania łuku dla łucznika
                        const bowDrawing = this.scene.add.rectangle(
                            this.flipX ? this.x + 25 : this.x - 25,
                            this.y,
                            20,
                            3,
                            attackColor,
                            0.8
                        );
                        
                        this.scene.tweens.add({
                            targets: bowDrawing,
                            scaleX: 0.5,
                            alpha: 0,
                            duration: 200,
                            onComplete: () => bowDrawing.destroy()
                        });
                        
                        // Efekt strzału z łuku
                        const arrow = this.scene.add.rectangle(
                            this.flipX ? this.x + 15 : this.x - 15,
                            this.y,
                            15,
                            2,
                            attackColor,
                            0.9
                        );
                        
                        this.scene.tweens.add({
                            targets: arrow,
                            x: this.flipX ? this.x + 50 : this.x - 50,
                            alpha: 0,
                            duration: 150,
                            onComplete: () => arrow.destroy()
                        });
                        break;
                        
                    case 'TANK':
                        attackColor = 0x0088ff; // niebieski
                        attackSize = 18;
                        attackDuration = 350;
                        attackAlpha = 0.5;
                        
                        // Efekt uderzenia młotem dla tanka
                        const hammerEffect = this.scene.add.rectangle(
                            this.flipX ? this.x + 30 : this.x - 30,
                            this.y - 5,
                            25,
                            40,
                            attackColor,
                            0.6
                        ).setOrigin(0.5);
                        
                        this.scene.tweens.add({
                            targets: hammerEffect,
                            scaleY: 0.5,
                            alpha: 0,
                            duration: 250,
                            onComplete: () => hammerEffect.destroy()
                        });
                        break;
                        
                    case 'MINION':
                        attackColor = 0x88ff88; // zielony
                        attackSize = 10;
                        attackDuration = 150;
                        attackAlpha = 0.4;
                        break;
                }
                
                // Dodajemy efekt wizualny ciosu
                const attackEffect = this.scene.add.circle(
                    this.flipX ? this.x + 30 : this.x - 30,
                    this.y,
                    attackSize,
                    attackColor,
                    attackAlpha
                );
                
                // Efekt znika po krótkim czasie
                this.scene.tweens.add({
                    targets: attackEffect,
                    alpha: 0,
                    duration: attackDuration,
                    onComplete: () => {
                        attackEffect.destroy();
                    }
                });
                
                // Wyświetlamy wartość obrażeń nad bohaterem
                const hero = this.scene.playerSystem?.getHero();
                if (hero) {
                    const damageText = this.scene.add.text(
                        hero.x,
                        hero.y - 40,
                        `-${attackValue}`,
                        {
                            fontFamily: 'Arial',
                            fontSize: '16px',
                            color: '#ff0000',
                            stroke: '#000000',
                            strokeThickness: 3
                        }
                    ).setOrigin(0.5);
                    
                    this.scene.tweens.add({
                        targets: damageText,
                        y: damageText.y - 30,
                        alpha: 0,
                        duration: 800,
                        onComplete: () => damageText.destroy()
                    });
                }
            });
            
            return true;
        }
        
        return false;
    }
    
    takeDamage(amount) {
        // Nie możemy zadawać obrażeń martwemu wrogowi
        if (this.isDead) return;
        
        // Zastosowanie obrony
        const actualDamage = Math.max(1, amount - this.defense);
        
        // Zmniejszamy zdrowie, ale nie poniżej zera
        this.health = Math.max(0, this.health - actualDamage);
        
        // Aktualizujemy pasek zdrowia
        this.updateHealthBar();
        
        // Logowanie - tylko jeśli debugowanie włączone
        if (window.gameData.debugMode) {
            logger.info(`Wróg ${this.enemyType} otrzymuje obrażenia: ${amount}, po obronie: ${actualDamage}, pozostałe HP: ${this.health}`, "ENEMY_DAMAGE");
        }
        
        // Jeśli wróg zginął, wywołujemy metodę śmierci
        if (this.health <= 0 && !this.isDead) {
            // Natychmiast oznaczamy jako martwego, aby uniknąć wielokrotnego wywołania die()
            this.isDead = true;
            this.die();
        }
        
        // Efekty wizualne otrzymania obrażeń - tylko jeśli wróg nadal żyje
        if (!this.isDead) {
            // Czerwony błysk przy trafieniu
            this.setTint(0xff0000);
            this.scene.time.delayedCall(200, () => {
                if (this.active) this.clearTint();
            });
        }
    }
    
    die() {
        // Jeśli wróg jest już martwy, nie rób nic
        if (this.isDead) return;
        
        // Natychmiastowo oznaczamy jako martwy
        this.isDead = true;
        
        // Natychmiastowo zatrzymujemy wroga
        this.setVelocity(0, 0);
        
        // Całkowicie wyłączamy fizykę i kolizje
        if (this.body) {
            this.body.enable = false;
            this.body.checkCollision.none = true;
        }
        
        // Czyścimy pociski dla przeciwników dystansowych
        if (this.isRanged) {
            // Usuwamy wszystkie pociski
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const projData = this.projectiles[i];
                
                // Zatrzymujemy emiter śladu
                if (projData.trailEmitter) {
                    projData.trailEmitter.remove();
                }
                
                // Niszczymy pocisk
                if (projData.projectile && projData.projectile.active) {
                    projData.projectile.destroy();
                }
            }
            this.projectiles = [];
        }
        
        // Natychmiastowo ukrywamy wroga
        this.setAlpha(0);
        
        // Ukrywamy (ale nie niszczymy) graficzne ciało wroga
        if (this.enemyBody) {
            this.enemyBody.setVisible(false);
            // Nie niszczymy całkowicie, aby można było ponownie użyć
        }
        
        // Natychmiastowo niszczymy wszystkie powiązane elementy UI
        if (this.healthBarBg) {
            this.healthBarBg.destroy();
            this.healthBarBg = null;
        }
        
        if (this.healthBar) {
            this.healthBar.destroy();
            this.healthBar = null;
        }
        
        if (this.levelText) {
            this.levelText.destroy();
            this.levelText = null;
        }
        
        // Usuwamy tarczę, jeśli istnieje
        if (this.shield) {
            this.shield.destroy();
            this.shield = null;
        }
        
        // Czyszczenie wszystkich efektów
        this.clearEffects();
        
        // Efekt wizualny śmierci
        const deathEffect = this.scene.add.circle(this.x, this.y, 30, 0xff0000, 0.7);
        this.scene.tweens.add({
            targets: deathEffect,
            alpha: 0,
            scale: 0,
            duration: 300, // Szybszy efekt
            onComplete: () => deathEffect.destroy()
        });
        
        // Odtwarzamy dźwięk śmierci
        if (this.deathSound && this.deathSound.play) {
            this.deathSound.play({ volume: 0.3 });
        }
        
        // Dodajemy punkty doświadczenia
        if (this.scene.playerSystem && this.scene.playerSystem.getHero()) {
            const hero = this.scene.playerSystem.getHero();
            hero.addExperience(this.experienceValue);
        }
        
        // Aktualizacja licznika zabitych wrogów
        window.gameData.enemiesKilled++;
        
        // Informujemy system wrogów o śmierci
        if (this.scene.enemySystem) {
            this.scene.enemySystem.enemyKilled();
        }
        
        // Wyświetlamy wartość doświadczenia
        const expText = this.scene.add.text(this.x, this.y - 10, `+${this.experienceValue} EXP`, {
            fontSize: '16px',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        
        // Natychmiastowo wyłączamy metodę update
        this.update = function() { return; };
        
        // Po krótkiej przerwie całkowicie niszczymy wroga
        this.scene.time.delayedCall(100, () => {
            // Natychmiastowo deaktywujemy wroga
            this.setActive(false);
            this.setVisible(false);
        });
        
        // Animujemy tekst doświadczenia
        this.scene.tweens.add({
            targets: expText,
            y: expText.y - 50,
            alpha: 0,
            duration: 1000,
            onComplete: () => {
                expText.destroy();
            }
        });
    }

    // Metoda aktualizująca pasek zdrowia wroga
    updateHealthBar() {
        // Obliczamy procent zdrowia
        const healthPercent = Math.max(0, this.health / this.maxHealth);
        
        // Aktualizujemy szerokość paska zdrowia
        this.healthBar.width = this.healthBarBg.width * healthPercent;
        
        // Zmieniamy kolor paska zdrowia w zależności od ilości zdrowia
        if (healthPercent < 0.3) {
            this.healthBar.fillColor = 0xff0000; // czerwony przy małym zdrowiu
        } else if (healthPercent < 0.6) {
            this.healthBar.fillColor = 0xffff00; // żółty przy średnim zdrowiu
        } else {
            this.healthBar.fillColor = 0x00ff00; // zielony przy wysokim zdrowiu
        }
    }

    // Strzela pociskiem w kierunku bohatera
    shootProjectile() {
        const time = this.scene.time.now;
        
        // Sprawdzamy, czy upłynął cooldown strzału
        if (time < this.lastShootTime + this.shootCooldown) {
            return false;
        }
        
        // Znajdujemy bohatera
        const hero = this.scene.playerSystem?.getHero();
        if (!hero || hero.isDead) {
            return false;
        }
        
        // Aktualizujemy czas ostatniego strzału
        this.lastShootTime = time;
        
        // Obliczamy kierunek do bohatera
        const dx = hero.x - this.x;
        const dy = hero.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Normalizujemy wektor kierunku
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        // Tworzymy pocisk
        const projectile = this.scene.add.circle(this.x, this.y, 6, 0x5555ff, 0.8);
        
        // Dodajemy właściwości fizyki do pocisku
        this.scene.physics.add.existing(projectile);
        
        // Ustawiamy prędkość pocisku
        projectile.body.setVelocity(dirX * this.projectileSpeed, dirY * this.projectileSpeed);
        
        // Dodajemy dodatkowe właściwości do pocisku
        projectile.damage = this.attack;
        projectile.lifespan = 3000; // Czas życia pocisku w ms
        projectile.creationTime = time;
        
        // Dodajemy efekt "śladu" za pociskiem
        const trailEmitter = this.scene.time.addEvent({
            delay: 100,
            callback: () => {
                if (projectile.active) {
                    const trail = this.scene.add.circle(projectile.x, projectile.y, 3, 0x5555ff, 0.4);
                    this.scene.tweens.add({
                        targets: trail,
                        alpha: 0,
                        scale: 0.5,
                        duration: 300,
                        onComplete: () => trail.destroy()
                    });
                }
            },
            callbackScope: this,
            loop: true
        });
        
        // Dodajemy pocisk do tablicy aktywnych pocisków
        this.projectiles.push({ 
            projectile, 
            trailEmitter, 
            creationTime: time 
        });
        
        // Dodajemy animację strzału (przygotowanie łuku)
        const shootEffect = this.scene.add.rectangle(
            this.x, 
            this.y, 
            20, 
            5, 
            0x5555ff, 
            0.9
        );
        
        this.scene.tweens.add({
            targets: shootEffect,
            alpha: 0,
            width: 30,
            duration: 200,
            onComplete: () => shootEffect.destroy()
        });
        
        // Dodajemy kolizję pocisku z bohaterem
        this.scene.physics.add.overlap(projectile, hero, (proj, hero) => {
            // Zadajemy obrażenia bohaterowi
            if (typeof hero.takeDamage === 'function') {
                hero.takeDamage(projectile.damage);
            }
            
            // Efekt trafienia
            const hitEffect = this.scene.add.circle(projectile.x, projectile.y, 10, 0xff0000, 0.7);
            this.scene.tweens.add({
                targets: hitEffect,
                alpha: 0,
                scale: 2,
                duration: 200,
                onComplete: () => hitEffect.destroy()
            });
            
            // Usuwamy pocisk
            this.destroyProjectile(projectile);
        });
        
        return true;
    }
    
    // Niszczy pocisk i jego emiter
    destroyProjectile(projectile) {
        // Znajdź indeks pocisku w tablicy
        const index = this.projectiles.findIndex(p => p.projectile === projectile);
        
        if (index !== -1) {
            // Zatrzymujemy emiter śladu
            if (this.projectiles[index].trailEmitter) {
                this.projectiles[index].trailEmitter.remove();
            }
            
            // Niszczymy pocisk
            projectile.destroy();
            
            // Usuwamy z tablicy
            this.projectiles.splice(index, 1);
        }
    }
    
    // Aktualizuje wszystkie pociski i usuwa te, które przekroczyły czas życia
    updateProjectiles() {
        const time = this.scene.time.now;
        
        // Sprawdzamy wszystkie pociski
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projData = this.projectiles[i];
            const projectile = projData.projectile;
            
            // Jeśli pocisk istnieje i przekroczył czas życia, niszczymy go
            if (projectile && projectile.active && time > projData.creationTime + projectile.lifespan) {
                this.destroyProjectile(projectile);
            }
            
            // Jeśli pocisk wyszedł poza ekran, usuwamy go
            if (projectile && projectile.active && 
                (projectile.x < -50 || projectile.x > 850 || 
                 projectile.y < -50 || projectile.y > 650)) {
                this.destroyProjectile(projectile);
            }
        }
    }
} 