import { logger } from '../../services/LogService.js';

export default class CombatSystem {
    constructor(scene) {
        this.scene = scene;
        
        // Właściwości systemu celowania
        this.lastShotTime = 0;
        this.shotCooldown = 500; // czas między strzałami w ms
        this.targetingRadius = 50; // Promień wykrywania wrogów w obszarze celowania
        
        // Auto-aim
        this.autoAimEnabled = true; // Domyślnie włączone
        this.autoAimRadius = 150; // Większy promień dla auto-aim niż dla zwykłego celowania
        
        // Object Pooling
        this.bulletPool = [];          // Pula pocisków
        this.hitEffectPool = [];       // Pula efektów trafienia
        this.damageTextPool = [];      // Pula tekstów z obrażeniami
        this.maxPoolSize = 20;         // Maksymalny rozmiar każdej puli
        
        // Własności graficzne
        this.targetLine = null;
        this.targetHighlight = null;
        this.crosshair = null;
        this.crosshairInner = null; // Wewnętrzny element celownika
        this.crosshairOuter = null; // Zewnętrzny element celownika
        
        // Kolory celownika
        this.normalColor = 0xffffff; // Biały kolor celownika
        this.targetColor = 0xff0000; // Czerwony kolor przy wykryciu wroga
        
        // Wskaźnik odnowienia strzału - bardziej subtelny
        this.cooldownRing = null;
        this.isCooldownActive = false;
    }
    
    initialize() {
        // Tworzymy minimalistyczny, kontrastowy celownik
        // Zewnętrzny okrąg celownika
        this.crosshairOuter = this.scene.add.circle(0, 0, 8, this.normalColor);
        this.crosshairOuter.setStrokeStyle(1.5, this.normalColor);
        this.crosshairOuter.setFillStyle(0x000000, 0); // Przezroczysty środek
        
        // Wewnętrzny punkt celownika
        this.crosshairInner = this.scene.add.circle(0, 0, 2, this.normalColor, 1);
        
        // Grupujemy elementy celownika dla łatwiejszej manipulacji
        this.crosshair = this.scene.add.container(0, 0, [this.crosshairOuter, this.crosshairInner]);
        this.crosshair.setDepth(100); // Umieszczamy celownik na wierzchu wszystkich elementów
        
        // Dodajemy linię celowniczą i podświetlenie celu
        this.targetLine = this.scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000);
        this.targetLine.setLineWidth(1);
        this.targetLine.setAlpha(0);
        
        this.targetHighlight = this.scene.add.circle(0, 0, 25, this.targetColor, 0.3);
        this.targetHighlight.setAlpha(0);
        
        // Inicjalizujemy cooldownRing jako null - utworzymy go dopiero przy pierwszym strzale
        this.cooldownRing = null;
        this.isCooldownActive = false;
        
        // Ukrywamy domyślny kursor
        this.scene.input.setDefaultCursor('none');
        
        // Dodajemy klawisze do zmiany promienia celowania
        this.plusKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
        this.minusKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);
        
        this.plusKey.on('down', () => {
            this.targetingRadius += 10;
            if (this.targetingRadius > 150) this.targetingRadius = 150;
            this.showRadiusChangeMessage('+');
        });
        
        this.minusKey.on('down', () => {
            this.targetingRadius -= 10;
            if (this.targetingRadius < 10) this.targetingRadius = 10;
            this.showRadiusChangeMessage('-');
        });
        
        // Dodajemy klawisz przełączania auto-aim
        this.autoAimKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
        this.autoAimKey.on('down', () => {
            this.autoAimEnabled = !this.autoAimEnabled;
            this.showAutoAimMessage();
        });
        
        // Śledzimy pozycję myszy dla celowania
        this.scene.input.on('pointermove', (pointer) => {
            // Aktualizujemy pozycję celownika
            this.crosshair.x = pointer.x;
            this.crosshair.y = pointer.y;
            
            // Aktualizujemy pozycję wskaźnika odnowienia - tylko jeśli istnieje
            if (this.cooldownRing && !this.cooldownRing.destroyed) {
                this.cooldownRing.x = pointer.x;
                this.cooldownRing.y = pointer.y;
            }
            
            // Jeśli auto-aim jest włączony, szukamy wrogów w większym promieniu
            let targetEnemy = null;
            if (this.autoAimEnabled) {
                targetEnemy = this.getEnemyAtPosition(pointer.x, pointer.y, this.autoAimRadius);
            } else {
                targetEnemy = this.getEnemyAtPosition(pointer.x, pointer.y, this.targetingRadius);
            }
            
            if (targetEnemy) {
                // Pokazujemy linię celowniczą i podświetlenie celu
                this.targetLine.setAlpha(0.6);
                
                // Zmieniamy kolor celownika na czerwony i zwiększamy jego rozmiar
                this.crosshairOuter.setStrokeStyle(2, this.targetColor);
                this.crosshairInner.setFillStyle(this.targetColor);
                
                // Efekt pulsowania przy wykryciu wroga
                if (!this.crosshairTween || !this.crosshairTween.isPlaying()) {
                    this.crosshairTween = this.scene.tweens.add({
                        targets: this.crosshairOuter,
                        scaleX: 1.2,
                        scaleY: 1.2,
                        duration: 200,
                        yoyo: true,
                        repeat: 0
                    });
                }
                
                // Aktualizujemy początek linii tylko gdy mamy bohatera
                if (this.scene.playerSystem && this.scene.playerSystem.getHero()) {
                    const hero = this.scene.playerSystem.getHero();
                    this.targetLine.setTo(hero.x, hero.y - 10, targetEnemy.x, targetEnemy.y);
                }
                
                this.targetHighlight.setAlpha(0.6);
                this.targetHighlight.x = targetEnemy.x;
                this.targetHighlight.y = targetEnemy.y;
                
                // Jeśli auto-aim jest włączony, przesuwamy celownik na wroga
                if (this.autoAimEnabled) {
                    // Płynne przesuwanie celownika w kierunku wroga (nie od razu na wroga)
                    const dx = targetEnemy.x - this.crosshair.x;
                    const dy = targetEnemy.y - this.crosshair.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Jeśli celownik jest daleko od wroga, przesuń go w jego kierunku
                    if (distance > 5) {
                        this.crosshair.x += dx * 0.2; // 20% odległości w każdej klatce
                        this.crosshair.y += dy * 0.2;
                    }
                }
                
                this.handleShooting(pointer);
            } else {
                // Przywracamy standardowy kolor i rozmiar celownika
                this.crosshairOuter.setStrokeStyle(1.5, this.normalColor);
                this.crosshairInner.setFillStyle(this.normalColor);
                
                // Ukrywamy linię celowniczą i podświetlenie
                this.targetLine.setAlpha(0);
                this.targetHighlight.setAlpha(0);
            }
        });
        
        // Obsługa kliknięć myszą - strzelanie
        this.scene.input.on('pointerdown', (pointer) => {
            this.handleShooting(pointer);
        });
        
        // Inicjalizacja puli obiektów
        this.initObjectPools();
    }
    
    // Inicjalizuje pule obiektów dla lepszej wydajności
    initObjectPools() {
        // Tworzymy wstępnie obiekty w puli pocisków
        for (let i = 0; i < 10; i++) {
            const bullet = this.scene.add.circle(0, 0, 5, 0xffff00, 1);
            bullet.setActive(false);
            bullet.setVisible(false);
            this.bulletPool.push(bullet);
        }
        
        // Tworzymy wstępnie obiekty w puli efektów trafienia
        for (let i = 0; i < 5; i++) {
            const hitEffect = this.scene.add.circle(0, 0, 15, 0xffffff, 0.7);
            hitEffect.setActive(false);
            hitEffect.setVisible(false);
            this.hitEffectPool.push(hitEffect);
        }
        
        // Tworzymy wstępnie obiekty w puli tekstów z obrażeniami
        for (let i = 0; i < 5; i++) {
            const damageText = this.scene.add.text(0, 0, "0", {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            });
            damageText.setOrigin(0.5);
            damageText.setActive(false);
            damageText.setVisible(false);
            this.damageTextPool.push(damageText);
        }
        
        logger.info("Zainicjalizowano pule obiektów", "COMBAT_SYSTEM");
    }
    
    // Pobiera obiekt z puli lub tworzy nowy, jeśli pula jest pusta
    getPooledObject(pool, createFunction) {
        // Szukamy nieaktywnego obiektu w puli
        const obj = pool.find(obj => !obj.active);
        
        if (obj) {
            // Jeśli znaleźliśmy nieaktywny obiekt, reaktywujemy go
            obj.setActive(true);
            obj.setVisible(true);
            return obj;
        } else if (pool.length < this.maxPoolSize) {
            // Jeśli pula nie jest pełna, tworzymy nowy obiekt
            const newObj = createFunction();
            pool.push(newObj);
            return newObj;
        } else {
            // Jeśli pula jest pełna, używamy najstarszego obiektu (pierwszy w puli)
            const oldestObj = pool.shift();
            pool.push(oldestObj); // Przenosimy na koniec puli (najmłodszy)
            return oldestObj;
        }
    }
    
    // Zwraca obiekt do puli (dezaktywuje go)
    returnToPool(obj) {
        if (obj) {
            obj.setActive(false);
            obj.setVisible(false);
        }
    }
    
    // Obsługa strzelania
    handleShooting(pointer) {
        // Sprawdzamy, czy nastąpiło ochłodzenie strzału
        const time = this.scene.time.now;
        if (time < this.lastShotTime + this.shotCooldown) {
            return false; // Nie możemy jeszcze strzelać
        }
        
        // Nie możemy strzelać, jeśli nie mamy bohatera
        if (!this.scene.playerSystem || !this.scene.playerSystem.getHero()) {
            return false;
        }
        
        // Sprawdzamy, czy kliknęliśmy na wroga
        let clickedEnemy = null;
        
        // Jeśli auto-aim jest włączony, używamy większego promienia
        if (this.autoAimEnabled) {
            clickedEnemy = this.getEnemyAtPosition(pointer.x, pointer.y, this.autoAimRadius);
        } else {
            clickedEnemy = this.getEnemyAtPosition(pointer.x, pointer.y, this.targetingRadius);
        }
        
        if (clickedEnemy) {
            // Strzelamy do klikniętego wroga
            this.shootAt(clickedEnemy);
            this.lastShotTime = time;
            
            // Aktywujemy wskaźnik odnowienia strzału
            this.showCooldownIndicator();
            
            return true;
        }
        
        return false;
    }
    
    // Pokazuje wskaźnik odnowienia strzału
    showCooldownIndicator() {
        // Pomijamy efekt odnowienia w trybie wysokiej wydajności
        if (window.gameData.performanceMode) {
            this.isCooldownActive = true;
            this.scene.time.delayedCall(this.shotCooldown, () => {
                this.isCooldownActive = false;
            });
            return;
        }
        
        // W trybie niskiej wydajności pokazujemy pełny efekt odnowienia
        // Bezpieczne usunięcie poprzedniego wskaźnika
        if (this.cooldownRing) {
            if (typeof this.cooldownRing.destroy === 'function') {
                this.cooldownRing.destroy();
            } else if (typeof this.cooldownRing.clear === 'function') {
                // Jeśli to obiekt Graphics, wywołujemy clear
                this.cooldownRing.clear();
            }
            this.cooldownRing = null;
        }
        
        try {
            // Bezpieczne utworzenie nowego wskaźnika
            // Umieszczamy cooldownRing dokładnie w miejscu celownika
            this.cooldownRing = this.scene.add.circle(
                this.crosshair ? this.crosshair.x : 400,
                this.crosshair ? this.crosshair.y : 300,
                25, 
                0xffffff, 
                0.2
            );
            // Ustawiamy głębokość tak, aby był za celownikiem ale nad większością elementów gry
            this.cooldownRing.setDepth(99);
            
            this.isCooldownActive = true;
            
            // Tworzymy również tekstowy wskaźnik czasu odnowienia
            const cooldownText = this.scene.add.text(
                this.crosshair ? this.crosshair.x : 400,
                this.crosshair ? this.crosshair.y + 25 : 325,
                (this.shotCooldown / 1000).toFixed(1) + "s",
                {
                    fontSize: '14px',
                    fontFamily: 'Arial',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 3
                }
            ).setOrigin(0.5);
            cooldownText.setDepth(101);
            
            // Dodajemy animację odliczania dla tekstu
            let remainingTime = this.shotCooldown / 1000;
            const updateInterval = 100; // aktualizacja co 100ms
            
            const updateTimer = () => {
                remainingTime -= updateInterval / 1000;
                if (remainingTime <= 0) {
                    cooldownText.destroy();
                } else {
                    cooldownText.setText(remainingTime.toFixed(1) + "s");
                    cooldownText.x = this.crosshair ? this.crosshair.x : 400;
                    cooldownText.y = this.crosshair ? this.crosshair.y + 25 : 325;
                    this.scene.time.delayedCall(updateInterval, updateTimer);
                }
            };
            
            // Rozpoczynamy odliczanie
            this.scene.time.delayedCall(updateInterval, updateTimer);
            
            // Animacja kurczenia się pierścienia cooldownu
            this.scene.tweens.add({
                targets: this.cooldownRing,
                scale: 0.5,
                alpha: 0,
                duration: this.shotCooldown,
                onComplete: () => {
                    if (this.cooldownRing && !this.cooldownRing.destroyed) {
                        this.cooldownRing.destroy();
                        this.cooldownRing = null;
                    }
                    this.isCooldownActive = false;
                },
                onUpdate: (tween) => {
                    // Aktualizujemy pozycję cooldownRing, aby podążał za celownikiem
                    if (this.cooldownRing && !this.cooldownRing.destroyed) {
                        this.cooldownRing.x = this.crosshair ? this.crosshair.x : 400;
                        this.cooldownRing.y = this.crosshair ? this.crosshair.y : 300;
                    }
                }
            });
        } catch (error) {
            console.error("Błąd podczas tworzenia wskaźnika odnowienia:", error);
            this.isCooldownActive = false;
        }
    }
    
    // Wyświetla komunikat o przełączeniu auto-aim
    showAutoAimMessage() {
        // Tekst statusu
        const statusText = this.autoAimEnabled ? "WŁĄCZONE" : "WYŁĄCZONE";
        const statusColor = this.autoAimEnabled ? "#00ff00" : "#ff0000";
        
        // Tworzymy komunikat tekstowy
        const message = this.scene.add.text(400, 120, `Auto-Aim: ${statusText}`, {
            fontSize: '18px',
            fill: statusColor,
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        
        // Animacja znikania
        this.scene.tweens.add({
            targets: message,
            alpha: 0,
            y: 100,
            duration: 1500,
            onComplete: () => {
                message.destroy();
            }
        });
    }
    
    // Sprawdza, czy na danej pozycji lub w jej pobliżu jest wróg
    getEnemyAtPosition(x, y, radius = null) {
        if (!this.scene.enemySystem || !this.scene.enemySystem.getEnemyGroup()) {
            return null;
        }
        
        // Jeśli nie podano promienia, użyj domyślnego
        const searchRadius = radius || this.targetingRadius;
        
        const enemies = this.scene.enemySystem.getEnemyGroup().getChildren();
        let closestEnemy = null;
        let closestDistance = searchRadius; // Maksymalny promień wykrywania celu
        
        enemies.forEach(enemy => {
            if (enemy.active && !enemy.isDead) {
                // Obliczamy odległość między kursorem a środkiem wroga
                const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
                
                // Jeśli wróg jest w zasięgu i jest bliżej niż poprzedni znaleziony wróg
                if (distance <= closestDistance) {
                    closestDistance = distance;
                    closestEnemy = enemy;
                }
            }
        });
        
        return closestEnemy;
    }
    
    // Metoda wykonująca strzał do wroga
    shootAt(enemy) {
        // Jeśli wróg jest już martwy, ignorujemy
        if (!enemy || !enemy.active || enemy.isDead) return;
        
        const hero = this.scene.playerSystem.getHero();
        if (!hero) return;
        
        // Sprawdzamy, czy bohater może wykonać atak
        if (hero.canAttack()) {
            // Kierujemy bohatera w stronę wroga
            if (enemy.x > hero.x) {
                hero.flipX = false; // Skieruj bohatera w prawo
            } else {
                hero.flipX = true; // Skieruj bohatera w lewo
            }
            
            // Kierunek strzału od bohatera do celownika
            const targetX = this.crosshair.x;
            const targetY = this.crosshair.y;
            
            // Tworzymy uproszczone efekty w trybie wysokiej wydajności
            const performanceMode = window.gameData.performanceMode;
            
            // Tworzymy efekt strzału
            const bulletStartX = hero.x + (hero.flipX ? -20 : 20);
            const bulletStartY = hero.y - 10;
            
            // Obliczamy wektor kierunku strzału (od bohatera do celownika)
            const dx = targetX - bulletStartX;
            const dy = targetY - bulletStartY;
            const angle = Math.atan2(dy, dx);
            
            // Pobieramy pocisk z puli
            const bullet = this.getPooledObject(this.bulletPool, () => {
                return this.scene.add.circle(0, 0, performanceMode ? 3 : 5, 0xffff00, performanceMode ? 0.7 : 1);
            });
            
            // Ustawiamy pozycję początkową pocisku
            bullet.x = bulletStartX;
            bullet.y = bulletStartY;
            bullet.radius = performanceMode ? 3 : 5;
            
            // Animacja lotu pocisku od bohatera do celu
            this.scene.tweens.add({
                targets: bullet,
                x: targetX,
                y: targetY,
                duration: performanceMode ? 100 : 200,
                ease: 'Linear',
                onComplete: () => {
                    // Po dotarciu do celu, tworzymy efekt trafienia
                    if (!performanceMode) {
                        const hitEffect = this.getPooledObject(this.hitEffectPool, () => {
                            return this.scene.add.circle(0, 0, 15, 0xffffff, 0.7);
                        });
                        
                        hitEffect.x = targetX;
                        hitEffect.y = targetY;
                        hitEffect.setScale(1);
                        hitEffect.setAlpha(0.7);
                        
                        this.scene.tweens.add({
                            targets: hitEffect,
                            alpha: 0,
                            scale: 1.5,
                            duration: 200,
                            onComplete: () => {
                                this.returnToPool(hitEffect);
                            }
                        });
                    }
                    
                    // Zadajemy obrażenia wrogowi
                    const damage = hero.attack;
                    enemy.takeDamage(damage);
                    
                    // Wyświetlamy liczbę zadanych obrażeń
                    if (!performanceMode) {
                        const damageText = this.getPooledObject(this.damageTextPool, () => {
                            return this.scene.add.text(0, 0, "0", {
                                fontSize: '16px',
                                fontFamily: 'Arial',
                                color: '#ffffff',
                                stroke: '#000000',
                                strokeThickness: 3
                            }).setOrigin(0.5);
                        });
                        
                        // Wybieramy kolor dla liczby obrażeń
                        let color = '#ffffff';
                        let fontSize = '16px';
                        
                        // Kolorowanie w zależności od wielkości obrażeń
                        if (damage > 20) {
                            color = '#ff0000'; // Czerwony dla dużych obrażeń
                            fontSize = '24px';
                        } else if (damage > 10) {
                            color = '#ffff00'; // Żółty dla średnich obrażeń
                            fontSize = '18px';
                        }
                        
                        damageText.setText(damage.toString());
                        damageText.setStyle({
                            fontSize: fontSize,
                            color: color,
                            stroke: '#000000',
                            strokeThickness: 3
                        });
                        damageText.x = enemy.x;
                        damageText.y = enemy.y - 20;
                        
                        this.scene.tweens.add({
                            targets: damageText,
                            y: damageText.y - 50,
                            scale: damage > 20 ? 1.2 : 0.8,
                            alpha: 0,
                            duration: 800,
                            onComplete: () => {
                                this.returnToPool(damageText);
                            }
                        });
                    }
                    
                    // Zwracamy pocisk do puli
                    this.returnToPool(bullet);
                }
            });
            
            // Krótki błysk celownika jako informacja zwrotna o strzale
            this.scene.tweens.add({
                targets: [this.crosshairOuter, this.crosshairInner],
                alpha: 0.3,
                duration: 50,
                yoyo: true,
                repeat: 1
            });
            
            // Dźwięk strzału jeśli dostępny
            try {
                if (hero.attackSound) {
                    hero.attackSound.play();
                }
            } catch (error) {
                logger.warn(`Nie można odtworzyć dźwięku ataku: ${error.message}`, "COMBAT_SYSTEM");
            }
        }
    }
    
    update(time, delta) {
        // Ukrywamy lub pokazujemy crosshair w zależności od stanu menu etc.
        if (this.crosshair) {
            if (this.scene.game.scene.isActive('UIScene')) {
                // Sprawdzamy, czy menu jest otwarte
                // Jeśli tak, ukrywamy celownik
                // Jeśli nie, pokazujemy celownik
                const uiScene = this.scene.scene.get('UIScene');
                if (uiScene && uiScene.menuOpen) {
                    this.crosshair.setVisible(false);
                    if (this.cooldownRing) this.cooldownRing.setVisible(false);
                } else {
                    this.crosshair.setVisible(true);
                    if (this.cooldownRing) this.cooldownRing.setVisible(true);
                }
            }
        }
        
        // Aktualizujemy cooldownRing, jeśli istnieje
        if (this.cooldownRing && !this.cooldownRing.destroyed && this.isCooldownActive) {
            const progress = 1 - Math.min(1, (time - this.lastShotTime) / this.shotCooldown);
            this.cooldownRing.radius = 12 * progress; // Zmiana promienia w zależności od postępu
            
            // Zapewniamy, że cooldownRing podąża za celownikiem
            this.cooldownRing.x = this.crosshair ? this.crosshair.x : 400;
            this.cooldownRing.y = this.crosshair ? this.crosshair.y : 300;
        }
        
        // Pokazujemy cooldown na celowniku
        if (this.isCooldownActive && this.crosshairOuter) {
            const progress = Math.min(1, (time - this.lastShotTime) / this.shotCooldown);
            // Zmiana koloru celownika na szary podczas cooldownu, stopniowo przywracany do normalnego
            const cooldownColor = Phaser.Display.Color.Interpolate.ColorWithRGB(
                0x888888, // Kolor szary 
                this.normalColor, // Docelowy kolor 
                100, // Ilość kroków
                progress * 100 // Aktualny krok
            );
            this.crosshairOuter.setStrokeStyle(1.5, cooldownColor.color);
            this.crosshairInner.setFillStyle(cooldownColor.color);
        }
        
        // Automatyczne strzelanie w trybie auto
        if (window.gameData.autoMode) {
            const hero = this.scene.playerSystem?.getHero();
            if (hero && hero.active && !hero.isDead) {
                // Sprawdzamy czy minął cooldown
                if (time > this.lastShotTime + this.shotCooldown) {
                    // Szukamy najbliższego wroga
                    const nearestEnemy = this.getNearestEnemy(hero.x, hero.y);
                    
                    if (nearestEnemy) {
                        this.autoShootAt(nearestEnemy);
                    }
                }
            }
        }
    }
} 