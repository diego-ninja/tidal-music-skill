/**
 * Servicio para persistencia del estado de reproducción
 * Almacena y recupera el estado de reproducción en DynamoDB
 */

const DynamoDbService = require('./dynamoDbService');
const logger = require('../utils/logger');

// Nombre de la tabla para estado de reproducción
const PLAYBACK_TABLE = process.env.PLAYBACK_TABLE || 'TidalPlaybackState';

// TTL para el estado de reproducción (24 horas)
const PLAYBACK_TTL_SECONDS = 24 * 60 * 60;

/**
 * Clase de servicio para persistencia del estado de reproducción
 */
class PlaybackPersistenceService {
  constructor() {
    this.dynamoDb = new DynamoDbService(PLAYBACK_TABLE);
  }
  
  /**
   * Guarda el estado de reproducción para un usuario
   * @param {string} userId - ID de usuario de Alexa
   * @param {Object} playbackState - Estado de reproducción
   * @returns {Promise<Object>} - Estado guardado
   */
  async savePlaybackState(userId, playbackState) {
    try {
      const now = new Date();
      // Calcular TTL para expiración automática (24 horas después)
      const ttl = Math.floor(now.getTime() / 1000) + PLAYBACK_TTL_SECONDS;
      
      const stateItem = {
        userId, // Partition key
        timestamp: now.toISOString(), // Sort key para permitir múltiples estados
        state: JSON.stringify(playbackState),
        ttl, // TTL para expiración automática
        createdAt: now.toISOString()
      };
      
      // Guardar en DynamoDB
      await this.dynamoDb.putItem(stateItem);
      
      logger.info('Estado de reproducción guardado', { 
        userId,
        stateType: playbackState.type || 'unknown'
      });
      
      return playbackState;
    } catch (error) {
      logger.error('Error al guardar estado de reproducción', { error, userId });
      throw error;
    }
  }
  
  /**
   * Obtiene el estado de reproducción más reciente para un usuario
   * @param {string} userId - ID de usuario de Alexa
   * @returns {Promise<Object|null>} - Estado de reproducción o null si no existe
   */
  async getLatestPlaybackState(userId) {
    try {
      // Consultar DynamoDB por userId y obtener el estado más reciente
      const results = await this.dynamoDb.query({
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        Limit: 1,
        ScanIndexForward: false // Orden descendente (más reciente primero)
      });
      
      if (!results || results.length === 0) {
        logger.info('No se encontró estado de reproducción para el usuario', { userId });
        return null;
      }
      
      // Parsear el estado desde el formato JSON almacenado
      try {
        const playbackState = JSON.parse(results[0].state);
        return playbackState;
      } catch (parseError) {
        logger.error('Error al parsear estado de reproducción', { 
          parseError,
          userId,
          rawState: results[0].state.substring(0, 100) + '...'
        });
        return null;
      }
    } catch (error) {
      logger.error('Error al obtener estado de reproducción', { error, userId });
      throw error;
    }
  }
  
  /**
   * Actualiza el estado de reproducción para un track específico
   * @param {string} userId - ID de usuario de Alexa
   * @param {string} token - Token del track (generalmente el ID)
   * @param {Object} updates - Actualizaciones al estado
   * @returns {Promise<Object|null>} - Estado actualizado o null si no existe
   */
  async updateTrackState(userId, token, updates) {
    try {
      // Obtener el estado actual
      const currentState = await this.getLatestPlaybackState(userId);
      
      if (!currentState) {
        logger.info('No hay estado de reproducción para actualizar', { userId, token });
        return null;
      }
      
      // Verificar si el token coincide con el actual
      if (currentState.token !== token) {
        logger.info('El token no coincide con el estado actual', { 
          userId,
          currentToken: currentState.token,
          requestedToken: token
        });
        // En este caso, guardar un nuevo estado en lugar de actualizar
        const newState = {
          ...updates,
          token,
          updatedAt: new Date().toISOString()
        };
        return this.savePlaybackState(userId, newState);
      }
      
      // Actualizar el estado actual con las nuevas propiedades
      const updatedState = {
        ...currentState,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      // Guardar el estado actualizado
      return this.savePlaybackState(userId, updatedState);
    } catch (error) {
      logger.error('Error al actualizar estado de reproducción', { 
        error, 
        userId,
        token
      });
      throw error;
    }
  }
  
  /**
   * Guarda una lista de reproducción para un usuario
   * @param {string} userId - ID de usuario de Alexa
   * @param {Array} trackList - Lista de tracks
   * @param {number} currentIndex - Índice actual en la lista
   * @returns {Promise<Object>} - Estado de reproducción guardado
   */
  async savePlaylist(userId, trackList, currentIndex = 0) {
    try {
      const playbackState = {
        type: 'playlist',
        trackList,
        currentIndex,
        updatedAt: new Date().toISOString()
      };
      
      return this.savePlaybackState(userId, playbackState);
    } catch (error) {
      logger.error('Error al guardar playlist', { error, userId });
      throw error;
    }
  }
  
  /**
   * Obtiene la última lista de reproducción para un usuario
   * @param {string} userId - ID de usuario de Alexa
   * @returns {Promise<Object|null>} - Información de la playlist o null
   */
  async getPlaylist(userId) {
    try {
      const state = await this.getLatestPlaybackState(userId);
      
      if (!state || state.type !== 'playlist') {
        return null;
      }
      
      return {
        trackList: state.trackList || [],
        currentIndex: state.currentIndex || 0
      };
    } catch (error) {
      logger.error('Error al obtener playlist', { error, userId });
      throw error;
    }
  }
  
  /**
   * Actualiza el índice actual en una lista de reproducción
   * @param {string} userId - ID de usuario de Alexa
   * @param {number} newIndex - Nuevo índice en la lista
   * @returns {Promise<Object|null>} - Información actualizada de la playlist o null
   */
  async updatePlaylistIndex(userId, newIndex) {
    try {
      const playlist = await this.getPlaylist(userId);
      
      if (!playlist) {
        return null;
      }
      
      // Validar que el índice esté dentro de los límites
      const validIndex = Math.max(0, Math.min(newIndex, playlist.trackList.length - 1));
      
      const updatedState = {
        type: 'playlist',
        trackList: playlist.trackList,
        currentIndex: validIndex,
        updatedAt: new Date().toISOString()
      };
      
      await this.savePlaybackState(userId, updatedState);
      
      return {
        trackList: playlist.trackList,
        currentIndex: validIndex
      };
    } catch (error) {
      logger.error('Error al actualizar índice de playlist', { error, userId, newIndex });
      throw error;
    }
  }
  
  /**
   * Elimina el estado de reproducción para un usuario
   * @param {string} userId - ID de usuario de Alexa
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async clearPlaybackState(userId) {
    try {
      // Obtener todos los estados del usuario
      const states = await this.dynamoDb.query({
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });
      
      if (!states || states.length === 0) {
        return true;
      }
      
      // Eliminar cada estado
      const deletePromises = states.map(state => 
        this.dynamoDb.deleteItem({
          userId,
          timestamp: state.timestamp
        })
      );
      
      await Promise.all(deletePromises);
      
      logger.info('Estado de reproducción eliminado', { userId });
      return true;
    } catch (error) {
      logger.error('Error al eliminar estado de reproducción', { error, userId });
      throw error;
    }
  }
}

// Exportar una instancia única
module.exports = new PlaybackPersistenceService();