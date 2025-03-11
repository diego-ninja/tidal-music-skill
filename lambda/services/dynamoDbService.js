/**
 * Servicio para interactuar con DynamoDB
 * Proporciona operaciones CRUD genéricas para persistencia de datos
 */

const AWS = require('aws-sdk');
const logger = require('../utils/logger');
const config = require('./configService');

/**
 * Clase de servicio para interactuar con DynamoDB
 */
class DynamoDbService {
  /**
   * Constructor del servicio
   * @param {string} tableName - Nombre de la tabla DynamoDB 
   */
  constructor(tableName) {
    this.tableName = tableName;
    
    // Obtener configuración
    const dynamoConfig = config.getSection('dynamoDB');
    const appConfig = config.getSection('app');
    
    // Configurar el cliente de DynamoDB
    const options = {
      region: appConfig.region,
      apiVersion: '2012-08-10',
      httpOptions: {
        connectTimeout: config.get('aws.connectTimeout', 2000),
        timeout: config.get('aws.timeout', 5000)
      },
      maxRetries: config.get('retry.maxRetries', 3)
    };
    
    // Si estamos en entorno local o se ha especificado un endpoint personalizado
    if (dynamoConfig.endpoint || config.isLocal()) {
      options.endpoint = dynamoConfig.endpoint || 'http://localhost:8000';
      logger.info('Usando DynamoDB con endpoint personalizado', { endpoint: options.endpoint });
    }
    
    this.dynamoDB = new AWS.DynamoDB.DocumentClient(options);
  }
  
  /**
   * Guarda un item en la tabla
   * @param {Object} item - Item a guardar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} - Item guardado
   */
  async putItem(item, options = {}) {
    try {
      const params = {
        TableName: this.tableName,
        Item: item,
        ...options
      };
      
      logger.debug('Guardando item en DynamoDB', { 
        table: this.tableName,
        itemKeys: Object.keys(item)
      });
      
      await this.dynamoDB.put(params).promise();
      return item;
    } catch (error) {
      logger.error('Error al guardar item en DynamoDB', { 
        error,
        table: this.tableName
      });
      throw this._handleError(error);
    }
  }
  
  /**
   * Obtiene un item por su clave primaria
   * @param {Object} key - Clave primaria del item
   * @returns {Promise<Object>} - Item encontrado o null
   */
  async getItem(key) {
    try {
      const params = {
        TableName: this.tableName,
        Key: key
      };
      
      logger.debug('Obteniendo item de DynamoDB', { 
        table: this.tableName,
        key
      });
      
      const result = await this.dynamoDB.get(params).promise();
      return result.Item || null;
    } catch (error) {
      logger.error('Error al obtener item de DynamoDB', { 
        error,
        table: this.tableName,
        key
      });
      throw this._handleError(error);
    }
  }
  
  /**
   * Actualiza un item existente
   * @param {Object} key - Clave primaria del item
   * @param {Object} updates - Campos a actualizar
   * @returns {Promise<Object>} - Item actualizado
   */
  async updateItem(key, updates) {
    try {
      // Construir expresión de actualización
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};
      
      // Procesar cada campo a actualizar
      Object.entries(updates).forEach(([field, value]) => {
        // No actualizar campos que son parte de la clave primaria
        if (Object.keys(key).includes(field)) {
          return;
        }
        
        const fieldName = `#${field}`;
        const valueName = `:${field}`;
        
        updateExpression.push(`${fieldName} = ${valueName}`);
        expressionAttributeNames[fieldName] = field;
        expressionAttributeValues[valueName] = value;
      });
      
      // Si no hay actualizaciones, devolver el item actual
      if (updateExpression.length === 0) {
        return this.getItem(key);
      }
      
      const params = {
        TableName: this.tableName,
        Key: key,
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      };
      
      logger.debug('Actualizando item en DynamoDB', { 
        table: this.tableName,
        key,
        updateFields: Object.keys(updates)
      });
      
      const result = await this.dynamoDB.update(params).promise();
      return result.Attributes;
    } catch (error) {
      logger.error('Error al actualizar item en DynamoDB', { 
        error,
        table: this.tableName,
        key
      });
      throw this._handleError(error);
    }
  }
  
  /**
   * Elimina un item por su clave primaria
   * @param {Object} key - Clave primaria del item
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async deleteItem(key) {
    try {
      const params = {
        TableName: this.tableName,
        Key: key
      };
      
      logger.debug('Eliminando item de DynamoDB', { 
        table: this.tableName,
        key
      });
      
      await this.dynamoDB.delete(params).promise();
      return true;
    } catch (error) {
      logger.error('Error al eliminar item de DynamoDB', { 
        error,
        table: this.tableName,
        key
      });
      throw this._handleError(error);
    }
  }
  
  /**
   * Realiza una consulta en la tabla
   * @param {Object} options - Opciones de la consulta
   * @returns {Promise<Array>} - Items encontrados
   */
  async query(options) {
    try {
      const params = {
        TableName: this.tableName,
        ...options
      };
      
      logger.debug('Consultando DynamoDB', { 
        table: this.tableName,
        keyCondition: options.KeyConditionExpression
      });
      
      const result = await this.dynamoDB.query(params).promise();
      return result.Items || [];
    } catch (error) {
      logger.error('Error al consultar DynamoDB', { 
        error,
        table: this.tableName
      });
      throw this._handleError(error);
    }
  }
  
  /**
   * Realiza un escaneo completo de la tabla
   * @param {Object} options - Opciones del escaneo
   * @returns {Promise<Array>} - Items encontrados
   */
  async scan(options = {}) {
    try {
      const params = {
        TableName: this.tableName,
        ...options
      };
      
      logger.debug('Escaneando DynamoDB', { table: this.tableName });
      
      const result = await this.dynamoDB.scan(params).promise();
      return result.Items || [];
    } catch (error) {
      logger.error('Error al escanear DynamoDB', { 
        error,
        table: this.tableName
      });
      throw this._handleError(error);
    }
  }
  
  /**
   * Realiza operaciones por lotes (batchWrite)
   * @param {Array} items - Items para operaciones por lotes
   * @param {string} operation - Tipo de operación ('put' o 'delete')
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async batchWrite(items, operation = 'put') {
    try {
      // Dividir en lotes de 25 (límite de DynamoDB)
      const batches = [];
      for (let i = 0; i < items.length; i += 25) {
        batches.push(items.slice(i, i + 25));
      }
      
      logger.debug('Realizando operación batchWrite en DynamoDB', { 
        table: this.tableName,
        operation,
        totalItems: items.length,
        batches: batches.length
      });
      
      const results = [];
      
      // Procesar cada lote
      for (const batch of batches) {
        const requestItems = {};
        requestItems[this.tableName] = batch.map(item => {
          if (operation === 'delete') {
            return {
              DeleteRequest: {
                Key: item
              }
            };
          } else {
            return {
              PutRequest: {
                Item: item
              }
            };
          }
        });
        
        const params = {
          RequestItems: requestItems
        };
        
        const result = await this.dynamoDB.batchWrite(params).promise();
        results.push(result);
      }
      
      return {
        batches: batches.length,
        results
      };
    } catch (error) {
      logger.error('Error en operación batchWrite', { 
        error,
        table: this.tableName,
        operation
      });
      throw this._handleError(error);
    }
  }
  
  /**
   * Maneja errores de DynamoDB y los convierte en errores más descriptivos
   * @param {Error} error - Error original
   * @returns {Error} - Error procesado
   * @private
   */
  _handleError(error) {
    // Si ya es un error personalizado, devolverlo
    if (error.isCustom) {
      return error;
    }
    
    // Manejar errores específicos de DynamoDB
    switch (error.code) {
      case 'ResourceNotFoundException':
        return Object.assign(
          new Error(`La tabla ${this.tableName} no existe`),
          { isCustom: true, originalError: error, statusCode: 404 }
        );
      case 'ConditionalCheckFailedException':
        return Object.assign(
          new Error('La condición de la operación no se cumplió'),
          { isCustom: true, originalError: error, statusCode: 400 }
        );
      case 'ProvisionedThroughputExceededException':
        return Object.assign(
          new Error('Se ha excedido el throughput provisionado'),
          { isCustom: true, originalError: error, statusCode: 429 }
        );
      case 'ValidationException':
        return Object.assign(
          new Error(`Error de validación: ${error.message}`),
          { isCustom: true, originalError: error, statusCode: 400 }
        );
      default:
        return Object.assign(
          new Error(`Error de DynamoDB: ${error.message}`),
          { isCustom: true, originalError: error, statusCode: 500 }
        );
    }
  }
}

module.exports = DynamoDbService;