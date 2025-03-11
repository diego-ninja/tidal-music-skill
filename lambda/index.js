/**
 * Punto de entrada principal para la skill de Alexa de Tidal
 */

const Alexa = require('ask-sdk-core');
const logger = require('./utils/logger');

// Importar manejadores
const LaunchRequestHandler = require('./handlers/launchHandler');
const { 
  HelpIntentHandler, 
  CancelAndStopIntentHandler,
  SessionEndedRequestHandler,
  ErrorHandler
} = require('./handlers/commonHandlers');
const {
  PlayMusicIntentHandler,
  SearchMusicIntentHandler,
  AudioPlayerEventHandler,
  PauseIntentHandler,
  ResumeIntentHandler,
  NextIntentHandler,
  PreviousIntentHandler
} = require('./handlers/musicHandlers');

/**
 * Esta función es el punto de entrada para la Lambda
 * Recibe los eventos de Alexa y los procesa
 */
exports.handler = async function (event, context) {
  logger.info('Evento recibido:', { event });
  
  try {
    // Crear una instancia de Alexa Skill Builder
    const skillBuilder = Alexa.SkillBuilders.custom()
      .addRequestHandlers(
        LaunchRequestHandler,
        PlayMusicIntentHandler,
        SearchMusicIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        PauseIntentHandler,
        ResumeIntentHandler,
        NextIntentHandler,
        PreviousIntentHandler,
        AudioPlayerEventHandler,
        SessionEndedRequestHandler
      )
      .addErrorHandlers(ErrorHandler)
      .withApiClient(new Alexa.DefaultApiClient())
      .withCustomUserAgent('tidal-music-skill/v1.0');
      
    // Crear la skill
    const skill = skillBuilder.create();
    
    // Ejecutar la skill con el evento recibido
    const response = await skill.invoke(event, context);
    logger.info('Respuesta:', { response });
    
    return response;
  } catch (error) {
    logger.error('Error no capturado:', { error });
    throw error;
  }
};