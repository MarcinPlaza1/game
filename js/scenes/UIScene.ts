export default class UIScene extends Phaser.Scene {
    private gameScene!: Phaser.Scene;
    private topBar!: Phaser.GameObjects.Rectangle;
    private waveText!: Phaser.GameObjects.Text;
    private goldText!: Phaser.GameObjects.Text;
    private autoModeText!: Phaser.GameObjects.Text;
    private controlsText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'UIScene' });
    }

    create(): void {
        // Odniesienie do głównej sceny gry
        this.gameScene = this.scene.get('GameScene');
        
        // Panel górny - tło
        this.topBar = this.add.rectangle(400, 25, 800, 50, 0x000000, 0.7);
        
        // Tworzymy teksty UI
        // Usunięto element wyniku
        
        this.waveText = this.add.text(400, 15, 'Fala: 1', {
            fontSize: '20px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);
        
        this.goldText = this.add.text(700, 15, 'Złoto: 0', {
            fontSize: '20px',
            fill: '#ffff00',
            fontStyle: 'bold'
        });
        
        // Tryb auto
        this.autoModeText = this.add.text(400, 560, 'Tryb: Ręczny', {
            fontSize: '16px',
            fill: '#ffffff'
        }).setOrigin(0.5, 0.5);
        
        // Informacja o sterowaniu
        this.controlsText = this.add.text(400, 580, 'Sterowanie: A/D - ruch w lewo/prawo, SPACJA - tryb auto', {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5, 0.5);
        
        // Nasłuchujemy na zmiany trybu automatycznego
        this.gameScene.events.on('autoModeChanged', this.updateAutoModeText, this);
        
        // Nasłuchujemy na zmiany numeru fali
        this.gameScene.events.on('waveChanged', this.updateWaveText, this);
    }
    
    updateAutoModeText(isAutoMode: boolean): void {
        this.autoModeText.setText(`Tryb: ${isAutoMode ? 'Automatyczny' : 'Ręczny'}`);
        
        // Zmieniamy kolor tekstu w zależności od trybu
        if (isAutoMode) {
            this.autoModeText.setColor('#00ff00'); // zielony dla trybu auto
        } else {
            this.autoModeText.setColor('#ffffff'); // biały dla trybu ręcznego
        }
    }
    
    updateWaveText(waveNumber: number): void {
        this.waveText.setText(`Fala: ${waveNumber}`);
    }
} 