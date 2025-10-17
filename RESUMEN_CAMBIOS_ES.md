# 📋 Resumen de Cambios - Persistencia de Sesiones WhatsApp

## 🎯 Problema Resuelto

**ANTES:** 
- Escaneabas el QR ✅
- Enviabas mensajes ✅
- Los archivos se guardaban en `/sessions/{clientId}/` ✅
- PERO tiempo después, al consultar `/status`, aparecía como desconectado ❌
- Al reiniciar el contenedor Docker, todas las sesiones se perdían ❌

**AHORA:**
- Las sesiones se **reconectan automáticamente** al iniciar el servidor ✅
- Si una sesión se desconecta, intenta reconectar cuando consultas `/status` ✅
- Las sesiones **persisten** entre reinicios del contenedor ✅
- Si hay credenciales corruptas (código 401), se limpian automáticamente ✅
- El servidor **NO se cae** por errores de conexión ✅

---

## 🔧 ¿Qué se Cambió?

### 1. **Auto-Restauración de Sesiones** (whatsapp.js)
- Nueva función `restoreAllSessions()` que:
  - Lee todas las carpetas en `/sessions/`
  - Reconecta cada sesión automáticamente
  - Se ejecuta al iniciar el servidor

### 2. **Manejo Global de Errores** (index.js)
- Handlers para `uncaughtException` y `unhandledRejection`
- El servidor ya NO se cae por errores de Baileys

### 3. **Endpoint /status Mejorado** (routes.js)
- Detecta si la sesión existe en disco
- Intenta reconectar automáticamente si está desconectada
- Retorna más información:
  ```json
  {
    "clientId": "153",
    "connected": false,
    "state": "connecting",
    "session_exists_on_disk": true,
    "auto_reconnecting": true
  }
  ```

### 4. **Auto-Limpieza de Sesiones Corruptas** (whatsapp.js)
- Si WhatsApp retorna código 401 (Logged Out)
- Se eliminan automáticamente los archivos de sesión
- El cliente debe escanear un nuevo QR

### 5. **Try-Catch en Todos los Event Handlers** (whatsapp.js)
- `connection.update` - wrapped
- `creds.update` - wrapped
- `messages.upsert` - wrapped
- Previene crashes del servidor

---

## 📦 Archivos Modificados

```
zunida-whatsapp-api-stable/
├── src/
│   ├── whatsapp.js        ← Lógica de auto-restauración
│   ├── index.js           ← Handlers globales + llamada a restore
│   └── routes.js          ← Endpoint /status mejorado
├── CHANGELOG.md           ← Documentación técnica detallada
├── DEPLOY_UPDATE.md       ← Guía de despliegue paso a paso
└── RESUMEN_CAMBIOS_ES.md  ← Este archivo
```

---

## 🚀 Cómo Desplegar en EC2

### Paso 1: Conectarte a tu EC2

```bash
ssh -i tu-key.pem ec2-user@tu-ec2-ip
```

### Paso 2: Ir al directorio del proyecto

```bash
cd /ruta/a/zunida-whatsapp-api-stable
```

### Paso 3: Pull los cambios

```bash
git pull origin main
```

### Paso 4: Rebuild y restart

```bash
docker-compose up -d --build
```

### Paso 5: Ver los logs

```bash
docker-compose logs -f whatsapp-api
```

**Deberías ver:**
```
🚀 WhatsApp API Server running on port 3006
🔄 [STARTUP] Restoring sessions from disk...
📂 [STARTUP] Found 3 session(s): 13, 136, 153
🔌 [STARTUP] Restoring session: 13
✅ [13] WhatsApp connection opened successfully!
✅ [STARTUP] Session restoration process completed
```

---

## ✅ Verificación

### 1. Health Check

```bash
curl http://localhost:3006/api/health
```

### 2. Ver todas las sesiones

```bash
curl http://localhost:3006/api/sessions
```

### 3. Ver status de una sesión específica

```bash
curl http://localhost:3006/api/status/13
```

### 4. **Test de Persistencia (¡IMPORTANTE!)**

```bash
# Ver que una sesión está conectada
curl http://localhost:3006/api/status/13

# Reiniciar el contenedor
docker-compose restart whatsapp-api

# Esperar 10 segundos
sleep 10

# Verificar que se reconectó automáticamente
curl http://localhost:3006/api/status/13
# Debe retornar: "connected": true
```

---

## 📊 Comportamiento Esperado

### Escenario 1: Reinicio del Servidor
```
1. docker-compose restart whatsapp-api
2. Servidor lee /sessions/
3. Encuentra sesiones: 13, 136, 153
4. Reconecta cada una automáticamente
5. En 10-15 segundos todas están "connected"
```

### Escenario 2: Consulta de Status de Sesión Desconectada
```
1. GET /api/status/153
2. Detecta que existe en disco pero está desconectada
3. Inicia reconexión automática en background
4. Retorna: auto_reconnecting: true
5. En ~5 segundos la sesión se reconecta
```

### Escenario 3: Sesión con Credenciales Corruptas (401)
```
1. WhatsApp retorna código 401 (Logged Out)
2. El sistema detecta el 401
3. Elimina automáticamente la carpeta /sessions/153/
4. Log: "Corrupted session files deleted"
5. El cliente debe escanear un nuevo QR
```

---

## 🐛 Troubleshooting

### Problema: "Las sesiones no se restauran"

**Verifica:**
```bash
# 1. Que el volumen esté montado
docker exec whatsapp-api ls -la /app/sessions/

# 2. Que existan archivos creds.json
docker exec whatsapp-api ls -la /app/sessions/13/

# 3. Ver logs de startup
docker-compose logs whatsapp-api | grep STARTUP
```

**Solución:**
- Asegúrate que `docker-compose.yml` tiene:
  ```yaml
  volumes:
    - ./sessions:/app/sessions
  ```

---

### Problema: "Permission denied en /app/sessions"

**Solución:**
```bash
sudo chown -R 1000:1000 ./sessions
docker-compose restart whatsapp-api
```

---

### Problema: "Sesión permanece en 'connecting'"

**Solución:**
```bash
# Opción 1: Forzar reconexión desde la API
curl -X DELETE http://localhost:3006/api/delete/153
curl http://localhost:3006/api/connect/153

# Opción 2: Limpiar manualmente y reiniciar
docker exec whatsapp-api rm -rf /app/sessions/153
docker-compose restart whatsapp-api
```

---

## 🎬 Demo Rápido

```bash
# 1. Crear una sesión de test
curl http://localhost:3006/api/connect/demo-test
# Escanear el QR

# 2. Verificar que está conectada
curl http://localhost:3006/api/status/demo-test
# Resultado: "connected": true

# 3. Enviar un mensaje
curl -X POST http://localhost:3006/api/send/demo-test \
  -H "Content-Type: application/json" \
  -d '{"to": "+51987654321", "message": "Test desde API"}'

# 4. Reiniciar el contenedor
docker-compose restart whatsapp-api

# 5. Esperar 10 segundos
sleep 10

# 6. Verificar que se reconectó automáticamente
curl http://localhost:3006/api/status/demo-test
# Resultado: "connected": true ✅

# 7. Enviar otro mensaje (debería funcionar sin escanear QR)
curl -X POST http://localhost:3006/api/send/demo-test \
  -H "Content-Type: application/json" \
  -d '{"to": "+51987654321", "message": "Funciona después del restart!"}'
```

---

## 📈 Beneficios para ZUNIDA

### Antes
- ❌ Cada vez que se reiniciaba el contenedor, había que escanear todos los QRs de nuevo
- ❌ Sesiones se desconectaban aleatoriamente
- ❌ El servidor se caía por errores de conexión
- ❌ Credenciales corruptas causaban loops infinitos

### Ahora
- ✅ Reiniciar el contenedor es seguro, todo se reconecta solo
- ✅ Las sesiones se auto-reconectan cuando se desconectan
- ✅ El servidor es resiliente y no se cae
- ✅ Credenciales corruptas se limpian automáticamente
- ✅ **Menos intervención manual, más confiabilidad**

---

## 🔗 Integración con Zunida API (NestJS)

Desde tu backend principal (`zunida-api`), ahora puedes:

1. **Consultar status sin preocuparte:**
   ```typescript
   GET http://localhost:3006/api/status/{companyId}
   // Si existe en disco pero está desconectada, se reconecta sola
   ```

2. **Enviar mensajes directamente:**
   ```typescript
   POST http://localhost:3006/api/send/{companyId}
   {
     "to": "+51987654321",
     "message": "Tu reserva ha sido confirmada"
   }
   ```

3. **Enviar PDFs:**
   ```typescript
   POST http://localhost:3006/api/send-document/{companyId}
   {
     "to": "+51987654321",
     "documentData": "data:application/pdf;base64,...",
     "filename": "ticket_123.pdf",
     "message": "Aquí tu ticket"
   }
   ```

---

## 📞 Soporte

Si tienes problemas después del deploy:

1. Captura los logs:
   ```bash
   docker-compose logs whatsapp-api > logs.txt
   ```

2. Verifica las sesiones:
   ```bash
   curl http://localhost:3006/api/sessions > sessions.json
   ```

3. Lista archivos en disk:
   ```bash
   ls -la sessions/
   ```

---

## ✨ Conclusión

Esta actualización hace que el **WhatsApp API** sea mucho más **robusto y confiable**:

- 🔁 Las sesiones persisten automáticamente
- 🛡️ El servidor no se cae por errores
- 🧹 Auto-limpieza de problemas
- 🚀 Menos mantenimiento manual

**Tiempo de deploy:** ~3 minutos  
**Downtime:** ~10 segundos  
**Riesgo:** Muy bajo (es backward compatible)

---

**Fecha:** 2025-10-17  
**Versión:** 1.1.0  
**Equipo:** ZUNIDA Development Team 🇵🇪

