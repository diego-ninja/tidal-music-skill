/**
 * Punto de entrada principal para la skill de Alexa de Tidal
 */

require('dotenv').config();

const Alexa = require('ask-sdk-core');
const config = require('./services/configService');
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

// Importar manejadores de autenticación
const {
  AccountLinkedHandler,
  AccountLinkDeletedHandler
} = require('./handlers/authHandler');

// Importar manejadores de monitorización
const {
    DiagnosticsIntentHandler,
    ClearCacheIntentHandler,
    ScheduledMaintenanceHandler
  } = require('./handlers/monitoringHandler');

/**
 * Inicializar y configurar la skill
 */
function buildSkill() {
  // Obtener configuración de Alexa
  const alexaConfig = config.getSection('alexa');
  
  // Crear una instancia de Alexa Skill Builder
  return Alexa.SkillBuilders.custom()
    .addRequestHandlers(
      // Manejadores de eventos del ciclo de vida
      LaunchRequestHandler,
      AccountLinkedHandler,
      AccountLinkDeletedHandler,
      
      // Manejadores de intents de música
      PlayMusicIntentHandler,
      SearchMusicIntentHandler,
      PauseIntentHandler,
      ResumeIntentHandler,
      NextIntentHandler,
      PreviousIntentHandler,
      
      // Manejadores de eventos del AudioPlayer
      AudioPlayerEventHandler,
      
      // Manejadores de intents comunes
      HelpIntentHandler,
      CancelAndStopIntentHandler,
      SessionEndedRequestHandler,

      // Manejadores de diagnóstico y monitorización (solo en desarrollo y pruebas)
      ...(config.isProduction() ? [] : [
        DiagnosticsIntentHandler,
        ClearCacheIntentHandler
      ]),
    
    // Manejador de mantenimiento programado
    ScheduledMaintenanceHandler
    )
    .addErrorHandlers(ErrorHandler)
    .withApiClient(new Alexa.DefaultApiClient())
    .withCustomUserAgent(`tidal-music-skill/v1.0 (${config.get('app.environment')})`)
    .withSkillId(alexaConfig.skillId)
    .create();
}

// Crear la skill una sola vez (singleton)
const skill = buildSkill();

/**
 * Esta función es el punto de entrada para la Lambda
 * Recibe los eventos de Alexa y los procesa
 */
exports.handler = async function (event, context) {
  // Loguear el ambiente al iniciar
  const environment = config.get('app.environment');
  const isLocal = config.isLocal();
  
  logger.info('Skill iniciada', { 
    environment,
    isLocal,
    requestId: context.awsRequestId
  });
  
  // Loguear evento recibido (nivel debug)
  logger.debug('Evento recibido', { event });
  
  try {
    // Ejecutar la skill con el evento recibido
    const response = await skill.invoke(event, context);
    
    // Loguear respuesta (nivel debug)
    logger.debug('Respuesta generada', { response });
    
    return response;
  } catch (error) {
    // Loguear error no capturado
    logger.error('Error no capturado en handler principal', { error });
    throw error;
  }
};

// Exponer configuración para pruebas
exports.config = config;