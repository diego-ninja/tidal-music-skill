/**
 * Servicio para interactuar con la API oficial de Tidal
 * Proporciona métodos de alto nivel para buscar y reproducir música
 */

const logger = require('../utils/logger');
const config = require('../utils/configService');
const tidalApi = require('../clients/tidalApiClient');
const tokenPersistenceService = require('../services/tokenPersistenceService');
const cacheService = require('../utils/cacheService');

// Namespace para la caché de Tidal
const CACHE_NS = 'tidal';

// TTL por tipo de datos (en segundos)
const CACHE_TTL = {
  userInfo: 300,         // 5 minutos
  search: 900,           // 15 minutos
  tracks: 1800,          // 30 minutos
  albums: 3600,          // 1 hora
  playlists: 3600,       // 1 hora
  artists: 3600,         // 1 hora
  streamUrl: 1800        // 30 minutos
};

/**
 * Clase de servicio para interactuar con la API de Tidal
 */
class TidalService {
  constructor() {
    // Obtener configuración
    this.config = config.getSection('tidal');
    this.cacheEnabled = config.get('cache.enabled', true);
    
    // TTL para caché de URLs de streaming
    this.streamUrlTTL = this.config.streamUrlTTL || 1800; // 30 minutos por defecto
    
    logger.info('TidalService inicializado', {
      cacheEnabled: this.cacheEnabled,
      streamUrlTTL: this.streamUrlTTL
    });
  }

  /**
   * Obtiene información del usuario autenticado
   * @param {string} accessToken - Token de acceso
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Object>} - Información del usuario
   */
  async getUserInfo(accessToken, userId = null) {
    try {
      // Generar clave de caché
      const cacheKey = cacheService.makeKey('userInfo', accessToken);
      
      // Usar caché para reducir llamadas a la API
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get('/me', {}, accessToken),
            accessToken,
            userId
          );
          return response.data;
        },
        CACHE_TTL.userInfo
      );
    } catch (error) {
      logger.error('Error al obtener información del usuario', { error });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Busca contenido en Tidal (canciones, artistas, álbumes, playlists)
   * @param {string} accessToken - Token de acceso
   * @param {string} query - Término de búsqueda
   * @param {number} limit - Límite de resultados por tipo
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Object>} - Resultados de búsqueda
   */
  async search(accessToken, query, limit = 5, userId = null) {
    try {
      // Generar clave de caché
      const cacheKey = cacheService.makeKey('search', query, limit);
      
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = {
            query,
            limit,
            offset: 0,
            types: 'ARTISTS,ALBUMS,TRACKS,PLAYLISTS',
            includeContributors: true,
            countryCode: this.config.countryCode
          };
          
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get('/search', params, accessToken),
            accessToken,
            userId
          );
          
          // Formatear resultados para facilitar su uso
          return {
            tracks: response.data.tracks ? response.data.tracks.items : [],
            artists: response.data.artists ? response.data.artists.items : [],
            albums: response.data.albums ? response.data.albums.items : [],
            playlists: response.data.playlists ? response.data.playlists.items : []
          };
        },
        CACHE_TTL.search
      );
    } catch (error) {
      logger.error('Error en búsqueda', { error, query });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Busca una canción específica
   * @param {string} accessToken - Token de acceso
   * @param {string} trackName - Nombre de la canción
   * @param {string} artistName - Nombre del artista (opcional)
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Object>} - Resultados de búsqueda
   */
  async searchTrack(accessToken, trackName, artistName = null, userId = null) {
    try {
      let query = trackName;
      if (artistName) {
        query = `${trackName} ${artistName}`;
      }
      
      // Generar clave de caché
      const cacheKey = cacheService.makeKey('track', query);
      
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = {
            query,
            limit: 10,
            offset: 0,
            countryCode: this.config.countryCode
          };
          
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get('/search/tracks', params, accessToken),
            accessToken,
            userId
          );
          
          return {
            tracks: response.data.items || []
          };
        },
        CACHE_TTL.tracks
      );
    } catch (error) {
      logger.error('Error en búsqueda de canción', { error, trackName, artistName });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Busca un álbum específico
   * @param {string} accessToken - Token de acceso
   * @param {string} albumName - Nombre del álbum
   * @param {string} artistName - Nombre del artista (opcional)
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Object>} - Resultados de búsqueda
   */
  async searchAlbum(accessToken, albumName, artistName = null, userId = null) {
    try {
      let query = albumName;
      if (artistName) {
        query = `${albumName} ${artistName}`;
      }
      
      // Generar clave de caché
      const cacheKey = cacheService.makeKey('album', query);
      
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = {
            query,
            limit: 10,
            offset: 0,
            countryCode: this.config.countryCode
          };
          
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get('/search/albums', params, accessToken),
            accessToken,
            userId
          );
          
          return {
            albums: response.data.items || []
          };
        },
        CACHE_TTL.albums
      );
    } catch (error) {
      logger.error('Error en búsqueda de álbum', { error, albumName, artistName });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Busca un artista específico
   * @param {string} accessToken - Token de acceso
   * @param {string} artistName - Nombre del artista
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Object>} - Resultados de búsqueda
   */
  async searchArtist(accessToken, artistName, userId = null) {
    try {
      // Generar clave de caché
      const cacheKey = cacheService.makeKey('artist', artistName);
      
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = {
            query: artistName,
            limit: 10,
            offset: 0,
            countryCode: this.config.countryCode
          };
          
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get('/search/artists', params, accessToken),
            accessToken,
            userId
          );
          
          return {
            artists: response.data.items || []
          };
        },
        CACHE_TTL.artists
      );
    } catch (error) {
      logger.error('Error en búsqueda de artista', { error, artistName });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Busca una playlist específica
   * @param {string} accessToken - Token de acceso
   * @param {string} playlistName - Nombre de la playlist
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Object>} - Resultados de búsqueda
   */
  async searchPlaylist(accessToken, playlistName, userId = null) {
    try {
      // Generar clave de caché
      const cacheKey = cacheService.makeKey('playlist', playlistName);
      
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = {
            query: playlistName,
            limit: 10,
            offset: 0,
            countryCode: this.config.countryCode
          };
          
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get('/search/playlists', params, accessToken),
            accessToken,
            userId
          );
          
          return {
            playlists: response.data.items || []
          };
        },
        CACHE_TTL.playlists
      );
    } catch (error) {
      logger.error('Error en búsqueda de playlist', { error, playlistName });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene las pistas de un álbum
   * @param {string} accessToken - Token de acceso
   * @param {string} albumId - ID del álbum
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Array>} - Lista de pistas
   */
  async getAlbumTracks(accessToken, albumId, userId = null) {
    try {
      // Generar clave de caché
      const cacheKey = cacheService.makeKey('albumTracks', albumId);
      
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = {
            limit: 50,
            offset: 0,
            countryCode: this.config.countryCode
          };
          
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get(`/albums/${albumId}/tracks`, params, accessToken),
            accessToken,
            userId
          );
          
          return response.data.items || [];
        },
        CACHE_TTL.albums
      );
    } catch (error) {
      logger.error('Error al obtener pistas del álbum', { error, albumId });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene las pistas de una playlist
   * @param {string} accessToken - Token de acceso
   * @param {string} playlistId - ID de la playlist
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Array>} - Lista de pistas
   */
  async getPlaylistTracks(accessToken, playlistId, userId = null) {
    try {
      // Generar clave de caché
      const cacheKey = cacheService.makeKey('playlistTracks', playlistId);
      
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = {
            limit: 50,
            offset: 0,
            countryCode: this.config.countryCode
          };
          
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get(`/playlists/${playlistId}/tracks`, params, accessToken),
            accessToken,
            userId
          );
          
          return response.data.items || [];
        },
        CACHE_TTL.playlists
      );
    } catch (error) {
      logger.error('Error al obtener pistas de la playlist', { error, playlistId });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene las pistas más populares de un artista
   * @param {string} accessToken - Token de acceso
   * @param {string} artistId - ID del artista
   * @param {number} limit - Límite de pistas a obtener
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Array>} - Lista de pistas populares
   */
  async getArtistTopTracks(accessToken, artistId, limit = 10, userId = null) {
    try {
      // Generar clave de caché
      const cacheKey = cacheService.makeKey('artistTopTracks', artistId, limit);
      
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = { 
            limit,
            offset: 0,
            countryCode: this.config.countryCode
          };
          
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get(`/artists/${artistId}/toptracks`, params, accessToken),
            accessToken,
            userId
          );
          
          return response.data.items || [];
        },
        CACHE_TTL.artists
      );
    } catch (error) {
      logger.error('Error al obtener top tracks del artista', { error, artistId });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene la URL de streaming para una pista
   * @param {string} accessToken - Token de acceso
   * @param {string} trackId - ID de la pista
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<string>} - URL de streaming
   */
  async getStreamUrl(accessToken, trackId, userId = null) {
    try {
      // Generar clave de caché
      const cacheKey = cacheService.makeKey('streamUrl', trackId);
      
      // Usar un TTL más corto para URLs de streaming (pueden expirar)
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = {
            soundQuality: this.config.soundQuality || 'HIGH',
            countryCode: this.config.countryCode
          };
          
          // La API v2 de Tidal usa un endpoint específico para obtener la URL de streaming
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get(`/tracks/${trackId}/playbackinfo`, params, accessToken),
            accessToken,
            userId
          );
          
          if (!response.data || !response.data.manifest || !response.data.manifest.url) {
            throw new Error('No se pudo obtener la URL de streaming');
          }
          
          return response.data.manifest.url;
        },
        this.streamUrlTTL
      );
    } catch (error) {
      logger.error('Error al obtener URL de streaming', { error, trackId });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene favoritos del usuario
   * @param {string} accessToken - Token de acceso
   * @param {string} type - Tipo de favorito (tracks, albums, artists, playlists)
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Object>} - Lista de favoritos
   */
  async getFavorites(accessToken, type, userId = null) {
    try {
      // Los favoritos cambian con frecuencia, TTL más corto
      const cacheKey = cacheService.makeKey('favorites', type, userId || accessToken.substring(0, 10));
      
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = {
            limit: 50,
            offset: 0,
            countryCode: this.config.countryCode
          };
          
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get(`/favorites/${type}`, params, accessToken),
            accessToken,
            userId
          );
          
          return response.data.items || [];
        },
        300 // 5 minutos (TTL corto para datos personales que cambian)
      );
    } catch (error) {
      logger.error('Error al obtener favoritos', { error, type });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene las playlists del usuario
   * @param {string} accessToken - Token de acceso
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Array>} - Lista de playlists
   */
  async getUserPlaylists(accessToken, userId = null) {
    try {
      // Las playlists del usuario cambian con frecuencia, TTL más corto
      const cacheKey = cacheService.makeKey('userPlaylists', userId || accessToken.substring(0, 10));
      
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = {
            limit: 50,
            offset: 0,
            countryCode: this.config.countryCode
          };
          
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get('/my-collection/playlists/folders', params, accessToken),
            accessToken,
            userId
          );
          
          return response.data.items || [];
        },
        300 // 5 minutos (TTL corto para datos personales que cambian)
      );
    } catch (error) {
      logger.error('Error al obtener playlists del usuario', { error });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene recomendaciones personalizadas para el usuario
   * @param {string} accessToken - Token de acceso
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Object>} - Recomendaciones de música
   */
  async getRecommendations(accessToken, userId = null) {
    try {
      // Las recomendaciones cambian con frecuencia, TTL más corto
      const cacheKey = cacheService.makeKey('recommendations', userId || accessToken.substring(0, 10));
      
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = {
            countryCode: this.config.countryCode
          };
          
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get('/recommended/sections', params, accessToken),
            accessToken,
            userId
          );
          
          return response.data || {};
        },
        600 // 10 minutos (las recomendaciones no cambian tan rápido)
      );
    } catch (error) {
      logger.error('Error al obtener recomendaciones', { error });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene detalles de una pista
   * @param {string} accessToken - Token de acceso
   * @param {string} trackId - ID de la pista
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<Object>} - Detalles de la pista
   */
  async getTrackDetails(accessToken, trackId, userId = null) {
    try {
      // Generar clave de caché
      const cacheKey = cacheService.makeKey('trackDetails', trackId);
      
      return await cacheService.getOrSet(
        CACHE_NS,
        cacheKey,
        async () => {
          const params = {
            countryCode: this.config.countryCode
          };
          
          const response = await this._executeWithTokenRefresh(
            () => tidalApi.get(`/tracks/${trackId}`, params, accessToken),
            accessToken,
            userId
          );
          
          return response.data || {};
        },
        CACHE_TTL.tracks
      );
    } catch (error) {
      logger.error('Error al obtener detalles de la pista', { error, trackId });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Limpia la caché del servicio
   * @param {string} type - Tipo de datos a limpiar (opcional)
   */
  clearCache(type = null) {
    if (type) {
      // Limpiar solo un tipo específico de datos
      logger.info(`Limpiando caché de ${type}`);
      for (const key of Object.keys(CACHE_TTL)) {
        if (key === type || key.startsWith(`${type}:`)) {
          cacheService.delete(CACHE_NS, key);
        }
      }
    } else {
      // Limpiar toda la caché de Tidal
      logger.info('Limpiando toda la caché de Tidal');
      cacheService.clear(CACHE_NS);
    }
  }
  
  /**
   * Obtiene estadísticas de la caché
   * @returns {Object} - Estadísticas
   */
  getCacheStats() {
    return cacheService.getStats();
  }

  /**
   * Ejecuta una función con soporte para refresco automático de token
   * Si ocurre un error 401, intenta refrescar el token y reintentar la operación
   * @param {Function} apiCallFn - Función que realiza la llamada a la API
   * @param {string} accessToken - Token de acceso actual
   * @param {string} userId - ID de usuario de Alexa (opcional)
   * @returns {Promise<any>} - Resultado de la llamada a la API
   * @private
   */
  async _executeWithTokenRefresh(apiCallFn, accessToken, userId) {
    try {
      // Intentar realizar la llamada API con el token actual
      return await apiCallFn();
    } catch (error) {
      // Si el error no es 401 (Unauthorized) o no hay token, propagar el error
      if (!error.response || error.response.status !== 401 || !accessToken) {
        throw error;
      }

      logger.info('Token expirado, intentando refrescar...', { userId });

      try {
        let refreshToken;
        
        // Intentar obtener refreshToken de la base de datos persistente si tenemos userId
        if (userId) {
          const tokens = await tokenPersistenceService.getTokensByUserId(userId);
          if (tokens && tokens.refreshToken) {
            refreshToken = tokens.refreshToken;
          }
        }
        
        // Si no tenemos userId o no encontramos el token, buscar por accessToken
        if (!refreshToken) {
          refreshToken = await tokenPersistenceService.getRefreshTokenByAccessToken(accessToken);
        }
        
        if (!refreshToken) {
          logger.warn('No se encontró refreshToken para este accessToken', { userId });
          throw error; // Re-lanzar error original si no hay refreshToken
        }

        // Solicitar nuevo token usando el refreshToken
        const newTokens = await tidalApi.refreshAccessToken(refreshToken);
        
        // Guardar el nuevo par de tokens en la persistencia si tenemos userId
        if (userId) {
          await tokenPersistenceService.updateTokens(
            userId,
            accessToken,
            newTokens.access_token,
            newTokens.refresh_token,
            newTokens.expires_in
          );
        } else {
          // Si no tenemos userId, solo actualizamos la caché en memoria
          await tokenPersistenceService.saveTokens(
            'anonymous', // Usamos 'anonymous' como userId temporal
            newTokens.access_token,
            newTokens.refresh_token,
            newTokens.expires_in
          );
        }
        
        // Limpiar caché relacionada con este token
        this._clearTokenRelatedCache(accessToken);
        
        logger.info('Token refrescado exitosamente', { userId });
        
        // Actualizar la función de llamada para usar el nuevo token
        const updatedApiCallFn = () => {
          // Reemplazar el token en las llamadas a la API
          // Este enfoque asume que el accessToken se pasa como último parámetro
          // en todos los métodos de tidalApi
          return apiCallFn.toString()
            .replace(accessToken, newTokens.access_token);
        };
        
        // Reintentar la llamada original con el nuevo token
        return await updatedApiCallFn();
      } catch (refreshError) {
        logger.error('Error al refrescar token', { refreshError, userId });
        // Si falla el refresh, propagar el error original
        throw error;
      }
    }
  }
  
  /**
   * Limpia entradas de caché relacionadas con un token
   * @param {string} accessToken - Token de acceso
   * @private
   */
  _clearTokenRelatedCache(accessToken) {
    // Las claves que contienen el accessToken
    const tokenPrefix = accessToken.substring(0, 10);
    
    // Limpiar entradas de caché que contienen este token
    logger.debug('Limpiando caché relacionada con token', { tokenPrefix });
    
    // Este método es simplificado ya que no tenemos acceso directo al cacheMap
    // En una implementación completa, recorreríamos las claves y eliminaríamos las que contengan el token
    
    // Por ahora, limpiar al menos userInfo que sabemos contiene el token
    cacheService.delete(CACHE_NS, cacheService.makeKey('userInfo', accessToken));
  }
  
  /**
   * Maneja errores de la API y los convierte en errores más descriptivos
   * @param {Error} error - Error original
   * @returns {Error} - Error procesado
   * @private
   */
  _handleApiError(error) {
    // Si es un error de red o timeout
    if (!error.response) {
      return new Error('Error de conexión con el servicio de Tidal');
    }
    
    // Manejar errores específicos de la API
    switch (error.response.status) {
      case 400:
        return new Error('Solicitud incorrecta a Tidal');
      case 401:
        return new Error('Sesión expirada o no autorizada en Tidal');
      case 403:
        return new Error('No tienes permiso para realizar esta acción en Tidal');
      case 404:
        return new Error('El contenido solicitado no existe en Tidal');
      case 429:
        return new Error('Demasiadas solicitudes a Tidal. Intenta más tarde');
      default:
        return new Error(`Error del servicio de Tidal: ${error.response.status}`);
    }
  }
}

// Exportar una instancia única del servicio
module.exports = new TidalService();