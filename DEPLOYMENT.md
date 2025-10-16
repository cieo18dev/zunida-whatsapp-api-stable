# 🚀 Deployment Guide - WhatsApp API en Docker EC2

## 📋 Tabla de Contenidos
- [Arquitectura](#arquitectura)
- [Problema de Sesiones](#problema-de-sesiones)
- [Soluciones](#soluciones)
- [Deployment en EC2](#deployment-en-ec2)
- [Comunicación con Otros MS](#comunicación-con-otros-ms)

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────┐
│                   AWS EC2                        │
│                                                  │
│  ┌───────────────────────────────────────────┐ │
│  │      Docker Container                      │ │
│  │                                            │ │
│  │  ┌──────────────────────────────────┐    │ │
│  │  │   WhatsApp API (Port 3002)       │    │ │
│  │  │   - Express Server               │    │ │
│  │  │   - Baileys                      │    │ │
│  │  │   - Endpoints REST               │    │ │
│  │  └──────────────────────────────────┘    │ │
│  │           ↓                               │ │
│  │  ┌──────────────────────────────────┐    │ │
│  │  │   Volumen Montado                │    │ │
│  │  │   /app/sessions/                 │    │ │
│  │  │   - Archivos de sesión           │    │ │
│  │  │   - creds.json, pre-keys, etc    │    │ │
│  │  └──────────────────────────────────┘    │ │
│  └───────────────────────────────────────────┘ │
│                 ↕️ HTTP/REST                    │
│  ┌───────────────────────────────────────────┐ │
│  │     Otros Microservicios                  │ │
│  │     (Billing, Reservations, etc)          │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## ⚠️ Problema CRÍTICO: Archivos de Sesión

### El Problema

Los archivos de sesión de WhatsApp se guardan en:
```
sessions/
├── client1/
│   ├── creds.json          # Credenciales de autenticación
│   ├── pre-key-*.json      # Keys de cifrado
│   ├── session-*.json      # Sesiones activas
│   └── ...
├── client2/
└── ...
```

**¿Qué pasa en Docker?**

❌ **Sin volúmenes persistentes:**
- El contenedor se reinicia → **SE PIERDEN TODAS LAS SESIONES**
- Necesitas escanear QR de nuevo para CADA cliente
- Usuarios tienen que reconectar sus WhatsApps

✅ **Con volúmenes persistentes:**
- Sesiones se mantienen entre reinicios
- No necesitas re-escanear QR
- Todo funciona como esperado

---

## 🔧 Soluciones

### Opción 1: **Volumen Local EC2** (Recomendado para 1 instancia)

```yaml
# docker-compose.yml
volumes:
  - ./sessions:/app/sessions
```

**Ventajas:**
- ✅ Simple
- ✅ Rápido
- ✅ Sesiones persisten

**Desventajas:**
- ❌ Solo funciona en 1 EC2
- ❌ No escalable horizontalmente
- ❌ Si EC2 muere, pierdes sesiones

---

### Opción 2: **EFS (Elastic File System)** (Recomendado para múltiples instancias)

```bash
# En EC2, montar EFS
sudo mount -t nfs4 -o nfsvers=4.1 \
  fs-12345678.efs.us-east-1.amazonaws.com:/ \
  /mnt/whatsapp-sessions
```

```yaml
# docker-compose.yml
volumes:
  - /mnt/whatsapp-sessions:/app/sessions
```

**Ventajas:**
- ✅ Sistema de archivos compartido
- ✅ Múltiples EC2 acceden al mismo almacenamiento
- ✅ Escalable horizontalmente
- ✅ Backup automático

**Desventajas:**
- 💰 Costo adicional (~$0.30/GB/mes)
- ⚙️ Configuración más compleja

**Arquitectura con EFS:**
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   EC2 #1    │    │   EC2 #2    │    │   EC2 #3    │
│  Container  │    │  Container  │    │  Container  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                   │
       └──────────────────┼───────────────────┘
                          │
                    ┌─────▼─────┐
                    │    EFS    │
                    │ (Sessions)│
                    └───────────┘
```

---

### Opción 3: **S3** (Mejor opción, pero dijiste que no 😅)

**Por qué S3 es ideal:**
- ✅ Altamente disponible
- ✅ Durabilidad 99.999999999%
- ✅ Escalable infinitamente
- ✅ Backup automático
- ✅ Versionado de archivos
- 💰 Muy barato (~$0.023/GB/mes)

Pero entiendo que no quieres usar S3, así que descartamos esta opción.

---

### Opción 4: **EBS Volume** (Volumen persistente)

```bash
# En EC2, crear y montar EBS volume
sudo mkfs -t ext4 /dev/xvdf
sudo mount /dev/xvdf /mnt/whatsapp-sessions
```

```yaml
volumes:
  - /mnt/whatsapp-sessions:/app/sessions
```

**Ventajas:**
- ✅ Persistente
- ✅ Rápido (SSD)
- ✅ Backup mediante snapshots

**Desventajas:**
- ❌ Solo 1 EC2 a la vez
- ❌ No compartible entre instancias

---

## 🚀 Deployment en EC2

### 1. Setup EC2

```bash
# Conectar a EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Instalar Docker
sudo yum update -y
sudo yum install docker -y
sudo service docker start
sudo usermod -a -G docker ec2-user

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Deploy App

```bash
# Clonar repo
git clone your-repo
cd auth_info_baileys

# Crear directorio para sesiones
mkdir -p sessions

# Build y Run
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### 3. Verificar

```bash
# Health check
curl http://localhost:3002/api/health
# Debe responder: OK

# Ver swagger
curl http://your-ec2-ip:3002/api-docs
```

---

## 🌐 Comunicación con Otros Microservicios

### Arquitectura de Microservicios

```
┌─────────────────┐         ┌─────────────────┐
│   Billing MS    │         │ Reservation MS  │
│   (Port 4000)   │         │   (Port 5000)   │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │      HTTP/REST API        │
         └───────────┬───────────────┘
                     │
            ┌────────▼─────────┐
            │  WhatsApp API    │
            │   (Port 3002)    │
            └──────────────────┘
```

### Ejemplo: Billing MS enviando mensaje

**Desde Billing Microservice:**

```javascript
// billing-ms/src/services/whatsapp.service.js
import axios from 'axios';

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'http://whatsapp-api:3002';

export async function sendWhatsAppMessage(clientId, phoneNumber, message) {
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/api/send/${clientId}`,
      {
        to: phoneNumber,
        message: message
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

export async function sendWhatsAppDocument(clientId, phoneNumber, documentData, filename) {
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/api/send-document/${clientId}`,
      {
        to: phoneNumber,
        message: 'Aquí está tu boleta',
        documentData: documentData,
        filename: filename
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp document:', error);
    throw error;
  }
}

// Uso en Billing MS
async function sendInvoice(orderId) {
  const order = await getOrder(orderId);
  const pdfBase64 = await generateInvoicePDF(order);
  
  await sendWhatsAppDocument(
    'default', // clientId
    order.customerPhone,
    pdfBase64,
    `invoice-${orderId}.pdf`
  );
}
```

### Docker Compose con Múltiples MS

```yaml
version: '3.8'

services:
  whatsapp-api:
    build: ./whatsapp-api
    ports:
      - "3002:3002"
    volumes:
      - whatsapp-sessions:/app/sessions
    networks:
      - zunida-network

  billing-ms:
    build: ./billing-ms
    ports:
      - "4000:4000"
    environment:
      - WHATSAPP_API_URL=http://whatsapp-api:3002
    depends_on:
      - whatsapp-api
    networks:
      - zunida-network

  reservation-ms:
    build: ./reservation-ms
    ports:
      - "5000:5000"
    environment:
      - WHATSAPP_API_URL=http://whatsapp-api:3002
    depends_on:
      - whatsapp-api
    networks:
      - zunida-network

networks:
  zunida-network:
    driver: bridge

volumes:
  whatsapp-sessions:
```

---

## 📊 Recomendaciones por Escenario

### Escenario 1: **Startup / MVP** (1 EC2)
```
✅ Usar: Volumen local o EBS
💰 Costo: ~$10-30/mes
🔧 Complejidad: Baja
```

### Escenario 2: **Producción** (2-3 EC2 con Load Balancer)
```
✅ Usar: EFS
💰 Costo: ~$50-100/mes
🔧 Complejidad: Media
⚠️ PROBLEMA: Baileys no está diseñado para múltiples instancias
           compartiendo sesiones. Puede haber race conditions.
```

**IMPORTANTE para múltiples instancias:**
Si usas Load Balancer, necesitas **sticky sessions** (session affinity) para que cada cliente siempre vaya a la misma instancia.

### Escenario 3: **Enterprise** (Altamente disponible)
```
✅ Usar: S3 + Redis (como zunida-whatsapp-ms)
💰 Costo: ~$100-200/mes
🔧 Complejidad: Alta
✅ Ventajas: Escalable, HA, sin sticky sessions
```

---

## 🔒 Security Groups en EC2

```bash
# Abrir puerto 3002 solo para tus otros MS
Inbound Rules:
- Port 3002: Solo desde Security Group de tus MS internos
- Port 22: Solo desde tu IP (para SSH)

# NO expongas 3002 públicamente
```

---

## 📈 Monitoring

```bash
# Ver logs en tiempo real
docker-compose logs -f whatsapp-api

# Ver uso de recursos
docker stats

# Health check automático
curl http://localhost:3002/api/health
```

---

## 🎯 Respuesta Final a tus Preguntas

### ✅ **¿Puedes correr en Docker EC2?**
**SÍ**, funciona perfectamente.

### ✅ **¿Otros MS pueden comunicarse?**
**SÍ**, mediante HTTP/REST API. Usa `http://whatsapp-api:3002/api/...`

### ⚠️ **¿Qué pasa con los archivos de sesión?**

**Opciones:**

1. **Para 1 EC2 (Simple):**
   - Usa volumen local montado
   - `- ./sessions:/app/sessions`
   - ✅ Sesiones persisten entre reinicios

2. **Para múltiples EC2 (Complejo):**
   - Usa EFS (sistema de archivos compartido)
   - Configura sticky sessions en Load Balancer
   - ⚠️ Baileys puede tener problemas con concurrencia

3. **Para producción enterprise:**
   - Usa S3 + Redis (sé que dijiste que no, pero es la mejor opción)
   - Implementa manejo de locks para evitar conflictos
   - ✅ Totalmente escalable y confiable

---

## 🚨 ADVERTENCIA IMPORTANTE

Si el contenedor Docker se reinicia **SIN volúmenes persistentes:**
- ❌ **TODAS las sesiones se pierden**
- ❌ Cada cliente necesita escanear QR de nuevo
- ❌ Usuarios pierden conexión con WhatsApp

**SIEMPRE usa volúmenes persistentes en producción.**

---

## 📚 Recursos Adicionales

- [Docker Volumes](https://docs.docker.com/storage/volumes/)
- [AWS EFS](https://aws.amazon.com/efs/)
- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)

