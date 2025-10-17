# Changelog - WhatsApp API Stability Improvements

## Version 1.1.0 - 2025-10-17

### 🎯 Objetivo Principal
Resolver el problema de pérdida de sesiones: las sesiones se desconectaban después de un tiempo a pesar de que los archivos de credenciales existían en disco.

---

## ✅ Problemas Resueltos

### 1. **Sesiones no se reconectaban automáticamente al reiniciar el servidor**
**Antes:** Las sesiones solo se guardaban en memoria. Si el contenedor se reiniciaba, las sesiones se perdían aunque los archivos existieran en `/sessions/`.

**Ahora:** 
- Auto-restauración de todas las sesiones al iniciar el servidor
- Lee todas las carpetas en `/sessions/` y reconecta automáticamente
- Logs claros de cada sesión que se está restaurando

### 2. **Servidor se caía por errores no capturados**
**Antes:** Errores como "Connection Closed (428)" causaban que todo el servidor crasheara.

**Ahora:**
- Handlers globales para `uncaughtException` y `unhandledRejection`
- Try-catch en todos los event handlers de Baileys
- El servidor permanece activo aunque una sesión falle

### 3. **Sesiones con código 401 (Logged Out) en loop infinito**
**Antes:** Cuando WhatsApp retornaba 401, la sesión intentaba reconectar con credenciales corruptas indefinidamente.

**Ahora:**
- Detección automática de código 401
- Limpieza automática de archivos de sesión corruptos
- El cliente debe escanear un nuevo QR code

### 4. **Endpoint /status no intentaba reconectar**
**Antes:** `/api/status/:clientId` solo leía el estado en memoria, no intentaba reconectar si la sesión existía en disco.

**Ahora:**
- Detecta si la sesión existe en disco pero está desconectada
- Intenta auto-reconectar en segundo plano
- Retorna información adicional:
  - `session_exists_on_disk`: true/false
  - `auto_reconnecting`: true/false
  - `state`: estado actual de la conexión

---

## 🔧 Cambios Técnicos

### Nuevas Funciones (whatsapp.js)

```javascript
// Verifica si existe una sesión en disco
sessionExistsOnDisk(sessionId)

// Restaura todas las sesiones al iniciar
restoreAllSessions()
```

### Mejoras en Event Handlers

1. **connection.update**
   - Wrapped en try-catch para prevenir crashes
   - Mejor manejo del código 401 con auto-limpieza
   - Mejor logging para debugging

2. **creds.update**
   - Wrapped en try-catch
   - Error handling al guardar credenciales

3. **messages.upsert**
   - Wrapped en try-catch
   - No crashea si hay un error procesando mensajes

### Mejoras en index.js

- Handlers globales de errores no capturados
- Llamada a `restoreAllSessions()` al iniciar
- Mejor logging del proceso de startup

### Mejoras en routes.js

- Endpoint `/api/status/:clientId` mejorado con auto-reconexión
- Más información en la respuesta del status

---

## 📊 Comportamiento Esperado

### Al Iniciar el Servidor

```
🚀 WhatsApp API Server running on port 3006
📚 Swagger documentation: http://localhost:3006/api-docs
...

🔄 [STARTUP] Restoring sessions from disk...
📂 [STARTUP] Found 3 session(s): 13, 136, 153
🔌 [STARTUP] Restoring session: 13
[13] Using WA v2.3000.1027934701, isLatest: true
🔄 [13] Connecting to WhatsApp...
✅ [13] WhatsApp connection opened successfully!
📱 [13] Phone number: 573001234567
🔌 [STARTUP] Restoring session: 136
...
✅ [STARTUP] Session restoration process completed
```

### Al Consultar Status de Sesión Desconectada

```
GET /api/status/153

🔄 [153] Session exists on disk but disconnected, attempting auto-reconnect...

Response:
{
  "clientId": "153",
  "connected": false,
  "state": "connecting",
  "session_exists_on_disk": true,
  "auto_reconnecting": true
}
```

### Al Detectar Código 401 (Logged Out)

```
[153] Connection closed. Status code: 401, Reconnect: false
🚪 [153] Logged out (401). Cleaning up session files...
🗑️  [153] Corrupted session files deleted. Client needs to scan QR again.
```

---

## 🚀 Deployment

### En Desarrollo (Local)

```bash
cd zunida-whatsapp-api-stable
pnpm install
pnpm start
```

### En Producción (Docker en EC2)

```bash
# 1. Detener contenedor actual
docker-compose down

# 2. Rebuild con nuevos cambios
docker-compose up -d --build

# 3. Ver logs
docker-compose logs -f whatsapp-api
```

### Verificar que funciona

```bash
# Health check
curl http://localhost:3006/api/health

# Ver sesiones
curl http://localhost:3006/api/sessions

# Ver status de una sesión específica
curl http://localhost:3006/api/status/13
```

---

## ⚠️ Notas Importantes

1. **Volumen de Docker**: Asegúrate de que el volumen `./sessions:/app/sessions` esté correctamente configurado en `docker-compose.yml`

2. **Múltiples sesiones**: Si tienes muchas sesiones (10+), el proceso de restauración puede tomar 20-40 segundos

3. **Código 401**: Si ves este código, el cliente DEBE escanear un nuevo QR. Los archivos se limpian automáticamente

4. **Reiniciar el contenedor es seguro**: Todas las sesiones se restaurarán automáticamente

---

## 📝 Testing

Para probar que funciona:

1. **Escanear QR de una sesión nueva**
   ```bash
   curl http://localhost:3006/api/connect/test-session
   ```

2. **Enviar un mensaje**
   ```bash
   curl -X POST http://localhost:3006/api/send/test-session \
     -H "Content-Type: application/json" \
     -d '{"to": "+51987654321", "message": "Test"}'
   ```

3. **Reiniciar el contenedor**
   ```bash
   docker-compose restart whatsapp-api
   ```

4. **Verificar que la sesión se restauró**
   ```bash
   curl http://localhost:3006/api/status/test-session
   # Debería retornar connected: true
   ```

---

## 🐛 Troubleshooting

### La sesión sigue desconectándose
- Verifica que el volumen de Docker esté montado correctamente
- Revisa los logs: `docker-compose logs -f whatsapp-api`
- Verifica que los archivos existan: `ls -la sessions/`

### No se restauran las sesiones
- Verifica que exista la carpeta `sessions/` con subcarpetas
- Cada subcarpeta debe tener un `creds.json`
- Revisa los logs de startup

### Error 401 recurrente
- Es normal si WhatsApp desconectó la sesión
- El cliente debe escanear un nuevo QR
- Los archivos corruptos se limpian automáticamente

---

## 👥 Autor
ZUNIDA Team - 2025

