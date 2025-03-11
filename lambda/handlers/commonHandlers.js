/**
 * Manejadores comunes para intents estándar de Alexa
 * Incluye manejadores para ayuda, cancelar, detener y errores
 */

const logger = require('../utils/logger');

/**
 * Manejador para el intent AMAZON.HelpIntent
 * Se activa cuando el usuario pide ayuda
 */
const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'Puedes pedirme que reproduzca canciones, álbumes o playlists de Tidal. ' +
      'Por ejemplo, di "reproduce Despacito" o "busca canciones de Rosalía".';
      
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('Ayuda - Tidal Música', speechText)
      .getResponse();
  }
};

/**
 * Manejador para los intents AMAZON.CancelIntent y AMAZON.StopIntent
 * Se activa cuando el usuario quiere cancelar o detener la interacción
 */
const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speechText = 'Hasta pronto!';
    
    // Detener cualquier reproducción activa
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Tidal Música', speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
};

/**
 * Manejador para el evento SessionEndedRequest
 * Se activa cuando la sesión termina
 */
const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    // Limpiar recursos si es necesario
    logger.info('Sesión finalizada:', {
      reason: handlerInput.requestEnvelope.request.reason
    });
    
    return handlerInput.responseBuilder.getResponse();
  }
};

/**
 * Manejador de errores
 * Captura cualquier error no manejado en otros handlers
 */
const ErrorHandler = {
  canHandle() {
    return true; // Este handler captura todos los errores
  },
  handle(handlerInput, error) {
    logger.error('Error manejado:', { error });
    
    const speechText = 'Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo.';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('Error - Tidal Música', speechText)
      .getResponse();
  }
};

module.exports = {
  HelpIntentHandler,
  CancelAndStopIntentHandler,
  SessionEndedRequestHandler,
  ErrorHandler
};