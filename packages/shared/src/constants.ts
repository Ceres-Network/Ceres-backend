export const STROOPS_PER_USDC = 10_000_000n;

export const RAINFALL_MULTIPLIER = 100;
export const NDVI_MULTIPLIER = 10_000;
export const SOIL_MOISTURE_MULTIPLIER = 100;

export const CONTRACT_ADDRESSES = {
  POOL: process.env.POOL_CONTRACT || '',
  POLICY: process.env.POLICY_CONTRACT || '',
  ORACLE: process.env.ORACLE_CONTRACT || '',
  TRIGGER: process.env.TRIGGER_CONTRACT || '',
};

export const STELLAR_CONFIG = {
  NETWORK: process.env.STELLAR_NETWORK || 'testnet',
  RPC_URL: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  HORIZON_URL: process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org',
};

export const WEATHER_API_URLS = {
  OPEN_METEO: process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1',
  NASA_POWER: process.env.NASA_POWER_BASE_URL || 'https://power.larc.nasa.gov/api',
  CHIRPS: process.env.CHIRPS_BASE_URL || 'https://climateserv.servirglobal.net',
};

export const ORACLE_NODE = {
  PUBLIC_KEY: process.env.ORACLE_NODE_PUBLIC_KEY || '',
  SECRET_KEY: process.env.ORACLE_NODE_SECRET_KEY || '',
};

export const FEEDER_INTERVALS = {
  RAINFALL_HOURS: 6,
  NDVI_HOURS: 12,
  SOIL_MOISTURE_HOURS: 12,
  DEDUPLICATION_HOURS: 6,
};

export const INDEXER_CONFIG = {
  POLL_INTERVAL_MS: 10_000,
  MAX_RETRY_ATTEMPTS: 3,
  BACKOFF_BASE_MS: 1000,
};

export const API_CONFIG = {
  PORT: parseInt(process.env.API_PORT || '3001', 10),
  API_KEY: process.env.API_KEY || '',
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};
