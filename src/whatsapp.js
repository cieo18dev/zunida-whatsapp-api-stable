import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

// Multi-session management
const sessions = new Map();
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

const logger = pino({ level: 'silent' });

/**
 * Session data structure
 */
class WhatsAppSession {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.sock = null;
    this.qrCodeData = null;
    this.connectionState = 'disconnected';
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.phoneNumber = null;
  }
}

/**
 * Get or create a session
 */
function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new WhatsAppSession(sessionId));
  }
  return sessions.get(sessionId);
}

/**
 * Get session directory path
 */
function getSessionPath(sessionId) {
  return path.join('sessions', sessionId);
}

/**
 * Ensure session directory exists
 */
function ensureSessionDir(sessionId) {
  const sessionPath = getSessionPath(sessionId);
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }
}

/**
 * Clean up a socket instance
 */
function cleanupSocket(session) {
  if (session.sock) {
    try {
      session.sock.ev.removeAllListeners('connection.update');
      session.sock.ev.removeAllListeners('creds.update');
      session.sock.ev.removeAllListeners('messages.upsert');
      session.sock.end(undefined);
    } catch (error) {
      console.log(`Error during socket cleanup for session ${session.sessionId}:`, error.message);
    }
    session.sock = null;
  }
}

/**
 * Calculate reconnection delay with exponential backoff
 */
function getReconnectDelay(attempts) {
  const delay = Math.min(RECONNECT_DELAY_MS * Math.pow(2, attempts), MAX_RECONNECT_DELAY_MS);
  return delay;
}

/**
 * Initialize and connect to WhatsApp for a specific session
 * @param {string} sessionId - Unique identifier for the session
 */
export async function connectWhatsApp(sessionId = 'default') {
  const session = getSession(sessionId);
  
  // Prevent multiple simultaneous connection attempts
  if (session.isReconnecting) {
    console.log(`⏳ [${sessionId}] Connection attempt already in progress, skipping...`);
    return session.sock;
  }

  // Check if max reconnect attempts reached
  if (session.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log(`❌ [${sessionId}] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached.`);
    session.connectionState = 'failed';
    session.isReconnecting = false;
    return null;
  }

  session.isReconnecting = true;
  
  try {
    // Clean up any existing socket
    cleanupSocket(session);
    
    // Ensure session directory exists
    ensureSessionDir(sessionId);

    const { state, saveCreds } = await useMultiFileAuthState(getSessionPath(sessionId));
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    console.log(`[${sessionId}] Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    session.sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: state,
      browser: ['WhatsApp API', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: undefined,
      keepAliveIntervalMs: 30000,
      emitOwnEvents: true,
      getMessage: async () => undefined
    });

    // Handle connection updates
    session.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`📱 [${sessionId}] QR Code received, converting to base64...`);
        session.qrCodeData = await QRCode.toDataURL(qr);
        session.connectionState = 'qr_ready';
        session.reconnectAttempts = 0; // Reset on QR generation
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`[${sessionId}] Connection closed. Status code: ${statusCode}, Reconnect: ${shouldReconnect}`);
        session.connectionState = 'disconnected';
        session.isReconnecting = false;
        
        if (shouldReconnect) {
          session.reconnectAttempts++;
          const delay = getReconnectDelay(session.reconnectAttempts);
          
          console.log(`⏱️  [${sessionId}] Attempting reconnection ${session.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);
          
          setTimeout(() => {
            connectWhatsApp(sessionId);
          }, delay);
        } else {
          console.log(`🚪 [${sessionId}] Logged out. Please scan QR code again.`);
          session.qrCodeData = null;
          session.reconnectAttempts = 0;
          cleanupSocket(session);
        }
      } else if (connection === 'open') {
        console.log(`✅ [${sessionId}] WhatsApp connection opened successfully!`);
        
        // Get phone number if available
        if (session.sock.user) {
          session.phoneNumber = session.sock.user.id.split(':')[0];
          console.log(`📱 [${sessionId}] Phone number: ${session.phoneNumber}`);
        }
        
        session.qrCodeData = null;
        session.connectionState = 'connected';
        session.isReconnecting = false;
        session.reconnectAttempts = 0; // Reset counter on successful connection
      } else if (connection === 'connecting') {
        console.log(`🔄 [${sessionId}] Connecting to WhatsApp...`);
        session.connectionState = 'connecting';
      }
    });

    // Save credentials whenever they update
    session.sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages (optional - for logging)
    session.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        for (const msg of messages) {
          if (!msg.key.fromMe && msg.message) {
            console.log(`📨 [${sessionId}] New message received:`, JSON.stringify(msg, null, 2));
          }
        }
      }
    });

    session.isReconnecting = false;
    return session.sock;
  } catch (error) {
    console.error(`❌ [${sessionId}] Error during WhatsApp connection:`, error.message);
    session.isReconnecting = false;
    session.connectionState = 'error';
    
    // Retry on error
    if (session.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      session.reconnectAttempts++;
      const delay = getReconnectDelay(session.reconnectAttempts);
      console.log(`⏱️  [${sessionId}] Retrying connection in ${delay}ms...`);
      
      setTimeout(() => {
        connectWhatsApp(sessionId);
      }, delay);
    }
    
    throw error;
  }
}

/**
 * Get the current QR code as base64 data URL for a session
 * @param {string} sessionId - Session identifier
 */
export function getQRCode(sessionId = 'default') {
  const session = sessions.get(sessionId);
  return session ? session.qrCodeData : null;
}

/**
 * Get the current connection state for a session
 * @param {string} sessionId - Session identifier
 */
export function getConnectionState(sessionId = 'default') {
  const session = sessions.get(sessionId);
  return session ? session.connectionState : 'disconnected';
}

/**
 * Reset reconnection counter for a session
 * @param {string} sessionId - Session identifier
 */
export function resetReconnectAttempts(sessionId = 'default') {
  const session = sessions.get(sessionId);
  if (session) {
    session.reconnectAttempts = 0;
    console.log(`🔄 [${sessionId}] Reconnection attempts counter reset`);
  }
}

/**
 * Get socket instance for a session
 * @param {string} sessionId - Session identifier
 */
export function getSocket(sessionId = 'default') {
  const session = sessions.get(sessionId);
  return session ? session.sock : null;
}

/**
 * Disconnect and clean up WhatsApp connection for a session
 * @param {string} sessionId - Session identifier
 */
export async function disconnectWhatsApp(sessionId = 'default') {
  console.log(`🔌 [${sessionId}] Disconnecting WhatsApp...`);
  const session = sessions.get(sessionId);
  
  if (session) {
    session.connectionState = 'disconnected';
    session.isReconnecting = false;
    session.reconnectAttempts = 0;
    cleanupSocket(session);
    session.qrCodeData = null;
  }
}

/**
 * Delete a session completely
 * @param {string} sessionId - Session identifier
 */
export async function deleteSession(sessionId) {
  if (sessionId === 'default') {
    throw new Error('Cannot delete default session');
  }
  
  // Disconnect first
  await disconnectWhatsApp(sessionId);
  
  // Remove from sessions map
  sessions.delete(sessionId);
  
  // Delete session files
  const sessionPath = getSessionPath(sessionId);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    console.log(`🗑️  [${sessionId}] Session files deleted`);
  }
}

/**
 * Get all active sessions
 */
export function getAllSessions() {
  const sessionList = [];
  sessions.forEach((session, sessionId) => {
    sessionList.push({
      session_id: sessionId,
      state: session.connectionState,
      phone_number: session.phoneNumber,
      has_qr: !!session.qrCodeData,
      reconnect_attempts: session.reconnectAttempts
    });
  });
  return sessionList;
}

/**
 * Send a message to a WhatsApp number from a specific session
 * @param {string} sessionId - Session identifier
 * @param {string} number - Phone number with country code (without + or -)
 * @param {string} message - Message text to send
 */
export async function sendMessage(sessionId = 'default', number, message) {
  const session = sessions.get(sessionId);
  
  if (!session || !session.sock) {
    throw new Error(`Session ${sessionId} not connected. Please call /connect first.`);
  }

  if (session.connectionState !== 'connected') {
    throw new Error(`Session ${sessionId} is not connected. Current state: ${session.connectionState}`);
  }

  try {
    // Wait a bit if socket was just created to ensure it's fully ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify if the number exists on WhatsApp
    const result = await session.sock.onWhatsApp(number);
    if (!result || result.length === 0 || !result[0].exists) {
      throw new Error(`Number ${number} is not on WhatsApp`);
    }
    
    // Send message using the verified JID
    const sentMessage = await session.sock.sendMessage(result[0].jid, { text: message });
    console.log(`✅ [${sessionId}] Message sent to ${number}:`, message);
    return sentMessage;
  } catch (error) {
    console.error(`❌ [${sessionId}] Error sending message:`, error.message);
    
    // If connection error, update state
    if (error.message.includes('Connection Closed') || error.message.includes('Socket Closed')) {
      session.connectionState = 'disconnected';
    }
    
    throw new Error(`Failed to send message: ${error.message}`);
  }
}

/**
 * Send a message with a document (PDF) to a WhatsApp number from a specific session
 * @param {string} sessionId - Session identifier
 * @param {string} number - Phone number with country code (without + or -)
 * @param {string} message - Optional caption/message text
 * @param {string} documentData - Base64 data string (data:application/pdf;base64,...)
 * @param {string} filename - Filename for the document
 */
export async function sendMessageWithDocument(sessionId = 'default', number, message, documentData, filename) {
  const session = sessions.get(sessionId);
  
  if (!session || !session.sock) {
    throw new Error(`Session ${sessionId} not connected. Please call /connect first.`);
  }

  if (session.connectionState !== 'connected') {
    throw new Error(`Session ${sessionId} is not connected. Current state: ${session.connectionState}`);
  }

  try {
    // Wait a bit if socket was just created to ensure it's fully ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify if the number exists on WhatsApp
    const result = await session.sock.onWhatsApp(number);
    if (!result || result.length === 0 || !result[0].exists) {
      throw new Error(`Number ${number} is not on WhatsApp`);
    }

    // Process base64 data
    if (!documentData.startsWith('data:')) {
      throw new Error('Invalid documentData format. Must be base64 data (data:application/pdf;base64,...)');
    }

    console.log(`[📥] Processing base64 PDF data for ${number}`);
    const base64Data = documentData.split(',')[1];
    const pdfBuffer = Buffer.from(base64Data, 'base64');
    console.log(`[✅] PDF processed from base64, size: ${pdfBuffer.length} bytes`);

    // Send document with buffer
    const documentMessage = {
      document: pdfBuffer,
      mimetype: 'application/pdf',
      fileName: filename,
      caption: message || `Documento: ${filename}`
    };

    const sentMessage = await session.sock.sendMessage(result[0].jid, documentMessage);
    console.log(`✅ [${sessionId}] Document sent to ${number}: ${filename}`);
    return sentMessage;
  } catch (error) {
    console.error(`❌ [${sessionId}] Error sending document:`, error.message);
    
    // If connection error, update state
    if (error.message.includes('Connection Closed') || error.message.includes('Socket Closed')) {
      session.connectionState = 'disconnected';
    }
    
    throw new Error(`Failed to send document: ${error.message}`);
  }
}

