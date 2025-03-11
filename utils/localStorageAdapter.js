/**
 * Adaptador de almacenamiento local para pruebas
 * Simula un almacenamiento persistente para tokens y otros datos durante pruebas locales
 */

const fs = require('fs');
const path = require('path');

// Ruta al archivo de almacenamiento local
const STORAGE_FILE = path.join(__dirname, '..', '.local-storage.json');

/**
 * Adaptador de almacenamiento local
 */
class LocalStorageAdapter {
  /**
   * Constructor
   * Inicializa el almacenamiento local si no existe
   */
  constructor() {
    this.storage = {};
    this.loadStorage();
  }
  
  /**
   * Carga el almacenamiento desde el archivo
   * @private
   */
  loadStorage() {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const data = fs.readFileSync(STORAGE_FILE, 'utf8');
        this.storage = JSON.parse(data);
      } else {
        // Crear archivo de almacenamiento si no existe
        this.saveStorage();
      }
    } catch (error) {
      console.error('Error al cargar el almacenamiento local:', error);
      this.storage = {};
    }
  }
  
  /**
   * Guarda el almacenamiento en el archivo
   * @private
   */
  saveStorage() {
    try {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(this.storage, null, 2), 'utf8');
    } catch (error) {
      console.error('Error al guardar el almacenamiento local:', error);
    }
  }
  
  /**
   * Obtiene un elemento del almacenamiento
   * @param {string} key - Clave del elemento
   * @returns {*} - Valor almacenado o null si no existe
   */
  getItem(key) {
    return this.storage[key] || null;
  }
  
  /**
   * Establece un elemento en el almacenamiento
   * @param {string} key - Clave del elemento
   * @param {*} value - Valor a almacenar
   */
  setItem(key, value) {
    this.storage[key] = value;
    this.saveStorage();
  }
  
  /**
   * Elimina un elemento del almacenamiento
   * @param {string} key - Clave del elemento a eliminar
   */
  removeItem(key) {
    delete this.storage[key];
    this.saveStorage();
  }
  
  /**
   * Limpia todo el almacenamiento
   */
  clear() {
    this.storage = {};
    this.saveStorage();
  }
}

// Exportar una instancia única
module.exports = new LocalStorageAdapter();
