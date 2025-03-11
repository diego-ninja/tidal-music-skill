/**
 * Manejadores para los intents relacionados con la música
 * Incluye reproducción, búsqueda y control de audio
 */

const logger = require('../utils/logger');
const tidalService = require('../services/tidalService');
const playbackPersistenceService = require('../services/playbackPersistenceService');
/**
 * Manejador para el intent PlayMusicIntent
 * Se activa cuando el usuario quiere reproducir música
 */
const PlayMusicIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'PlayMusicIntent';
  },
  async handle(handlerInput) {
    logger.info('Manejando PlayMusicIntent');
    
    try {
      // Verificar token de acceso
      const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
      if (!accessToken) {
        return handlerInput.responseBuilder
          .speak('Para reproducir música de Tidal, necesitas vincular tu cuenta. He enviado un enlace a la aplicación de Alexa.')
          .withLinkAccountCard()
          .getResponse();
      }
      
      // Obtener userId para persistencia
      const userId = handlerInput.requestEnvelope.context.System.user.userId;
      
      // Obtener slots de la solicitud
      const intent = handlerInput.requestEnvelope.request.intent;
      const slots = intent.slots;
      
      let speechText = '';
      let streamUrl = '';
      let metadata = {};
      
      // Determinar qué tipo de contenido reproducir basado en los slots proporcionados
      if (slots.song && slots.song.value) {
        // Buscar y reproducir una canción específica
        const songName = slots.song.value;
        const artistName = slots.artist && slots.artist.value ? slots.artist.value : null;
        
        logger.info('Buscando canción', { songName, artistName, userId });
        
        const searchResult = await tidalService.searchTrack(accessToken, songName, artistName, userId);
        
        if (searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
          const track = searchResult.tracks[0];
          streamUrl = await tidalService.getStreamUrl(accessToken, track.id, userId);
          metadata = {
            title: track.title,
            artist: track.artist.name,
            albumArtUrl: track.album.cover,
            albumName: track.album.title,
            token: track.id // Usar track.id como token para identificación única
          };
          
          speechText = `Reproduciendo ${track.title} de ${track.artist.name}`;
          
          // Guardar el estado de reproducción en DynamoDB
          await playbackPersistenceService.savePlaybackState(userId, {
            type: 'track',
            trackId: track.id,
            title: track.title,
            artist: track.artist.name,
            albumName: track.album.title,
            offsetInMilliseconds: 0,
            token: track.id,
            url: streamUrl
          });
        } else {
          throw new Error('No se encontró la canción');
        }
      } else if (slots.album && slots.album.value) {
        // Buscar y reproducir un álbum
        const albumName = slots.album.value;
        const artistName = slots.artist && slots.artist.value ? slots.artist.value : null;
        
        logger.info('Buscando álbum', { albumName, artistName, userId });
        
        const searchResult = await tidalService.searchAlbum(accessToken, albumName, artistName, userId);
        
        if (searchResult && searchResult.albums && searchResult.albums.length > 0) {
          const album = searchResult.albums[0];
          const trackList = await tidalService.getAlbumTracks(accessToken, album.id, userId);
          
          if (trackList && trackList.length > 0) {
            streamUrl = await tidalService.getStreamUrl(accessToken, trackList[0].id, userId);
            
            // Crear una lista de tracks simplificada para almacenamiento
            const simplifiedTrackList = trackList.map(track => ({
              id: track.id,
              title: track.title,
              artist: track.artist.name
            }));
            
            metadata = {
              title: trackList[0].title,
              artist: trackList[0].artist.name,
              albumArtUrl: album.cover,
              albumName: album.title,
              token: trackList[0].id, // Usar el ID de la primera pista como token
              // Guardar la lista de reproducción para gestionar siguiente/anterior
              trackList: simplifiedTrackList,
              currentIndex: 0
            };
            
            speechText = `Reproduciendo el álbum ${album.title} de ${album.artist.name}`;
            
            // Guardar la playlist en DynamoDB
            await playbackPersistenceService.savePlaylist(userId, simplifiedTrackList, 0);
            
            // También guardar el estado actual de reproducción
            await playbackPersistenceService.savePlaybackState(userId, {
              type: 'album',
              albumId: album.id,
              albumName: album.title,
              artist: album.artist.name,
              trackId: trackList[0].id,
              title: trackList[0].title,
              offsetInMilliseconds: 0,
              token: trackList[0].id,
              currentIndex: 0,
              url: streamUrl
            });
          } else {
            throw new Error('No se pudieron obtener las pistas del álbum');
          }
        } else {
          throw new Error('No se encontró el álbum');
        }
      } else if (slots.playlist && slots.playlist.value) {
        // Buscar y reproducir una playlist
        const playlistName = slots.playlist.value;
        
        logger.info('Buscando playlist', { playlistName, userId });
        
        const searchResult = await tidalService.searchPlaylist(accessToken, playlistName, userId);
        
        if (searchResult && searchResult.playlists && searchResult.playlists.length > 0) {
          const playlist = searchResult.playlists[0];
          const trackList = await tidalService.getPlaylistTracks(accessToken, playlist.id, userId);
          
          if (trackList && trackList.length > 0) {
            streamUrl = await tidalService.getStreamUrl(accessToken, trackList[0].id, userId);
            
            // Crear una lista de tracks simplificada para almacenamiento
            const simplifiedTrackList = trackList.map(track => ({
              id: track.id,
              title: track.title,
              artist: track.artist.name
            }));
            
            metadata = {
              title: trackList[0].title,
              artist: trackList[0].artist.name,
              albumArtUrl: playlist.image,
              playlistName: playlist.title,
              token: trackList[0].id, // Usar el ID de la primera pista como token
              // Guardar la lista de reproducción para gestionar siguiente/anterior
              trackList: simplifiedTrackList,
              currentIndex: 0
            };
            
            speechText = `Reproduciendo la playlist ${playlist.title}`;
            
            // Guardar la playlist en DynamoDB
            await playbackPersistenceService.savePlaylist(userId, simplifiedTrackList, 0);
            
            // También guardar el estado actual de reproducción
            await playbackPersistenceService.savePlaybackState(userId, {
              type: 'playlist',
              playlistId: playlist.id,
              playlistName: playlist.title,
              trackId: trackList[0].id,
              title: trackList[0].title,
              artist: trackList[0].artist.name,
              offsetInMilliseconds: 0,
              token: trackList[0].id,
              currentIndex: 0,
              url: streamUrl
            });
          } else {
            throw new Error('No se pudieron obtener las pistas de la playlist');
          }
        } else {
          throw new Error('No se encontró la playlist');
        }
      } else if (slots.artist && slots.artist.value) {
        // Reproducir música de un artista
        const artistName = slots.artist.value;
        
        logger.info('Buscando artista', { artistName, userId });
        
        const searchResult = await tidalService.searchArtist(accessToken, artistName, userId);
        
        if (searchResult && searchResult.artists && searchResult.artists.length > 0) {
          const artist = searchResult.artists[0];
          const topTracks = await tidalService.getArtistTopTracks(accessToken, artist.id, 10, userId);
          
          if (topTracks && topTracks.length > 0) {
            streamUrl = await tidalService.getStreamUrl(accessToken, topTracks[0].id, userId);
            
            // Crear una lista de tracks simplificada para almacenamiento
            const simplifiedTrackList = topTracks.map(track => ({
              id: track.id,
              title: track.title,
              artist: track.artist.name
            }));
            
            metadata = {
              title: topTracks[0].title,
              artist: artist.name,
              albumArtUrl: topTracks[0].album.cover,
              albumName: topTracks[0].album.title,
              token: topTracks[0].id, // Usar el ID de la primera pista como token
              // Guardar la lista de reproducción para gestionar siguiente/anterior
              trackList: simplifiedTrackList,
              currentIndex: 0
            };
            
            speechText = `Reproduciendo música de ${artist.name}`;
            
            // Guardar la playlist en DynamoDB
            await playbackPersistenceService.savePlaylist(userId, simplifiedTrackList, 0);
            
            // También guardar el estado actual de reproducción
            await playbackPersistenceService.savePlaybackState(userId, {
              type: 'artist',
              artistId: artist.id,
              artistName: artist.name,
              trackId: topTracks[0].id,
              title: topTracks[0].title,
              albumName: topTracks[0].album.title,
              offsetInMilliseconds: 0,
              token: topTracks[0].id,
              currentIndex: 0,
              url: streamUrl
            });
          } else {
            throw new Error('No se pudieron obtener las pistas del artista');
          }
        } else {
          throw new Error('No se encontró el artista');
        }
      } else {
        // Si no se especificaron slots válidos
        speechText = 'No entendí qué quieres reproducir. Por favor, especifica una canción, artista, álbum o playlist.';
        return handlerInput.responseBuilder
          .speak(speechText)
          .reprompt('Puedes decir, por ejemplo, "reproduce Despacito" o "pon música de Rosalía".')
          .getResponse();
      }
      
      // Guardar metadata en la sesión para controles de reproducción (por compatibilidad)
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      sessionAttributes.currentlyPlaying = metadata;
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
      
      // Construir la respuesta con el audio stream
      return handlerInput.responseBuilder
        .speak(speechText)
        .addAudioPlayerPlayDirective(
          'REPLACE_ALL',
          streamUrl,
          metadata.token, // Usar el ID como token para identificación única
          0, // offsetInMilliseconds
          null, // expectedPreviousToken
          metadata // audioItemMetadata
        )
        .withSimpleCard(
          'Tidal Música - Reproduciendo',
          `${metadata.title}\nPor: ${metadata.artist}\n${metadata.albumName ? `Álbum: ${metadata.albumName}` : ''}`
        )
        .getResponse();
    } catch (error) {
      logger.error('Error en PlayMusicIntentHandler', { error });
      
      let errorMessage = 'Lo siento, ha ocurrido un error al intentar reproducir la música.';
      
      // Mensajes de error específicos
      if (error.message === 'No se encontró la canción') {
        errorMessage = 'No he podido encontrar esa canción. ¿Podrías intentar con otra?';
      } else if (error.message === 'No se encontró el álbum') {
        errorMessage = 'No he podido encontrar ese álbum. ¿Podrías intentar con otro?';
      } else if (error.message === 'No se encontró la playlist') {
        errorMessage = 'No he podido encontrar esa playlist. ¿Podrías intentar con otra?';
      } else if (error.message === 'No se encontró el artista') {
        errorMessage = 'No he podido encontrar ese artista. ¿Podrías intentar con otro?';
      }
      
      return handlerInput.responseBuilder
        .speak(errorMessage)
        .reprompt('¿Qué te gustaría escuchar?')
        .getResponse();
    }
  }};

/**
 * Manejador para el intent SearchMusicIntent
 * Se activa cuando el usuario quiere buscar música
 */
const SearchMusicIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'SearchMusicIntent';
  },
  async handle(handlerInput) {
    logger.info('Manejando SearchMusicIntent');
    
    try {
      // Verificar token de acceso
      const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
      if (!accessToken) {
        return handlerInput.responseBuilder
          .speak('Para buscar música en Tidal, necesitas vincular tu cuenta. He enviado un enlace a la aplicación de Alexa.')
          .withLinkAccountCard()
          .getResponse();
      }
      
      // Obtener el término de búsqueda
      const searchTerm = handlerInput.requestEnvelope.request.intent.slots.searchTerm.value;
      
      if (!searchTerm) {
        return handlerInput.responseBuilder
          .speak('No he entendido qué quieres buscar. Por favor, dime qué canción, artista, álbum o playlist te gustaría encontrar.')
          .reprompt('¿Qué te gustaría buscar?')
          .getResponse();
      }
      
      logger.info('Buscando término', { searchTerm });
      
      // Realizar una búsqueda en Tidal
      const searchResults = await tidalService.search(accessToken, searchTerm);
      
      // Procesar y presentar resultados
      // Determinar qué tipo de resultados presentar primero
      let speechText = '';
      let cardContent = '';
      
      if (searchResults.tracks && searchResults.tracks.length > 0) {
        const topTrack = searchResults.tracks[0];
        speechText += `He encontrado la canción "${topTrack.title}" de ${topTrack.artist.name}. `;
        cardContent += `Canción: ${topTrack.title} - ${topTrack.artist.name}\n`;
      }
      
      if (searchResults.artists && searchResults.artists.length > 0) {
        const topArtist = searchResults.artists[0];
        speechText += `He encontrado al artista ${topArtist.name}. `;
        cardContent += `Artista: ${topArtist.name}\n`;
      }
      
      if (searchResults.albums && searchResults.albums.length > 0) {
        const topAlbum = searchResults.albums[0];
        speechText += `He encontrado el álbum "${topAlbum.title}" de ${topAlbum.artist.name}. `;
        cardContent += `Álbum: ${topAlbum.title} - ${topAlbum.artist.name}\n`;
      }
      
      if (speechText === '') {
        speechText = `No he encontrado resultados para "${searchTerm}". Intenta con otro término.`;
        cardContent = 'No se encontraron resultados';
      } else {
        speechText += '¿Quieres que reproduzca alguno de estos resultados?';
      }
      
      // Guardar resultados en la sesión para seguimiento
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      sessionAttributes.lastSearchResults = searchResults;
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
      
      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt('¿Quieres que reproduzca alguno de estos resultados? Puedes decir, por ejemplo, "reproduce la canción" o "pon al artista".')
        .withSimpleCard('Resultados de búsqueda', cardContent)
        .getResponse();
    } catch (error) {
      logger.error('Error en SearchMusicIntentHandler', { error });
      
      return handlerInput.responseBuilder
        .speak('Lo siento, ha ocurrido un error al buscar música. Por favor, inténtalo de nuevo.')
        .reprompt('¿Qué te gustaría buscar?')
        .getResponse();
    }
  }
};

/**
 * Manejador para eventos del AudioPlayer
 * Gestiona eventos como PlaybackStarted, PlaybackFinished, etc.
 */
const AudioPlayerEventHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type.startsWith('AudioPlayer.');
  },
  async handle(handlerInput) {
    const audioPlayerEventName = handlerInput.requestEnvelope.request.type.split('.')[1];
    const userId = handlerInput.requestEnvelope.context.System.user.userId;
    const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
    
    logger.info('Evento AudioPlayer recibido', { audioPlayerEventName, userId });
    
    // Obtener información del token actual (identificador del track)
    const token = handlerInput.requestEnvelope.request.token;
    
    // Intentar obtener el estado de reproducción desde DynamoDB
    let playbackState;
    try {
      playbackState = await playbackPersistenceService.getLatestPlaybackState(userId);
    } catch (error) {
      logger.error('Error al obtener estado de reproducción', { error, userId });
      // Continuar aunque no podamos obtener el estado persistente
    }
    
    // Si no hay estado en DynamoDB, intentar usar el de la sesión (por compatibilidad)
    if (!playbackState) {
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      playbackState = sessionAttributes.currentlyPlaying || {};
    }
    
    switch (audioPlayerEventName) {
      case 'PlaybackStarted':
        // Realizar acciones cuando comienza la reproducción
        logger.info('Reproducción iniciada', { token, userId });
        
        // Documentar en los logs el estado completo
        if (playbackState) {
          logger.debug('Estado de reproducción activo', { 
            userId, 
            type: playbackState.type,
            title: playbackState.title,
            token
          });
        }
        break;
        
      case 'PlaybackFinished':
        // Cuando termina una pista, reproducir la siguiente si existe
        logger.info('Reproducción finalizada', { token, userId });
        
        // Verificar si tenemos una playlist
        let playlist;
        try {
          playlist = await playbackPersistenceService.getPlaylist(userId);
        } catch (error) {
          logger.error('Error al obtener playlist', { error, userId });
        }
        
        if (playlist && playlist.trackList && playlist.currentIndex < playlist.trackList.length - 1) {
          try {
            if (!accessToken) {
              logger.warn('No hay accessToken para reproducir siguiente pista', { userId });
              return handlerInput.responseBuilder.getResponse();
            }
            
            const nextIndex = playlist.currentIndex + 1;
            const nextTrack = playlist.trackList[nextIndex];
            
            logger.info('Reproduciendo siguiente pista', { 
              userId,
              currentIndex: playlist.currentIndex,
              nextIndex,
              nextTrack: nextTrack.title
            });
            
            const streamUrl = await tidalService.getStreamUrl(accessToken, nextTrack.id, userId);
            
            // Actualizar el índice en la playlist persistente
            await playbackPersistenceService.updatePlaylistIndex(userId, nextIndex);
            
            // Actualizar el estado de reproducción
            await playbackPersistenceService.savePlaybackState(userId, {
              type: playbackState.type || 'playlist',
              trackId: nextTrack.id,
              title: nextTrack.title,
              artist: nextTrack.artist,
              offsetInMilliseconds: 0,
              token: nextTrack.id,
              currentIndex: nextIndex,
              url: streamUrl,
              playlistId: playbackState.playlistId,
              playlistName: playbackState.playlistName,
              albumId: playbackState.albumId,
              albumName: playbackState.albumName,
              artistId: playbackState.artistId,
              artistName: playbackState.artistName
            });
            
            // Actualizar la sesión (por compatibilidad)
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
            if (sessionAttributes.currentlyPlaying) {
              sessionAttributes.currentlyPlaying.currentIndex = nextIndex;
              sessionAttributes.currentlyPlaying.title = nextTrack.title;
              sessionAttributes.currentlyPlaying.artist = nextTrack.artist;
              sessionAttributes.currentlyPlaying.token = nextTrack.id;
              handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            }
            
            return handlerInput.responseBuilder
              .addAudioPlayerPlayDirective(
                'REPLACE_ALL',
                streamUrl,
                nextTrack.id, // token
                0, // offsetInMilliseconds
                null, // expectedPreviousToken
                {
                  title: nextTrack.title,
                  artist: nextTrack.artist,
                  token: nextTrack.id,
                  currentIndex: nextIndex,
                  trackList: playlist.trackList
                } // audioItemMetadata
              )
              .getResponse();
          } catch (error) {
            logger.error('Error al reproducir siguiente pista', { error, userId });
            
            // Intentar enviar una notificación al usuario sobre el error
            try {
              // Usar el API de notificaciones proactivas de Alexa
              // o guardar el error para informar en la siguiente interacción
              await playbackPersistenceService.savePlaybackState(userId, {
                ...playbackState,
                error: 'No se pudo reproducir la siguiente pista',
                errorTimestamp: new Date().toISOString()
              });
            } catch (notificationError) {
              logger.error('Error al guardar notificación de error', { notificationError, userId });
            }
          }
        } else {
          logger.info('Fin de la reproducción, no hay más pistas', { userId });
          
          // Actualizar el estado para indicar que la reproducción ha terminado
          try {
            if (playbackState) {
              await playbackPersistenceService.savePlaybackState(userId, {
                ...playbackState,
                isComplete: true,
                completedAt: new Date().toISOString()
              });
            }
          } catch (updateError) {
            logger.error('Error al actualizar estado final', { updateError, userId });
          }
        }
        break;
        
      case 'PlaybackStopped':
        // Guardar posición para reanudar más tarde
        const offsetInMilliseconds = handlerInput.requestEnvelope.request.offsetInMilliseconds;
        
        logger.info('Reproducción detenida', { token, offsetInMilliseconds, userId });
        
        // Guardar la posición en DynamoDB
        try {
          if (playbackState) {
            await playbackPersistenceService.updateTrackState(userId, token, {
              offsetInMilliseconds,
              pausedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          logger.error('Error al guardar posición de pausa', { error, userId });
        }
        
        // También actualizar en la sesión por compatibilidad
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if (sessionAttributes.currentlyPlaying) {
          sessionAttributes.currentlyPlaying.offsetInMilliseconds = offsetInMilliseconds;
          handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        }
        break;
        
      case 'PlaybackFailed':
        // Manejar errores de reproducción
        const errorType = handlerInput.requestEnvelope.request.error.type;
        const errorMessage = handlerInput.requestEnvelope.request.error.message;
        
        logger.error('Error de reproducción', { 
          errorType,
          errorMessage,
          token,
          userId
        });
        
        // Guardar el error en el estado de reproducción
        try {
          if (playbackState) {
            await playbackPersistenceService.savePlaybackState(userId, {
              ...playbackState,
              error: errorMessage,
              errorType,
              errorTimestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          logger.error('Error al guardar información de error', { error, userId });
        }
        break;
        
      case 'PlaybackNearlyFinished':
        // Preparar la siguiente pista para reproducción sin buffering
        logger.info('Reproducción casi finalizada', { token, userId });
        
        // Se podría implementar pre-buffering o pre-caching de la siguiente pista
        // pero por ahora simplemente logueamos el evento
        break;
    }
    
    return handlerInput.responseBuilder.getResponse();
  }
};
/**
 * Manejador para el intent AMAZON.PauseIntent
 * Pausa la reproducción actual
 */
const PauseIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PauseIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .addAudioPlayerStopDirective()
      .getResponse();
  }
};

/**
 * Manejador para el intent AMAZON.ResumeIntent
 * Reanuda la reproducción pausada
 */
const ResumeIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.ResumeIntent';
  },
  async handle(handlerInput) {
    try {
      const userId = handlerInput.requestEnvelope.context.System.user.userId;
      const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
      
      logger.info('Manejando ResumeIntent', { userId });
      
      if (!accessToken) {
        return handlerInput.responseBuilder
          .speak('Para reanudar la música, necesitas vincular tu cuenta de Tidal. He enviado un enlace a la aplicación de Alexa.')
          .withLinkAccountCard()
          .getResponse();
      }
      
      // Intentar obtener el estado de reproducción desde DynamoDB
      let playbackState;
      try {
        playbackState = await playbackPersistenceService.getLatestPlaybackState(userId);
      } catch (error) {
        logger.error('Error al obtener estado de reproducción', { error, userId });
      }
      
      // Si no hay estado en DynamoDB, intentar usar el de la sesión (por compatibilidad)
      if (!playbackState) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        playbackState = sessionAttributes.currentlyPlaying;
      }
      
      if (!playbackState) {
        return handlerInput.responseBuilder
          .speak('No hay nada para reanudar. ¿Qué te gustaría escuchar?')
          .reprompt('Puedes pedirme que reproduzca una canción, álbum o playlist.')
          .getResponse();
      }
      
      logger.info('Reanudando reproducción', { 
        userId,
        track: playbackState.title,
        artist: playbackState.artist
      });
      
      // Si tenemos la URL guardada y no ha pasado mucho tiempo (menos de 1 hora)
      const savedUrl = playbackState.url;
      const offset = playbackState.offsetInMilliseconds || 0;
      
      let streamUrl;
      
      // Verificar si la URL guardada aún es válida
      const pausedAt = playbackState.pausedAt ? new Date(playbackState.pausedAt) : null;
      const urlIsValid = pausedAt && ((new Date() - pausedAt) < 60 * 60 * 1000); // 1 hora
      
      if (savedUrl && urlIsValid) {
        // Usar la URL guardada si aún es válida
        streamUrl = savedUrl;
        logger.info('Usando URL guardada para reanudar', { userId });
      } else {
        // Obtener una nueva URL si no tenemos una o ha expirado
        try {
          // Obtener el ID de la pista a reanudar
          let trackId;
          
          if (playbackState.trackId) {
            trackId = playbackState.trackId;
          } else if (playbackState.token) {
            trackId = playbackState.token;
          } else if (playbackState.trackList && typeof playbackState.currentIndex !== 'undefined') {
            trackId = playbackState.trackList[playbackState.currentIndex].id;
          } else {
            throw new Error('No se puede determinar qué pista reanudar');
          }
          
          // Obtener nueva URL de streaming
          streamUrl = await tidalService.getStreamUrl(accessToken, trackId, userId);
          
          // Actualizar la URL en el estado de reproducción
          await playbackPersistenceService.updateTrackState(userId, trackId, {
            url: streamUrl,
            updatedAt: new Date().toISOString()
          });
          
          logger.info('Obtenida nueva URL para reanudar', { userId, trackId });
        } catch (error) {
          logger.error('Error al obtener URL para reanudar', { error, userId });
          throw error;
        }
      }
      
      // Construir metadata para la reproducción
      const metadata = {
        title: playbackState.title,
        artist: playbackState.artist,
        token: playbackState.token || playbackState.trackId,
        offsetInMilliseconds: offset
      };
      
      // Si hay una lista de reproducción, incluirla
      if (playbackState.trackList && typeof playbackState.currentIndex !== 'undefined') {
        metadata.trackList = playbackState.trackList;
        metadata.currentIndex = playbackState.currentIndex;
      }
      
      // Añadir información del álbum si está disponible
      if (playbackState.albumName) {
        metadata.albumName = playbackState.albumName;
      }
      
      // Actualizar timestamp de reanudación
      await playbackPersistenceService.updateTrackState(userId, metadata.token, {
        resumedAt: new Date().toISOString()
      });
      
      return handlerInput.responseBuilder
        .speak('Reanudando reproducción.')
        .addAudioPlayerPlayDirective(
          'REPLACE_ALL',
          streamUrl,
          metadata.token, // token
          offset, // offsetInMilliseconds
          null, // expectedPreviousToken
          metadata // audioItemMetadata
        )
        .getResponse();
    } catch (error) {
      logger.error('Error en ResumeIntentHandler', { error });
      
      return handlerInput.responseBuilder
        .speak('Lo siento, no pude reanudar la reproducción. ¿Quieres intentar reproducir algo más?')
        .reprompt('¿Qué te gustaría escuchar?')
        .getResponse();
    }
  }
};

/**
 * Manejador para el intent AMAZON.NextIntent
 * Reproduce la siguiente pista
 */
const NextIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NextIntent';
  },
  async handle(handlerInput) {
    try {
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      const playbackInfo = sessionAttributes.currentlyPlaying;
      
      if (!playbackInfo || !playbackInfo.trackList) {
        return handlerInput.responseBuilder
          .speak('No hay una lista de reproducción activa para avanzar.')
          .getResponse();
      }
      
      const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
      
      if (!accessToken) {
        return handlerInput.responseBuilder
          .speak('Para controlar la reproducción, necesitas vincular tu cuenta de Tidal. He enviado un enlace a la aplicación de Alexa.')
          .withLinkAccountCard()
          .getResponse();
      }
      
      // Verificar si hay una pista siguiente
      const nextIndex = playbackInfo.currentIndex + 1;
      if (nextIndex >= playbackInfo.trackList.length) {
        return handlerInput.responseBuilder
          .speak('Has llegado al final de la lista de reproducción.')
          .getResponse();
      }
      
      // Reproducir la siguiente pista
      const nextTrack = playbackInfo.trackList[nextIndex];
      const streamUrl = await tidalService.getStreamUrl(accessToken, nextTrack.id);
      
      // Actualizar la información de reproducción
      playbackInfo.currentIndex = nextIndex;
      playbackInfo.title = nextTrack.title;
      playbackInfo.artist = nextTrack.artist;
      
      sessionAttributes.currentlyPlaying = playbackInfo;
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
      
      return handlerInput.responseBuilder
        .speak(`Reproduciendo ${nextTrack.title} de ${nextTrack.artist}`)
        .addAudioPlayerPlayDirective(
          'REPLACE_ALL',
          streamUrl,
          nextTrack.title, // token
          0, // offsetInMilliseconds
          null, // expectedPreviousToken
          playbackInfo // audioItemMetadata
        )
        .getResponse();
    } catch (error) {
      logger.error('Error en NextIntentHandler', { error });
      
      return handlerInput.responseBuilder
        .speak('Lo siento, ha ocurrido un error al intentar reproducir la siguiente pista.')
        .getResponse();
    }
  }
};

/**
 * Manejador para el intent AMAZON.PreviousIntent
 * Reproduce la pista anterior
 */
const PreviousIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PreviousIntent';
  },
  async handle(handlerInput) {
    try {
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      const playbackInfo = sessionAttributes.currentlyPlaying;
      
      if (!playbackInfo || !playbackInfo.trackList) {
        return handlerInput.responseBuilder
          .speak('No hay una lista de reproducción activa para retroceder.')
          .getResponse();
      }
      
      const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
      
      if (!accessToken) {
        return handlerInput.responseBuilder
          .speak('Para controlar la reproducción, necesitas vincular tu cuenta de Tidal. He enviado un enlace a la aplicación de Alexa.')
          .withLinkAccountCard()
          .getResponse();
      }
      
      // Verificar si hay una pista anterior
      const prevIndex = playbackInfo.currentIndex - 1;
      if (prevIndex < 0) {
        return handlerInput.responseBuilder
          .speak('Ya estás en la primera pista de la lista de reproducción.')
          .getResponse();
      }
      
      // Reproducir la pista anterior
      const prevTrack = playbackInfo.trackList[prevIndex];
      const streamUrl = await tidalService.getStreamUrl(accessToken, prevTrack.id);
      
      // Actualizar la información de reproducción
      playbackInfo.currentIndex = prevIndex;
      playbackInfo.title = prevTrack.title;
      playbackInfo.artist = prevTrack.artist;
      
      sessionAttributes.currentlyPlaying = playbackInfo;
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
      
      return handlerInput.responseBuilder
        .speak(`Reproduciendo ${prevTrack.title} de ${prevTrack.artist}`)
        .addAudioPlayerPlayDirective(
          'REPLACE_ALL',
          streamUrl,
          prevTrack.title, // token
          0, // offsetInMilliseconds
          null, // expectedPreviousToken
          playbackInfo // audioItemMetadata
        )
        .getResponse();
    } catch (error) {
      logger.error('Error en PreviousIntentHandler', { error });
      
      return handlerInput.responseBuilder
        .speak('Lo siento, ha ocurrido un error al intentar reproducir la pista anterior.')
        .getResponse();
    }
  }
};

module.exports = {
  PlayMusicIntentHandler,
  SearchMusicIntentHandler,
  AudioPlayerEventHandler,
  PauseIntentHandler,
  ResumeIntentHandler,
  NextIntentHandler,
  PreviousIntentHandler
};