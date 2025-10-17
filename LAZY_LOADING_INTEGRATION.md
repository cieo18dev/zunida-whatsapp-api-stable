# 🔄 Lazy Loading - Guía de Integración Frontend

## 📋 Resumen

Con Lazy Loading implementado, las sesiones de WhatsApp:
- ✅ **NO** se conectan automáticamente al iniciar el servidor
- ✅ Se conectan **solo cuando se necesitan** (enviar mensaje o admin en panel)
- ✅ Se desconectan automáticamente después de inactividad
- ✅ **Beneficio:** El celular recibe notificaciones push normalmente

---

## 🎯 Cambios en el Backend (WhatsApp API)

### ✅ Completado:

1. **Sistema de timers de inactividad** - `whatsapp.js`
2. **NO auto-conectar al inicio** - `index.js`
3. **Conectar on-demand en `/send`** - `routes.js`
4. **Conectar on-demand en `/send-document`** - `routes.js`
5. **Nuevo endpoint `/keep-alive`** - `routes.js`

---

## 🔧 Integración en Frontend (Zunida API - NestJS)

### **Escenario 1: Admin abre el Dashboard**

El frontend debe llamar `/keep-alive` periódicamente para mantener la sesión activa.

#### **Opción A: En el Componente del Dashboard (Angular/React)**

```typescript
// dashboard.component.ts (Angular)
export class DashboardComponent implements OnInit, OnDestroy {
  private keepAliveInterval: any;
  private companyId: string;

  ngOnInit() {
    this.companyId = this.authService.getCompanyId();
    
    // Llamar keep-alive cada 60 segundos
    this.keepAliveInterval = setInterval(() => {
      this.whatsappService.keepAlive(this.companyId).subscribe({
        next: (res) => console.log('✅ WhatsApp session kept alive'),
        error: (err) => console.error('❌ Keep-alive failed:', err)
      });
    }, 60000); // 60 segundos
  }

  ngOnDestroy() {
    // Limpiar interval cuando el admin cierra el panel
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    // En 5 minutos la sesión se desconectará automáticamente
  }
}
```

```typescript
// whatsapp.service.ts
@Injectable()
export class WhatsappService {
  constructor(private http: HttpClient) {}

  keepAlive(companyId: string): Observable<any> {
    return this.http.post(
      `http://localhost:3006/api/keep-alive/${companyId}`,
      {}
    );
  }
}
```

#### **Opción B: En el Backend (NestJS) - Middleware o Guard**

```typescript
// whatsapp-keep-alive.interceptor.ts
@Injectable()
export class WhatsappKeepAliveInterceptor implements NestInterceptor {
  constructor(private readonly httpService: HttpService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const companyId = request.user?.companyId;

    // Llamar keep-alive cuando el admin hace requests
    if (companyId && this.isAdminRoute(request.url)) {
      this.httpService
        .post(`http://localhost:3006/api/keep-alive/${companyId}`, {})
        .subscribe();
    }

    return next.handle();
  }

  private isAdminRoute(url: string): boolean {
    // Detectar rutas del admin panel
    return url.includes('/dashboard') || url.includes('/admin');
  }
}
```

---

### **Escenario 2: Enviar Mensajes Automáticos**

**NO necesitas cambiar nada.** Los endpoints `/send` y `/send-document` ahora:
1. Detectan si la sesión está desconectada
2. Conectan automáticamente (3-5 segundos)
3. Envían el mensaje
4. Se desconectan después de 2 minutos

```typescript
// reservation.service.ts (Sin cambios)
async sendConfirmation(reservation: Reservation) {
  // Funciona igual que antes
  await this.http.post(`http://localhost:3006/api/send/${reservation.companyId}`, {
    to: reservation.clientPhone,
    message: 'Tu reserva ha sido confirmada'
  }).toPromise();
  
  // La API conecta on-demand automáticamente ✅
}
```

---

### **Escenario 3: Mostrar Estado de WhatsApp en UI**

Puedes mostrar un indicador más claro al usuario:

```typescript
// whatsapp-status.component.ts
async checkWhatsAppStatus() {
  const status = await this.http.get(
    `http://localhost:3006/api/status/${this.companyId}`
  ).toPromise();

  if (status.session_exists_on_disk) {
    // Tiene credenciales válidas
    if (status.connected) {
      this.statusMessage = '🟢 WhatsApp activo';
    } else {
      this.statusMessage = '🟡 WhatsApp listo (se conectará cuando envíes mensajes)';
    }
  } else {
    // No tiene credenciales
    this.statusMessage = '🔴 Escanea el código QR';
  }
}
```

---

## 📊 Comportamiento Esperado

### **Timeline de una sesión típica:**

```
00:00 - Admin abre dashboard
  ↓
00:01 - Frontend llama /keep-alive
  ↓
00:05 - Sesión conectada (ve 🟢 "Connected")
  ↓
00:06 - Frontend sigue llamando /keep-alive cada 60 seg
  ↓
10:00 - Admin cierra dashboard
  ↓
15:00 - Sin actividad por 5 min → Sesión se desconecta automáticamente
  ↓
15:01 - 📱 Celular vuelve a recibir notificaciones push
  ↓
16:30 - Cliente hace reserva
  ↓
16:30 - Backend llama /send
  ↓
16:33 - API conecta on-demand (3 seg)
  ↓
16:33 - Mensaje enviado ✅
  ↓
16:35 - Sin actividad por 2 min → Sesión se desconecta
  ↓
16:36 - 📱 Celular recibe notificaciones push nuevamente
```

---

## 🔍 Endpoints Actualizados

### **POST /api/keep-alive/:clientId** (NUEVO)

Mantiene la sesión activa mientras el admin está en el panel.

**Request:**
```bash
curl -X POST http://localhost:3006/api/keep-alive/130
```

**Response:**
```json
{
  "success": true,
  "clientId": "130",
  "state": "connected",
  "message": "Session is active and will disconnect after 5 minutes of inactivity"
}
```

**Uso recomendado:**
- Llamar cada 30-60 segundos desde el frontend
- Solo cuando el admin está activamente usando el panel

---

### **POST /api/send/:clientId** (MODIFICADO)

Ahora conecta automáticamente si no está conectada.

**Comportamiento nuevo:**
1. Verifica si la sesión existe en disco
2. Si NO está conectada → conecta on-demand
3. Espera hasta 15 segundos por la conexión
4. Envía el mensaje
5. Programa desconexión en 2 minutos

**Response adicional en caso de error:**
```json
{
  "error": "Session 130 not found. Please scan QR code first."
}
```

---

### **POST /api/send-document/:clientId** (MODIFICADO)

Mismo comportamiento que `/send`.

---

### **GET /api/status/:clientId** (SIN CAMBIOS)

Sigue funcionando igual. Retorna:
```json
{
  "clientId": "130",
  "connected": false,  // ← Puede estar false aunque funcione
  "state": "disconnected",
  "session_exists_on_disk": true,  // ← Lo importante
  "auto_reconnecting": false
}
```

**Interpretación:**
- `session_exists_on_disk: true` → Todo OK, mensajes se enviarán
- `session_exists_on_disk: false` → Necesita escanear QR

---

## ⏱️ Tiempos de Inactividad

| Escenario | Timeout | Propósito |
|-----------|---------|-----------|
| **Envío de mensaje** | 2 minutos | Mensajes automáticos rápidos |
| **Admin en panel** | 5 minutos | Usuario activo tiene más tiempo |
| **Reconexión** | 15 segundos | Máximo tiempo de espera |

---

## 🧪 Testing

### **Test 1: Keep-Alive desde Frontend**

```typescript
// Simular admin en dashboard
const interval = setInterval(() => {
  fetch('http://localhost:3006/api/keep-alive/130', { method: 'POST' })
    .then(res => res.json())
    .then(data => console.log('Keep-alive:', data));
}, 60000);

// Después de 10 minutos, limpiar
setTimeout(() => clearInterval(interval), 600000);

// Esperar 5 minutos → sesión debe desconectarse
```

---

### **Test 2: Envío con Lazy Loading**

```bash
# 1. Verificar que está desconectada
curl http://localhost:3006/api/status/130
# Resultado: "connected": false

# 2. Enviar mensaje (debe conectar on-demand)
curl -X POST http://localhost:3006/api/send/130 \
  -H "Content-Type: application/json" \
  -d '{"to": "+51987654321", "message": "Test lazy loading"}'

# 3. Ver logs del servidor
docker-compose logs -f whatsapp-api
# Debe mostrar: "🔄 [130] Not connected, connecting on-demand for message..."

# 4. Mensaje debe llegar en ~5 segundos
```

---

### **Test 3: Verificar que Celular Recibe Notificaciones**

```bash
# 1. Asegurarse que la sesión está desconectada
curl http://localhost:3006/api/status/130
# "connected": false

# 2. Desde otro celular, enviar mensaje a ese WhatsApp
# Resultado: ✅ El celular DEBE sonar/vibrar (notificación push)

# 3. Conectar sesión manualmente
curl -X POST http://localhost:3006/api/keep-alive/130

# 4. Desde otro celular, enviar mensaje nuevamente
# Resultado: ❌ El celular NO debe sonar (sesión activa en "computadora")
```

---

## 📝 Checklist de Integración

### Backend (WhatsApp API) - ✅ Completado

- [x] Sistema de timers implementado
- [x] Lazy loading activado
- [x] Endpoint `/keep-alive` creado
- [x] `/send` y `/send-document` con conectar on-demand

### Frontend (Zunida API) - 🔄 Por Hacer

- [ ] Implementar keep-alive en dashboard component
- [ ] Agregar servicio de WhatsApp con método `keepAlive()`
- [ ] Actualizar UI para mostrar estado correcto
- [ ] Testing end-to-end

---

## 🚀 Deploy

### 1. Deploy del Backend (WhatsApp API)

```bash
# En el EC2
cd ~/projects/zunida-whatsapp-api-stable
git pull origin main
docker-compose up -d --build
docker-compose logs -f whatsapp-api
```

**Deberías ver:**
```
🚀 WhatsApp API Server running on port 3006
🔄 [LAZY LOADING] Sessions will connect automatically when needed
📱 Benefit: Phone receives notifications when sessions are inactive
```

### 2. Deploy del Frontend (Zunida API)

```bash
# En el EC2
cd ~/projects/zunida-api
# Agregar código de keep-alive
git pull origin main
# Rebuild si es necesario
```

---

## ⚠️ Importante

1. **NO todas las sesiones estarán "connected" siempre** - Esto es normal y esperado
2. **`session_exists_on_disk: true`** es lo que indica que todo funciona
3. **Mensajes automáticos siempre se enviarán** - Solo con 3-5 seg de delay
4. **Celular recibirá notificaciones** el 95% del tiempo

---

## 🆘 Troubleshooting

### Problema: "Session keeps disconnecting"

**Causa:** Keep-alive no se está llamando desde el frontend

**Solución:**
```bash
# Verificar que el frontend está llamando keep-alive
docker-compose logs -f whatsapp-api | grep "Keep-alive"
# Debe mostrar llamadas cada 60 segundos cuando admin está en panel
```

---

### Problema: "Messages take too long to send"

**Causa:** Normal con lazy loading (3-5 seg para conectar)

**Solución:**
- Para mensajes instantáneos, usar keep-alive antes de enviar
- O aceptar el delay (imperceptible para reminders/confirmaciones)

---

### Problema: "Phone still not receiving notifications"

**Causa:** Sesión sigue conectada

**Solución:**
```bash
# 1. Verificar estado real
curl http://localhost:3006/api/sessions

# 2. Si muestra "connected", desconectar manualmente
curl -X POST http://localhost:3006/api/disconnect \
  -H "Content-Type: application/json" \
  -d '{"session_id": "130"}'

# 3. Esperar 1 minuto y probar
```

---

**Fecha:** 2025-10-17  
**Versión:** 1.2.0 (Lazy Loading)  
**Autor:** ZUNIDA Development Team

