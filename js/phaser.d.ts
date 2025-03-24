// Type definitions for Phaser 3
// Project: https://phaser.io/
// Simplified declaration file for this project

declare namespace Phaser {
    // Constants
    const AUTO: number;
    const CANVAS: number;
    const WEBGL: number;
    
    // Klasa Scene jako własność Phaser
    const Scene: {
        prototype: Scene;
        new(config: any): Scene;
    };
    
    // Namespaces
    namespace Types {
        namespace Core {
            interface GameConfig {
                type: number;
                width: number;
                height: number;
                parent?: string | HTMLElement;
                canvas?: HTMLCanvasElement;
                context?: CanvasRenderingContext2D;
                scene?: Scene | Scene[] | any[] | any;
                seed?: string[];
                title?: string;
                url?: string;
                version?: string;
                autoFocus?: boolean;
                input?: boolean | InputConfig;
                disableContextMenu?: boolean;
                transparent?: boolean;
                fps?: FPSConfig;
                render?: RenderConfig;
                backgroundColor?: string | number;
                callbacks?: CallbacksConfig;
                physics?: PhysicsConfig;
                loader?: LoaderConfig;
                images?: ImagesConfig;
                dom?: DOMContainerConfig;
                plugins?: PluginObject | PluginObjectItem[];
                scale?: ScaleConfig;
                audio?: AudioConfig;
                pipeline?: PipelineConfig;
                banner?: BannerConfig;
                zoom?: number;
                disableVisibilityChange?: boolean;
            }

            interface FPSConfig {
                min?: number;
                target?: number;
                forceSetTimeOut?: boolean;
                deltaHistory?: number;
                panicMax?: number;
            }

            interface RenderConfig {
                antialias?: boolean;
                pixelArt?: boolean;
                autoResize?: boolean;
                roundPixels?: boolean;
                transparent?: boolean;
                clearBeforeRender?: boolean;
                premultipliedAlpha?: boolean;
                preserveDrawingBuffer?: boolean;
                failIfMajorPerformanceCaveat?: boolean;
                powerPreference?: string;
                batchSize?: number;
                maxLights?: number;
                maxTextures?: number;
                mipmapFilter?: string;
                desynchronized?: boolean;
                backgroundColor?: number;
                disableContextMenu?: boolean;
            }

            interface PhysicsConfig {
                default?: string;
                arcade?: {
                    gravity?: { x?: number; y?: number };
                    debug?: boolean;
                    fps?: number;
                    timeScale?: number;
                    maxSubSteps?: number;
                    skipQuadTree?: boolean;
                    overlapBias?: number;
                    tileBias?: number;
                    forceX?: boolean;
                };
                matter?: any;
            }

            interface InputConfig {}
            interface LoaderConfig {}
            interface ImagesConfig {}
            interface DOMContainerConfig {}
            interface CallbacksConfig {}
            interface PluginObject {}
            interface PluginObjectItem {}
            interface ScaleConfig {}
            interface AudioConfig {}
            interface PipelineConfig {}
            interface BannerConfig {}
        }
    }
    
    // Classes
    class Game {
        constructor(config: Types.Core.GameConfig);

        scene: {
            scenes: Scene[];
            add(key: string, sceneConfig: any, autoStart?: boolean, data?: any): Scene;
            start(key: string, data?: any): boolean;
            switch(key: string, data?: any): boolean;
            stop(key: string): Phaser.Game;
            launch(key: string, data?: any): boolean;
            isActive(key: string): boolean;
            keys: { [key: string]: Scene };
            get(key: string): Scene;
        };

        loop: {
            actualFps: number;
        };

        physics: {
            arcade: {
                world: {
                    setBounds(x: number, y: number, width: number, height: number, checkLeft?: boolean, checkRight?: boolean, checkUp?: boolean, checkDown?: boolean): any;
                    drawDebug: boolean;
                    debugGraphic: any;
                };
            };
        };

        input: any;
        events: {
            on(event: string, callback: Function, context?: any): void;
            off(event: string, callback: Function, context?: any): void;
            emit(event: string, ...args: any[]): void;
        };
        destroy(removeCanvas?: boolean): void;
    }
    
    namespace Input {
        namespace Keyboard {
            interface Key {
                isDown: boolean;
                isUp: boolean;
                duration: number;
                timeDown: number;
                timeUp: number;
                repeats: number;
                on(event: string, callback: Function, context?: any): this;
            }
            
            const KeyCodes: {
                A: number;
                B: number;
                C: number;
                D: number;
                E: number;
                F: number;
                P: number;
                Q: number;
                S: number;
                T: number;
                W: number;
                SPACE: number;
                F2: number;
                F3: number;
                F4: number;
                F5: number;
            };
        }
    }
    
    namespace Physics {
        namespace Arcade {
            interface Collider {
                destroy(): void;
            }
        }
    }
    
    namespace Sound {
        interface BaseSound {
            play(config?: any): this;
            stop(): this;
            pause(): this;
            resume(): this;
            setVolume(volume: number): this;
            setLoop(value: boolean): this;
        }
    }
    
    interface Scene {
        constructor(config: any);

        sys: {
            settings: {
                key: string;
                active: boolean;
            };
            game: Game;
        };

        add: GameObjects.GameObjectFactory;
        tweens: {
            add(config: any): any;
        };
        
        physics: {
            world: {
                drawDebug: boolean;
                debugGraphic: any;
            };
        };
        input: {
            keyboard: {
                addKey(keyCode: number): Input.Keyboard.Key;
                createCursorKeys(): any;
                once(event: string, callback: Function, context?: any): any;
            };
            once(event: string, callback: Function, context?: any): any;
        };
        cameras: {
            main: {
                width: number;
                height: number;
            };
        };
        load: {
            audio(key: string, url: string): void;
            image(key: string, url: string): void;
            on(event: string, callback: Function, context?: any): void;
        };
        sound: {
            add(key: string, config?: any): Sound.BaseSound;
        };
        scene: {
            start(key: string, data?: any): void;
            launch(key: string, data?: any): void;
            pause(key: string): void;
            resume(key: string): void;
            stop(key: string): void;
            get(key: string): Scene;
        };
        textures: {
            exists(key: string): boolean;
        };
        cache: {
            audio: {
                add(key: string, data: any): void;
                exists(key: string): boolean;
            };
        };
        make: {
            text(config: any): GameObjects.Text;
            graphics(config?: any): GameObjects.Graphics;
        };
        events: {
            emit(event: string, ...args: any[]): void;
            on(event: string, callback: Function, context?: any): void;
        };
        time: {
            now: number;
            addEvent(config: any): any;
            delayedCall(delay: number, callback: Function, context?: any, ...args: any[]): any;
        };
        
        preload(): void;
        create(): void;
        update(time: number, delta: number): void;
        
        // Dodatkowe właściwości dla SafeGameObjectFactory
        safeAdd(): any;
        _safeAdd?: any;
    }
    
    // Game Objects
    namespace GameObjects {
        interface GameObject {
            scene: Scene;
            type: string;
            name: string;
            active: boolean;
            tabIndex: number;
            visible: boolean;
            x: number;
            y: number;
            depth: number;
            scale: number;
            scaleX: number;
            scaleY: number;
            angle: number;
            rotation: number;
            alpha: number;
            width: number;
            height: number;
            
            setAlpha(alpha: number): this;
            setAngle(angle: number): this;
            setDepth(depth: number): this;
            setOrigin(x: number, y?: number): this;
            setPosition(x: number, y?: number): this;
            setRotation(rotation: number): this;
            setScale(x: number, y?: number): this;
            setVisible(value: boolean): this;
            setX(x: number): this;
            setY(y: number): this;
            destroy(): void;
            setInteractive(config?: any): this;
            on(event: string, callback: Function, context?: any): this;
        }
        
        interface Arc extends GameObject {
            radius: number;
            startAngle: number;
            endAngle: number;
            anticlockwise: boolean;
            destroyed: boolean;
        }
        
        interface Text extends GameObject {
            text: string;
            setText(text: string): this;
            setStyle(style: any): this;
            setFontSize(size: number | string): this;
            setColor(color: string): this;
            setFontFamily(family: string): this;
            setBackgroundColor(color: string): this;
            setPadding(padding: any): this;
        }
        
        interface Graphics extends GameObject {
            fillStyle(color: number, alpha?: number): this;
            fillRect(x: number, y: number, width: number, height: number): this;
            fillCircle(x: number, y: number, radius: number): this;
            fillGradientStyle(topLeft: number, topRight: number, bottomLeft: number, bottomRight: number, alpha?: number): this;
            clear(): this;
            generateTexture(key: string, width: number, height: number): this;
        }
        
        interface Rectangle extends GameObject {
            width: number;
            height: number;
            fillColor: number;
        }
        
        class GameObjectFactory {
            constructor(scene: Scene);
            
            scene: Scene;
            
            circle(x: number, y: number, radius: number, fillColor?: number, fillAlpha?: number): Arc;
            text(x: number, y: number, text: string | string[], style?: any): Text;
            sprite(x: number, y: number, texture: string, frame?: string | number): Sprite;
            tileSprite(x: number, y: number, width: number, height: number, texture: string, frame?: string | number): TileSprite;
            image(x: number, y: number, texture: string, frame?: string | number): Image;
            graphics(config?: any): Graphics;
            rectangle(x: number, y: number, width: number, height: number, fillColor?: number, fillAlpha?: number): Rectangle;
        }
        
        interface Sprite extends GameObject {
            anims: any;
            body: any;
            play(key: string, ignoreIfPlaying?: boolean): this;
            setTexture(key: string, frame?: string | number): this;
            setFrame(frame: string | number): this;
        }
        
        interface TileSprite extends GameObject {
            tilePositionX: number;
            tilePositionY: number;
            setTilePosition(x: number, y?: number): this;
        }
        
        interface Image extends GameObject {}
    }
} 