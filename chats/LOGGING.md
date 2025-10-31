# 📝 Sistema de Logging por Día

## 🎯 Problema Resuelto

Antes: Un solo archivo de log que crecía indefinidamente (más de 100MB).

Ahora: **Un archivo por día** con rotación automática, compresión y eliminación de logs antiguos.

## 📁 Estructura de Logs

Los logs se guardan en `./logs/` y se organizan así:

```
logs/
├── 2024-01-15.log          # Logs del 15 de enero (GMT-5)
├── 2024-01-16.log          # Logs del 16 de enero (GMT-5)
├── 2024-01-16.log.1         # Si el 16 excedió 10MB, se divide
├── 2024-01-16.log.2        # Continuación si sigue creciendo
├── exceptions-2024-01-15.log   # Excepciones no capturadas
├── rejections-2024-01-15.log   # Promesas rechazadas
├── current.log             # Symlink al archivo actual
└── 2024-01-10.log.gz       # Logs antiguos comprimidos (auto)
```

**⚠️ IMPORTANTE:** Todas las fechas y horas están en **GMT-5** (hora de Colombia/Perú), independientemente de la zona horaria del servidor.

## ⚙️ Configuración

### Rotación Diaria Automática

- **Un archivo nuevo cada día** a las **00:00 GMT-5** (medianoche hora de Colombia/Perú)
- La rotación ocurre basada en la hora GMT-5, no en la hora local del servidor
- Formato: `YYYY-MM-DD.log` (ej: `2024-01-15.log`)

### Límite por Archivo

- **maxSize: 10MB** - Si un archivo excede 10MB en un día:
  - Se crea `2024-01-15.log.1`
  - Si sigue creciendo: `2024-01-15.log.2`, etc.
  - Máximo ~100MB por día (10 archivos de 10MB)

### Retención Automática

- **maxFiles: 14 días** - Solo se conservan los últimos 14 días
- Los logs más antiguos se **eliminan automáticamente**
- **zippedArchive: true** - Los logs antiguos se comprimen (.gz) antes de eliminarse

### Resultado Final

✅ **Nunca tendrás un archivo de más de 10MB**  
✅ **Solo 14 días de logs** (aproximadamente 140MB máximo en total)  
✅ **Un archivo por día** fácil de encontrar  
✅ **Eliminación automática** de logs antiguos  
✅ **Todos los timestamps y rotación en GMT-5** (hora de Colombia/Perú)  

## 🐳 En Docker (EC2)

Los logs se montan como volumen en `docker-compose.yml`:

```yaml
volumes:
  - ./logs:/app/logs  # Logs persistentes en el host EC2
```

### Ventajas

1. **Persisten** aunque reinicies el contenedor
2. **Accesibles** desde tu EC2 en `./logs/`
3. **No ocupan espacio** en el contenedor (están en el host)

### Ver Logs en EC2

```bash
# Ver estructura de logs
ls -lh logs/

# Ver log de hoy
tail -f logs/2024-01-15.log

# Ver log de ayer
cat logs/2024-01-14.log

# Ver todos los logs (últimos 14 días)
ls -lh logs/*.log

# Ver tamaño total de logs
du -sh logs/
```

## 📊 Ejemplo Real

Si el sistema corre 30 días sin reiniciar:

```
Día 1-14: logs/2024-01-01.log hasta logs/2024-01-14.log (GMT-5)
Día 15:   logs/2024-01-15.log (se crea nuevo archivo a las 00:00 GMT-5)
          logs/2024-01-01.log se elimina automáticamente

Día 16:   logs/2024-01-16.log (se crea nuevo archivo a las 00:00 GMT-5)
          logs/2024-01-02.log se elimina automáticamente
          
...y así sucesivamente
```

**Nota:** La rotación ocurre a las 00:00 GMT-5, incluso si el servidor está en otra zona horaria.

**Siempre tendrás máximo 14 archivos** (uno por día), con un tamaño máximo de ~10MB cada uno.

## 🔧 Personalización

Puedes ajustar en `src/logger.js`:

- `maxSize: '10m'` → Cambiar límite por archivo (ej: `'5m'` o `'20m'`)
- `maxFiles: '14d'` → Cambiar días de retención (ej: `'7d'` o `'30d'`)
- `zippedArchive: true` → Comprimir logs antiguos antes de eliminar

## 🚨 Logs Especiales

- **exceptions-YYYY-MM-DD.log**: Errores no capturados (`uncaughtException`)
- **rejections-YYYY-MM-DD.log**: Promesas rechazadas (`unhandledRejection`)

Estos también tienen rotación diaria y retención de 14 días.

