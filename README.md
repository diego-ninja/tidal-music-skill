# Tidal Music Skill para Alexa

Una skill de Alexa que permite reproducir música de Tidal en tus dispositivos Amazon Echo.

## Características

- Reproducción de canciones, álbumes, playlists y artistas de Tidal
- Búsqueda de contenido musical
- Control de reproducción (pausar, reanudar, siguiente, anterior)
- Vinculación de cuenta con Tidal
- Soporte para calidad de audio alta
- Gestión de favoritos
- Recomendaciones personalizadas

## Requisitos Previos

- Node.js (v14 o superior)
- npm (v6 o superior)
- Cuenta de desarrollador de Amazon
- Cuenta de desarrollador de Tidal
- ASK CLI (Alexa Skills Kit Command Line Interface)

## Instalación

1. Clona este repositorio:
   ```bash
   git clone https://github.com/tu-usuario/tidal-music-skill.git
   cd tidal-music-skill
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura ASK CLI:
   ```bash
   ask configure
   ```

## Configuración

1. Registra tu aplicación en el [Portal de Desarrolladores de Tidal](https://developer.tidal.com/) para obtener tu Client ID y Client Secret.

2. Configura las variables de entorno en Lambda o localmente:

   - `TIDAL_CLIENT_ID`: Tu Client ID de Tidal
   - `TIDAL_CLIENT_SECRET`: Tu Client Secret de Tidal
   - `LOG_LEVEL`: Nivel de logging (opcional, por defecto: 'info')

3. Actualiza los detalles de configuración en `skill.json`:
   - Cambia la URL de redirección para la vinculación de cuentas
   - Actualiza los detalles de privacidad
   - Establece la región correcta para tu función Lambda

## Estructura del Proyecto

```
tidal-music-skill/
├── .ask/
│   └── config
├── lambda/
│   ├── index.js              # Punto de entrada principal
│   ├── package.json          # Dependencias del proyecto
│   ├── utils/
│   │   ├── logger.js         # Utilidad para logging
│   │   └── tidalApi.js       # Cliente para la API de Tidal
│   ├── handlers/
│   │   ├── commonHandlers.js # Manejadores comunes (ayuda, salir, etc.)
│   │   ├── launchHandler.js  # Manejador de inicio
│   │   └── musicHandlers.js  # Manejadores relacionados con la música
│   └── services/
│       └── tidalService.js   # Servicio para interactuar con Tidal
├── models/
│   └── es-ES.json            # Modelo de interacción en español
├── utils/
│   └── localStorageAdapter.js # Adaptador para pruebas locales
├── tests/
│   ├── index.test.js         # Pruebas unitarias para la skill
│   └── tidalService.test.js  # Pruebas para el servicio de Tidal
├── local-debug.js            # Utilidad para pruebas locales
├── skill.json                # Configuración de la skill
├── .eslintrc.js              # Configuración de ESLint
└── README.md                 # Documentación del proyecto
```

## Uso

### Desarrollo Local

Para probar la skill localmente sin necesidad de desplegarla en Lambda:

```bash
# Prueba el evento LaunchRequest
node local-debug.js LaunchRequest

# Prueba la reproducción de una canción
node local-debug.js PlayMusicIntent --song="Despacito" --artist="Luis Fonsi"

# Prueba la búsqueda
node local-debug.js SearchMusicIntent --searchTerm="Rosalía"
```

### Pruebas

Para ejecutar las pruebas unitarias:

```bash
npm test
```

Para verificar el estilo del código:

```bash
npm run lint
```

### Despliegue

Para desplegar la skill en el entorno de desarrollo:

```bash
ask deploy
```

## Comandos de Voz Soportados

Algunos ejemplos de comandos que puedes usar con la skill:

- "Alexa, abre Tidal Música"
- "Alexa, pide a Tidal Música que reproduzca Despacito"
- "Alexa, pide a Tidal Música que ponga música de Rosalía"
- "Alexa, pide a Tidal Música que reproduzca el álbum El Mal Querer"
- "Alexa, pide a Tidal Música que busque canciones de Bad Bunny"
- "Alexa, siguiente canción" (durante la reproducción)
- "Alexa, pausa" (durante la reproducción)
- "Alexa, reanuda" (después de pausar)

## Autenticación con Tidal

Esta skill requiere vincular tu cuenta de Tidal. Al abrir la skill por primera vez, se te pedirá que vincules tu cuenta:

1. Abre la aplicación de Alexa en tu dispositivo móvil
2. Ve a la sección Skills
3. Encuentra la skill "Tidal Música"
4. Pulsa en "Habilitar skill"
5. Sigue las instrucciones para iniciar sesión con tu cuenta de Tidal
6. Una vez completado, podrás usar la skill con tu biblioteca de Tidal

## Solución de Problemas

### Problemas comunes:

- **Error de autenticación**: Asegúrate de que has vinculado correctamente tu cuenta de Tidal y que tu suscripción está activa.
- **Canción no encontrada**: Verifica el nombre de la canción o artista y prueba con términos más específicos.
- **Problemas de streaming**: Comprueba tu conexión a internet y que tu dispositivo Alexa esté conectado correctamente.

### Logs:

Para ver los logs en AWS Lambda:
1. Accede a la consola de AWS
2. Ve al servicio Lambda
3. Selecciona tu función
4. Ve a la pestaña "Monitoring"
5. Haz clic en "View logs in CloudWatch"

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - consulta el archivo LICENSE para más detalles.

## Contribuciones

Las contribuciones son bienvenidas. Por favor, sigue estos pasos:
1. Haz fork del repositorio
2. Crea una rama para tu característica (`git checkout -b feature/amazing-feature`)
3. Haz commit de tus cambios (`git commit -m 'Add some amazing feature'`)
4. Empuja a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## Agradecimientos

- [Equipo de Tidal](https://tidal.com) por proporcionar su API
- [Amazon Alexa](https://developer.amazon.com/alexa) por la plataforma de desarrollo de skills
- Todos los colaboradores y usuarios que hacen posible este proyecto
