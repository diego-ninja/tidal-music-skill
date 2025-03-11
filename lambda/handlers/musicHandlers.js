/**
 * Manejadores para los intents relacionados con la música
 * Incluye reproducción, búsqueda y control de audio
 */

const logger = require('../utils/logger');
const tidalService = require('../services/tidalService');

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
        
        logger.info('Buscando canción', { songName, artistName });
        
        const searchResult = await tidalService.searchTrack(accessToken, songName, artistName);
        
        if (searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
          const track = searchResult.tracks[0];
          streamUrl = await tidalService.getStreamUrl(accessToken, track.id);
          metadata = {
            title: track.title,
            artist: track.artist.name,
            albumArtUrl: track.album.cover,
            albumName: track.album.title
          };
          
          speechText = `Reproduciendo ${track.title} de ${track.artist.name}`;
        } else {
          throw new Error('No se encontró la canción');
        }
      } else if (slots.album && slots.album.value) {
        // Buscar y reproducir un álbum
        const albumName = slots.album.value;
        const artistName = slots.artist && slots.artist.value ? slots.artist.value : null;
        
        logger.info('Buscando álbum', { albumName, artistName });
        
        const searchResult = await tidalService.searchAlbum(accessToken, albumName, artistName);
        
        if (searchResult && searchResult.albums && searchResult.albums.length > 0) {
          const album = searchResult.albums[0];
          const trackList = await tidalService.getAlbumTracks(accessToken, album.id);
          
          if (trackList && trackList.length > 0) {
            streamUrl = await tidalService.getStreamUrl(accessToken, trackList[0].id);
            metadata = {
              title: trackList[0].title,
              artist: trackList[0].artist.name,
              albumArtUrl: album.cover,
              albumName: album.title,
              // Guardar la lista de reproducción para gestionar siguiente/anterior
              trackList: trackList.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.artist.name
              })),
              currentIndex: 0
            };
            
            speechText = `Reproduciendo el álbum ${album.title} de ${album.artist.name}`;
          } else {
            throw new Error('No se pudieron obtener las pistas del álbum');
          }
        } else {
          throw new Error('No se encontró el álbum');
        }
      } else if (slots.playlist && slots.playlist.value) {
        // Buscar y reproducir una playlist
        const playlistName = slots.playlist.value;
        
        logger.info('Buscando playlist', { playlistName });
        
        const searchResult = await tidalService.searchPlaylist(accessToken, playlistName);
        
        if (searchResult && searchResult.playlists && searchResult.playlists.length > 0) {
          const playlist = searchResult.playlists[0];
          const trackList = await tidalService.getPlaylistTracks(accessToken, playlist.id);
          
          if (trackList && trackList.length > 0) {
            streamUrl = await tidalService.getStreamUrl(accessToken, trackList[0].id);
            metadata = {
              title: trackList[0].title,
              artist: trackList[0].artist.name,
              albumArtUrl: playlist.image,
              playlistName: playlist.title,
              // Guardar la lista de reproducción para gestionar siguiente/anterior
              trackList: trackList.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.artist.name
              })),
              currentIndex: 0
            };
            
            speechText = `Reproduciendo la playlist ${playlist.title}`;
          } else {
            throw new Error('No se pudieron obtener las pistas de la playlist');
          }
        } else {
          throw new Error('No se encontró la playlist');
        }
      } else if (slots.artist && slots.artist.value) {
        // Reproducir música de un artista
        const artistName = slots.artist.value;
        
        logger.info('Buscando artista', { artistName });
        
        const searchResult = await tidalService.searchArtist(accessToken, artistName);
        
        if (searchResult && searchResult.artists && searchResult.artists.length > 0) {
          const artist = searchResult.artists[0];
          const topTracks = await tidalService.getArtistTopTracks(accessToken, artist.id);
          
          if (topTracks && topTracks.length > 0) {
            streamUrl = await tidalService.getStreamUrl(accessToken, topTracks[0].id);
            metadata = {
              title: topTracks[0].title,
              artist: artist.name,
              albumArtUrl: topTracks[0].album.cover,
              albumName: topTracks[0].album.title,
              // Guardar la lista de reproducción para gestionar siguiente/anterior
              trackList: topTracks.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.artist.name
              })),
              currentIndex: 0
            };
            
            speechText = `Reproduciendo música de ${artist.name}`;
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
      
      // Guardar metadata en la sesión para controles de reproducción
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      sessionAttributes.currentlyPlaying = metadata;
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
      
      // Construir la respuesta con el audio stream
      return handlerInput.responseBuilder
        .speak(speechText)
        .addAudioPlayerPlayDirective(
          'REPLACE_ALL',
          streamUrl,
          metadata.title, // token
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
  }
};

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
    logger.info('Evento AudioPlayer recibido', { audioPlayerEventName });
    
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const playbackInfo = sessionAttributes.currentlyPlaying || {};
    
    switch (audioPlayerEventName) {
      case 'PlaybackStarted':
        // Realizar acciones cuando comienza la reproducción
        logger.info('Reproducción iniciada', { playbackInfo });
        break;
        
      case 'PlaybackFinished':
        // Cuando termina una pista, reproducir la siguiente si existe
        if (playbackInfo.trackList && playbackInfo.currentIndex < playbackInfo.trackList.length - 1) {
          try {
            const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
            const nextIndex = playbackInfo.currentIndex + 1;
            const nextTrack = playbackInfo.trackList[nextIndex];
            
            const streamUrl = await tidalService.getStreamUrl(accessToken, nextTrack.id);
            
            // Actualizar el índice actual
            playbackInfo.currentIndex = nextIndex;
            playbackInfo.title = nextTrack.title;
            playbackInfo.artist = nextTrack.artist;
            
            sessionAttributes.currentlyPlaying = playbackInfo;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            
            return handlerInput.responseBuilder
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
            logger.error('Error al reproducir siguiente pista', { error });
          }
        }
        break;
        
      case 'PlaybackStopped':
        // Guardar posición para reanudar más tarde
        sessionAttributes.currentlyPlaying.offsetInMilliseconds = 
          handlerInput.requestEnvelope.request.offsetInMilliseconds;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        logger.info('Reproducción detenida', { 
          offset: handlerInput.requestEnvelope.request.offsetInMilliseconds 
        });
        break;
        
      case 'PlaybackFailed':
        // Manejar errores de reproducción
        logger.error('Error de reproducción', { 
          error: handlerInput.requestEnvelope.request.error 
        });
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
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      const playbackInfo = sessionAttributes.currentlyPlaying;
      
      if (!playbackInfo) {
        return handlerInput.responseBuilder
          .speak('No hay nada para reanudar. ¿Qué te gustaría escuchar?')
          .reprompt('Puedes pedirme que reproduzca una canción, álbum o playlist.')
          .getResponse();
      }
      
      const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
      
      if (!accessToken) {
        return handlerInput.responseBuilder
          .speak('Para reanudar la música, necesitas vincular tu cuenta de Tidal. He enviado un enlace a la aplicación de Alexa.')
          .withLinkAccountCard()
          .getResponse();
      }
      
      // Si tenemos una lista de reproducción, obtener el track actual
      let trackId;
      if (playbackInfo.trackList && typeof playbackInfo.currentIndex !== 'undefined') {
        trackId = playbackInfo.trackList[playbackInfo.currentIndex].id;
      } else {
        // Si es una sola canción, reconstruir el ID desde el token
        trackId = playbackInfo.title; // Esto asume que usamos el título como token
      }
      
      const streamUrl = await tidalService.getStreamUrl(accessToken, trackId);
      const offset = playbackInfo.offsetInMilliseconds || 0;
      
      return handlerInput.responseBuilder
        .speak('Reanudando reproducción.')
        .addAudioPlayerPlayDirective(
          'REPLACE_ALL',
          streamUrl,
          playbackInfo.title, // token
          offset, // offsetInMilliseconds
          null, // expectedPreviousToken
          playbackInfo // audioItemMetadata
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