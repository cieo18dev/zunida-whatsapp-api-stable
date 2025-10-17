# 🧪 Tests Updated for Lazy Loading

## 📋 Resumen de Cambios

Los tests han sido actualizados para reflejar el nuevo comportamiento de **Lazy Loading**.

---

## 📝 Archivos Modificados

### **1. send.test.js** ✅

**Cambios principales:**
- Test `should return 500 when session is not connected` → `should return 404 when session does not exist on disk`
- Código de error esperado: `500` → `404`
- Mensaje de error ahora incluye "scan QR"
- Tests de números válidos ahora aceptan `[200, 404, 500]` en vez de `[200, 500]`

**Razón:**
Con lazy loading, si la sesión no existe en disco, retorna 404. Si existe pero está desconectada, conecta on-demand automáticamente.

---

### **2. status.test.js** ✅

**Cambios principales:**
- Agregados 4 nuevos campos en la respuesta:
  - `state` - Estado de la conexión
  - `session_exists_on_disk` - Si tiene credenciales guardadas
  - `auto_reconnecting` - Si está intentando reconectar

- Nuevo test: `should include all required fields with correct types`
  - Valida todos los campos y sus tipos
  - Valida que `state` tenga valores válidos

**Razón:**
El endpoint `/api/status` ahora retorna más información para soportar lazy loading.

---

### **3. sessions.test.js** ✅

**Cambios principales:**
- Test `should return empty sessions array when no sessions exist` → `should return sessions array (may be empty with lazy loading)`
- Agregado mensaje informativo: "With lazy loading, sessions array is often empty"
- Test de sesión creada ahora acepta que puede NO aparecer en la lista (lazy loading)

**Razón:**
Con lazy loading, las sesiones no se auto-conectan al iniciar. La lista de sesiones activas puede estar vacía aunque existan credenciales en disco.

---

### **4. send-document.test.js** ✅

**Cambios principales:**
- Test `should return 500 when session is not connected` → `should return 404 when session does not exist on disk`
- Código de error esperado: `500` → `404`
- Tests de formato válido ahora aceptan `[200, 404, 500]` en vez de `[200, 500]`

**Razón:**
Misma lógica que `send.test.js` - lazy loading conecta on-demand si existe en disco.

---

### **5. keep-alive.test.js** ✅ (NUEVO)

**Tests incluidos:**

1. **should return 404 when session does not exist on disk**
   - Valida que retorna 404 si no hay credenciales

2. **should return correct response structure when session exists**
   - Valida campos: `success`, `clientId`, `state`, `message`
   - Timeout: 20 segundos (permite tiempo de conexión)

3. **should accept POST method only**
   - Valida que GET retorna 404

4. **should handle multiple calls without errors**
   - Llama keep-alive dos veces seguidas
   - Valida que no crashea

5. **should return message about disconnect timer**
   - Valida que el mensaje menciona "disconnect/inactivity/minutes"

6. **should handle invalid clientId gracefully**
   - Valida manejo de clientId vacío

**Razón:**
Nuevo endpoint que necesita cobertura de tests completa.

---

### **6. connect.test.js** - Sin cambios ✅

**Razón:**
El comportamiento de `/connect` no cambió con lazy loading.

---

### **7. delete.test.js** - Sin cambios ✅

**Razón:**
El comportamiento de `/delete` no cambió con lazy loading.

---

### **8. health.test.js** - Sin cambios ✅

**Razón:**
El health check no se ve afectado por lazy loading.

---

## 🧪 Ejecutar Tests

### Todos los tests:

```bash
cd zunida-whatsapp-api-stable
pnpm test
```

### Solo tests de integración:

```bash
pnpm test src/__tests__/integration
```

### Un test específico:

```bash
pnpm test src/__tests__/integration/keep-alive.test.js
```

### Con coverage:

```bash
pnpm test:coverage
```

---

## ✅ Tests Actualizados Summary

| Archivo | Estado | Tests Modificados | Tests Nuevos |
|---------|--------|-------------------|--------------|
| send.test.js | ✅ | 3 | 0 |
| status.test.js | ✅ | 1 | 1 |
| sessions.test.js | ✅ | 2 | 0 |
| send-document.test.js | ✅ | 3 | 0 |
| keep-alive.test.js | ✅ | 0 | 6 |
| connect.test.js | ✅ | 0 | 0 |
| delete.test.js | ✅ | 0 | 0 |
| health.test.js | ✅ | 0 | 0 |
| **TOTAL** | **✅** | **9** | **7** |

---

## 📊 Comportamiento Esperado de Tests

### **ANTES (Conexiones Permanentes):**

```bash
pnpm test

✓ send.test.js - espera error 500 si no está conectada
✓ sessions.test.js - espera sesiones auto-conectadas al iniciar
✓ status.test.js - solo valida connected: true/false
```

### **AHORA (Lazy Loading):**

```bash
pnpm test

✓ send.test.js - espera error 404 si no existe en disco
✓ sessions.test.js - acepta lista vacía (normal con lazy loading)
✓ status.test.js - valida 5 campos incluyendo session_exists_on_disk
✓ keep-alive.test.js - 6 nuevos tests para endpoint nuevo ✨
```

---

## 🐛 Notas Importantes

### 1. **Tests pueden ser más lentos**

Con lazy loading, algunos tests tardan más porque:
- Conectar on-demand toma 3-5 segundos
- keep-alive.test.js tiene timeout de 20-30 segundos

**Solución:** Los timeouts ya están configurados apropiadamente.

---

### 2. **Tests de /sessions pueden retornar array vacío**

Es **normal** que `/api/sessions` retorne `[]` con lazy loading.

**No es un error**, simplemente significa que ninguna sesión está activamente conectada en ese momento.

---

### 3. **Mock de sesiones para tests**

Si necesitas testear con sesiones "existentes":

```javascript
import fs from 'fs';
import path from 'path';

beforeAll(() => {
  // Crear carpeta de sesión falsa
  const sessionPath = path.join('sessions', 'test-client');
  fs.mkdirSync(sessionPath, { recursive: true });
  fs.writeFileSync(
    path.join(sessionPath, 'creds.json'),
    JSON.stringify({ test: 'data' })
  );
});

afterAll(() => {
  // Limpiar
  fs.rmSync(path.join('sessions', 'test-client'), { recursive: true });
});
```

---

### 4. **Tests de integración real**

Para testear con WhatsApp real:

1. Iniciar servidor: `pnpm start`
2. Escanear QR para sesión de test
3. Ejecutar tests de integración

**Nota:** Los tests actuales NO requieren WhatsApp real, son tests de API.

---

## 🔧 CI/CD

Si usas CI/CD, asegúrate de:

```yaml
# .github/workflows/test.yml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '20'
    - run: npm install -g pnpm
    - run: pnpm install
    - run: pnpm test
      timeout-minutes: 10  # ← Importante con lazy loading
```

---

## ✨ Nuevas Validaciones

Los tests ahora validan:

1. ✅ Respuesta 404 cuando sesión no existe
2. ✅ Campo `session_exists_on_disk` en status
3. ✅ Campo `state` con valores válidos
4. ✅ Campo `auto_reconnecting` booleano
5. ✅ Endpoint `/keep-alive` funciona correctamente
6. ✅ Múltiples llamadas a keep-alive no crashean
7. ✅ Mensajes de error mencionan "scan QR"

---

## 🎯 Próximos Pasos

1. ✅ Tests actualizados
2. ⏳ Ejecutar tests localmente: `pnpm test`
3. ⏳ Deploy a staging
4. ⏳ Ejecutar tests en staging
5. ⏳ Deploy a producción

---

**Fecha:** 2025-10-17  
**Versión:** 1.2.0 (Lazy Loading)  
**Tests Status:** ✅ All Updated

