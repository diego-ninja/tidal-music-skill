/**
 * Manejador para diagnóstico y monitorización
 * Proporciona información sobre el estado del sistema
 */

const logger = require('../utils/logger');
const config = require('../utils/configService');
const cacheService = require('../utils/cacheService');
const tidalService = require('../services/tidalService');
const tokenPersistenceService = require('../services/tokenPersistenceService');

/**
 * Intent para solicitar estadísticas y diagnóstico
 */
const DiagnosticsIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'DiagnosticsIntent'
    );
  },
  async handle(handlerInput) {
    // Solo permitir en entornos de desarrollo o pruebas
    const environment = config.get('app.environment');
    if (config.isProduction()) {
      return handlerInput.responseBuilder
        .speak('Esta función solo está disponible en entornos de desarrollo.')
        .getResponse();
    }
    
    // Obtener estadísticas
    const cacheStats = cacheService.getStats();
    
    // Generar respuesta con estadísticas
    const speechText = `
      Entorno: ${environment}.
      Caché: ${cacheStats.enabled ? 'habilitada' : 'deshabilitada'}.
      Tasa de aciertos: ${cacheStats.hitRate}%.
      Total de solicitudes: ${cacheStats.totalRequests}.
      Aciertos: ${cacheStats.hits}.
      Fallos: ${cacheStats.misses}.
      Tamaño: ${cacheStats.size} entradas en ${cacheStats.namespaces} espacios.
    `.replace(/\s+/g, ' ').trim();
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Diagnóstico', speechText)
      .getResponse();
  }
};

/**
 * Intent para limpiar la caché
 */
const ClearCacheIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'ClearCacheIntent'
    );
  },
  async handle(handlerInput) {
    // Solo permitir en entornos de desarrollo o pruebas
    if (config.isProduction()) {
      return handlerInput.responseBuilder
        .speak('Esta función solo está disponible en entornos de desarrollo.')
        .getResponse();
    }
    
    try {
      // Obtener tipo de caché a limpiar (opcional)
      const intent = handlerInput.requestEnvelope.request.intent;
      const cacheTypeSlot = intent.slots && intent.slots.cacheType;
      const cacheType = cacheTypeSlot && cacheTypeSlot.value;
      
      if (cacheType) {
        // Limpiar solo un tipo específico
        tidalService.clearCache(cacheType);
        
        return handlerInput.responseBuilder
          .speak(`Caché de ${cacheType} limpiada correctamente.`)
          .getResponse();
      } else {
        // Limpiar toda la caché
        cacheService.clear();
        
        return handlerInput.responseBuilder
          .speak('Toda la caché ha sido limpiada correctamente.')
          .getResponse();
      }
    } catch (error) {
      logger.error('Error al limpiar caché', { error });
      
      return handlerInput.responseBuilder
        .speak('Ha ocurrido un error al intentar limpiar la caché.')
        .getResponse();
    }
  }
};

/**
 * Manejador de eventos programados para mantenimiento
 */
const ScheduledMaintenanceHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'Scheduled.Maintenance';
  },
  async handle(handlerInput) {
    logger.info('Ejecutando mantenimiento programado');
    
    try {
      // Limpiar entradas expiradas de la caché
      const removed = cacheService.cleanup();
      
      // Otros procesos de mantenimiento podrían ir aquí
      // Por ejemplo, eliminar tokens expirados, etc.
      
      logger.info('Mantenimiento completado', { cacheEntriesRemoved: removed });
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          cacheEntriesRemoved: removed
        })
      };
    } catch (error) {
      logger.error('Error en mantenimiento programado', { error });
      
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: error.message
        })
      };
    }
  }
};

module.exports = {
  DiagnosticsIntentHandler,
  ClearCacheIntentHandler,
  ScheduledMaintenanceHandler
};