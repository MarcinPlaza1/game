// Deklaracja typu dla usługi logowania
export interface Logger {
    LEVELS: {
        DEBUG: number;
        INFO: number;
        WARN: number;
        ERROR: number;
    };
    enabledCategories: {
        [category: string]: boolean;
    };
    setLevel(level: number): void;
    setCategory(category: string, enabled: boolean): void;
    debug(message: string, category?: string): void;
    info(message: string, category?: string): void;
    warn(message: string, category?: string): void;
    error(message: string, category?: string): void;
}

export const logger: Logger; 