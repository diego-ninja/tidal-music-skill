/**
 * Servicio genérico de caché en memoria
 * Proporciona almacenamiento temporal para reducir llamadas a APIs externas
 */

const logger = require('../utils/logger');
const config = require('./configService');

/**
 * Clase que representa una entrada en la caché
 */
class CacheEntry {
  /**
   * Crea una nueva entrada de caché
   * @param {*} value - Valor a almacenar
   * @param {number} ttl - Tiempo de vida en segundos
   */
  constructor(value, ttl) {
    this.value = value;
    this.expiresAt = Date.now() + (ttl * 1000);
    this.createdAt = Date.now();
    this.hits = 0;
  }

  /**
   * Verifica si la entrada ha expirado
   * @returns {boolean} - true si ha expirado
   */
  isExpired() {
    return Date.now() > this.expiresAt;
  }

  /**
   * Registra un acceso a esta entrada
   */
  hit() {
    this.hits++;
    this.lastAccess = Date.now();
  }

  /**
   * Obtiene la antigüedad de la entrada en milisegundos
   * @returns {number} - Antigüedad en ms
   */
  getAge() {
    return Date.now() - this.createdAt;
  }
}

/**
 * Clase principal del servicio de caché
 */
class CacheService {
  /**
   * Crea una nueva instancia del servicio de caché
   */
  constructor() {
    // Obtener configuración
    const cacheConfig = config.getSection('cache');
    
    this.enabled = cacheConfig.enabled !== false;
    this.defaultTTL = cacheConfig.defaultTTL || 300; // 5 minutos por defecto
    this.maxSize = cacheConfig.maxSize || 1000;
    this.cleanupInterval = cacheConfig.cleanupInterval || 60000; // 1 minuto
    
    // Caché principal (Map de Maps para permitir "namespaces")
    this.caches = new Map();
    
    // Estadísticas
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      expired: 0
    };
    
    // Configurar limpieza periódica
    if (this.enabled) {
      this._setupCleanup();
      
      logger.info('Servicio de caché inicializado', {
        enabled: this.enabled,
        defaultTTL: this.defaultTTL,
        maxSize: this.maxSize
      });
    } else {
      logger.info('Servicio de caché inicializado en modo deshabilitado');
    }
  }
  
  /**
   * Configura la limpieza periódica de entradas expiradas
   * @private
   */
  _setupCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
    
    // Evitar que el timer impida que Node se cierre
    this.cleanupTimer.unref();
  }
  
  /**
   * Obtiene o crea un namespace de caché
   * @param {string} namespace - Nombre del espacio de caché
   * @returns {Map} - Map correspondiente al namespace
   * @private
   */
  _getCache(namespace) {
    if (!this.caches.has(namespace)) {
      this.caches.set(namespace, new Map());
    }
    return this.caches.get(namespace);
  }
  
  /**
   * Almacena un valor en la caché
   * @param {string} namespace - Namespace para agrupar entradas relacionadas
   * @param {string} key - Clave para identificar el valor
   * @param {*} value - Valor a almacenar
   * @param {number} ttl - Tiempo de vida en segundos (opcional)
   * @returns {*} - El valor almacenado
   */
  set(namespace, key, value, ttl = this.defaultTTL) {
    if (!this.enabled) return value;
    
    try {
      // Obtener el namespace
      const cache = this._getCache(namespace);
      
      // Verificar límite de tamaño
      if (cache.size >= this.maxSize) {
        this._evictOne(namespace);
      }
      
      // Almacenar entrada
      const entry = new CacheEntry(value, ttl);
      cache.set(key, entry);
      
      this.stats.sets++;
      
      return value;
    } catch (error) {
      // No fallar si hay error en la caché
      logger.error('Error al guardar en caché', { 
        error, 
        namespace, 
        key 
      });
      return value;
    }
  }
  
  /**
   * Obtiene un valor de la caché
   * @param {string} namespace - Namespace donde buscar
   * @param {string} key - Clave del valor
   * @returns {*} - Valor almacenado o undefined si no existe o expiró
   */
  get(namespace, key) {
    if (!this.enabled) return undefined;
    
    try {
      // Obtener el namespace
      const cache = this._getCache(namespace);
      
      // Buscar entrada
      const entry = cache.get(key);
      
      // Si no existe, retornar undefined
      if (!entry) {
        this.stats.misses++;
        return undefined;
      }
      
      // Si ha expirado, eliminar y retornar undefined
      if (entry.isExpired()) {
        cache.delete(key);
        this.stats.expired++;
        this.stats.misses++;
        return undefined;
      }
      
      // Incrementar contador de hits
      entry.hit();
      this.stats.hits++;
      
      return entry.value;
    } catch (error) {
      // No fallar si hay error en la caché
      logger.error('Error al leer de caché', { 
        error, 
        namespace, 
        key 
      });
      return undefined;
    }
  }
  
  /**
   * Verifica si una clave existe en la caché y no ha expirado
   * @param {string} namespace - Namespace donde buscar
   * @param {string} key - Clave a verificar
   * @returns {boolean} - true si la clave existe y no ha expirado
   */
  has(namespace, key) {
    if (!this.enabled) return false;
    
    try {
      // Obtener el namespace
      const cache = this._getCache(namespace);
      
      // Buscar entrada
      const entry = cache.get(key);
      
      // Si no existe, retornar false
      if (!entry) {
        return false;
      }
      
      // Si ha expirado, eliminar y retornar false
      if (entry.isExpired()) {
        cache.delete(key);
        this.stats.expired++;
        return false;
      }
      
      return true;
    } catch (error) {
      // No fallar si hay error en la caché
      logger.error('Error al verificar caché', { 
        error, 
        namespace, 
        key 
      });
      return false;
    }
  }
  
  /**
   * Elimina una entrada de la caché
   * @param {string} namespace - Namespace donde buscar
   * @param {string} key - Clave a eliminar
   * @returns {boolean} - true si se eliminó correctamente
   */
  delete(namespace, key) {
    if (!this.enabled) return false;
    
    try {
      const cache = this._getCache(namespace);
      return cache.delete(key);
    } catch (error) {
      logger.error('Error al eliminar de caché', { 
        error, 
        namespace, 
        key 
      });
      return false;
    }
  }
  
  /**
   * Limpia todas las entradas de un namespace
   * @param {string} namespace - Namespace a limpiar
   */
  clear(namespace) {
    if (!this.enabled) return;
    
    try {
      if (namespace) {
        // Limpiar solo un namespace
        const cache = this._getCache(namespace);
        cache.clear();
        logger.debug('Namespace de caché limpiado', { namespace });
      } else {
        // Limpiar toda la caché
        this.caches.clear();
        logger.debug('Caché completa limpiada');
      }
    } catch (error) {
      logger.error('Error al limpiar caché', { 
        error, 
        namespace 
      });
    }
  }
  
  /**
   * Elimina todas las entradas expiradas
   * @returns {number} - Número de entradas eliminadas
   */
  cleanup() {
    if (!this.enabled) return 0;
    
    try {
      let removed = 0;
      
      // Recorrer todos los namespaces
      for (const [namespaceName, cache] of this.caches.entries()) {
        // Entradas a eliminar
        const toDelete = [];
        
        // Identificar entradas expiradas
        for (const [key, entry] of cache.entries()) {
          if (entry.isExpired()) {
            toDelete.push(key);
          }
        }
        
        // Eliminar entradas expiradas
        for (const key of toDelete) {
          cache.delete(key);
          removed++;
        }
        
        if (toDelete.length > 0) {
          logger.debug('Entradas expiradas eliminadas', { 
            namespace: namespaceName, 
            count: toDelete.length 
          });
        }
      }
      
      if (removed > 0) {
        this.stats.expired += removed;
        logger.info('Limpieza de caché realizada', { 
          removed,
          cacheSize: this.size()
        });
      }
      
      return removed;
    } catch (error) {
      logger.error('Error en limpieza de caché', { error });
      return 0;
    }
  }
  
  /**
   * Obtiene y almacena un valor utilizando una función generadora
   * @param {string} namespace - Namespace para agrupar entradas relacionadas
   * @param {string} key - Clave para identificar el valor
   * @param {Function} fetchFn - Función que obtiene el valor (debe devolver una promesa)
   * @param {number} ttl - Tiempo de vida en segundos (opcional)
   * @returns {Promise<*>} - Valor obtenido de la caché o de la función generadora
   */
  async getOrSet(namespace, key, fetchFn, ttl = this.defaultTTL) {
    // Si la caché está deshabilitada, llamar directamente a la función
    if (!this.enabled) {
      return fetchFn();
    }
    
    try {
      // Intentar obtener de la caché
      const cachedValue = this.get(namespace, key);
      
      // Si existe en caché, devolverlo
      if (cachedValue !== undefined) {
        return cachedValue;
      }
      
      // Si no existe, obtener con la función y almacenar
      const value = await fetchFn();
      
      // Solo almacenar valores no undefined/null
      if (value !== undefined && value !== null) {
        this.set(namespace, key, value, ttl);
      }
      
      return value;
    } catch (error) {
      // Si hay error, propagarlo
      logger.error('Error en getOrSet', { 
        error, 
        namespace, 
        key 
      });
      throw error;
    }
  }
  
  /**
   * Elimina una entrada si la caché está llena
   * @param {string} namespace - Namespace donde eliminar
   * @private
   */
  _evictOne(namespace) {
    const cache = this._getCache(namespace);
    
    // Si no está lleno, no hacer nada
    if (cache.size < this.maxSize) {
      return;
    }
    
    try {
      // Estrategia: eliminar la entrada más antigua
      let oldestKey = null;
      let oldestEntry = null;
      
      for (const [key, entry] of cache.entries()) {
        if (!oldestEntry || entry.createdAt < oldestEntry.createdAt) {
          oldestKey = key;
          oldestEntry = entry;
        }
      }
      
      if (oldestKey) {
        cache.delete(oldestKey);
        this.stats.evictions++;
        
        logger.debug('Entrada de caché eliminada por límite de tamaño', { 
          namespace,
          key: oldestKey,
          age: oldestEntry ? Math.round(oldestEntry.getAge() / 1000) + 's' : 'unknown'
        });
      }
    } catch (error) {
      logger.error('Error al eliminar entrada de caché', { 
        error, 
        namespace 
      });
    }
  }
  
  /**
   * Obtiene estadísticas de uso de la caché
   * @returns {Object} - Estadísticas
   */
  getStats() {
    // Calcular estadísticas adicionales
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    // Calcular tamaño total
    let totalSize = 0;
    for (const cache of this.caches.values()) {
      totalSize += cache.size;
    }
    
    return {
      ...this.stats,
      totalRequests,
      hitRate: Math.round(hitRate * 100) / 100, // Redondear a 2 decimales
      namespaces: this.caches.size,
      size: totalSize,
      enabled: this.enabled
    };
  }
  
  /**
   * Obtiene el tamaño total de la caché
   * @returns {number} - Número total de entradas
   */
  size() {
    let total = 0;
    for (const cache of this.caches.values()) {
      total += cache.size;
    }
    return total;
  }
  
  /**
   * Genera una clave compuesta uniendo varios valores
   * @param {...*} args - Valores a incluir en la clave
   * @returns {string} - Clave compuesta
   */
  static makeKey(...args) {
    return args
      .map(arg => {
        if (arg === null || arg === undefined) {
          return '';
        }
        if (typeof arg === 'object') {
          return JSON.stringify(arg);
        }
        return String(arg);
      })
      .join(':');
  }
}

// Exportar una instancia única
module.exports = new CacheService();