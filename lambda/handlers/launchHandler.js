/**
 * Manejador para el evento LaunchRequest
 * Se activa cuando el usuario inicia la skill sin especificar un intent
 */

const logger = require('../utils/logger');
const tidalService = require('../services/tidalService');

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    logger.info('Iniciando skill de Tidal');
    
    try {
      // Verificar si el usuario tiene vinculada su cuenta de Tidal
      const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
      
      // Si no hay token, pedir al usuario que vincule su cuenta
      if (!accessToken) {
        logger.info('Usuario sin cuenta vinculada');
        return handlerInput.responseBuilder
          .speak('Bienvenido a Tidal Música. Para utilizar esta skill, necesitas vincular tu cuenta de Tidal. He enviado un enlace a la aplicación de Alexa para que puedas hacerlo.')
          .withLinkAccountCard()
          .getResponse();
      }
      
      // Obtener información del usuario para personalizar la respuesta
      try {
        const serviceClient = handlerInput.serviceClientFactory.getUpsServiceClient();
        const profileName = await serviceClient.getProfileGivenName();
        
        // Verificar estado de la cuenta Tidal
        const userInfo = await tidalService.getUserInfo(accessToken);
        logger.info('Información de usuario obtenida', { userInfo });
        
        const welcomeMessage = profileName 
          ? `Hola ${profileName}! Bienvenido a Tidal Música. Puedes pedirme que reproduzca tus canciones, álbumes o playlists favoritos.` 
          : 'Bienvenido a Tidal Música. Puedes pedirme que reproduzca tus canciones, álbumes o playlists favoritos.';
          
        return handlerInput.responseBuilder
          .speak(welcomeMessage)
          .reprompt('¿Qué te gustaría escuchar hoy?')
          .withSimpleCard('Bienvenido a Tidal Música', welcomeMessage)
          .getResponse();
      } catch (error) {
        logger.error('Error al obtener información del perfil', { error });
        
        // Manejo de error específico para token expirado
        if (error.statusCode === 401) {
          return handlerInput.responseBuilder
            .speak('Parece que tu sesión de Tidal ha expirado. He enviado un enlace a la aplicación de Alexa para que puedas volver a vincular tu cuenta.')
            .withLinkAccountCard()
            .getResponse();
        }
        
        // Respuesta genérica en caso de otros errores
        return handlerInput.responseBuilder
          .speak('Bienvenido a Tidal Música. ¿Qué te gustaría escuchar hoy?')
          .reprompt('Puedes pedirme que reproduzca una canción, un álbum o una playlist.')
          .withSimpleCard('Bienvenido a Tidal Música', 'Bienvenido a Tidal Música. ¿Qué te gustaría escuchar hoy?')
          .getResponse();
      }
    } catch (error) {
      logger.error('Error en LaunchRequestHandler', { error });
      
      return handlerInput.responseBuilder
        .speak('Ha ocurrido un error al iniciar Tidal Música. Por favor, inténtalo de nuevo más tarde.')
        .withSimpleCard('Error - Tidal Música', 'Ha ocurrido un error al iniciar la skill. Por favor, inténtalo de nuevo.')
        .getResponse();
    }
  }
};

module.exports = LaunchRequestHandler;