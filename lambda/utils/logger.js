/**
 * Utilidad de logging para la skill de Tidal
 * Proporciona funciones para registrar logs con diferentes niveles
 */

const winston = require('winston');
const config = require('../services/configService');

// Obtener configuración de logger
const loggerConfig = config.getSection('logger');

// Definir niveles de log personalizados con colores
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5
};

// Definir colores para la consola
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  trace: 'cyan'
};

// Aplicar colores personalizados
winston.addColors(colors);

// Configurar formato de logs basado en la configuración
let logFormat;
if (loggerConfig.format === 'json') {
  // Formato JSON para entornos de producción (más fácil de parsear)
  logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );
} else {
  // Formato legible para desarrollo
  logFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Añadir metadata si existe
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    return msg;
  });
  
  logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    logFormat
  );
}

// Crear transports según el entorno
const transports = [];

// Siempre añadir transport de consola
transports.push(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  })
);

// Añadir transport de archivo en desarrollo si se ha configurado
if (config.get('logger.file.enabled', false)) {
  transports.push(
    new winston.transports.File({
      filename: config.get('logger.file.path', 'logs/combined.log'),
      format: logFormat
    })
  );
  
  // Añadir transport de archivo para errores
  transports.push(
    new winston.transports.File({
      filename: config.get('logger.file.errorPath', 'logs/error.log'),
      level: 'error',
      format: logFormat
    })
  );
}

// Crear logger con configuración personalizada
const winstonLogger = winston.createLogger({
  level: loggerConfig.level || 'info',
  levels,
  format: logFormat,
  transports,
  // No fallar en caso de error de logging
  exitOnError: false
});

// Sanitizar datos sensibles en los logs según configuración
const sanitizeData = (obj) => {
  // Si se ha configurado para incluir datos sensibles, no sanitizar
  if (loggerConfig.includeSensitive) {
    return obj;
  }
  
  if (!obj) return obj;
  
  // Si es un string, revisar si contiene datos sensibles
  if (typeof obj === 'string') {
    // Ocultar tokens de acceso (JWT)
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
      if (['accessToken', 'refreshToken', 'password', 'token', 'secret', 'credential', 'clientSecret'].includes(key)) {
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
const logger = {
  error: (message, meta = {}) => {
    winstonLogger.error(message, sanitizeData(meta));
  },
  warn: (message, meta = {}) => {
    winstonLogger.warn(message, sanitizeData(meta));
  },
  info: (message, meta = {}) => {
    winstonLogger.info(message, sanitizeData(meta));
  },
  http: (message, meta = {}) => {
    winstonLogger.http(message, sanitizeData(meta));
  },
  debug: (message, meta = {}) => {
    winstonLogger.debug(message, sanitizeData(meta));
  },
  trace: (message, meta = {}) => {
    if (winstonLogger.levels[winstonLogger.level] >= levels.trace) {
      winstonLogger.debug(`TRACE: ${message}`, sanitizeData(meta));
    }
  },
  // Método utilitario para loguear inicio/fin de funciones
  logFunction: async (functionName, func, params = {}) => {
    const start = Date.now();
    logger.debug(`Iniciando ${functionName}`, sanitizeData(params));
    
    try {
      const result = await func();
      const duration = Date.now() - start;
      logger.debug(`Completado ${functionName} en ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Error en ${functionName} después de ${duration}ms`, {
        error,
        params: sanitizeData(params)
      });
      throw error;
    }
  }
};

module.exports = logger;