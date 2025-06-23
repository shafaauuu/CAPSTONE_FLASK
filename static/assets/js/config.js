/**
 * Global configuration settings for the CAPSTONE_FLASK frontend.
 * This file centralizes configuration values that might need to change between environments.
 */

// Base URL for the backend API
const API_CONFIG = {
    BASE_URL: "http://127.0.0.1:3000"
};

// Prevent modification of the configuration object
Object.freeze(API_CONFIG);
