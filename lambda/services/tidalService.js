/**
 * Servicio para interactuar con la API oficial de Tidal
 * Proporciona métodos de alto nivel para buscar y reproducir música
 */

const logger = require('../utils/logger');
const tidalApi = require('../clients/tidalApiClient');

/**
 * Clase de servicio para interactuar con la API de Tidal
 */
class TidalService {
  /**
   * Obtiene información del usuario autenticado
   * @param {string} accessToken - Token de acceso
   * @returns {Promise<Object>} - Información del usuario
   */
  async getUserInfo(accessToken) {
    try {
      const response = await tidalApi.get('/me', {}, accessToken);
      return response.data;
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
   * @returns {Promise<Object>} - Resultados de búsqueda
   */
  async search(accessToken, query, limit = 5) {
    try {
      const params = {
        query,
        limit,
        offset: 0,
        types: 'ARTISTS,ALBUMS,TRACKS,PLAYLISTS',
        includeContributors: true,
        countryCode: 'US'
      };
      
      const response = await tidalApi.get('/search', params, accessToken);
      
      // Formatear resultados para facilitar su uso
      const results = {
        tracks: response.data.tracks ? response.data.tracks.items : [],
        artists: response.data.artists ? response.data.artists.items : [],
        albums: response.data.albums ? response.data.albums.items : [],
        playlists: response.data.playlists ? response.data.playlists.items : []
      };
      
      return results;
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
   * @returns {Promise<Object>} - Resultados de búsqueda
   */
  async searchTrack(accessToken, trackName, artistName = null) {
    try {
      let query = trackName;
      if (artistName) {
        query = `${trackName} ${artistName}`;
      }
      
      const params = {
        query,
        limit: 10,
        offset: 0,
        countryCode: 'US'
      };
      
      const response = await tidalApi.get('/search/tracks', params, accessToken);
      
      return {
        tracks: response.data.items || []
      };
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
   * @returns {Promise<Object>} - Resultados de búsqueda
   */
  async searchAlbum(accessToken, albumName, artistName = null) {
    try {
      let query = albumName;
      if (artistName) {
        query = `${albumName} ${artistName}`;
      }
      
      const params = {
        query,
        limit: 10,
        offset: 0,
        countryCode: 'US'
      };
      
      const response = await tidalApi.get('/search/albums', params, accessToken);
      
      return {
        albums: response.data.items || []
      };
    } catch (error) {
      logger.error('Error en búsqueda de álbum', { error, albumName, artistName });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Busca un artista específico
   * @param {string} accessToken - Token de acceso
   * @param {string} artistName - Nombre del artista
   * @returns {Promise<Object>} - Resultados de búsqueda
   */
  async searchArtist(accessToken, artistName) {
    try {
      const params = {
        query: artistName,
        limit: 10,
        offset: 0,
        countryCode: 'US'
      };
      
      const response = await tidalApi.get('/search/artists', params, accessToken);
      
      return {
        artists: response.data.items || []
      };
    } catch (error) {
      logger.error('Error en búsqueda de artista', { error, artistName });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Busca una playlist específica
   * @param {string} accessToken - Token de acceso
   * @param {string} playlistName - Nombre de la playlist
   * @returns {Promise<Object>} - Resultados de búsqueda
   */
  async searchPlaylist(accessToken, playlistName) {
    try {
      const params = {
        query: playlistName,
        limit: 10,
        offset: 0,
        countryCode: 'US'
      };
      
      const response = await tidalApi.get('/search/playlists', params, accessToken);
      
      return {
        playlists: response.data.items || []
      };
    } catch (error) {
      logger.error('Error en búsqueda de playlist', { error, playlistName });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene las pistas de un álbum
   * @param {string} accessToken - Token de acceso
   * @param {string} albumId - ID del álbum
   * @returns {Promise<Array>} - Lista de pistas
   */
  async getAlbumTracks(accessToken, albumId) {
    try {
      const params = {
        limit: 50,
        offset: 0,
        countryCode: 'US'
      };
      
      const response = await tidalApi.get(`/albums/${albumId}/tracks`, params, accessToken);
      
      return response.data.items || [];
    } catch (error) {
      logger.error('Error al obtener pistas del álbum', { error, albumId });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene las pistas de una playlist
   * @param {string} accessToken - Token de acceso
   * @param {string} playlistId - ID de la playlist
   * @returns {Promise<Array>} - Lista de pistas
   */
  async getPlaylistTracks(accessToken, playlistId) {
    try {
      const params = {
        limit: 50,
        offset: 0,
        countryCode: 'US'
      };
      
      const response = await tidalApi.get(`/playlists/${playlistId}/tracks`, params, accessToken);
      
      return response.data.items || [];
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
   * @returns {Promise<Array>} - Lista de pistas populares
   */
  async getArtistTopTracks(accessToken, artistId, limit = 10) {
    try {
      const params = { 
        limit,
        offset: 0,
        countryCode: 'US'
      };
      
      const response = await tidalApi.get(`/artists/${artistId}/toptracks`, params, accessToken);
      
      return response.data.items || [];
    } catch (error) {
      logger.error('Error al obtener top tracks del artista', { error, artistId });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene la URL de streaming para una pista
   * @param {string} accessToken - Token de acceso
   * @param {string} trackId - ID de la pista
   * @returns {Promise<string>} - URL de streaming
   */
  async getStreamUrl(accessToken, trackId) {
    try {
      const params = {
        soundQuality: 'HIGH',
        countryCode: 'US'
      };
      
      // La API v2 de Tidal usa un endpoint específico para obtener la URL de streaming
      const response = await tidalApi.get(`/tracks/${trackId}/playbackinfo`, params, accessToken);
      
      if (!response.data || !response.data.manifest || !response.data.manifest.url) {
        throw new Error('No se pudo obtener la URL de streaming');
      }
      
      return response.data.manifest.url;
    } catch (error) {
      logger.error('Error al obtener URL de streaming', { error, trackId });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene favoritos del usuario
   * @param {string} accessToken - Token de acceso
   * @param {string} type - Tipo de favorito (tracks, albums, artists, playlists)
   * @returns {Promise<Object>} - Lista de favoritos
   */
  async getFavorites(accessToken, type) {
    try {
      const params = {
        limit: 50,
        offset: 0,
        countryCode: 'US'
      };
      
      const response = await tidalApi.get(`/favorites/${type}`, params, accessToken);
      
      return response.data.items || [];
    } catch (error) {
      logger.error('Error al obtener favoritos', { error, type });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene las playlists del usuario
   * @param {string} accessToken - Token de acceso
   * @returns {Promise<Array>} - Lista de playlists
   */
  async getUserPlaylists(accessToken) {
    try {
      const params = {
        limit: 50,
        offset: 0,
        countryCode: 'US'
      };
      
      const response = await tidalApi.get('/my-collection/playlists/folders', params, accessToken);
      
      return response.data.items || [];
    } catch (error) {
      logger.error('Error al obtener playlists del usuario', { error });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene recomendaciones personalizadas para el usuario
   * @param {string} accessToken - Token de acceso
   * @returns {Promise<Object>} - Recomendaciones de música
   */
  async getRecommendations(accessToken) {
    try {
      const params = {
        countryCode: 'US'
      };
      
      const response = await tidalApi.get('/recommended/sections', params, accessToken);
      
      return response.data || {};
    } catch (error) {
      logger.error('Error al obtener recomendaciones', { error });
      throw this._handleApiError(error);
    }
  }
  
  /**
   * Obtiene detalles de una pista
   * @param {string} accessToken - Token de acceso
   * @param {string} trackId - ID de la pista
   * @returns {Promise<Object>} - Detalles de la pista
   */
  async getTrackDetails(accessToken, trackId) {
    try {
      const params = {
        countryCode: 'US'
      };
      
      const response = await tidalApi.get(`/tracks/${trackId}`, params, accessToken);
      
      return response.data || {};
    } catch (error) {
      logger.error('Error al obtener detalles de la pista', { error, trackId });
      throw this._handleApiError(error);
    }
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