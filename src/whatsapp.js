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
const disconnectTimers = new Map(); // Timers for auto-disconnect
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

    // Handle connection updates - wrapped in try-catch to prevent server crashes
    session.sock.ev.on('connection.update', async (update) => {
      try {
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
              connectWhatsApp(sessionId).catch(err => {
                console.error(`❌ [${sessionId}] Reconnection failed:`, err.message);
              });
            }, delay);
          } else {
            // Logged out (401) - Clean up corrupted session files
            console.log(`🚪 [${sessionId}] Logged out (401). Cleaning up session files...`);
            
            session.qrCodeData = null;
            session.reconnectAttempts = 0;
            cleanupSocket(session);
            
            // Delete session files to force fresh QR on next connect
            const sessionPath = getSessionPath(sessionId);
            if (fs.existsSync(sessionPath)) {
              try {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log(`🗑️  [${sessionId}] Corrupted session files deleted. Client needs to scan QR again.`);
              } catch (err) {
                console.error(`❌ [${sessionId}] Failed to delete session files:`, err.message);
              }
            }
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
      } catch (error) {
        console.error(`❌ [${sessionId}] Error in connection.update handler:`, error.message);
        console.error('Stack:', error.stack);
      }
    });

    // Save credentials whenever they update
    session.sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (error) {
        console.error(`❌ [${sessionId}] Error saving credentials:`, error.message);
      }
    });

    // Handle incoming messages (optional - for logging)
    session.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        if (type === 'notify') {
          for (const msg of messages) {
            if (!msg.key.fromMe && msg.message) {
              console.log(`📨 [${sessionId}] New message received:`, JSON.stringify(msg, null, 2));
            }
          }
        }
      } catch (error) {
        console.error(`❌ [${sessionId}] Error handling message:`, error.message);
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
  
  // Cancel any scheduled disconnect
  cancelDisconnectTimer(sessionId);
  
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
 * Check if session folder exists on disk AND is properly authenticated
 */
export function sessionExistsOnDisk(sessionId) {
  const sessionPath = getSessionPath(sessionId);
  const credsPath = path.join(sessionPath, 'creds.json');
  
  // Check if creds.json exists
  if (!fs.existsSync(credsPath)) {
    return false;
  }
  
  try {
    // Read creds.json to verify it's a real authenticated session
    const credsContent = fs.readFileSync(credsPath, 'utf-8');
    const creds = JSON.parse(credsContent);
    
    // A properly authenticated session must have these fields
    // If it only has basic fields, it means QR was never scanned
    const hasRequiredFields = creds.me && creds.me.id;
    
    if (!hasRequiredFields) {
      console.log(`⚠️  [${sessionId}] Session folder exists but QR was never scanned (no me.id)`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ [${sessionId}] Error reading creds.json:`, error.message);
    return false;
  }
}

/**
 * Cancel scheduled disconnect for a session
 */
function cancelDisconnectTimer(sessionId) {
  if (disconnectTimers.has(sessionId)) {
    clearTimeout(disconnectTimers.get(sessionId));
    disconnectTimers.delete(sessionId);
    console.log(`⏱️  [${sessionId}] Disconnect timer cancelled`);
  }
}

/**
 * Schedule automatic disconnect after inactivity
 * @param {string} sessionId - Session identifier
 * @param {number} minutes - Minutes of inactivity before disconnect
 */
export function scheduleDisconnect(sessionId, minutes = 2) {
  // Cancel existing timer
  cancelDisconnectTimer(sessionId);
  
  const delayMs = minutes * 60 * 1000;
  
  const timer = setTimeout(async () => {
    console.log(`⏰ [${sessionId}] Inactivity timeout (${minutes} min), disconnecting...`);
    await disconnectWhatsApp(sessionId);
    disconnectTimers.delete(sessionId);
  }, delayMs);
  
  disconnectTimers.set(sessionId, timer);
  console.log(`⏱️  [${sessionId}] Scheduled disconnect in ${minutes} minute(s)`);
}

/**
 * Mark session activity and reset disconnect timer
 * @param {string} sessionId - Session identifier
 * @param {number} minutes - Minutes before auto-disconnect
 */
export function markSessionActivity(sessionId, minutes = 2) {
  console.log(`📌 [${sessionId}] Activity detected, resetting timer`);
  scheduleDisconnect(sessionId, minutes);
}

/**
 * Wait for session to connect
 * @param {string} sessionId - Session identifier
 * @param {number} timeoutMs - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} - True if connected, false if timeout
 */
export async function waitForConnection(sessionId, timeoutMs = 15000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const state = getConnectionState(sessionId);
    
    if (state === 'connected') {
      return true;
    }
    
    if (state === 'failed' || state === 'error') {
      throw new Error(`Connection failed for session ${sessionId}`);
    }
    
    // Check every 500ms
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  throw new Error(`Connection timeout for session ${sessionId} after ${timeoutMs}ms`);
}

/**
 * Auto-restore all sessions from disk on startup
 */
export async function restoreAllSessions() {
  console.log('🔄 [STARTUP] Restoring sessions from disk...');
  
  const sessionsDir = 'sessions';
  
  // Ensure sessions directory exists
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
    console.log('✅ [STARTUP] Sessions directory created');
    return;
  }
  
  // Read all session folders
  const folders = fs.readdirSync(sessionsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  if (folders.length === 0) {
    console.log('ℹ️  [STARTUP] No existing sessions found');
    return;
  }
  
  console.log(`📂 [STARTUP] Found ${folders.length} session(s): ${folders.join(', ')}`);
  
  // Restore each session
  for (const sessionId of folders) {
    const credsPath = path.join(sessionsDir, sessionId, 'creds.json');
    
    if (fs.existsSync(credsPath)) {
      console.log(`🔌 [STARTUP] Restoring session: ${sessionId}`);
      
      try {
        // Connect in background (don't wait)
        connectWhatsApp(sessionId).catch(err => {
          console.error(`❌ [STARTUP] Failed to restore session ${sessionId}:`, err.message);
        });
        
        // Small delay between connections to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ [STARTUP] Error restoring session ${sessionId}:`, error.message);
      }
    } else {
      console.log(`⚠️  [STARTUP] No credentials found for session ${sessionId}, skipping`);
    }
  }
  
  console.log('✅ [STARTUP] Session restoration process completed');
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

