/**
 * Servicio centralizado de configuración
 * Proporciona acceso unificado a las configuraciones de la aplicación
 */

const path = require('path');
const fs = require('fs');

/**
 * Clase para gestión centralizada de configuración
 */
class ConfigService {
  constructor() {
    // Configuración por defecto
    this.config = {
      // Configuración general
      app: {
        environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
        region: process.env.AWS_REGION || 'us-east-1',
        isLocal: process.env.IS_LOCAL === 'true' || process.env.AWS_SAM_LOCAL === 'true' || false
      },
      
      // Configuración de logs
      logger: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
        includeSensitive: process.env.LOG_INCLUDE_SENSITIVE === 'true' || false
      },
      
      // Configuración de DynamoDB
      dynamoDB: {
        tokenTable: process.env.TOKEN_TABLE || 'TidalTokens',
        playbackTable: process.env.PLAYBACK_TABLE || 'TidalPlaybackState',
        endpoint: process.env.DYNAMODB_ENDPOINT || null,
        ttlEnabled: process.env.DYNAMODB_TTL_ENABLED !== 'false',
        ttlSeconds: parseInt(process.env.DYNAMODB_TTL_SECONDS || '86400', 10) // 24 horas
      },
      
      // Configuración de Tidal API
      tidal: {
        clientId: process.env.TIDAL_CLIENT_ID || '',
        clientSecret: process.env.TIDAL_CLIENT_SECRET || '',
        apiUrl: process.env.TIDAL_API_URL || 'https://openapi.tidal.com/v2',
        apiTimeout: parseInt(process.env.TIDAL_API_TIMEOUT || '10000', 10), // 10 segundos
        countryCode: process.env.TIDAL_COUNTRY_CODE || 'US',
        soundQuality: process.env.TIDAL_SOUND_QUALITY || 'HIGH',
        streamUrlTTL: parseInt(process.env.TIDAL_STREAM_URL_TTL || '3600', 10) // 1 hora
      },
      
      // Configuración de Alexa
      alexa: {
        skillId: process.env.SKILL_ID || 'amzn1.ask.skill.local-debug',
        supportedLocales: (process.env.SUPPORTED_LOCALES || 'es-ES').split(','),
        cardTitle: process.env.CARD_TITLE || 'Tidal Música',
        defaultReprompt: process.env.DEFAULT_REPROMPT || '¿Qué te gustaría escuchar?'
      },
      
      // Configuración de cache
      cache: {
        enabled: process.env.CACHE_ENABLED !== 'false',
        defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10), // 5 minutos
        maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10) // 1000 elementos
      },
      
      // Configuración de reintentos
      retry: {
        maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
        baseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS || '1000', 10),
        maxDelayMs: parseInt(process.env.RETRY_MAX_DELAY_MS || '10000', 10)
      }
    };
    
    // Cargar configuración de archivo si existe (desarrollo local)
    this._loadConfigFile();
    
    // Validar configuración
    this._validateConfig();
    
    // Loguear configuración (solo en desarrollo)
    if (this.config.app.environment === 'development') {
      // Clonar para evitar modificar la original
      const configForLog = JSON.parse(JSON.stringify(this.config));
      
      // Ocultar secrets
      if (configForLog.tidal.clientSecret) {
        configForLog.tidal.clientSecret = '[REDACTED]';
      }
      
      console.log('Configuración cargada:', JSON.stringify(configForLog, null, 2));
    }
  }
  
  /**
   * Carga configuración desde archivo si existe
   * @private
   */
  _loadConfigFile() {
    try {
      // Intentar cargar config.json desde el directorio actual o el directorio raíz
      let configPath = path.resolve('./config.json');
      
      if (!fs.existsSync(configPath)) {
        configPath = path.resolve('../config.json');
      }
      
      if (fs.existsSync(configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this._mergeConfig(fileConfig);
        console.log(`Configuración cargada desde ${configPath}`);
      }
    } catch (error) {
      console.error('Error al cargar archivo de configuración:', error);
    }
  }
  
  /**
   * Combina configuración externa con la configuración actual
   * @param {Object} externalConfig - Configuración a combinar
   * @private
   */
  _mergeConfig(externalConfig) {
    // Recorrer las secciones de configuración
    Object.keys(externalConfig).forEach(section => {
      if (this.config[section] && typeof externalConfig[section] === 'object') {
        // Si la sección ya existe, combinar propiedades
        this.config[section] = {
          ...this.config[section],
          ...externalConfig[section]
        };
      } else {
        // Si la sección no existe, añadirla completa
        this.config[section] = externalConfig[section];
      }
    });
  }
  
  /**
   * Valida la configuración actual
   * @private
   */
  _validateConfig() {
    // Validar configuración de Tidal API
    if (this.config.app.environment !== 'development') {
      if (!this.config.tidal.clientId) {
        console.warn('ADVERTENCIA: TIDAL_CLIENT_ID no está configurado');
      }
      
      if (!this.config.tidal.clientSecret) {
        console.warn('ADVERTENCIA: TIDAL_CLIENT_SECRET no está configurado');
      }
    }
    
    // Validar configuración de DynamoDB
    if (this.config.app.isLocal && !this.config.dynamoDB.endpoint) {
      // Si estamos en local y no hay endpoint configurado, usar localhost
      this.config.dynamoDB.endpoint = 'http://localhost:8000';
      console.log('DynamoDB local configurado en', this.config.dynamoDB.endpoint);
    }
  }
  
  /**
   * Obtiene un valor de configuración por su ruta
   * @param {string} path - Ruta del valor (por ejemplo: 'logger.level')
   * @param {*} defaultValue - Valor por defecto si no existe
   * @returns {*} - Valor de configuración
   */
  get(path, defaultValue = null) {
    const parts = path.split('.');
    let current = this.config;
    
    for (const part of parts) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[part];
    }
    
    return current !== undefined ? current : defaultValue;
  }
  
  /**
   * Obtiene toda la configuración de una sección
   * @param {string} section - Nombre de la sección
   * @returns {Object} - Configuración de la sección
   */
  getSection(section) {
    return this.config[section] || {};
  }
  
  /**
   * Establece un valor de configuración
   * @param {string} path - Ruta del valor
   * @param {*} value - Valor a establecer
   */
  set(path, value) {
    const parts = path.split('.');
    let current = this.config;
    
    // Navegar hasta el penúltimo elemento
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      // Crear objetos intermedios si no existen
      if (current[part] === undefined || current[part] === null || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Establecer valor en el último nivel
    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }
  
  /**
   * Obtiene todas las variables de entorno con un prefijo
   * @param {string} prefix - Prefijo para filtrar (por ejemplo: 'TIDAL_')
   * @returns {Object} - Objeto con las variables encontradas
   */
  getEnvVars(prefix) {
    const result = {};
    const prefixUpper = prefix.toUpperCase();
    
    Object.keys(process.env)
      .filter(key => key.toUpperCase().startsWith(prefixUpper))
      .forEach(key => {
        // Convertir formato snake_case a camelCase
        const camelKey = key
          .toLowerCase()
          .replace(new RegExp(`^${prefix.toLowerCase()}`), '')
          .replace(/([-_][a-z])/g, group => group.replace('-', '').replace('_', '').toUpperCase());
        
        result[camelKey] = process.env[key];
      });
    
    return result;
  }
  
  /**
   * Verifica si se está ejecutando en un entorno específico
   * @param {string} env - Entorno a verificar ('production', 'development', etc.)
   * @returns {boolean} - true si coincide con el entorno actual
   */
  isEnvironment(env) {
    return this.config.app.environment === env;
  }
  
  /**
   * Verifica si se está ejecutando en un entorno local
   * @returns {boolean} - true si es entorno local
   */
  isLocal() {
    return this.config.app.isLocal;
  }
  
  /**
   * Verifica si se está ejecutando en modo producción
   * @returns {boolean} - true si es entorno de producción
   */
  isProduction() {
    return this.config.app.environment === 'production' || this.config.app.environment === 'prod';
  }
}

// Exportar una instancia única
module.exports = new ConfigService();