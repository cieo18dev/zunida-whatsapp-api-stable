# Tests de Integración - WhatsApp API

## 🎯 Objetivo

Esta suite de tests de **integración real** prueba la funcionalidad completa del API de WhatsApp **sin usar mocks**. Los tests se conectan realmente a WhatsApp y generan QR codes verdaderos.

## 🚀 Instalación de Dependencias

```bash
pnpm install
# o
npm install
```

## 🧪 Ejecutar Tests

### Todos los tests
```bash
pnpm test
# o
npm test
```

### Tests en modo watch (desarrollo)
```bash
pnpm test:watch
# o
npm run test:watch
```

### Tests con cobertura
```bash
pnpm test:coverage
# o
npm run test:coverage
```

### Test específico
```bash
pnpm test connect
# o
npm test -- --testPathPattern=connect
```

## 📋 Tests Incluidos

### 1. **GET /api/connect/:clientId** - ⭐ TEST MÁS IMPORTANTE
**Archivo:** `integration/connect.test.js`

Este test **genera un QR code REAL** conectándose a WhatsApp:

```javascript
✅ should generate a REAL QR code when connecting a new client
✅ should return already connecting message on second call
✅ should handle invalid client ID gracefully
```

**Características:**
- Se conecta a WhatsApp usando Baileys
- Genera QR code verdadero (no mockeado)
- Valida que el QR sea base64 válido
- Verifica que el QR tenga tamaño real (>1000 caracteres)
- Timeout de 35 segundos para generación de QR
- Limpia sesiones de prueba automáticamente

**Ejemplo de salida:**
```
🧪 Testing QR generation for client: test-client-1234567890
📋 Response status: 200
✅ QR Code generated successfully!
📱 QR Code starts with: data:image/png;base64,iVBORw0KGgoAAAANSUhEU...
```

### 2. **POST /api/send/:clientId**
**Archivo:** `integration/send.test.js`

Prueba el envío de mensajes de texto:

```javascript
✅ should return 400 when "to" is missing
✅ should return 400 when "message" is missing
✅ should return 400 for invalid phone number format - too short
✅ should return 400 for invalid phone number format - letters
✅ should return 400 for invalid phone number format - too long
✅ should return 500 when session is not connected
✅ should accept valid phone numbers with + prefix
✅ should accept valid phone numbers without + prefix
```

### 3. **POST /api/send-document/:clientId**
**Archivo:** `integration/send-document.test.js`

Prueba el envío de documentos PDF:

```javascript
✅ should return 400 when "to" is missing
✅ should return 400 when "documentData" is missing
✅ should return 400 when "filename" is missing
✅ should return 400 for invalid phone number format
✅ should return 400 for invalid documentData format (not base64)
✅ should return 400 for URL format (only base64 supported)
✅ should accept valid base64 PDF data format
✅ should accept valid base64 without optional message
✅ should return 500 when session is not connected
```

### 4. **GET /api/status/:clientId**
**Archivo:** `integration/status.test.js`

Prueba el estado de conexión:

```javascript
✅ should return status for non-existent client (disconnected)
✅ should return clientId in response
✅ should handle special characters in clientId
✅ should return boolean for connected field
```

### 5. **DELETE /api/delete/:clientId**
**Archivo:** `integration/delete.test.js`

Prueba la eliminación de sesiones:

```javascript
✅ should return 204 when deleting a non-existent session
✅ should delete session directory when it exists
✅ should return 400 when trying to delete default session
✅ should handle clientId with special characters
✅ should disconnect session before deleting
```

### 6. **GET /api/health**
**Archivo:** `integration/health.test.js`

Prueba el health check:

```javascript
✅ should return 200 OK
✅ should return plain text content type
✅ should be fast (respond in less than 100ms)
✅ should always return the same response
```

## 📊 Cobertura de Tests

Los tests cubren:

- ✅ Generación real de QR codes
- ✅ Validación de números de teléfono
- ✅ Validación de formato de documentos base64
- ✅ Manejo de errores 400, 404, 408, 500
- ✅ Estados de conexión (connected, connecting, disconnected)
- ✅ Limpieza de sesiones
- ✅ Health checks

## ⚠️ Notas Importantes

### Test de Generación de QR
- **Este test se conecta REALMENTE a WhatsApp**
- Puede tardar hasta 35 segundos
- Crea sesiones temporales en `sessions/test-client-*`
- Las sesiones se limpian automáticamente después del test
- Si el test falla con timeout, es normal (WhatsApp a veces tarda)

### Limpieza Automática
Todos los tests limpian las sesiones de prueba automáticamente usando:
- `afterAll()` hooks
- `afterEach()` hooks
- Prefijos únicos con timestamps

### Archivos Generados
Los tests pueden crear directorios temporales:
```
sessions/
  └── test-client-1234567890/
      ├── creds.json
      └── [otros archivos de sesión]
```

Estos se eliminan automáticamente al finalizar los tests.

## 🐛 Debugging

Si un test falla:

1. **Ver logs completos:**
```bash
pnpm test -- --verbose
```

2. **Ejecutar solo un test:**
```bash
pnpm test -- --testNamePattern="generate a REAL QR"
```

3. **Ver output del servidor:**
Los tests muestran los logs de conexión en consola.

## 📈 Resultados Esperados

### Test exitoso de QR:
```
PASS  src/__tests__/integration/connect.test.js (31.2s)
  Integration Tests - GET /api/connect/:clientId
    ✓ should generate a REAL QR code when connecting a new client (30015ms)
    ✓ should return already connecting message on second call (1002ms)
    ✓ should handle invalid client ID gracefully (152ms)
```

### Suite completa:
```
Test Suites: 6 passed, 6 total
Tests:       35 passed, 35 total
Snapshots:   0 total
Time:        42.156s
```

## 🎓 Casos de Prueba Cubiertos

### Casos Positivos ✅
- QR code se genera correctamente
- Mensajes válidos se aceptan
- Números válidos se procesan
- Base64 válido se acepta
- Health check responde OK

### Casos Negativos ❌
- Parámetros faltantes rechazan request
- Formatos inválidos retornan 400
- Sesiones no conectadas retornan 500
- Timeout en QR retorna 408

### Casos Edge 🔸
- Números con/sin prefijo +
- ClientIds con caracteres especiales
- Sesiones que no existen
- Intentos de eliminar sesión default

## 🚀 Próximos Pasos

Para agregar más tests:

1. Crear archivo en `src/__tests__/integration/`
2. Importar `@jest/globals` y `supertest`
3. Seguir la estructura de los tests existentes
4. Ejecutar con `pnpm test`

## 📝 Ejemplo de Test

```javascript
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import routes from '../../routes.js';

describe('My New Test', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', routes);
  });

  it('should do something', async () => {
    const response = await request(app)
      .get('/api/my-endpoint')
      .expect(200);

    expect(response.body).toBeDefined();
  });
});
```

