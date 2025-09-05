# DelTrack

Sistema de localización y seguimiento utilizando dispositivos IoT con comunicación MQTT y visualización web en tiempo real.

## Descripción

DelTrack es un proyecto de tesis que implementa un sistema de seguimiento y localización compuesto por:

- **Frontend**: Aplicación web React con mapas interactivos usando Leaflet
- **Backend**: API REST desarrollada con FastAPI y cliente MQTT para comunicación IoT
- **Hardware**: Dispositivos localizadores que envían datos GPS vía MQTT a ThingSpeak

## Características

- 📍 Visualización de ubicación en tiempo real en mapas interactivos
- 🔄 Comunicación bidireccional vía MQTT con ThingSpeak
- 🎯 Configuración de destinos y seguimiento de rutas
- 🔔 Sistema de notificaciones y alertas
- 📱 Interfaz web responsiva

## Tecnologías Utilizadas

### Frontend
- React 19.1.1
- Leaflet para mapas interactivos
- Vite como bundler
- Tailwind CSS para estilos
- Lucide React para iconos

### Backend  
- FastAPI para la API REST
- Paho MQTT para comunicación IoT
- Pydantic para validación de datos
- Uvicorn como servidor ASGI

## Instalación y Configuración

### Requisitos Previos
- Node.js (v18 o superior)
- Python 3.9 o superior
- Git

### 1. Clonar el repositorio
```bash
git clone https://github.com/paufriend/DelTrack.git
cd DelTrack
```

### 2. Configurar el Backend
```bash
cd backend
pip install -r requirements.txt

# Copiar y configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales reales de ThingSpeak
```

### 3. Configurar el Frontend
```bash
cd frontend
npm install
```

## Uso

### Ejecutar el Backend
```bash
cd backend/src
uvicorn main:app --reload
```
El servidor se ejecutará en `http://127.0.0.1:8000`

### Ejecutar el Frontend
```bash
cd frontend
npm run dev
```
La aplicación web se ejecutará en `http://localhost:5173`

## Estructura del Proyecto

```
DelTrack/
├── backend/
│   ├── src/
│   │   ├── main.py           # API FastAPI principal
│   │   ├── mqtt_client.py    # Cliente MQTT y lógica ThingSpeak
│   │   └── Localizador.py    # Clase modelo Localizador
│   └── requirements.txt      # Dependencias Python
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Componente principal
│   │   ├── components/      # Componentes React
│   │   │   ├── navbar.jsx
│   │   │   └── map/
│   │   │       ├── LocalizadoresMap.jsx
│   │   │       └── Notification.jsx
│   │   └── assets/
│   ├── package.json         # Dependencias Node.js
│   └── vite.config.js       # Configuración Vite
└── README.md
```

## API Endpoints

- `GET /messages` - Obtener mensajes de localizadores
- `GET /coordenadas/{localizador_id}` - Obtener coordenadas de un localizador
- `GET /localizadores` - Listar todos los localizadores
- `POST /destino/{localizador_id}` - Configurar destino para un localizador
- `GET /status` - Estado del API

## Configuración MQTT

El sistema utiliza ThingSpeak como broker MQTT. Para configurar las credenciales:

1. **Copia el archivo de ejemplo**: `cp backend/.env.example backend/.env`
2. **Edita el archivo `.env`** con tus credenciales reales de ThingSpeak:
   - `MQTT_CLIENT_ID`: Tu Client ID de ThingSpeak
   - `MQTT_PASSWORD`: Tu MQTT API Key de ThingSpeak  
   - `READ_API_KEY`: Tu Read API Key del canal
   - `CHANNEL_ID_RECEIVE`: ID del canal donde recibes datos (por defecto: 2983140)
   - `CHANNEL_ID_PUBLISH`: ID del canal donde publicas comandos (por defecto: 3038672)

### Configuraciones por defecto:
- Broker: `mqtt3.thingspeak.com`
- Puerto: `1883`

⚠️ **Importante**: El archivo `.env` contiene credenciales sensibles y está excluido del control de versiones.

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto es parte de una tesis académica.

## Contacto

Paula Solorzano Friend - [pgsolorz@espol.edu.ec]
Johan Gutierrez Macias - [@espol.edu.ec]

Enlace del Proyecto: [https://github.com/paufriend/DelTrack](https://github.com/paufriend/DelTrack)
