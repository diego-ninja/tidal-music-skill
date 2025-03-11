/**
 * Pruebas unitarias para la skill de Tidal
 * Verifica el funcionamiento correcto de los manejadores de intents
 */

const { expect } = require('chai');
const sinon = require('sinon');

// Módulos a testear
const LaunchRequestHandler = require('../lambda/handlers/launchHandler');
const { 
  HelpIntentHandler, 
  CancelAndStopIntentHandler,
  ErrorHandler
} = require('../lambda/handlers/commonHandlers');
const {
  PlayMusicIntentHandler,
  SearchMusicIntentHandler
} = require('../lambda/handlers/musicHandlers');

// Mock para el servicio de Tidal
const tidalService = require('../lambda/services/tidalService');

describe('Tidal Skill Test Suite', function() {
  
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

  // Helpers para construir objetos de prueba
  function getMockHandlerInput(type, intentName = null, slots = {}, accessToken = null) {
    const request = {
      type: type
    };
    
    if (type === 'IntentRequest') {
      request.intent = {
        name: intentName,
        slots: slots
      };
    }
    
    const context = {
      System: {
        user: {
          accessToken: accessToken
        }
      }
    };
    
    // Mock para attributesManager
    const attributes = {};
    const attributesManager = {
      getSessionAttributes: sinon.stub().returns(attributes),
      setSessionAttributes: sinon.stub()
    };
    
    // Mock para responseBuilder
    const responseBuilder = {
      speak: sinon.stub().returnsThis(),
      reprompt: sinon.stub().returnsThis(),
      withSimpleCard: sinon.stub().returnsThis(),
      withLinkAccountCard: sinon.stub().returnsThis(),
      withShouldEndSession: sinon.stub().returnsThis(),
      addAudioPlayerPlayDirective: sinon.stub().returnsThis(),
      addAudioPlayerStopDirective: sinon.stub().returnsThis(),
      getResponse: sinon.stub().returns({ responseObj: 'test' })
    };
    
    // Mock para serviceClientFactory
    const serviceClientFactory = {
      getUpsServiceClient: sinon.stub().returns({
        getProfileGivenName: sinon.stub().resolves('TestUser')
      })
    };
    
    return {
      requestEnvelope: {
        request,
        context
      },
      attributesManager,
      responseBuilder,
      serviceClientFactory
    };
  }

  // Tests para LaunchRequestHandler
  describe('LaunchRequestHandler', function() {
    it('debe manejar LaunchRequest', function() {
      const handlerInput = getMockHandlerInput('LaunchRequest');
      expect(LaunchRequestHandler.canHandle(handlerInput)).to.be.true;
    });
    
    it('debe solicitar vincular cuenta si no hay accessToken', async function() {
      const handlerInput = getMockHandlerInput('LaunchRequest');
      await LaunchRequestHandler.handle(handlerInput);
      
      expect(handlerInput.responseBuilder.withLinkAccountCard.calledOnce).to.be.true;
    });
    
    it('debe dar la bienvenida personalizada con accessToken', async function() {
      const handlerInput = getMockHandlerInput('LaunchRequest', null, {}, 'fake-token');
      
      // Mock para tidalService.getUserInfo
      sinon.stub(tidalService, 'getUserInfo').resolves({ userId: '123', username: 'testUser' });
      
      await LaunchRequestHandler.handle(handlerInput);
      
      expect(handlerInput.responseBuilder.speak.calledOnce).to.be.true;
      expect(handlerInput.responseBuilder.withLinkAccountCard.called).to.be.false;
    });
  });

  // Tests para HelpIntentHandler
  describe('HelpIntentHandler', function() {
    it('debe manejar HelpIntent', function() {
      const handlerInput = getMockHandlerInput('IntentRequest', 'AMAZON.HelpIntent');
      expect(HelpIntentHandler.canHandle(handlerInput)).to.be.true;
    });
    
    it('debe proporcionar mensaje de ayuda', async function() {
      const handlerInput = getMockHandlerInput('IntentRequest', 'AMAZON.HelpIntent');
      await HelpIntentHandler.handle(handlerInput);
      
      expect(handlerInput.responseBuilder.speak.calledOnce).to.be.true;
      expect(handlerInput.responseBuilder.reprompt.calledOnce).to.be.true;
    });
  });

  // Tests para CancelAndStopIntentHandler
  describe('CancelAndStopIntentHandler', function() {
    it('debe manejar CancelIntent', function() {
      const handlerInput = getMockHandlerInput('IntentRequest', 'AMAZON.CancelIntent');
      expect(CancelAndStopIntentHandler.canHandle(handlerInput)).to.be.true;
    });
    
    it('debe manejar StopIntent', function() {
      const handlerInput = getMockHandlerInput('IntentRequest', 'AMAZON.StopIntent');
      expect(CancelAndStopIntentHandler.canHandle(handlerInput)).to.be.true;
    });
    
    it('debe detener reproducción y finalizar sesión', async function() {
      const handlerInput = getMockHandlerInput('IntentRequest', 'AMAZON.StopIntent');
      await CancelAndStopIntentHandler.handle(handlerInput);
      
      expect(handlerInput.responseBuilder.speak.calledOnce).to.be.true;
      expect(handlerInput.responseBuilder.withShouldEndSession.calledWith(true)).to.be.true;
    });
  });

  // Tests para ErrorHandler
  describe('ErrorHandler', function() {
    it('debe manejar cualquier error', function() {
      const handlerInput = getMockHandlerInput('IntentRequest', 'SomeIntent');
      const error = new Error('Test error');
      expect(ErrorHandler.canHandle(handlerInput, error)).to.be.true;
    });
    
    it('debe proporcionar mensaje de error', async function() {
      const handlerInput = getMockHandlerInput('IntentRequest', 'SomeIntent');
      const error = new Error('Test error');
      await ErrorHandler.handle(handlerInput, error);
      
      expect(handlerInput.responseBuilder.speak.calledOnce).to.be.true;
    });
  });

  // Tests para PlayMusicIntentHandler
  describe('PlayMusicIntentHandler', function() {
    it('debe manejar PlayMusicIntent', function() {
      const handlerInput = getMockHandlerInput('IntentRequest', 'PlayMusicIntent');
      expect(PlayMusicIntentHandler.canHandle(handlerInput)).to.be.true;
    });
    
    it('debe solicitar vincular cuenta si no hay accessToken', async function() {
      const handlerInput = getMockHandlerInput('IntentRequest', 'PlayMusicIntent');
      await PlayMusicIntentHandler.handle(handlerInput);
      
      expect(handlerInput.responseBuilder.withLinkAccountCard.calledOnce).to.be.true;
    });
    
    it('debe buscar y reproducir una canción específica', async function() {
      // Crear slots con canción y artista
      const slots = {
        song: { value: 'Despacito' },
        artist: { value: 'Luis Fonsi' }
      };
      
      const handlerInput = getMockHandlerInput('IntentRequest', 'PlayMusicIntent', slots, 'fake-token');
      
      // Mock para tidalService.searchTrack
      sinon.stub(tidalService, 'searchTrack').resolves({
        tracks: [{
          id: '12345',
          title: 'Despacito',
          artist: { name: 'Luis Fonsi' },
          album: { cover: 'cover-url', title: 'Vida' }
        }]
      });
      
      // Mock para tidalService.getStreamUrl
      sinon.stub(tidalService, 'getStreamUrl').resolves('https://stream-url.example.com');
      
      await PlayMusicIntentHandler.handle(handlerInput);
      
      expect(tidalService.searchTrack.calledWith('fake-token', 'Despacito', 'Luis Fonsi')).to.be.true;
      expect(tidalService.getStreamUrl.called).to.be.true;
      expect(handlerInput.responseBuilder.addAudioPlayerPlayDirective.calledOnce).to.be.true;
    });
  });

  // Tests para SearchMusicIntentHandler
  describe('SearchMusicIntentHandler', function() {
    it('debe manejar SearchMusicIntent', function() {
      const handlerInput = getMockHandlerInput('IntentRequest', 'SearchMusicIntent');
      expect(SearchMusicIntentHandler.canHandle(handlerInput)).to.be.true;
    });
    
    it('debe buscar y presentar resultados', async function() {
      // Crear slot con término de búsqueda
      const slots = {
        searchTerm: { value: 'Rosalía' }
      };
      
      const handlerInput = getMockHandlerInput('IntentRequest', 'SearchMusicIntent', slots, 'fake-token');
      
      // Mock para tidalService.search
      sinon.stub(tidalService, 'search').resolves({
        artists: [{ name: 'Rosalía', id: '12345' }],
        tracks: [{ title: 'Malamente', artist: { name: 'Rosalía' }, id: '67890' }],
        albums: [{ title: 'El Mal Querer', artist: { name: 'Rosalía' }, id: '54321' }],
        playlists: []
      });
      
      await SearchMusicIntentHandler.handle(handlerInput);
      
      expect(tidalService.search.calledWith('fake-token', 'Rosalía')).to.be.true;
      expect(handlerInput.responseBuilder.speak.calledOnce).to.be.true;
      
      // Verificar que se guardaron los resultados en la sesión
      expect(handlerInput.attributesManager.setSessionAttributes.calledOnce).to.be.true;
    });
  });
});
