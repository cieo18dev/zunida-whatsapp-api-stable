# 🐳 Guía: Ejecutar el Proyecto con Docker

## 🚀 Inicio Rápido

### 1. Prerrequisitos

- Docker instalado
- Docker Compose instalado
- Red `zunida-network` creada (si usas múltiples servicios)

### 2. Crear la Red Docker (si no existe)

```bash
# Crear la red para conectar con otros microservicios
docker network create zunida-network
```

### 3. Construir y Ejecutar

```bash
# Ir al directorio del proyecto
cd zunida-whatsapp-api-stable

# Construir y ejecutar en background
docker-compose up -d --build

# Ver logs en tiempo real
docker-compose logs -f whatsapp-api
```

### 4. Verificar que Funciona

```bash
# Health check
curl http://localhost:3006/api/health
# Debe responder: OK

# Ver documentación Swagger
# Abre en navegador: http://localhost:3006/api-docs
```

---

## 📋 Comandos Útiles

### Ver Logs

```bash
# Logs en tiempo real
docker-compose logs -f whatsapp-api

# Últimas 100 líneas
docker-compose logs --tail 100 whatsapp-api

# Logs desde una fecha específica
docker-compose logs --since 2024-01-15T00:00:00 whatsapp-api

# Ver logs del archivo montado (con rotación diaria)
tail -f logs/$(date +%Y-%m-%d).log
```

### Control del Contenedor

```bash
# Detener
docker-compose stop

# Iniciar
docker-compose start

# Reiniciar
docker-compose restart

# Detener y eliminar contenedor
docker-compose down

# Detener, eliminar y reconstruir
docker-compose up -d --build

# Ver estado
docker-compose ps
```

### Entrar al Contenedor

```bash
# Entrar al contenedor
docker exec -it whatsapp-api sh

# Ver procesos dentro del contenedor
docker exec whatsapp-api ps aux

# Ver variables de entorno
docker exec whatsapp-api env
```

### Ver Recursos

```bash
# Uso de CPU/RAM del contenedor
docker stats whatsapp-api

# Ver espacio usado por volúmenes
docker system df -v
```

---

## 📁 Estructura de Directorios

```
zunida-whatsapp-api-stable/
├── sessions/          # Sesiones de WhatsApp (volumen montado)
├── logs/             # Logs diarios (volumen montado)
│   ├── 2024-01-15.log
│   ├── 2024-01-16.log
│   └── current.log
├── docker-compose.yml
├── Dockerfile
└── src/
```

### Volúmenes Montados

1. **`./sessions:/app/sessions`** - Sesiones de WhatsApp (CRÍTICO: persisten entre reinicios)
2. **`./logs:/app/logs`** - Logs diarios con rotación automática

---

## 🔧 Configuración Avanzada

### Cambiar Puerto

Edita `docker-compose.yml`:

```yaml
ports:
  - "3007:3006"  # Puerto externo:interno
```

Luego reinicia:
```bash
docker-compose up -d --build
```

### Cambiar Variables de Entorno

Edita `docker-compose.yml`:

```yaml
environment:
  - PORT=3006
  - NODE_ENV=production
  - LOG_LEVEL=debug  # Agregar nivel de log
```

### Usar Named Volumes (Producción)

```yaml
volumes:
  - whatsapp-sessions:/app/sessions
  - whatsapp-logs:/app/logs

# Agregar al final:
volumes:
  whatsapp-sessions:
    driver: local
  whatsapp-logs:
    driver: local
```

---

## 🚨 Troubleshooting

### El Contenedor No Inicia

```bash
# Ver logs de error
docker-compose logs whatsapp-api

# Verificar si el puerto está en uso
netstat -tulpn | grep 3006

# Matar proceso en puerto 3006 (si es necesario)
sudo lsof -ti:3006 | xargs kill -9
```

### Sesiones Se Pierden

✅ **Verificar que el volumen esté montado:**

```bash
# Ver volúmenes montados
docker inspect whatsapp-api | grep -A 10 Mounts

# Verificar que existe el directorio sessions/
ls -la sessions/
```

### Logs No Se Generan

✅ **Verificar permisos:**

```bash
# Crear directorio de logs si no existe
mkdir -p logs

# Dar permisos
chmod 755 logs

# Verificar que el contenedor puede escribir
docker exec whatsapp-api ls -la /app/logs
```

### Health Check Falla

```bash
# Verificar que el healthcheck funciona
docker exec whatsapp-api wget --no-verbose --tries=1 --spider http://localhost:3006/api/health

# Ver logs del healthcheck
docker inspect whatsapp-api | grep -A 20 Health
```

### Red No Existe

```bash
# Crear red
docker network create zunida-network

# Verificar que existe
docker network ls | grep zunida-network

# Reiniciar contenedor
docker-compose up -d
```

---

## 📊 Monitoreo

### Ver Logs en Tiempo Real con Filtros

```bash
# Solo errores
docker-compose logs -f whatsapp-api | grep --color=always "ERROR"

# Solo conexiones
docker-compose logs -f whatsapp-api | grep --color=always "Connected\|Connecting"

# Cliente específico
docker-compose logs -f whatsapp-api | grep --color=always "\[13\]"
```

### Ver Logs del Archivo (con rotación diaria)

```bash
# Ver log del día actual
tail -f logs/$(date +%Y-%m-%d).log

# O usar symlink
tail -f logs/current.log
```

### Estadísticas

```bash
# Ver uso de recursos
docker stats whatsapp-api --no-stream

# Ver tamaño de volúmenes
du -sh sessions/
du -sh logs/
```

---

## 🔄 Actualizar el Proyecto

### Cuando Haces Cambios en el Código

```bash
# 1. Hacer cambios en el código

# 2. Reconstruir y reiniciar
docker-compose up -d --build

# 3. Ver logs para verificar
docker-compose logs -f whatsapp-api
```

### Cuando Haces Cambios en Dependencies

```bash
# 1. Actualizar package.json o pnpm-lock.yaml

# 2. Reconstruir (sin cache para forzar reinstalación)
docker-compose build --no-cache

# 3. Reiniciar
docker-compose up -d
```

---

## 🏭 Producción (EC2)

### 1. Conectar a EC2

```bash
ssh -i tu-key.pem ec2-user@tu-ec2-ip
```

### 2. Clonar y Configurar

```bash
# Clonar repositorio
git clone tu-repo
cd zunida-whatsapp-api-stable

# Crear directorios necesarios
mkdir -p sessions logs

# Crear red Docker
docker network create zunida-network
```

### 3. Ejecutar

```bash
# Ejecutar en background
docker-compose up -d --build

# Verificar que corre
docker-compose ps

# Ver logs
docker-compose logs -f whatsapp-api
```

### 4. Auto-Inicio al Reiniciar EC2

Crear servicio systemd `/etc/systemd/system/whatsapp-api.service`:

```ini
[Unit]
Description=WhatsApp API Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/ruta/a/zunida-whatsapp-api-stable
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Habilitar servicio:

```bash
sudo systemctl enable whatsapp-api
sudo systemctl start whatsapp-api
```

---

## 📝 Ejemplo Completo

```bash
# 1. Clonar proyecto
git clone https://github.com/tu-usuario/zunida-whatsapp-api-stable.git
cd zunida-whatsapp-api-stable

# 2. Crear red Docker
docker network create zunida-network

# 3. Crear directorios
mkdir -p sessions logs

# 4. Construir y ejecutar
docker-compose up -d --build

# 5. Ver logs
docker-compose logs -f whatsapp-api

# 6. Verificar salud
curl http://localhost:3006/api/health

# 7. Ver Swagger
# Abre navegador: http://localhost:3006/api-docs
```

---

## ✅ Checklist de Verificación

- [ ] Docker y Docker Compose instalados
- [ ] Red `zunida-network` creada
- [ ] Directorios `sessions/` y `logs/` existen
- [ ] Puerto 3006 disponible
- [ ] Contenedor corre (`docker-compose ps`)
- [ ] Health check responde (`curl http://localhost:3006/api/health`)
- [ ] Logs se generan en `logs/` con fecha GMT-5
- [ ] Sesiones persisten después de reiniciar contenedor

---

## 🆘 Comandos de Emergencia

```bash
# Detener todo y limpiar
docker-compose down
docker system prune -f

# Reiniciar desde cero
docker-compose down
docker-compose up -d --build

# Ver logs de errores
docker-compose logs whatsapp-api 2>&1 | grep -i error

# Backup de sesiones (ANTES de cambios importantes)
tar -czf sessions-backup-$(date +%Y%m%d).tar.gz sessions/
```

---

## 📚 Documentación Adicional

- Ver logs: `VISUALIZAR_LOGS.md`
- Sistema de logging: `LOGGING.md`
- Deployment: `DEPLOYMENT.md`

