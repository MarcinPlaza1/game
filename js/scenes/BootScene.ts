export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload(): void {
        // Wyświetlanie paska ładowania
        const progressBar: Phaser.GameObjects.Graphics = this.add.graphics();
        const progressBox: Phaser.GameObjects.Graphics = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(240, 270, 320, 50);
        
        const width: number = this.cameras.main.width;
        const height: number = this.cameras.main.height;
        const loadingText: Phaser.GameObjects.Text = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Ładowanie...',
            style: {
                font: '20px Arial',
                fill: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);
        
        // Aktualizacja paska ładowania
        this.load.on('progress', (value: number) => {
            console.log(`Postęp ładowania: ${Math.floor(value * 100)}%`);
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(250, 280, 300 * value, 30);
        });
        
        this.load.on('complete', () => {
            console.log('Ładowanie zasobów zakończone!');
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            
            // Tworzymy tekstury programowo zamiast ładować je z zewnątrz
            this.createTextures();
            
            // Po zakończeniu ładowania przechodzimy bezpośrednio do ekranu startowego
            this.showStartScreen();
        });
        
        // Nie ładujemy żadnych zasobów - będziemy je tworzyć programowo
        // Tworzymy puste obiekty audio zamiast ładować pliki, które powodują błędy
        this.cache.audio.add('attack', new Audio());
        this.cache.audio.add('enemyDeath', new Audio());
        this.cache.audio.add('playerHit', new Audio());
        this.cache.audio.add('jump', new Audio());
        this.cache.audio.add('dodge', new Audio());
        this.cache.audio.add('bgMusic', new Audio());
    }
    
    createTextures(): void {
        console.log("Tworzenie tekstur programowo...");
        
        // Tworzymy wspólny canvas z ustawionym willReadFrequently dla lepszej wydajności
        const canvasOptions: any = { willReadFrequently: true };
        
        // Tekstura bohatera (niebieski kwadrat) - używamy Graphics zamiast Canvas
        const heroGraphics: Phaser.GameObjects.Graphics = this.make.graphics({x: 0, y: 0, add: false, canvasOptions: canvasOptions});
        heroGraphics.fillStyle(0x0000ff);
        heroGraphics.fillRect(4, 4, 40, 40);
        heroGraphics.generateTexture('hero', 48, 48);
        
        // Tekstura wroga (czerwony kwadrat)
        const enemyGraphics: Phaser.GameObjects.Graphics = this.make.graphics({x: 0, y: 0, add: false, canvasOptions: canvasOptions});
        enemyGraphics.fillStyle(0xff0000);
        enemyGraphics.fillRect(4, 4, 40, 40);
        enemyGraphics.generateTexture('enemy', 48, 48);
        
        // Tekstura cząsteczki dla efektów specjalnych
        const particleGraphics: Phaser.GameObjects.Graphics = this.make.graphics({x: 0, y: 0, add: false, canvasOptions: canvasOptions});
        particleGraphics.fillStyle(0xffffff);
        particleGraphics.fillCircle(8, 8, 8);
        particleGraphics.generateTexture('particle', 16, 16);
        
        // Tekstura tła (niebieski gradient)
        const bgGraphics: Phaser.GameObjects.Graphics = this.make.graphics({x: 0, y: 0, add: false, canvasOptions: canvasOptions});
        // Niebo (jasnoniebieskie)
        bgGraphics.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x1E90FF, 0x1E90FF, 1);
        bgGraphics.fillRect(0, 0, 800, 600);
        bgGraphics.generateTexture('background', 800, 600);
        
        // Tekstura ziemi dla platformy
        const groundGraphics: Phaser.GameObjects.Graphics = this.make.graphics({x: 0, y: 0, add: false, canvasOptions: canvasOptions});
        groundGraphics.fillStyle(0x8B4513); // SaddleBrown
        groundGraphics.fillRect(0, 0, 800, 20);
        groundGraphics.generateTexture('ground', 800, 20);
        
        console.log("Tekstury utworzone programowo");
    }

    showStartScreen(): void {
        console.log("Pokazuję ekran startowy...");
        const width: number = this.cameras.main.width;
        const height: number = this.cameras.main.height;
        
        // Tło ekranu startowego
        const background: Phaser.GameObjects.Rectangle = this.add.rectangle(0, 0, width, height, 0x000000);
        background.setOrigin(0, 0);
        
        // Tytuł gry
        const titleText: Phaser.GameObjects.Text = this.add.text(width / 2, 100, 'TOWER DEFENSE 2D', {
            fontSize: '48px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Opis gry
        const descriptionText: Phaser.GameObjects.Text = this.add.text(width / 2, 200, 'Broń swojej wieży przed nadchodzącymi wrogami!', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        
        // Przycisk start - robimy go interaktywnym od razu
        const startButton: Phaser.GameObjects.Rectangle = this.add.rectangle(width / 2, height - 150, 200, 60, 0x00aa00).setInteractive();
        startButton.setOrigin(0.5);
        
        const startText: Phaser.GameObjects.Text = this.add.text(width / 2, height - 150, 'ROZPOCZNIJ GRĘ', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        // Inicjalizujemy zmienne globalne gry
        (window as any).gameData = {
            autoMode: false,
            enemiesKilled: 0
        };
        
        // Obsługa kliknięcia w przycisk
        startButton.on('pointerover', () => {
            startButton.fillColor = 0x00cc00;
            console.log("Najechano na przycisk");
        });
        
        startButton.on('pointerout', () => {
            startButton.fillColor = 0x00aa00;
            console.log("Zjechano z przycisku");
        });
        
        startButton.on('pointerdown', () => {
            startButton.fillColor = 0x009900;
            console.log("Przycisk wciśnięty");
        });
        
        startButton.on('pointerup', () => {
            console.log("Kliknięcie przycisku start - uruchamiam grę!");
            this.startGame();
        });
        
        // Dodajemy możliwość uruchomienia gry przez naciśnięcie spacji
        this.input.keyboard.once('keydown-SPACE', () => {
            console.log("Naciśnięto spację - uruchamiam grę!");
            this.startGame();
        });
        
        // Tylko jedno kliknięcie uruchomi grę natychmiast
        this.input.once('pointerdown', () => {
            console.log("Kliknięto gdziekolwiek - uruchamiam grę!");
            this.startGame();
        });
        
        // Informacja o autorze
        const authorText: Phaser.GameObjects.Text = this.add.text(width / 2, height - 20, 'Created by Marcin Płaza', {
            fontSize: '14px',
            fill: '#888888'
        }).setOrigin(0.5);
    }
    
    startGame(): void {
        console.log("Uruchamiam GameScene...");
        this.scene.start('GameScene');
    }

    create(): void {
        // Funkcja create jest wywoływana po zakończeniu preload
        console.log("BootScene.create() wywołane");
        // Emulujemy zdarzenie complete, gdyby nie zostało wywołane automatycznie
        if (!this.textures.exists('hero')) {
            console.log("Ręcznie wywołuję ładowanie zasobów");
            this.createTextures();
            this.showStartScreen();
        }
    }
} 