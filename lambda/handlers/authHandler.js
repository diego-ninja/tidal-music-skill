/**
 * Manejador para autenticación y autorización con Tidal
 * Gestiona el proceso de vinculación de cuentas y los tokens
 */

const Alexa = require('ask-sdk-core');
const logger = require('../utils/logger');
const tidalService = require('../services/tidalService');

/**
 * Manejador para el evento de AccountLinked
 * Se activa cuando el usuario completa el proceso de vinculación de cuenta
 */
const AccountLinkedHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'AlexaSkillEvent.SkillAccountLinked';
  },
  
  async handle(handlerInput) {
    try {
      const accessToken = handlerInput.requestEnvelope.request.body.accessToken;
      const userId = handlerInput.requestEnvelope.context.System.user.userId;
      
      logger.info('Cuenta vinculada para usuario', { userId });
      
      // Almacenar el accessToken y refreshToken
      try {
        // Obtener información del usuario para verificar que el token funciona
        const userInfo = await tidalService.getUserInfo(accessToken);
        
        // Aquí podríamos guardar en una base de datos persistente la relación
        // entre el userId de Alexa y el userId de Tidal para análisis posterior
        
        logger.info('Verificación de token exitosa', { tidalUserId: userInfo.userId });
        
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true })
        };
      } catch (error) {
        logger.error('Error al verificar token después de vinculación', { error });
        return {
          statusCode: 500,
          body: JSON.stringify({ success: false, error: 'Error al verificar token' })
        };
      }
    } catch (error) {
      logger.error('Error en AccountLinkedHandler', { error });
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: 'Error interno' })
      };
    }
  }
};

/**
 * Manejador para el evento de AccountLinkedDeleted
 * Se activa cuando el usuario desvincula su cuenta
 */
const AccountLinkDeletedHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'AlexaSkillEvent.SkillAccountLinked' &&
           handlerInput.requestEnvelope.request.body.accessToken === undefined;
  },
  
  handle(handlerInput) {
    const userId = handlerInput.requestEnvelope.context.System.user.userId;
    
    logger.info('Cuenta desvinculada para usuario', { userId });
    
    // Aquí podríamos eliminar de nuestra base de datos persistente
    // cualquier información asociada a este usuario
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  }
};

/**
 * Verifica si el usuario tiene una cuenta vinculada y su token es válido
 * @param {Object} handlerInput - Input del handler
 * @returns {Promise<boolean>} - true si el usuario está autorizado
 */
const isUserAuthenticated = async (handlerInput) => {
  try {
    const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
    
    if (!accessToken) {
      return false;
    }
    
    // Verificar que el token sea válido haciendo una petición simple
    await tidalService.getUserInfo(accessToken);
    
    return true;
  } catch (error) {
    logger.error('Error al verificar autenticación', { error });
    return false;
  }
};

/**
 * Genera una respuesta solicitando vincular la cuenta
 * @param {Object} handlerInput - Input del handler
 * @returns {Object} - Respuesta con tarjeta de vinculación
 */
const getAccountLinkingResponse = (handlerInput) => {
  const speechText = 'Para usar esta skill necesitas vincular tu cuenta de Tidal. He enviado un enlace a la aplicación de Alexa para que puedas hacerlo.';
  
  return handlerInput.responseBuilder
    .speak(speechText)
    .withLinkAccountCard()
    .getResponse();
};

module.exports = {
  AccountLinkedHandler,
  AccountLinkDeletedHandler,
  isUserAuthenticated,
  getAccountLinkingResponse
};