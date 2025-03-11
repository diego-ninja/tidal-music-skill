/**
 * Servicio para persistencia de tokens de acceso y refresco
 * Almacena y recupera tokens de Tidal en DynamoDB
 */

const DynamoDbService = require('./dynamoDbService');
const logger = require('../utils/logger');
const config = require('../utils/configService');

/**
 * Clase de servicio para persistencia de tokens
 */
class TokenPersistenceService {
  constructor() {
    // Obtener nombre de tabla desde la configuración
    const tokenTable = config.get('dynamoDB.tokenTable', 'TidalTokens');
    this.dynamoDb = new DynamoDbService(tokenTable);
    
    // Configuración de caché
    const cacheConfig = config.getSection('cache');
    this.cacheEnabled = cacheConfig.enabled;
    this.cacheMaxSize = cacheConfig.maxSize;
    
    // Cache en memoria para reducir consultas a DynamoDB
    this.tokenCache = new Map();
    
    logger.info('TokenPersistenceService inicializado', { 
      table: tokenTable,
      cacheEnabled: this.cacheEnabled,
      cacheMaxSize: this.cacheMaxSize
    });
  }
  
  /**
   * Guarda un par de tokens (access token y refresh token)
   * @param {string} userId - ID de usuario de Alexa
   * @param {string} accessToken - Token de acceso
   * @param {string} refreshToken - Token de refresco
   * @param {number} expiresIn - Tiempo de expiración en segundos
   * @returns {Promise<Object>} - Tokens guardados
   */
  async saveTokens(userId, accessToken, refreshToken, expiresIn = 3600) {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + expiresIn * 1000);
      
      const tokenItem = {
        userId, // Partition key
        accessToken, // Sort key
        refreshToken,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      
      // Guardar en DynamoDB
      await this.dynamoDb.putItem(tokenItem);
      
      // Actualizar caché si está habilitada
      if (this.cacheEnabled) {
        this._updateCache(accessToken, refreshToken);
      }
      
      logger.info('Tokens guardados correctamente', { userId });
      
      return {
        accessToken,
        refreshToken,
        expiresAt
      };
    } catch (error) {
      logger.error('Error al guardar tokens', { error, userId });
      throw error;
    }
  }
  
  /**
   * Obtiene tokens por ID de usuario
   * @param {string} userId - ID de usuario de Alexa
   * @returns {Promise<Object>} - Último par de tokens para el usuario
   */
  async getTokensByUserId(userId) {
    try {
      // Consultar DynamoDB por userId y obtener el token más reciente
      const tokens = await this.dynamoDb.query({
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        Limit: 1,
        ScanIndexForward: false // Orden descendente (más reciente primero)
      });
      
      if (!tokens || tokens.length === 0) {
        logger.info('No se encontraron tokens para el usuario', { userId });
        return null;
      }
      
      const tokenData = tokens[0];
      
      // Actualizar caché si está habilitada
      if (this.cacheEnabled) {
        this._updateCache(tokenData.accessToken, tokenData.refreshToken);
      }
      
      return {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresAt: new Date(tokenData.expiresAt)
      };
    } catch (error) {
      logger.error('Error al obtener tokens por userId', { error, userId });
      throw error;
    }
  }
  
  /**
   * Obtiene el refresh token asociado a un access token
   * @param {string} accessToken - Token de acceso
   * @returns {Promise<string|null>} - Token de refresco o null si no se encuentra
   */
  async getRefreshTokenByAccessToken(accessToken) {
    try {
      // Primero buscar en caché si está habilitada
      if (this.cacheEnabled && this.tokenCache.has(accessToken)) {
        logger.debug('Refresh token encontrado en caché', {
          accessTokenPrefix: accessToken.substring(0, 10) + '...'
        });
        return this.tokenCache.get(accessToken);
      }
      
      // Si no está en caché o la caché está deshabilitada, buscar en DynamoDB
      const result = await this.dynamoDb.query({
        IndexName: 'AccessTokenIndex', // Global Secondary Index para buscar por accessToken
        KeyConditionExpression: 'accessToken = :accessToken',
        ExpressionAttributeValues: {
          ':accessToken': accessToken
        },
        Limit: 1
      });
      
      if (!result || result.length === 0) {
        logger.info('No se encontró refresh token para el access token', { 
          accessTokenPrefix: accessToken.substring(0, 10) + '...'
        });
        return null;
      }
      
      const refreshToken = result[0].refreshToken;
      
      // Actualizar caché si está habilitada
      if (this.cacheEnabled) {
        this._updateCache(accessToken, refreshToken);
      }
      
      return refreshToken;
    } catch (error) {
      logger.error('Error al obtener refresh token', { 
        error,
        accessTokenPrefix: accessToken.substring(0, 10) + '...'
      });
      throw error;
    }
  }
  
  /**
   * Actualiza los tokens para un usuario
   * @param {string} userId - ID de usuario de Alexa
   * @param {string} oldAccessToken - Token de acceso anterior
   * @param {string} newAccessToken - Nuevo token de acceso
   * @param {string} newRefreshToken - Nuevo token de refresco
   * @param {number} expiresIn - Tiempo de expiración en segundos
   * @returns {Promise<Object>} - Tokens actualizados
   */
  async updateTokens(userId, oldAccessToken, newAccessToken, newRefreshToken, expiresIn = 3600) {
    try {
      // Eliminar el par de tokens antiguo
      if (oldAccessToken) {
        await this.deleteTokens(userId, oldAccessToken);
      }
      
      // Guardar el nuevo par de tokens
      return this.saveTokens(userId, newAccessToken, newRefreshToken, expiresIn);
    } catch (error) {
      logger.error('Error al actualizar tokens', { error, userId });
      throw error;
    }
  }
  
  /**
   * Elimina un par de tokens
   * @param {string} userId - ID de usuario de Alexa
   * @param {string} accessToken - Token de acceso a eliminar
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async deleteTokens(userId, accessToken) {
    try {
      await this.dynamoDb.deleteItem({
        userId,
        accessToken
      });
      
      // Eliminar de la caché si está habilitada
      if (this.cacheEnabled) {
        this.tokenCache.delete(accessToken);
      }
      
      logger.info('Tokens eliminados correctamente', { userId });
      return true;
    } catch (error) {
      logger.error('Error al eliminar tokens', { error, userId });
      throw error;
    }
  }
  
  /**
   * Elimina todos los tokens de un usuario
   * @param {string} userId - ID de usuario de Alexa
   * @returns {Promise<boolean>} - true si se eliminaron correctamente
   */
  async deleteAllUserTokens(userId) {
    try {
      // Obtener todos los tokens del usuario
      const tokens = await this.dynamoDb.query({
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });
      
      if (!tokens || tokens.length === 0) {
        logger.info('No hay tokens para eliminar', { userId });
        return true;
      }
      
      // Eliminar cada token
      const deletePromises = tokens.map(token => {
        // Eliminar también de la caché si está habilitada
        if (this.cacheEnabled) {
          this.tokenCache.delete(token.accessToken);
        }
        
        return this.dynamoDb.deleteItem({
          userId,
          accessToken: token.accessToken
        });
      });
      
      await Promise.all(deletePromises);
      
      logger.info('Todos los tokens del usuario eliminados', { 
        userId, 
        count: tokens.length 
      });
      
      return true;
    } catch (error) {
      logger.error('Error al eliminar todos los tokens del usuario', { error, userId });
      throw error;
    }
  }
  
  /**
   * Limpia la caché de tokens
   */
  clearCache() {
    if (this.cacheEnabled) {
      const size = this.tokenCache.size;
      this.tokenCache.clear();
      logger.info('Caché de tokens limpiada', { size });
    }
  }
  
  /**
   * Actualiza la caché en memoria con un par de tokens
   * @param {string} accessToken - Token de acceso
   * @param {string} refreshToken - Token de refresco
   * @private
   */
  _updateCache(accessToken, refreshToken) {
    if (!this.cacheEnabled) {
      return;
    }
    
    this.tokenCache.set(accessToken, refreshToken);
    
    // Limitar el tamaño de la caché
    if (this.tokenCache.size > this.cacheMaxSize) {
      // Eliminar la entrada más antigua
      const oldestKey = this.tokenCache.keys().next().value;
      this.tokenCache.delete(oldestKey);
      logger.debug('Caché de tokens podada por tamaño máximo', { 
        maxSize: this.cacheMaxSize 
      });
    }
  }
}

// Exportar una instancia única
module.exports = new TokenPersistenceService();