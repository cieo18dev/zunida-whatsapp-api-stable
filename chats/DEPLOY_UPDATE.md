# 🚀 Deploy Update - Session Persistence Fix

## Resumen
Esta actualización resuelve el problema de sesiones que se pierden después de un tiempo. Ahora las sesiones se reconectan automáticamente al iniciar el servidor.

---

## ⚡ Quick Deploy en EC2

### Opción 1: Actualización Sin Downtime (Recomendado)

```bash
# 1. SSH a tu EC2
ssh -i tu-key.pem ec2-user@tu-ec2-ip

# 2. Ir al directorio del proyecto
cd /ruta/a/zunida-whatsapp-api-stable

# 3. Pull los últimos cambios
git pull origin main

# 4. Rebuild y restart
docker-compose up -d --build

# 5. Verificar logs
docker-compose logs -f whatsapp-api
```

**Tiempo estimado:** 2-3 minutos  
**Downtime:** ~10 segundos durante el restart

---

### Opción 2: Deploy Desde Cero

```bash
# 1. Detener contenedor actual
docker-compose down

# 2. Pull cambios
git pull origin main

# 3. Rebuild desde cero
docker-compose build --no-cache

# 4. Iniciar
docker-compose up -d

# 5. Ver logs
docker-compose logs -f
```

**Tiempo estimado:** 5-7 minutos  
**Downtime:** 2-3 minutos

---

## ✅ Verificación Post-Deploy

### 1. Health Check

```bash
curl http://localhost:3006/api/health
# Debe retornar: OK
```

### 2. Verificar Sesiones

```bash
curl http://localhost:3006/api/sessions
```

**Respuesta esperada:**
```json
{
  "sessions": [
    {
      "session_id": "13",
      "state": "connected",
      "phone_number": "573001234567",
      "has_qr": false,
      "reconnect_attempts": 0
    }
  ]
}
```

### 3. Verificar Logs de Startup

```bash
docker-compose logs whatsapp-api | grep STARTUP
```

**Debe mostrar:**
```
🔄 [STARTUP] Restoring sessions from disk...
📂 [STARTUP] Found X session(s): ...
🔌 [STARTUP] Restoring session: ...
✅ [STARTUP] Session restoration process completed
```

### 4. Test de Persistencia

```bash
# 1. Verificar que una sesión está conectada
curl http://localhost:3006/api/status/13

# 2. Reiniciar el contenedor
docker-compose restart whatsapp-api

# 3. Esperar 10 segundos
sleep 10

# 4. Verificar que la sesión se reconectó
curl http://localhost:3006/api/status/13
# Debe retornar connected: true
```

---

## 🔍 Monitoring Post-Deploy

### Ver logs en tiempo real

```bash
docker-compose logs -f whatsapp-api
```

### Buscar errores

```bash
docker-compose logs whatsapp-api | grep "❌"
```

### Ver solo eventos de conexión

```bash
docker-compose logs whatsapp-api | grep -E "✅|🔄|🚪"
```

---

## 📊 Métricas de Éxito

Después del deploy, deberías ver:

✅ **Sesiones se restauran automáticamente** al reiniciar  
✅ **No más crashes** del servidor por errores de conexión  
✅ **Código 401 se limpia automáticamente**  
✅ **Endpoint /status intenta auto-reconectar**  

---

## ⚠️ Problemas Comunes

### Problema: Sesiones no se restauran

**Causa:** Volumen de Docker no está correctamente montado

**Solución:**
```bash
# Verificar que el volumen existe
docker volume ls | grep whatsapp

# Verificar archivos de sesión
docker exec whatsapp-api ls -la /app/sessions/

# Si no hay archivos, verificar docker-compose.yml
cat docker-compose.yml | grep volumes -A 2
```

---

### Problema: "Permission denied" en /app/sessions

**Causa:** Permisos incorrectos

**Solución:**
```bash
# Dar permisos correctos
sudo chown -R 1000:1000 ./sessions

# Reiniciar contenedor
docker-compose restart whatsapp-api
```

---

### Problema: Sesiones en "connecting" permanente

**Causa:** Credenciales corruptas o WhatsApp bloqueó la conexión

**Solución:**
```bash
# Opción 1: Forzar reconexión
curl -X DELETE http://localhost:3006/api/delete/{clientId}
curl -X GET http://localhost:3006/api/connect/{clientId}

# Opción 2: Limpiar manualmente
docker exec whatsapp-api rm -rf /app/sessions/{clientId}
docker-compose restart whatsapp-api
```

---

## 🔙 Rollback

Si algo sale mal, puedes hacer rollback:

```bash
# 1. Detener contenedor
docker-compose down

# 2. Volver a versión anterior
git checkout <commit-anterior>

# 3. Rebuild
docker-compose up -d --build

# 4. Verificar
curl http://localhost:3006/api/health
```

---

## 📝 Checklist Post-Deploy

- [ ] Health check responde OK
- [ ] Sesiones existentes se listaron correctamente
- [ ] Logs muestran "Session restoration process completed"
- [ ] Test de persistencia pasó (restart y reconexión)
- [ ] No hay errores en los logs
- [ ] Zunida API puede comunicarse con WhatsApp API
- [ ] Test de envío de mensaje funciona

---

## 🆘 Soporte

Si necesitas ayuda después del deploy:

1. **Captura los logs:**
   ```bash
   docker-compose logs whatsapp-api > logs.txt
   ```

2. **Verifica el estado de las sesiones:**
   ```bash
   curl http://localhost:3006/api/sessions > sessions.json
   ```

3. **Revisa archivos de sesión:**
   ```bash
   ls -la sessions/
   ```

---

## 📞 Contacto

Para reportar problemas o dudas sobre este deploy, contactar al equipo de desarrollo ZUNIDA.

---

**Última actualización:** 2025-10-17  
**Versión:** 1.1.0  
**Autor:** ZUNIDA Team

