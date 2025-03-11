/**
 * Cliente para la API oficial de Tidal
 * Proporciona métodos de bajo nivel para interactuar con la API
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../services/configService');

/**
 * Cliente para realizar peticiones a la API oficial de Tidal
 */
class TidalApiClient {
  /**
   * Crea una instancia del cliente con la configuración base
   */
  constructor() {
    // Obtener configuración de Tidal
    const tidalConfig = config.getSection('tidal');
    
    this.clientId = tidalConfig.clientId;
    this.clientSecret = tidalConfig.clientSecret;
    this.apiUrl = tidalConfig.apiUrl;
    this.apiTimeout = tidalConfig.apiTimeout;
    this.countryCode = tidalConfig.countryCode;
    this.soundQuality = tidalConfig.soundQuality;
    
    // Obtener configuración de reintentos
    const retryConfig = config.getSection('retry');
    this.maxRetries = retryConfig.maxRetries;
    this.baseDelayMs = retryConfig.baseDelayMs;
    this.maxDelayMs = retryConfig.maxDelayMs;
    
    // Validar configuración
    if (!this.clientId || !this.clientSecret) {
      logger.warn('TidalApiClient inicializado sin credenciales. Configura TIDAL_CLIENT_ID y TIDAL_CLIENT_SECRET');
    }
    
    // Crear cliente HTTP con configuración base
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: this.apiTimeout,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    // Configurar interceptores
    this._setupInterceptors();
  }
  
  /**
   * Configura interceptores para logging y manejo de errores
   * @private
   */
  _setupInterceptors() {
    // Interceptor para logging de solicitudes
    this.client.interceptors.request.use(config => {
      const logConfig = { ...config };
      
      // Evitar registrar tokens completos en los logs
      if (logConfig.headers && logConfig.headers.Authorization) {
        const auth = logConfig.headers.Authorization;
        logConfig.headers.Authorization = `${auth.substring(0, 15)}...`;
      }
      
      logger.debug('Petición API Tidal', { 
        method: logConfig.method, 
        url: logConfig.url, 
        params: logConfig.params 
      });
      
      return config;
    });
    
    // Interceptor para logging de respuestas
    this.client.interceptors.response.use(
      response => {
        logger.debug('Respuesta API Tidal', { 
          status: response.status,
          url: response.config.url,
          dataSize: response.data ? JSON.stringify(response.data).length : 0
        });
        return response;
      },
      error => {
        if (error.response) {
          logger.error('Error API Tidal', { 
            status: error.response.status,
            url: error.config ? error.config.url : 'unknown',
            data: error.response.data
          });
        } else {
          logger.error('Error de red API Tidal', { 
            message: error.message,
            url: error.config ? error.config.url : 'unknown'
          });
        }
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Realiza una petición GET a la API con reintentos automáticos
   * @param {string} endpoint - Endpoint a consultar
   * @param {Object} params - Parámetros de query
   * @param {string} accessToken - Token de acceso
   * @param {number} retries - Número de reintentos (opcional)
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async get(endpoint, params = {}, accessToken, retries) {
    // Usar maxRetries de la configuración si no se especifica
    const maxRetries = retries !== undefined ? retries : this.maxRetries;
    
    return this.requestWithRetry({
      endpoint,
      method: 'GET',
      params,
      accessToken,
      retries: maxRetries
    });
  }
  
  /**
   * Realiza una petición POST a la API con reintentos automáticos
   * @param {string} endpoint - Endpoint a consultar
   * @param {Object} data - Datos a enviar
   * @param {string} accessToken - Token de acceso
   * @param {number} retries - Número de reintentos (opcional)
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async post(endpoint, data = {}, accessToken, retries) {
    // Usar maxRetries de la configuración si no se especifica
    const maxRetries = retries !== undefined ? retries : this.maxRetries;
    
    return this.requestWithRetry({
      endpoint,
      method: 'POST',
      data,
      accessToken,
      retries: maxRetries
    });
  }
  
  /**
   * Realiza una petición PUT a la API con reintentos automáticos
   * @param {string} endpoint - Endpoint a consultar
   * @param {Object} data - Datos a enviar
   * @param {string} accessToken - Token de acceso
   * @param {number} retries - Número de reintentos (opcional)
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async put(endpoint, data = {}, accessToken, retries) {
    // Usar maxRetries de la configuración si no se especifica
    const maxRetries = retries !== undefined ? retries : this.maxRetries;
    
    return this.requestWithRetry({
      endpoint,
      method: 'PUT',
      data,
      accessToken,
      retries: maxRetries
    });
  }
  
  /**
   * Realiza una petición DELETE a la API con reintentos automáticos
   * @param {string} endpoint - Endpoint a consultar
   * @param {Object} params - Parámetros de query
   * @param {string} accessToken - Token de acceso
   * @param {number} retries - Número de reintentos (opcional)
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async delete(endpoint, params = {}, accessToken, retries) {
    // Usar maxRetries de la configuración si no se especifica
    const maxRetries = retries !== undefined ? retries : this.maxRetries;
    
    return this.requestWithRetry({
      endpoint,
      method: 'DELETE',
      params,
      accessToken,
      retries: maxRetries
    });
  }
  
  /**
   * Realiza una petición a la API con reintentos automáticos y backoff exponencial
   * @param {Object} options - Opciones de la solicitud
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async requestWithRetry(options) {
    const { 
      endpoint, 
      method, 
      accessToken, 
      params = {}, 
      data = null, 
      retries = this.maxRetries,
      headers = {}
    } = options;
    
    // Añadir el countryCode por defecto a los parámetros si no existe
    if (!params.countryCode && ['GET', 'DELETE'].includes(method.toUpperCase())) {
      params.countryCode = this.countryCode;
    }
    
    let lastError = null;
    let attempts = 0;
    
    // Implementar reintentos con backoff exponencial
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        attempts++;
        const config = {
          url: endpoint,
          method: method.toUpperCase(),
          headers: {
            ...this._getAuthHeaders(accessToken),
            ...headers
          }
        };
        
        // Añadir parámetros según el método
        if (['GET', 'DELETE', 'HEAD'].includes(config.method)) {
          config.params = params;
        } else {
          config.data = data;
        }
        
        const response = await this.client.request(config);
        
        if (attempts > 1) {
          logger.info(`Petición exitosa después de ${attempts} intentos`, { 
            endpoint, 
            method 
          });
        }
        
        return response;
      } catch (error) {
        lastError = error;
        
        // No reintentar en ciertos casos
        if (error.response && [400, 401, 403, 404].includes(error.response.status)) {
          logger.debug(`No se reintenta la petición debido al código de error: ${error.response.status}`, {
            endpoint,
            method
          });
          break;
        }
        
        // Si es el último intento, no esperar
        if (attempt === retries - 1) {
          break;
        }
        
        // Calcular tiempo de espera con backoff exponencial y jitter (aleatoriedad)
        const baseDelay = Math.min(
          this.maxDelayMs, 
          Math.pow(2, attempt) * this.baseDelayMs
        );
        const jitter = Math.random() * (baseDelay * 0.2); // 20% de jitter
        const delayMs = baseDelay + jitter;
        
        logger.warn(`Reintentando petición a ${endpoint} (intento ${attempt + 1}/${retries}) después de ${delayMs.toFixed(0)}ms`, {
          error: error.message
        });
        
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    logger.error(`Todos los intentos fallaron (${attempts}/${retries}) para ${method} ${endpoint}`, {
      error: lastError.message
    });
    
    throw lastError;
  }
  
  /**
   * Obtiene un token de acceso mediante OAuth 2.0 usando credenciales de cliente
   * @returns {Promise<Object>} - Token de acceso y metadata
   */
  async getClientCredentialsToken() {
    try {
      const response = await this.requestWithRetry({
        endpoint: '/oauth2/token',
        method: 'POST',
        data: {
          grant_type: 'client_credentials'
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret
        },
        retries: 5 // Más reintentos para esta operación crítica
      });
      
      return response.data;
    } catch (error) {
      logger.error('Error al obtener token de cliente', { error });
      throw error;
    }
  }
  
  /**
   * Refresca un token de acceso expirado usando un token de refresco
   * @param {string} refreshToken - Token de refresco
   * @returns {Promise<Object>} - Nuevo token de acceso y metadata
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Esta llamada es crítica, así que usamos directamente requestWithRetry
      // con más reintentos para aumentar la probabilidad de éxito
      const response = await this.requestWithRetry({
        endpoint: '/oauth2/token',
        method: 'POST',
        data: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret
        },
        retries: 5 // Más reintentos para esta operación crítica
      });
      
      return response.data;
    } catch (error) {
      logger.error('Error al refrescar token', { error });
      throw error;
    }
  }
  
  /**
   * Construye los headers de autenticación
   * @param {string} accessToken - Token de acceso
   * @returns {Object} - Headers para la petición
   * @private
   */
  _getAuthHeaders(accessToken) {
    const headers = {
      'X-Tidal-Token': this.clientId
    };
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    return headers;
  }
}

// Exportar una instancia única del cliente
module.exports = new TidalApiClient();