/**
 * Pruebas unitarias para el servicio de Tidal
 * Verifica la correcta integración con la API de Tidal
 */

const { expect } = require('chai');
const sinon = require('sinon');
const tidalService = require('../lambda/services/tidalService');
const tidalApi = require('../lambda/utils/tidalApi');

describe('Tidal Service Test Suite', function() {
  // Configuración antes de todas las pruebas
  before(function() {
    // Suprimir logs durante las pruebas
    sinon.stub(console, 'log');
    sinon.stub(console, 'error');
  });
  
  // Limpieza después de todas las pruebas
  after(function() {
    // Restaurar stubs
    console.log.restore();
    console.error.restore();
    sinon.restore();
  });
  
  // Limpieza después de cada prueba
  afterEach(function() {
    // Restaurar solo los stubs específicos de cada prueba
    sinon.restore();
  });

  // Test para getUserInfo
  describe('getUserInfo()', function() {
    it('debe obtener información del usuario correctamente', async function() {
      // Mock para la respuesta de la API
      const userInfoResponse = {
        data: {
          userId: '12345',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      };
      
      // Crear stub para tidalApi.get
      sinon.stub(tidalApi, 'get').resolves(userInfoResponse);
      
      // Llamar al método
      const result = await tidalService.getUserInfo('fake-token');
      
      // Verificar resultado
      expect(result).to.deep.equal(userInfoResponse.data);
      expect(tidalApi.get.calledWith('/me', {}, 'fake-token')).to.be.true;
    });
    
    it('debe manejar errores correctamente', async function() {
      // Mock para error de API
      const apiError = new Error('API Error');
      apiError.response = { status: 401 };
      
      // Crear stub para tidalApi.get que lanza error
      sinon.stub(tidalApi, 'get').rejects(apiError);
      
      try {
        await tidalService.getUserInfo('fake-token');
        // Si llegamos aquí, la prueba debe fallar
        expect.fail('Debería haber lanzado un error');
      } catch (error) {
        // Verificar que el error fue manejado correctamente
        expect(error.message).to.equal('Sesión expirada o no autorizada en Tidal');
      }
    });
  });

  // Test para search
  describe('search()', function() {
    it('debe buscar contenido correctamente', async function() {
      // Mock para la respuesta de búsqueda
      const searchResponse = {
        data: {
          artists: { items: [{ id: '1', name: 'Artist 1' }] },
          albums: { items: [{ id: '2', title: 'Album 1' }] },
          tracks: { items: [{ id: '3', title: 'Track 1' }] },
          playlists: { items: [{ id: '4', title: 'Playlist 1' }] }
        }
      };
      
      // Crear stub para tidalApi.get
      sinon.stub(tidalApi, 'get').resolves(searchResponse);
      
      // Llamar al método
      const result = await tidalService.search('fake-token', 'test query', 5);
      
      // Verificar resultado
      expect(result).to.have.property('artists').that.is.an('array');
      expect(result).to.have.property('albums').that.is.an('array');
      expect(result).to.have.property('tracks').that.is.an('array');
      expect(result).to.have.property('playlists').that.is.an('array');
      
      // Verificar que se llamó a la API correctamente
      expect(tidalApi.get.calledOnce).to.be.true;
      const apiCallArgs = tidalApi.get.firstCall.args;
      expect(apiCallArgs[0]).to.equal('/search');
      expect(apiCallArgs[1].query).to.equal('test query');
      expect(apiCallArgs[1].limit).to.equal(5);
      expect(apiCallArgs[2]).to.equal('fake-token');
    });
  });

  // Test para searchTrack
  describe('searchTrack()', function() {
    it('debe buscar pistas correctamente', async function() {
      // Mock para la respuesta de búsqueda de pistas
      const tracksResponse = {
        data: {
          items: [
            { id: '1', title: 'Track 1', artist: { name: 'Artist 1' } },
            { id: '2', title: 'Track 2', artist: { name: 'Artist 2' } }
          ]
        }
      };
      
      // Crear stub para tidalApi.get
      sinon.stub(tidalApi, 'get').resolves(tracksResponse);
      
      // Llamar al método con artista
      const result = await tidalService.searchTrack('fake-token', 'test track', 'test artist');
      
      // Verificar resultado
      expect(result).to.have.property('tracks').that.is.an('array');
      expect(result.tracks).to.have.lengthOf(2);
      
      // Verificar que se construyó la query correctamente con artista
      const apiCallArgs = tidalApi.get.firstCall.args;
      expect(apiCallArgs[1].query).to.equal('test track test artist');
    });
    
    it('debe buscar pistas sin artista especificado', async function() {
      // Mock para la respuesta de búsqueda de pistas
      const tracksResponse = {
        data: {
          items: [
            { id: '1', title: 'Track 1', artist: { name: 'Artist 1' } }
          ]
        }
      };
      
      // Crear stub para tidalApi.get
      sinon.stub(tidalApi, 'get').resolves(tracksResponse);
      
      // Llamar al método sin artista
      const result = await tidalService.searchTrack('fake-token', 'test track');
      
      // Verificar que se construyó la query correctamente sin artista
      const apiCallArgs = tidalApi.get.firstCall.args;
      expect(apiCallArgs[1].query).to.equal('test track');
    });
  });

  // Test para getStreamUrl
  describe('getStreamUrl()', function() {
    it('debe obtener URL de streaming correctamente', async function() {
      // Mock para la respuesta de la API
      const streamResponse = {
        data: {
          manifest: {
            url: 'https://streaming.example.com/track/12345'
          }
        }
      };
      
      // Crear stub para tidalApi.get
      sinon.stub(tidalApi, 'get').resolves(streamResponse);
      
      // Llamar al método
      const result = await tidalService.getStreamUrl('fake-token', '12345');
      
      // Verificar resultado
      expect(result).to.equal('https://streaming.example.com/track/12345');
      
      // Verificar que se llamó a la API correctamente
      expect(tidalApi.get.calledWith('/tracks/12345/playbackinfo')).to.be.true;
    });
    
    it('debe manejar respuestas sin URL de streaming', async function() {
      // Mock para la respuesta de la API sin URL
      const invalidResponse = {
        data: {
          manifest: {}
        }
      };
      
      // Crear stub para tidalApi.get
      sinon.stub(tidalApi, 'get').resolves(invalidResponse);
      
      try {
        await tidalService.getStreamUrl('fake-token', '12345');
        // Si llegamos aquí, la prueba debe fallar
        expect.fail('Debería haber lanzado un error');
      } catch (error) {
        // Verificar que el error fue manejado correctamente
        expect(error.message).to.equal('No se pudo obtener la URL de streaming');
      }
    });
  });

  // Test para getFavorites
  describe('getFavorites()', function() {
    it('debe obtener favoritos del usuario correctamente', async function() {
      // Mock para la respuesta de la API
      const favoritesResponse = {
        data: {
          items: [
            { id: '1', title: 'Favorite 1' },
            { id: '2', title: 'Favorite 2' }
          ]
        }
      };
      
      // Crear stub para tidalApi.get
      sinon.stub(tidalApi, 'get').resolves(favoritesResponse);
      
      // Llamar al método
      const result = await tidalService.getFavorites('fake-token', 'tracks');
      
      // Verificar resultado
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2);
      
      // Verificar que se llamó a la API correctamente
      expect(tidalApi.get.calledWith('/favorites/tracks')).to.be.true;
    });
  });

  // Test para manejo de errores
  describe('_handleApiError()', function() {
    it('debe manejar error 401 correctamente', function() {
      const apiError = new Error('API Error');
      apiError.response = { status: 401 };
      
      const result = tidalService._handleApiError(apiError);
      
      expect(result.message).to.equal('Sesión expirada o no autorizada en Tidal');
    });
    
    it('debe manejar error 404 correctamente', function() {
      const apiError = new Error('API Error');
      apiError.response = { status: 404 };
      
      const result = tidalService._handleApiError(apiError);
      
      expect(result.message).to.equal('El contenido solicitado no existe en Tidal');
    });
    
    it('debe manejar error sin respuesta correctamente', function() {
      const networkError = new Error('Network Error');
      
      const result = tidalService._handleApiError(networkError);
      
      expect(result.message).to.equal('Error de conexión con el servicio de Tidal');
    });
  });
});
