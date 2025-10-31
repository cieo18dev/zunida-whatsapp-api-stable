# 📖 Guía: Cómo Ver los Logs

## 🐳 En Docker (EC2)

### 1. Ver Logs del Día Actual (en Tiempo Real)

```bash
# Conectar a tu EC2
ssh tu-usuario@tu-ec2-ip

# Ir al directorio del proyecto
cd /ruta/a/zunida-whatsapp-api-stable

# Ver logs del día actual (seguir en tiempo real)
tail -f logs/$(date -u -d '-5 hours' +%Y-%m-%d).log

# O más simple (si el servidor tiene la fecha correcta):
tail -f logs/$(date +%Y-%m-%d).log

# Ver solo las últimas 100 líneas
tail -n 100 logs/$(date +%Y-%m-%d).log
```

### 2. Ver Logs de un Día Específico

```bash
# Ver log completo del 15 de enero (GMT-5)
cat logs/2024-01-15.log

# Ver log con paginación (útil para archivos grandes)
less logs/2024-01-15.log
# Presiona 'q' para salir, flechas para navegar

# Ver últimas 50 líneas de un día específico
tail -n 50 logs/2024-01-15.log
```

### 3. Buscar en los Logs

```bash
# Buscar "ERROR" en el log de hoy
grep -i "ERROR" logs/$(date +%Y-%m-%d).log

# Buscar un cliente específico
grep "clientId 13" logs/$(date +%Y-%m-%d).log

# Buscar con contexto (3 líneas antes y después)
grep -C 3 "QR code" logs/2024-01-15.log

# Buscar en todos los logs (últimos 14 días)
grep -r "Failed to connect" logs/

# Buscar y ver con colores
grep --color=always "ERROR\|WARN" logs/2024-01-15.log
```

### 4. Ver Logs desde Docker (sin entrar al contenedor)

```bash
# Ver logs del contenedor directamente
docker logs -f whatsapp-api

# Ver últimas 100 líneas
docker logs --tail 100 whatsapp-api

# Ver logs desde una fecha específica
docker logs --since 2024-01-15T00:00:00 whatsapp-api

# Ver logs y seguir nuevos
docker logs -f --since 5m whatsapp-api
```

### 5. Ver Tamaño y Estado de los Logs

```bash
# Ver tamaño total de todos los logs
du -sh logs/

# Ver tamaño de cada archivo
du -h logs/*.log

# Listar todos los archivos de log con tamaño
ls -lh logs/*.log

# Ver cuántos archivos hay
ls -1 logs/*.log | wc -l

# Ver los archivos más grandes
ls -lhS logs/*.log | head -5
```

### 6. Ver Logs de Errores Específicos

```bash
# Ver solo errores del día actual
grep "ERROR" logs/$(date +%Y-%m-%d).log

# Ver excepciones no capturadas
cat logs/exceptions-$(date +%Y-%m-%d).log

# Ver promesas rechazadas
cat logs/rejections-$(date +%Y-%m-%d).log

# Ver todos los errores de hoy con timestamps
grep -E "(ERROR|WARN)" logs/$(date +%Y-%m-%d).log | tail -50
```

### 7. Filtrar y Formatear Logs

```bash
# Ver solo logs de conexiones
grep "Connecting\|Connected\|Disconnecting" logs/$(date +%Y-%m-%d).log

# Ver logs de un cliente específico
grep "\[13\]" logs/$(date +%Y-%m-%d).log

# Ver logs entre dos horas (ej: 14:00 a 18:00 GMT-5)
grep "2024-01-15 1[4-8]:" logs/2024-01-15.log

# Contar cuántos errores hay hoy
grep -c "ERROR" logs/$(date +%Y-%m-%d).log

# Ver últimas conexiones exitosas
grep "WhatsApp connection opened successfully" logs/$(date +%Y-%m-%d).log | tail -10
```

### 8. Exportar Logs

```bash
# Exportar log del día actual a un archivo
cat logs/$(date +%Y-%m-%d).log > log-hoy.txt

# Exportar solo errores
grep "ERROR" logs/$(date +%Y-%m-%d).log > errores-hoy.txt

# Comprimir log de un día específico
gzip logs/2024-01-15.log
# Se crea: logs/2024-01-15.log.gz

# Ver log comprimido sin descomprimir
zcat logs/2024-01-15.log.gz | grep "ERROR"
```

## 🔍 Comandos Útiles Combinados

### Monitoreo en Tiempo Real con Filtros

```bash
# Ver solo errores en tiempo real
tail -f logs/$(date +%Y-%m-%d).log | grep --color=always "ERROR\|WARN"

# Ver logs de conexiones en tiempo real
tail -f logs/$(date +%Y-%m-%d).log | grep --color=always "Connecting\|Connected"

# Ver actividad de un cliente específico en tiempo real
tail -f logs/$(date +%Y-%m-%d).log | grep --color=always "\[13\]"
```

### Estadísticas Rápidas

```bash
# Contar líneas por nivel de log
echo "INFO: $(grep -c '\[INFO\]' logs/$(date +%Y-%m-%d).log)"
echo "ERROR: $(grep -c '\[ERROR\]' logs/$(date +%Y-%m-%d).log)"
echo "WARN: $(grep -c '\[WARN\]' logs/$(date +%Y-%m-%d).log)"

# Ver actividad por hora (últimas 24 horas)
grep -o "2024-01-15 [0-9][0-9]:" logs/2024-01-15.log | sort | uniq -c
```

## 📋 Ejemplos Prácticos

### Ejemplo 1: Debug de Conexión

```bash
# Ver todas las conexiones de hoy
grep -E "(Connecting|Connected|Disconnected|QR Code)" logs/$(date +%Y-%m-%d).log

# Ver intentos de reconexión
grep "Attempting reconnection" logs/$(date +%Y-%m-%d).log
```

### Ejemplo 2: Monitoreo de Errores

```bash
# Ver los 10 errores más recientes
grep "ERROR" logs/$(date +%Y-%m-%d).log | tail -10

# Ver errores con stack trace
grep -A 5 "ERROR" logs/$(date +%Y-%m-%d).log | tail -50
```

### Ejemplo 3: Ver Actividad de Mensajes

```bash
# Ver mensajes enviados hoy
grep "Message sent\|Document sent" logs/$(date +%Y-%m-%d).log

# Ver mensajes recibidos
grep "New message received" logs/$(date +%Y-%m-%d).log
```

## 📍 Notas Importantes

1. **Fechas en GMT-5**: Todos los nombres de archivo y timestamps están en GMT-5
   - Si son las 23:00 del 15 de enero GMT-5, el archivo es `2024-01-15.log`
   - A las 00:00 GMT-5 del 16, se crea `2024-01-16.log`

2. **Symlink**: Hay un symlink `current.log` que apunta al archivo del día actual
   ```bash
   # Ver log actual usando symlink
   tail -f logs/current.log
   ```

3. **Archivos Comprimidos**: Los logs antiguos se comprimen automáticamente
   ```bash
   # Ver log comprimido
   zcat logs/2024-01-10.log.gz
   ```

4. **Retención**: Solo se guardan los últimos 14 días, los más antiguos se eliminan automáticamente

## 🚀 Script de Monitoreo Rápido

Crea este script `monitor-logs.sh`:

```bash
#!/bin/bash
# Ver logs en tiempo real con filtros útiles

LOG_DIR="logs"
TODAY=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/$TODAY.log"

echo "📊 Monitoreando: $LOG_FILE"
echo "Presiona Ctrl+C para salir"
echo ""

tail -f "$LOG_FILE" | while read line; do
    if echo "$line" | grep -q "ERROR"; then
        echo -e "\033[31m$line\033[0m"  # Rojo para errores
    elif echo "$line" | grep -q "WARN"; then
        echo -e "\033[33m$line\033[0m"  # Amarillo para warnings
    elif echo "$line" | grep -q "Connected\|Connected successfully"; then
        echo -e "\033[32m$line\033[0m"   # Verde para conexiones
    else
        echo "$line"
    fi
done
```

Uso:
```bash
chmod +x monitor-logs.sh
./monitor-logs.sh
```

