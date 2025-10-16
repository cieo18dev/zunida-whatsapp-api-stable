/**
 * Ejemplo de cómo otros microservicios pueden comunicarse
 * con el WhatsApp API
 * 
 * Este archivo muestra cómo usar el API desde:
 * - Billing MS
 * - Reservation MS
 * - Cualquier otro servicio
 */

// ============================================
// Opción 1: Usando fetch (Node 18+)
// ============================================

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'http://localhost:3006';

// Conectar cliente y obtener QR
async function connectWhatsApp(clientId) {
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/api/connect/${clientId}`);
    const data = await response.json();
    
    if (data.qr) {
      console.log('📱 Escanea este QR code:');
      console.log(data.qr);
      // Puedes mostrar el QR en tu frontend
      return { needsQR: true, qr: data.qr };
    } else if (data.connected) {
      console.log('✅ Cliente ya conectado');
      return { needsQR: false, message: data.message };
    }
  } catch (error) {
    console.error('Error conectando:', error);
    throw error;
  }
}

// Enviar mensaje de texto
async function sendMessage(clientId, phoneNumber, message) {
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/api/send/${clientId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phoneNumber,
        message: message,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    const data = await response.json();
    console.log('✅ Mensaje enviado exitosamente');
    return data;
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error);
    throw error;
  }
}

// Enviar documento PDF
async function sendDocument(clientId, phoneNumber, documentBase64, filename, caption) {
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/api/send-document/${clientId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phoneNumber,
        message: caption,
        documentData: documentBase64, // data:application/pdf;base64,...
        filename: filename,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send document');
    }

    const data = await response.json();
    console.log('✅ Documento enviado exitosamente');
    return data;
  } catch (error) {
    console.error('❌ Error enviando documento:', error);
    throw error;
  }
}

// Verificar estado de conexión
async function checkStatus(clientId) {
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/api/status/${clientId}`);
    const data = await response.json();
    
    console.log(`Estado de ${clientId}:`, data.connected ? '✅ Conectado' : '❌ Desconectado');
    return data;
  } catch (error) {
    console.error('Error verificando estado:', error);
    throw error;
  }
}

// ============================================
// EJEMPLO DE USO: Billing Microservice
// ============================================

class BillingService {
  constructor(whatsappApiUrl = 'http://localhost:3006') {
    this.whatsappApiUrl = whatsappApiUrl;
    this.defaultClientId = 'billing-client';
  }

  // Enviar factura por WhatsApp
  async sendInvoice(customerPhone, invoiceId, pdfBase64) {
    console.log(`📤 Enviando factura ${invoiceId} a ${customerPhone}`);

    // 1. Verificar que el cliente está conectado
    const status = await this.checkConnection();
    if (!status.connected) {
      throw new Error('WhatsApp no está conectado. Escanea el QR primero.');
    }

    // 2. Enviar mensaje de texto
    await this.sendMessage(
      customerPhone,
      `¡Hola! Te enviamos tu factura #${invoiceId}. Gracias por tu compra.`
    );

    // 3. Enviar documento PDF
    await this.sendDocument(
      customerPhone,
      pdfBase64,
      `Factura-${invoiceId}.pdf`,
      'Aquí está tu factura en PDF'
    );

    console.log(`✅ Factura ${invoiceId} enviada exitosamente`);
  }

  // Enviar recordatorio de pago
  async sendPaymentReminder(customerPhone, invoiceId, amount) {
    const message = `
🔔 Recordatorio de Pago

Factura: #${invoiceId}
Monto: $${amount}

Por favor realiza tu pago a la brevedad posible.

Gracias por tu preferencia.
    `.trim();

    return this.sendMessage(customerPhone, message);
  }

  // Métodos auxiliares
  async sendMessage(phone, message) {
    return sendMessage(this.defaultClientId, phone, message);
  }

  async sendDocument(phone, base64, filename, caption) {
    return sendDocument(this.defaultClientId, phone, base64, filename, caption);
  }

  async checkConnection() {
    return checkStatus(this.defaultClientId);
  }
}

// ============================================
// EJEMPLO DE USO: Reservation Microservice
// ============================================

class ReservationService {
  constructor(whatsappApiUrl = 'http://localhost:3006') {
    this.whatsappApiUrl = whatsappApiUrl;
    this.defaultClientId = 'reservation-client';
  }

  // Enviar confirmación de reserva
  async sendReservationConfirmation(customerPhone, reservationData) {
    const message = `
✅ Reserva Confirmada

ID: ${reservationData.id}
Fecha: ${reservationData.date}
Hora: ${reservationData.time}
Personas: ${reservationData.guests}

Nos vemos pronto!
    `.trim();

    return sendMessage(this.defaultClientId, customerPhone, message);
  }

  // Enviar ticket de reserva
  async sendReservationTicket(customerPhone, reservationId, ticketPdfBase64) {
    // 1. Mensaje de texto
    await sendMessage(
      this.defaultClientId,
      customerPhone,
      `¡Tu reserva está confirmada! Te enviamos tu ticket.`
    );

    // 2. Documento PDF
    await sendDocument(
      this.defaultClientId,
      customerPhone,
      ticketPdfBase64,
      `Ticket-Reserva-${reservationId}.pdf`,
      'Aquí está tu ticket de reserva'
    );

    console.log(`✅ Ticket enviado a ${customerPhone}`);
  }

  // Enviar recordatorio de reserva (24 horas antes)
  async sendReservationReminder(customerPhone, reservationData) {
    const message = `
⏰ Recordatorio de Reserva

Mañana a las ${reservationData.time}

Mesa reservada para ${reservationData.guests} personas.

Te esperamos!
    `.trim();

    return sendMessage(this.defaultClientId, customerPhone, message);
  }
}

// ============================================
// EJEMPLO DE USO
// ============================================

async function main() {
  // Ejemplo Billing
  const billing = new BillingService('http://whatsapp-api:3002');
  
  // Verificar conexión
  const status = await billing.checkConnection();
  if (!status.connected) {
    console.log('⚠️  WhatsApp no conectado. Conectando...');
    await connectWhatsApp('billing-client');
  }

  // Enviar factura
  const pdfBase64 = 'data:application/pdf;base64,JVBERi0xLjQK...'; // Tu PDF en base64
  await billing.sendInvoice('+51987654321', 'INV-001', pdfBase64);

  // Enviar recordatorio
  await billing.sendPaymentReminder('+51987654321', 'INV-001', 150.00);

  // ========================================

  // Ejemplo Reservation
  const reservation = new ReservationService('http://whatsapp-api:3002');

  await reservation.sendReservationConfirmation('+51987654321', {
    id: 'RES-123',
    date: '2025-10-20',
    time: '19:00',
    guests: 4,
  });

  const ticketPdf = 'data:application/pdf;base64,JVBERi0xLjQK...';
  await reservation.sendReservationTicket('+51987654321', 'RES-123', ticketPdf);
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

// ============================================
// EXPORTAR PARA USAR EN OTROS SERVICIOS
// ============================================

export {
  connectWhatsApp,
  sendMessage,
  sendDocument,
  checkStatus,
  BillingService,
  ReservationService,
};

