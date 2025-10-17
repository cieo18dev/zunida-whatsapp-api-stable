import express from 'express';
import QRCode from 'qrcode';
import { 
  connectWhatsApp, 
  getQRCode, 
  sendMessage,
  sendMessageWithDocument,
  getConnectionState,
  disconnectWhatsApp,
  getSocket,
  deleteSession,
  getAllSessions,
  sessionExistsOnDisk
} from './whatsapp.js';

const router = express.Router();

/**
 * @swagger
 * /api/connect/{clientId}:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Connect WhatsApp client
 *     description: Initiates a WhatsApp connection for the specified client. If no previous session exists, returns a QR code to scan with WhatsApp.
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the client/session
 *         example: "13"
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "✅ Client 13 is already connected."
 *                 - type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                       example: false
 *                     qr:
 *                       type: string
 *                       description: Base64-encoded QR code image
 *                       example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *       408:
 *         description: QR generation timeout
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "QR generation timeout. Please try again."
 *                 connected:
 *                   type: boolean
 *                   example: false
 *       500:
 *         description: Failed to connect
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Failed to connect"
 */
router.get('/connect/:clientId', async (req, res) => {
  const clientId = req.params.clientId;

  try {
    const state = getConnectionState(clientId);
    const sock = getSocket(clientId);

    // Check if already connecting or connected
    if (state === 'connected' && sock) {
      res.json({
        connected: true,
        message: `✅ Client ${clientId} is already connected.`,
      });
      return;
    }

    if (state === 'connecting') {
      res.json({
        connected: true,
        message: `🟡 Client ${clientId} is already connecting.`,
      });
      return;
    }

    // Check if QR is already available
    const existingQR = getQRCode(clientId);
    if (existingQR) {
      res.json({
        connected: false,
        qr: existingQR
      });
      return;
    }

    // No session exists, need to create new connection and generate QR
    console.log(`[🔄] No session found for client ${clientId}, initiating new connection...`);
    
    let qrSent = false;
    
    // Start connection
    connectWhatsApp(clientId).catch(err => {
      console.error(`[❌] Error during connection for ${clientId}:`, err);
    });

    // Wait for QR code generation with polling
    const startTime = Date.now();
    const timeout = 30000; // 30 seconds
    const pollInterval = 500; // Check every 500ms

    const checkQR = setInterval(() => {
      const qr = getQRCode(clientId);
      const currentState = getConnectionState(clientId);

      if (qr && !qrSent && !res.headersSent) {
        clearInterval(checkQR);
        qrSent = true;
        console.log(`[📱] QR code generated for client ${clientId}`);
        res.json({ connected: false, qr: qr });
      } else if (currentState === 'connected' && !res.headersSent) {
        clearInterval(checkQR);
        res.json({
          connected: true,
          message: `✅ Client ${clientId} connected successfully.`
        });
      } else if (Date.now() - startTime > timeout && !res.headersSent) {
        clearInterval(checkQR);
        console.warn(`[⏰] QR generation timeout for client ${clientId}`);
        res.status(408).json({ 
          error: 'QR generation timeout. Please try again.',
          connected: false 
        });
      }
    }, pollInterval);

  } catch (err) {
    console.error(`[❌] Error in connect endpoint for client ${clientId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: '❌ Failed to connect' });
    }
  }
});

/**
 * @swagger
 * /api/send/{clientId}:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Send WhatsApp message
 *     description: Sends a WhatsApp message from the specified client to the destination phone number.
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the client/session
 *         example: "13"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - message
 *             properties:
 *               to:
 *                 type: string
 *                 description: Phone number with country code (without + or -)
 *                 example: "+51987654321"
 *               message:
 *                 type: string
 *                 description: Message text to send
 *                 example: "Hello! This is a test message."
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing required parameters or invalid format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Missing "to" or "message"'
 *       500:
 *         description: Failed to send message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to send message"
 */
router.post('/send/:clientId', async (req, res) => {
  const { to, message } = req.body;
  const clientId = req.params.clientId;

  if (!to || !message) {
    res.status(400).json({ error: 'Missing "to" or "message"' });
    return;
  }

  if (!/^\+?\d{10,15}$/.test(to)) {
    res.status(400).json({ error: 'Invalid phone number format' });
    return;
  }

  try {
    await sendMessage(clientId, to, message);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

/**
 * @swagger
 * /api/send-document/{clientId}:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Send WhatsApp message with document
 *     description: Sends a WhatsApp message with a PDF document attachment from the specified client to the destination phone number.
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the client/session
 *         example: "13"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - documentData
 *               - filename
 *             properties:
 *               to:
 *                 type: string
 *                 description: Phone number with country code
 *                 example: "+51987654321"
 *               message:
 *                 type: string
 *                 description: Optional caption/message text
 *                 example: "Aquí tienes tu ticket de reserva"
 *               documentData:
 *                 type: string
 *                 description: Base64 encoded PDF data (data:application/pdf;base64,...)
 *                 example: "data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMy..."
 *               filename:
 *                 type: string
 *                 description: Filename for the document
 *                 example: "ticket_reserva_123.pdf"
 *     responses:
 *       200:
 *         description: Message with document sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing required parameters or invalid format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Missing "to", "documentData" or "filename"'
 *       500:
 *         description: Failed to send document
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to send document"
 */
router.post('/send-document/:clientId', async (req, res) => {
  const { to, message, documentData, filename } = req.body;
  const clientId = req.params.clientId;

  if (!to || !documentData || !filename) {
    res.status(400).json({ error: 'Missing "to", "documentData" or "filename"' });
    return;
  }

  if (!/^\+?\d{10,15}$/.test(to)) {
    res.status(400).json({ error: 'Invalid phone number format' });
    return;
  }

  // Validate format (base64 data)
  if (!documentData.startsWith('data:')) {
    res.status(400).json({ error: 'Invalid documentData format (must be base64 data)' });
    return;
  }

  try {
    await sendMessageWithDocument(clientId, to, message || '', documentData, filename);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

/**
 * @swagger
 * /api/status/{clientId}:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Check connection status
 *     description: Checks if an active session exists for the specified client. If session exists on disk but is disconnected, it will attempt to reconnect.
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the client/session
 *         example: "13"
 *     responses:
 *       200:
 *         description: Connection status queried successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientId:
 *                   type: string
 *                   example: "13"
 *                 connected:
 *                   type: boolean
 *                   example: true
 *                 state:
 *                   type: string
 *                   example: "connected"
 *                 session_exists_on_disk:
 *                   type: boolean
 *                   example: true
 *                 auto_reconnecting:
 *                   type: boolean
 *                   example: false
 *       500:
 *         description: Error checking status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientId:
 *                   type: string
 *                   example: "13"
 *                 connected:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Connection error"
 */
router.get('/status/:clientId', async (req, res) => {
  const { clientId } = req.params;

  try {
    const state = getConnectionState(clientId);
    const connected = state === 'connected';
    const existsOnDisk = sessionExistsOnDisk(clientId);
    
    // If session exists on disk but is disconnected, try to auto-reconnect
    let autoReconnecting = false;
    if (existsOnDisk && !connected && state === 'disconnected') {
      console.log(`🔄 [${clientId}] Session exists on disk but disconnected, attempting auto-reconnect...`);
      autoReconnecting = true;
      
      // Trigger reconnection in background
      connectWhatsApp(clientId).catch(err => {
        console.error(`❌ [${clientId}] Auto-reconnect failed:`, err.message);
      });
    }
    
    res.json({ 
      clientId, 
      connected,
      state,
      session_exists_on_disk: existsOnDisk,
      auto_reconnecting: autoReconnecting
    });
  } catch (err) {
    res.status(500).json({ clientId, connected: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/delete/{clientId}:
 *   delete:
 *     tags: [WhatsApp]
 *     summary: Delete client session
 *     description: Completely deletes the client session, including all credentials and authentication data.
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the client/session
 *         example: "session1"
 *     responses:
 *       204:
 *         description: Session deleted successfully
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "No session found for client session1"
 *       500:
 *         description: Failed to delete session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to delete session"
 *                 details:
 *                   type: string
 *                   example: "Error details"
 */
router.delete('/delete/:clientId', async (req, res) => {
  const clientId = req.params.clientId;

  try {
    await deleteSession(clientId);
    res.status(204).send(); // No Content
  } catch (err) {
    console.error(`[❌] Failed to delete session ${clientId}:`, err);
    
    if (err.message.includes('Cannot delete')) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Failed to delete session', details: err.message });
    }
  }
});

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     tags: [WhatsApp]
 *     summary: List all sessions
 *     description: Retrieves a list of all active WhatsApp sessions with their current status.
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       session_id:
 *                         type: string
 *                         example: "default"
 *                       state:
 *                         type: string
 *                         enum: [disconnected, connecting, qr_ready, connected]
 *                         example: "connected"
 *                       phone_number:
 *                         type: string
 *                         example: "573001234567"
 *                       has_qr:
 *                         type: boolean
 *                         example: false
 *                       reconnect_attempts:
 *                         type: number
 *                         example: 0
 *             examples:
 *               multipleSessions:
 *                 summary: Multiple active sessions
 *                 value:
 *                   sessions:
 *                     - session_id: "default"
 *                       state: "connected"
 *                       phone_number: "573001234567"
 *                       has_qr: false
 *                       reconnect_attempts: 0
 *                     - session_id: "billing-client"
 *                       state: "connecting"
 *                       phone_number: null
 *                       has_qr: true
 *                       reconnect_attempts: 1
 *               noSessions:
 *                 summary: No active sessions
 *                 value:
 *                   sessions: []
 *       500:
 *         description: Failed to retrieve sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to retrieve sessions"
 *                 details:
 *                   type: string
 *                   example: "Error details"
 */
router.get('/sessions', (req, res) => {
  try {
    const sessions = getAllSessions();
    res.json({ sessions });
  } catch (err) {
    console.error('[❌] Failed to retrieve sessions:', err);
    res.status(500).json({ 
      error: 'Failed to retrieve sessions', 
      details: err.message 
    });
  }
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Health Check
 *     description: Service health check endpoint.
 *     responses:
 *       200:
 *         description: Service running correctly
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "OK"
 */
router.get('/health', (req, res) => {
  res.status(200).send('OK');
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: An error occurred
 *         details:
 *           type: string
 *           example: Error details
 */

export default router;
