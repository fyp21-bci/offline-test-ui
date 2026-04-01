/**
 * Utility for persisting and retrieving configuration objects from localStorage.
 */

export const STORAGE_KEYS = {
    REAL_TIME_CONFIG: 'bci_real_time_config',
    GAME_MODE_CONFIG: 'bci_game_mode_config',
    OFFLINE_CONFIG: 'bci_offline_config',
    QUESTIONNAIRE_MODE_CONFIG: 'bci_questionnaire_mode_config',
};

export const ConfigPersistence = {
    /**
     * Save configuration to localStorage
     * @param key Storage key
     * @param config Configuration object
     */
    save: <T>(key: string, config: T): void => {
        try {
            const serialized = JSON.stringify(config);
            localStorage.setItem(key, serialized);
        } catch (e) {
            console.error('Failed to save configuration to localStorage', e);
        }
    },

    /**
     * Load configuration from localStorage
     * @param key Storage key
     * @returns The configuration object or null if not found
     */
    load: <T>(key: string): T | null => {
        try {
            const serialized = localStorage.getItem(key);
            if (serialized === null) return null;
            return JSON.parse(serialized) as T;
        } catch (e) {
            console.error('Failed to load configuration from localStorage', e);
            return null;
        }
    },

    /**
     * Check if a configuration exists in localStorage
     * @param key Storage key
     * @returns true if exists, false otherwise
     */
    exists: (key: string): boolean => {
        return localStorage.getItem(key) !== null;
    }
};
