/**
 * Utilidad de logging para la skill de Tidal
 * Proporciona funciones para registrar logs con diferentes niveles
 */

const winston = require('winston');

// Configurar formato de logs
const logFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  // Añadir metadata si existe
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  
  return msg;
});

// Crear logger con configuración personalizada
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ],
  // No fallar en caso de error de logging
  exitOnError: false
});

// Sanitizar datos sensibles en los logs
const sanitizeData = (obj) => {
  if (!obj) return obj;
  
  // Si es un string, revisar si contiene datos sensibles
  if (typeof obj === 'string') {
    // Ocultar tokens de acceso
    if (obj.includes('eyJ') && obj.length > 100) {
      return '[ACCESS_TOKEN_REDACTED]';
    }
    return obj;
  }
  
  // Si es un objeto o array, recorrer recursivamente
  if (typeof obj === 'object') {
    const sanitized = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
      // Sanitizar campos específicos conocidos por contener información sensible
      if (['accessToken', 'refreshToken', 'password', 'token'].includes(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(obj[key]);
      }
    }
    
    return sanitized;
  }
  
  return obj;
};

// Envolver los métodos del logger para sanitizar automáticamente
const wrappedLogger = {
  info: (message, meta = {}) => {
    logger.info(message, sanitizeData(meta));
  },
  error: (message, meta = {}) => {
    logger.error(message, sanitizeData(meta));
  },
  warn: (message, meta = {}) => {
    logger.warn(message, sanitizeData(meta));
  },
  debug: (message, meta = {}) => {
    logger.debug(message, sanitizeData(meta));
  }
};

module.exports = wrappedLogger;