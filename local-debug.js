/**
 * Utilidad para ejecutar y probar la skill de Tidal localmente
 * 
 * Uso:
 * node local-debug.js <intent-name> [parameters]
 * 
 * Ejemplos:
 * node local-debug.js LaunchRequest
 * node local-debug.js PlayMusicIntent --song="Despacito" --artist="Luis Fonsi"
 * node local-debug.js SearchMusicIntent --searchTerm="Rosalía"
 */

const { handler } = require('./lambda/index');
const localStorageAdapter = require('./utils/localStorageAdapter');

// Obtener argumentos de línea de comandos
const args = process.argv.slice(2);
const intentName = args[0];

if (!intentName) {
  console.error('Debe especificar un intent. Ejemplo: node local-debug.js LaunchRequest');
  process.exit(1);
}

// Función para parsear los parámetros de línea de comandos
function parseArgs(args) {
  const params = {};
  
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      params[key] = value ? value.replace(/"/g, '') : true;
    }
  });
  
  return params;
}

// Función para construir slots a partir de parámetros
function buildSlots(params) {
  const slots = {};
  
  Object.keys(params).forEach(key => {
    slots[key] = {
      name: key,
      value: params[key],
      confirmationStatus: 'NONE'
    };
  });
  
  return slots;
}

// Construir el evento para Alexa
function buildAlexaEvent(intentName, params = {}) {
  // Usar token de acceso de prueba o leerlo del almacenamiento local
  const accessToken = params.accessToken || localStorageAdapter.getItem('accessToken') || null;
  
  // Evento base
  const event = {
    version: '1.0',
    session: {
      new: true,
      sessionId: 'local-debug-session-' + Date.now(),
      application: {
        applicationId: 'amzn1.ask.skill.local-debug'
      },
      user: {
        userId: 'local-debug-user',
        accessToken: accessToken
      }
    },
    context: {
      System: {
        application: {
          applicationId: 'amzn1.ask.skill.local-debug'
        },
        user: {
          userId: 'local-debug-user',
          accessToken: accessToken
        },
        device: {
          deviceId: 'local-debug-device',
          supportedInterfaces: {
            AudioPlayer: {}
          }
        }
      },
      AudioPlayer: {
        playerActivity: 'IDLE'
      }
    },
    request: {
      type: intentName.endsWith('Intent') ? 'IntentRequest' : intentName,
      requestId: 'local-debug-request-' + Date.now(),
      timestamp: new Date().toISOString(),
      locale: 'es-ES',
      intent: undefined
    }
  };
  
  // Si es un IntentRequest, configurar la intención y slots
  if (event.request.type === 'IntentRequest') {
    event.request.intent = {
      name: intentName,
      confirmationStatus: 'NONE',
      slots: buildSlots(params)
    };
  }
  
  return event;
}

// Función principal: construir el evento y ejecutar el handler
async function runLocalDebug() {
  try {
    const params = parseArgs(args.slice(1));
    const event = buildAlexaEvent(intentName, params);
    
    console.log('\n📣 Invocando skill con el siguiente evento:');
    console.log(JSON.stringify(event, null, 2));
    
    // Crear un contexto similar al de Lambda
    const context = {
      succeed: (result) => {
        console.log('\n✅ Respuesta exitosa:');
        console.log(JSON.stringify(result, null, 2));
      },
      fail: (error) => {
        console.error('\n❌ Error:');
        console.error(error);
      }
    };
    
    // Invocar el handler
    console.log('\n⏳ Ejecutando handler...\n');
    const result = await handler(event, context);
    
    // Si el handler devuelve una promesa en lugar de usar context.succeed
    if (result) {
      console.log('\n✅ Respuesta exitosa:');
      console.log(JSON.stringify(result, null, 2));
      
      // Si la respuesta contiene un token de acceso, guardarlo para futuras ejecuciones
      if (result.sessionAttributes && result.sessionAttributes.accessToken) {
        localStorageAdapter.setItem('accessToken', result.sessionAttributes.accessToken);
        console.log('\n💾 Token de acceso guardado para futuras ejecuciones');
      }
    }
  } catch (error) {
    console.error('\n❌ Error al ejecutar el debug local:');
    console.error(error);
  }
}

// Ejecutar
runLocalDebug();
