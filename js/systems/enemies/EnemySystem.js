import { logger } from '../../services/LogService.js';
import Enemy from '../../entities/Enemy.js';

// Definicje typów wrogów
const ENEMY_TYPES = {
    MINION: {
        name: 'Pajątek',
        healthMultiplier: 0.6,
        damageMultiplier: 0.7,
        speedMultiplier: 1.5,
        experienceMultiplier: 0.5,
        spawnChance: 0.40, // 40% szans na pojawienie się
        color: 0x88ff88, // Jasnozielony
        scale: 0.6
    },
    STANDARD: {
        name: 'Goblin',
        healthMultiplier: 1.0,
        damageMultiplier: 1.0,
        speedMultiplier: 1.0,
        experienceMultiplier: 1.0,
        spawnChance: 0.25, // 25% szans na pojawienie się
        color: 0xffffff, // Biały (domyślny)
        scale: 0.8
    },
    TANK: {
        name: 'Ork',
        healthMultiplier: 2.0,
        damageMultiplier: 0.8,
        speedMultiplier: 0.6,
        experienceMultiplier: 1.5,
        spawnChance: 0.20, // 20% szans na pojawienie się
        color: 0xff8844, // Pomarańczowy
        scale: 1.0
    },
    BERSERKER: {
        name: 'Berserker',
        healthMultiplier: 0.8,
        damageMultiplier: 1.7,
        speedMultiplier: 1.3,
        experienceMultiplier: 1.3,
        spawnChance: 0.10, // 10% szans na pojawienie się
        color: 0xff5555, // Czerwony
        scale: 0.85
    },
    RANGED: {
        name: 'Łucznik',
        healthMultiplier: 0.7,
        damageMultiplier: 1.2,
        speedMultiplier: 0.9,
        experienceMultiplier: 1.2,
        spawnChance: 0.15, // 15% szans na pojawienie się
        color: 0x5555ff, // Niebieski
        scale: 0.75
    },
    BOSS: {
        name: 'BOSS',
        healthMultiplier: 4.0,
        damageMultiplier: 2.0,
        speedMultiplier: 0.7,
        experienceMultiplier: 3.0,
        spawnChance: 0.05, // 5% szans na pojawienie się
        color: 0xffcc00, // Złoty
        scale: 1.2
    }
};

export default class EnemySystem {
    constructor(scene) {
        this.scene = scene;
        this.enemies = [];
        this.enemyGroup = scene.physics.add.group();
        this.waveNumber = 1;
        this.difficulty = 1.0;
        this.enemiesPerWave = 5;
        this.enemiesKilled = 0;
        this.lastSpawnTime = 0;
        this.timeBetweenWaves = 3000; // Czas między falami w ms
        this.lastWaveEndTime = 0;
        this.specialEnemiesPerWave = 1; // Liczba specjalnych przeciwników na falę
        this.lastCleanupTime = 0; // Czas ostatniego czyszczenia martwych wrogów
        
        // Zmienne dla wrogów
        this.baseSpawnInterval = 7000; // Bazowy interwał spawnowania wrogów w ms
        this.spawnInterval = this.baseSpawnInterval; // Aktualny interwał spawnowania
        this.enemySpeed = 50; // Prędkość wrogów
        this.enemyHealth = 100; // Zdrowie bazowe wroga
        this.enemyDamage = 10; // Obrażenia wroga
        
        // Licznik spawn burst - ile wrogów pojawia się jednocześnie
        this.spawnBurstCount = 1; // Początkowo tylko 1 wróg na raz
        
        // Stałe pozycji
        this.GROUND_LEVEL = 500; // Poziom ziemi
        this.ENEMY_SPAWN_X = 850; // Pozycja pojawiania się wrogów (poza ekranem z prawej)
        
        // Liczniki typów wrogów do statystyk
        this.enemyTypeStats = {
            MINION: 0,
            STANDARD: 0,
            TANK: 0,
            BERSERKER: 0,
            RANGED: 0,
            BOSS: 0
        };
        
        // Pool obiektów wrogów dla optymalizacji
        this.enemyPool = [];
        this.maxEnemiesOnScreen = 30; // Maksymalna liczba wrogów na ekranie
        
        // Licznik klatek dla optymalizacji aktualizacji
        this.frameCounter = 0;
        
        // Zmienne dla systemu fal czasowych
        this.waveDuration = 30000; // Czas trwania fali: 30 sekund
        this.waveStartTime = 0; // Czas rozpoczęcia aktualnej fali
        this.waveTimeLeft = 0; // Pozostały czas fali
        this.waveTimeText = null; // Tekst wyświetlający pozostały czas fali
    }
    
    initialize() {
        // Tworzymy grupę wrogów
        this.enemyGroup = this.scene.physics.add.group({
            runChildUpdate: false // Wyłączamy automatyczną aktualizację dzieci - będziemy ją kontrolować ręcznie
        });
        
        // Inicjalizacja puli wrogów
        this.initializeEnemyPool(20); // Na początek tworzymy 20 nieaktywnych wrogów w puli
        
        // Dodajemy timer do spawnowania wrogów - WAŻNE: poprawne wiązanie this
        this.spawnEnemyBurst = this.spawnEnemyBurst.bind(this);
        this.enemySpawnTimer = this.scene.time.addEvent({
            delay: this.spawnInterval,
            callback: this.spawnEnemyBurst,
            callbackScope: this,
            loop: true
        });
        
        // Ustawiamy czas rozpoczęcia pierwszej fali
        this.waveStartTime = this.scene.time.now;
        
        // Pokazujemy komunikat o pierwszej fali
        this.showWaveStartEffect();
        
        // Emitujemy zdarzenie informujące o aktualnym numerze fali
        this.scene.events.emit('waveChanged', this.waveNumber);
        
        // Debugowanie
        console.log("EnemySystem zainicjalizowany, waveStartTime =", this.waveStartTime);
    }
    
    // Inicjalizacja puli wrogów
    initializeEnemyPool(count) {
        for (let i = 0; i < count; i++) {
            const enemy = new Enemy(this.scene, -100, -100, 100, 10, 50);
            enemy.setActive(false);
            enemy.setVisible(false);
            this.enemyPool.push(enemy);
            this.enemyGroup.add(enemy);
        }
    }
    
    // Pobieranie wroga z puli
    getEnemyFromPool() {
        // Najpierw sprawdzamy czy mamy już za dużo aktywnych wrogów
        const activeEnemies = this.enemyGroup.getChildren().filter(enemy => enemy.active);
        if (activeEnemies.length >= this.maxEnemiesOnScreen) {
            return null;
        }
        
        // Szukamy nieaktywnego wroga w puli
        for (let enemy of this.enemyPool) {
            if (!enemy.active) {
                return enemy;
            }
        }
        
        // Jeśli nie ma dostępnych wrogów, tworzymy nowego i dodajemy do puli
        const newEnemy = new Enemy(this.scene, -100, -100, 100, 10, 50);
        newEnemy.setActive(false);
        newEnemy.setVisible(false);
        this.enemyPool.push(newEnemy);
        this.enemyGroup.add(newEnemy);
        
        return newEnemy;
    }
    
    // Nowa metoda: spawnuje grupę wrogów na raz (burst)
    spawnEnemyBurst() {
        // Spawnujemy kilku wrogów na raz, ale tylko jeśli mamy miejsce
        // Skalujemy liczbę wrogów w zależności od numeru fali
        const waveBurstBonus = Math.min(5, Math.floor((this.waveNumber - 1) / 2)); // +1 wróg co 2 fale, max +5
        let spawnCount = Math.min(
            this.spawnBurstCount + waveBurstBonus,
            this.maxEnemiesOnScreen - this.getActiveEnemiesCount()
        );
        
        // Logujemy informacje o spawnowaniu
        logger.debug(`Spawning burst of ${spawnCount} enemies in wave ${this.waveNumber}`, "ENEMY_SPAWN");
        
        for (let i = 0; i < spawnCount; i++) {
            // Dodajemy małe opóźnienie między poszczególnymi wrogami w burst
            // Im wyższa fala, tym mniejsze opóźnienie (szybsze pojawianie się wrogów)
            const spawnDelay = Math.max(50, 200 - (this.waveNumber - 1) * 15);
            
            this.scene.time.delayedCall(i * spawnDelay, () => {
                this.spawnEnemy();
            });
        }
    }
    
    // Zliczanie aktywnych wrogów
    getActiveEnemiesCount() {
        return this.enemyGroup.getChildren().filter(enemy => enemy.active).length;
    }
    
    // Decyduje o typie wroga na podstawie szans na pojawienie się
    getRandomEnemyType() {
        // Im wyższa fala, tym większa szansa na trudniejszych przeciwników
        const waveBonus = (this.waveNumber - 1) * 0.03; // Bonus 3% na falę
        
        // Gwarantowany BOSS co 10 fal
        if (this.waveNumber % 10 === 0 && this.enemiesKilled === this.enemiesPerWave - 1) {
            return 'BOSS';
        }
        
        const roll = Math.random();
        let cumulativeChance = 0;
        
        // Uwzględniamy bonus fali - zwiększając szanse na trudniejszych przeciwników
        const adjustedChances = {
            BOSS: ENEMY_TYPES.BOSS.spawnChance + waveBonus,
            BERSERKER: ENEMY_TYPES.BERSERKER.spawnChance + waveBonus * 0.7,
            RANGED: ENEMY_TYPES.RANGED.spawnChance + waveBonus * 0.6,
            TANK: ENEMY_TYPES.TANK.spawnChance + waveBonus * 0.5,
            STANDARD: ENEMY_TYPES.STANDARD.spawnChance - waveBonus * 0.3,
            MINION: ENEMY_TYPES.MINION.spawnChance - waveBonus * 0.5
        };
        
        // Normalizujemy szanse, aby sumowały się do 1
        const totalChance = Object.values(adjustedChances).reduce((a, b) => a + b, 0);
        for (const type in adjustedChances) {
            adjustedChances[type] /= totalChance;
        }
        
        // Wybieramy typ wroga
        for (const type in adjustedChances) {
            cumulativeChance += adjustedChances[type];
            if (roll < cumulativeChance) {
                return type;
            }
        }
        
        // Domyślnie zwracamy standardowego wroga
        return 'STANDARD';
    }
    
    spawnEnemy() {
        logger.debug("Wywołano spawnEnemy()", "ENEMY_SPAWN");
        
        // Pobieramy wroga z puli zamiast tworzenia nowego
        const enemy = this.getEnemyFromPool();
        if (!enemy) {
            logger.debug("Nie można spawnować wroga - osiągnięto limit lub brak dostępnych w puli", "ENEMY_SPAWN");
            return;
        }
        
        // Wrogowie spawnują się z prawej strony (zza kamery) - zawsze na poziomie ziemi
        const y = this.GROUND_LEVEL - 25; // Pozycja Y na poziomie ziemi
        
        // Wybieramy typ wroga
        const enemyType = this.getRandomEnemyType();
        const enemyTypeData = ENEMY_TYPES[enemyType];
        
        // Aktualizujemy statystyki typów wrogów
        this.enemyTypeStats[enemyType]++;
        
        // Obliczamy bonus za falę - silniejsze skalowanie statystyk wrogów z każdą falą
        const waveBonus = Math.pow(1.1, this.waveNumber - 1); // Wykładniczy wzrost trudności: 10% na falę
        
        // Skalujemy parametry wroga zgodnie z trudnością, typem i numerem fali
        const health = Math.floor(this.enemyHealth * this.difficulty * enemyTypeData.healthMultiplier * waveBonus);
        const damage = Math.floor(this.enemyDamage * this.difficulty * enemyTypeData.damageMultiplier * waveBonus);
        const speed = Math.floor(this.enemySpeed * (0.8 + this.difficulty * 0.2) * enemyTypeData.speedMultiplier * (1 + (this.waveNumber - 1) * 0.05));
        const exp = Math.floor(20 * this.difficulty * enemyTypeData.experienceMultiplier * (1 + (this.waveNumber - 1) * 0.1));
        
        // Nieznaczna wariacja pozycji Y dla różnych typów wrogów
        const offsetY = enemyType === 'MINION' ? 10 : (enemyType === 'BOSS' ? -20 : 0);
        
        // Resetujemy wroga do nowego stanu
        enemy.reset(this.ENEMY_SPAWN_X, y + offsetY, health, damage, speed);
        enemy.setActive(true);
        enemy.setVisible(true);
        
        // Upewniamy się, że grafika wroga jest widoczna i aktywna
        if (enemy.enemyBody) {
            enemy.enemyBody.setVisible(true);
            enemy.enemyBody.setAlpha(1);
            // Upewniam się, że głębokość jest ustawiona tak, aby ciało było widoczne
            enemy.enemyBody.setDepth(1);
        } else {
            // Jeśli z jakiegoś powodu enemyBody nie istnieje, tworzymy je
            enemy.enemyBody = this.scene.add.rectangle(
                enemy.x, 
                enemy.y, 
                40, 
                40, 
                enemyTypeData.color
            );
            enemy.enemyBody.setDepth(1);
        }
        
        // Ustawiamy typ wroga i jego właściwości używając naszej metody
        enemy.setEnemyType(enemyType);
        
        // Dostosowujemy szerokość paska zdrowia do rozmiaru wroga
        enemy.healthBarBg.width = 40 * enemyTypeData.scale;
        enemy.healthBar.width = 40 * enemyTypeData.scale;
        
        // Dodajemy niestandardową obronę w zależności od typu
        if (enemyType === 'TANK') {
            enemy.defense = 15; // Wyższa obrona dla tanków
            
            // Dodatkowe zabezpieczenie dla widoczności Orków
            if (enemy.enemyBody) {
                enemy.enemyBody.fillColor = 0xff8844; // Pomarańczowy
                enemy.enemyBody.width = 50;
                enemy.enemyBody.height = 50;
            }
        } else if (enemyType === 'BOSS') {
            enemy.defense = 25; // Najwyższa obrona dla bossów
        }
        
        // Inicjalizujemy efekty specjalne dla danego typu wroga
        enemy.initSpecialEffects();
        
        // Ustawiamy ruch - pierwotnie poruszają się w lewo, ale będą podążać za bohaterem
        enemy.setHorizontalMovement(false); // Wyłączamy ruch tylko w poziomie, aby mogli podążać za bohaterem
        enemy.setVelocityX(-speed); // Początkowy ruch w lewo
        
        // Dostosowanie ruchu w zależności od typu wroga
        switch (enemyType) {
            case 'MINION':
                // Miniony są szybkie i zwinne - pozwalamy na pełny ruch 2D
                enemy.horizontalMovementOnly = false;
                break;
            case 'BERSERKER':
                // Berserkerzy są agresywni i elastyczni - mogą poruszać się w dowolnym kierunku
                enemy.horizontalMovementOnly = false;
                break;
            case 'BOSS':
                // Bossy są potężne, ale mniej zwinne - ograniczamy ruch w pionie
                enemy.horizontalMovementOnly = true;
                break;
            case 'TANK':
                // Tanki są powolne - ograniczamy ruch w pionie
                enemy.horizontalMovementOnly = true;
                break;
            case 'RANGED':
                // Łucznicy poruszają się, zatrzymują i strzelają
                enemy.horizontalMovementOnly = false;
                enemy.isRanged = true;
                enemy.projectileSpeed = 250;
                enemy.attackRange = 300; // Zasięg ataku
                enemy.attackCooldown = 2000; // Dłuższy cooldown dla ataków dystansowych
                break;
            case 'STANDARD':
            default:
                // Standardowe jednostki mogą poruszać się w obu kierunkach, ale z ograniczeniami
                enemy.horizontalMovementOnly = false;
                break;
        }
        
        // Dodajemy wroga do grupy
        this.enemyGroup.add(enemy);
        
        // Debugowanie: Sprawdzamy, czy wróg został dodany do grupy
        logger.debug(`${enemyTypeData.name} utworzony: x=${enemy.x}, y=${enemy.y}, health=${health}, damage=${damage}, speed=${speed}`, "ENEMY_SPAWN");
        logger.debug(`Liczba wrogów w grupie: ${this.enemyGroup.getChildren().length}`, "ENEMY_SPAWN");
        
        // Zwiększamy wartość doświadczenia w zależności od poziomu trudności i typu wroga
        enemy.experienceValue = exp;
        
        // Aktualizujemy czas ostatniego spawnowania
        this.lastSpawnTime = this.scene.time.now;
        
        return enemy;
    }
    
    findClosestEnemy(hero) {
        if (!this.enemyGroup) return null;
        
        const enemies = this.enemyGroup.getChildren().filter(enemy => enemy.active && !enemy.isDead);
        if (enemies.length === 0) return null;
        
        // Optymalizacja: zamiast filtrować tablicę, po prostu wybieramy wroga bezpośrednio
        let closestEnemy = null;
        let minDistance = Infinity;
        
        for (const enemy of enemies) {
            // Tylko wrogowie po prawej
            if (enemy.x <= hero.x) continue;
            
            const distance = enemy.x - hero.x; // Tylko odległość w poziomie
            if (distance < minDistance) {
                minDistance = distance;
                closestEnemy = enemy;
            }
        }
        
        // Jeśli nie ma wrogów po prawej, sprawdzamy po lewej
        if (!closestEnemy) {
            for (const enemy of enemies) {
                const distance = Math.abs(hero.x - enemy.x);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestEnemy = enemy;
                }
            }
        }
        
        return closestEnemy;
    }
    
    // Rozpoczyna nową falę przeciwników
    startNewWave() {
        // Zwiększamy numer fali (dla pierwszej fali pozostaje 1)
        if (this.waveNumber >= 1) {
            this.waveNumber++;
        }
        
        logger.info(`Rozpoczynam falę: ${this.waveNumber}`, "ENEMY_SYSTEM");
        
        // Nie ustawiamy tutaj czasu fali, ponieważ jest on już ustawiony w update()
        this.waveTimeLeft = this.waveDuration;
        
        // Logowanie do debugowania
        logger.info(`Czas początku fali: ${this.waveStartTime}, czas trwania: ${this.waveDuration}`, "ENEMY_SYSTEM");
        
        // Zwiększamy poziom trudności wraz z falą
        const baseDifficulty = 1.0;
        const difficultyPerWave = 0.15; // Zwiększamy o 15% na falę
        this.difficulty = baseDifficulty + (this.waveNumber - 1) * difficultyPerWave;
        
        // Aktualizujemy statystyki wrogów dla nowej fali
        this.updateEnemyStats();
        
        // Zwiększamy ilość wrogów pojawiających się na raz
        this.spawnBurstCount = Math.min(10, 1 + Math.floor(this.waveNumber / 2));
        
        // Zmniejszamy interwał spawnowania wrogów (częstsze spawny w wyższych falach)
        const spawnIntervalReduction = Math.min(0.7, 0.05 * this.waveNumber); // Maksymalnie 70% redukcji
        this.spawnInterval = Math.max(1000, this.baseSpawnInterval * (1 - spawnIntervalReduction));
        
        // Aktualizujemy timer spawnowania wrogów
        if (this.enemySpawnTimer) {
            this.enemySpawnTimer.remove();
        }
        this.enemySpawnTimer = this.scene.time.addEvent({
            delay: this.spawnInterval,
            callback: this.spawnEnemyBurst,
            callbackScope: this,
            loop: true
        });
        
        // Powiadamiamy o nowej fali
        this.scene.events.emit('waveChanged', this.waveNumber);
        
        // Spawnujemy nową grupę przeciwników
        this.spawnEnemyBurst();
        
        // Efekt wizualny nowej fali
        this.showWaveStartEffect();
    }
    
    // Efekt wizualny rozpoczęcia nowej fali
    showWaveStartEffect() {
        const waveText = this.scene.add.text(400, 250, `FALA ${this.waveNumber}`, {
            fontSize: '36px',
            fill: '#ff9900',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(100);
        
        // Animacja tekstu
        this.scene.tweens.add({
            targets: waveText,
            scale: { from: 0.5, to: 1.5 },
            alpha: { from: 1, to: 0 },
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                waveText.destroy();
            }
        });
    }
    
    // Wyświetla statystyki pokonanych wrogów
    showEnemyStats() {
        const totalEnemies = Object.values(this.enemyTypeStats).reduce((a, b) => a + b, 0);
        
        let statsText = 'STATYSTYKI WROGÓW:\n';
        for (const type in this.enemyTypeStats) {
            const percent = totalEnemies > 0 ? (this.enemyTypeStats[type] / totalEnemies * 100).toFixed(1) : '0.0';
            statsText += `${ENEMY_TYPES[type].name}: ${this.enemyTypeStats[type]} (${percent}%)\n`;
        }
        
        const statsDisplay = this.scene.add.text(400, 280, statsText, {
            fontSize: '16px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);
        
        this.scene.tweens.add({
            targets: statsDisplay,
            alpha: { from: 1, to: 0 },
            y: 250,
            duration: 5000,
            ease: 'Sine.easeIn',
            onComplete: () => statsDisplay.destroy()
        });
    }
    
    // Metoda wywoływana po zabiciu wroga
    enemyKilled() {
        // Zwiększamy licznik zabitych wrogów
        this.enemiesKilled++;
        
        // Dodatkowe czyszczenie - usuwamy martwych wrogów, którzy jeszcze nie zostali zdezaktywowani
        this.cleanupDeadEnemies();
        
        // Modyfikacja statystyk wrogów w zależności od fali
        // Można tu dodać logikę premiującą gracza za szybkie zabijanie wrogów
    }
    
    // Metoda do usuwania martwych wrogów
    cleanupDeadEnemies() {
        if (!this.enemyGroup) return;
        
        const enemies = this.enemyGroup.getChildren();
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.isDead) {
                // Upewniamy się, że wróg jest całkowicie nieaktywny
                enemy.setActive(false);
                enemy.setVisible(false);
                
                // Usuwamy wszystkie pozostałe elementy UI
                if (enemy.healthBarBg) {
                    enemy.healthBarBg.destroy();
                    enemy.healthBarBg = null;
                }
                
                if (enemy.healthBar) {
                    enemy.healthBar.destroy();
                    enemy.healthBar = null;
                }
                
                if (enemy.levelText) {
                    enemy.levelText.destroy();
                    enemy.levelText = null;
                }
                
                // Ukrywamy ciało graficzne, ale nie niszczymy go
                if (enemy.enemyBody) {
                    enemy.enemyBody.setVisible(false);
                }
                
                // Usuwamy wroga z grupy, ale zachowujemy go w puli
                this.enemyGroup.remove(enemy, false);
            }
        }
    }
    
    getEnemyGroup() {
        return this.enemyGroup;
    }
    
    update(time) {
        // Dodajemy debugowanie, aby sprawdzić czy metoda update jest wywoływana
        if (this.frameCounter % 60 === 0) { // Co około sekundę
            console.log(`EnemySystem.update() wywołane, czas: ${time}, waveStartTime: ${this.waveStartTime}, różnica: ${time - this.waveStartTime}ms`);
        }
        this.frameCounter++;
        
        // Aktualizujemy pozostały czas fali
        if (this.waveStartTime > 0) {
            const elapsed = time - this.waveStartTime;
            this.waveTimeLeft = Math.max(0, this.waveDuration - elapsed);
            
            // Jeśli czas fali się skończył, rozpoczynamy nową falę
            if (this.waveTimeLeft <= 0) {
                logger.info(`Czas fali ${this.waveNumber} się skończył! Rozpoczynam nową falę.`, "ENEMY_SYSTEM");
                this.waveStartTime = time; // Aktualizujemy czas rozpoczęcia nowej fali
                this.startNewWave();
            }
        } else {
            // Jeśli z jakiegoś powodu waveStartTime nie jest ustawiony, naprawiamy to
            console.error("waveStartTime nie był ustawiony!", time);
            this.waveStartTime = time;
            this.waveTimeLeft = this.waveDuration;
        }
        
        // Aktualizujemy pozycje wrogów
        if (this.enemyGroup) {
            this.enemyGroup.getChildren().forEach(enemy => {
                if (enemy.active && enemy.update) {
                    enemy.update();
                }
            });
            
            // Regularnie czyścimy martwych wrogów
            if (!this.cleanupTimer || time > this.lastCleanupTime + 1000) {
                this.cleanupDeadEnemies();
                this.lastCleanupTime = time;
            }
        }
    }
    
    // Aktualizuje statystyki wrogów w zależności od numeru fali
    updateEnemyStats() {
        // Bazowe statystyki wrogów
        const baseHealth = 100;
        const baseDamage = 10;
        const baseSpeed = 50;
        
        // Współczynnik wzrostu trudności dla każdej fali
        const healthGrowth = 1.15; // +15% zdrowia na falę
        const damageGrowth = 1.1;  // +10% obrażeń na falę
        const speedGrowth = 1.05;  // +5% prędkości na falę
        
        // Aktualizujemy bazowe statystyki wrogów w zależności od numeru fali
        this.enemyHealth = Math.floor(baseHealth * Math.pow(healthGrowth, this.waveNumber - 1));
        this.enemyDamage = Math.floor(baseDamage * Math.pow(damageGrowth, this.waveNumber - 1));
        this.enemySpeed = Math.floor(baseSpeed * Math.pow(speedGrowth, this.waveNumber - 1));
        
        // Logujemy nowe statystyki
        logger.info(`Zaktualizowano statystyki wrogów dla fali ${this.waveNumber}:`, "ENEMY_SYSTEM");
        logger.info(`- Zdrowie: ${this.enemyHealth}`, "ENEMY_SYSTEM");
        logger.info(`- Obrażenia: ${this.enemyDamage}`, "ENEMY_SYSTEM");
        logger.info(`- Prędkość: ${this.enemySpeed}`, "ENEMY_SYSTEM");
    }
} 