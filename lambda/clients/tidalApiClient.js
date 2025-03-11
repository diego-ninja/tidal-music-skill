/**
 * Cliente para la API oficial de Tidal
 * Proporciona métodos de bajo nivel para interactuar con la API
 */

const axios = require('axios');
const logger = require('../utils/logger');

// Configuración de la API oficial de Tidal
const API_BASE_URL = 'https://openapi.tidal.com/v2';
const API_TIMEOUT = 10000; // 10 segundos

/**
 * Cliente para realizar peticiones a la API oficial de Tidal
 */
class TidalApiClient {
  /**
   * Crea una instancia del cliente con la configuración base
   * @param {string} clientId - ID de cliente de la aplicación
   * @param {string} clientSecret - Secret de cliente de la aplicación
   */
  constructor(clientId, clientSecret) {
    this.clientId = clientId || process.env.TIDAL_CLIENT_ID;
    this.clientSecret = clientSecret || process.env.TIDAL_CLIENT_SECRET;
    
    if (!this.clientId || !this.clientSecret) {
      logger.warn('TidalApiClient inicializado sin credenciales. Configura TIDAL_CLIENT_ID y TIDAL_CLIENT_SECRET');
    }
    
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
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
   * Realiza una petición GET a la API
   * @param {string} endpoint - Endpoint a consultar
   * @param {Object} params - Parámetros de query
   * @param {string} accessToken - Token de acceso
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async get(endpoint, params = {}, accessToken) {
    return this.client.get(endpoint, {
      params,
      headers: this._getAuthHeaders(accessToken)
    });
  }
  
  /**
   * Realiza una petición POST a la API
   * @param {string} endpoint - Endpoint a consultar
   * @param {Object} data - Datos a enviar
   * @param {string} accessToken - Token de acceso
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async post(endpoint, data = {}, accessToken) {
    return this.client.post(endpoint, data, {
      headers: this._getAuthHeaders(accessToken)
    });
  }
  
  /**
   * Realiza una petición a la API con reintentos
   * @param {Object} options - Opciones de la solicitud
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async requestWithRetry(options) {
    const { endpoint, method, accessToken, params = {}, data = null, retries = 3 } = options;
    
    let lastError = null;
    
    // Implementar reintentos con backoff exponencial
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        if (method.toUpperCase() === 'GET') {
          return await this.get(endpoint, params, accessToken);
        } else if (method.toUpperCase() === 'POST') {
          return await this.post(endpoint, data, accessToken);
        } else {
          throw new Error(`Método HTTP no soportado: ${method}`);
        }
      } catch (error) {
        lastError = error;
        
        // No reintentar en ciertos casos
        if (error.response && [400, 401, 403, 404].includes(error.response.status)) {
          break;
        }
        
        // Esperar antes de reintentar (backoff exponencial)
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        logger.warn(`Reintentando petición a ${endpoint} (intento ${attempt + 1}/${retries})`);
      }
    }
    
    throw lastError;
  }
  
  /**
   * Obtiene un token de acceso mediante OAuth 2.0 usando credenciales de cliente
   * @returns {Promise<Object>} - Token de acceso y metadata
   */
  async getClientCredentialsToken() {
    try {
      const response = await this.client.post('/oauth2/token', {
        grant_type: 'client_credentials'
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret
        }
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
      const response = await this.client.post('/oauth2/token', {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret
        }
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

// Exportar una instancia única del cliente con las credenciales de entorno
module.exports = new TidalApiClient();