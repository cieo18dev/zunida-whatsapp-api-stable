# WhatsApp Multi-Session REST API with Baileys

A powerful REST API for WhatsApp using the Baileys library with **multi-session support**. Connect multiple WhatsApp accounts simultaneously, manage them independently, and send messages programmatically.

## 🌟 Features

- 📱 **Multi-session support** - Connect multiple WhatsApp accounts at the same time
- 🔐 Independent session management - Each account has its own authentication and state
- 💬 Send text messages from any connected account
- 🔄 Smart automatic reconnection with exponential backoff per session
- 🛡️ Protection against reconnection loops
- 📊 Real-time connection status monitoring for all sessions
- 🔌 Manual disconnect and reconnection control
- 🗑️ Delete sessions and authentication data
- 📚 **Interactive Swagger documentation**
- 🎨 **Beautiful web interface** for managing sessions

## 🚀 Installation

Install dependencies using pnpm:

```bash
pnpm install
```

## 📖 Usage

### Start the server

```bash
pnpm start
```

Or for development with auto-reload:

```bash
pnpm dev
```

The server will start on port 3002 (or the port specified in the PORT environment variable).

## 🖥️ Web Interface

Once the server is running, open your browser and visit:

```
http://localhost:3002
```

The web interface allows you to:
- ✨ Create new sessions with custom IDs
- 📱 View all active sessions and their status
- 🔍 Scan QR codes for each session
- 📊 Monitor connection states in real-time
- 🗑️ Delete sessions you no longer need
- 🔄 Auto-refresh every 5 seconds

## 📚 API Documentation (Swagger)

Visit the interactive API documentation:

```
http://localhost:3002/api-docs
```

Swagger UI provides:
- 📖 Complete API documentation
- 🧪 Try-it-out functionality for all endpoints
- 📝 Request/response schemas
- ✅ Easy testing without command line tools

## 🔌 API Endpoints

### Session Management

#### **GET /sessions**
Get a list of all active sessions.

**Request:**
```bash
curl http://localhost:3002/sessions
```

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "session_id": "default",
      "state": "connected",
      "phone_number": "573001234567",
      "has_qr": false,
      "reconnect_attempts": 0
    },
    {
      "session_id": "session1",
      "state": "qr_ready",
      "phone_number": null,
      "has_qr": true,
      "reconnect_attempts": 0
    }
  ]
}
```

---

#### **DELETE /sessions/{sessionId}**
Delete a session and its authentication files (cannot delete 'default').

**Request:**
```bash
curl -X DELETE http://localhost:3002/sessions/session1
```

**Response:**
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

---

### Connection Management

#### **POST /connect**
Initialize WhatsApp connection for a specific session.

**Request:**
```bash
curl -X POST http://localhost:3002/connect \
  -H "Content-Type: application/json" \
  -d '{"session_id": "session1"}'
```

**Body Parameters:**
- `session_id` (string, optional): Session identifier. Defaults to "default"

**Response:**
```json
{
  "success": true,
  "session_id": "session1",
  "message": "Connection initiated. Scan the QR code to authenticate."
}
```

---

#### **GET /qr**
Get the QR code for a specific session.

**Request:**
```bash
curl "http://localhost:3002/qr?session_id=session1"
```

**Query Parameters:**
- `session_id` (string, optional): Session identifier. Defaults to "default"

**Response:**
```json
{
  "success": true,
  "session_id": "session1",
  "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

---

#### **GET /status**
Get the connection status of a specific session.

**Request:**
```bash
curl "http://localhost:3002/status?session_id=session1"
```

**Query Parameters:**
- `session_id` (string, optional): Session identifier. Defaults to "default"

**Response:**
```json
{
  "success": true,
  "session_id": "session1",
  "state": "connected"
}
```

**Possible states:** `disconnected`, `connecting`, `qr_ready`, `connected`, `error`, `failed`

---

#### **POST /disconnect**
Disconnect a specific session.

**Request:**
```bash
curl -X POST http://localhost:3002/disconnect \
  -H "Content-Type: application/json" \
  -d '{"session_id": "session1"}'
```

**Body Parameters:**
- `session_id` (string, optional): Session identifier. Defaults to "default"

**Response:**
```json
{
  "success": true,
  "session_id": "session1",
  "message": "WhatsApp disconnected successfully"
}
```

---

#### **POST /reset-reconnect**
Reset reconnection attempts counter for a session.

**Request:**
```bash
curl -X POST http://localhost:3002/reset-reconnect \
  -H "Content-Type: application/json" \
  -d '{"session_id": "session1"}'
```

**Body Parameters:**
- `session_id` (string, optional): Session identifier. Defaults to "default"

**Response:**
```json
{
  "success": true,
  "session_id": "session1",
  "message": "Reconnection attempts counter reset successfully"
}
```

---

### Messaging

#### **POST /send**
Send a text message from a specific session.

**Request:**
```bash
curl -X POST http://localhost:3002/send \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session1",
    "number": "573001234567",
    "message": "Hello from the API!"
  }'
```

**Body Parameters:**
- `session_id` (string, optional): Session identifier. Defaults to "default"
- `number` (string, required): Phone number with country code (without + or -)
  - Example: "573001234567" for Colombia
  - Example: "14155552671" for USA
- `message` (string, required): Text message to send

**Response:**
```json
{
  "success": true,
  "session_id": "session1",
  "message": "Message sent successfully",
  "result": { ... }
}
```

---

### Health Check

#### **GET /health**
Server health check.

**Request:**
```bash
curl http://localhost:3002/health
```

**Response:**
```json
{
  "status": "ok"
}
```

---

## 🔄 Multi-Session Workflow

### Creating and Using Multiple Sessions

1. **Start the server**: `pnpm start`
2. **Open the web interface**: Visit `http://localhost:3002`
3. **Create sessions**:
   - Use the web UI to create sessions like "session1", "session2", etc.
   - Or use the API: `POST /connect` with `session_id` in the body
4. **Scan QR codes**: Each session gets its own QR code
5. **Send messages**: Specify which session to use when sending messages

### Example: Managing Two WhatsApp Accounts

```bash
# Create first session (default)
curl -X POST http://localhost:3002/connect \
  -H "Content-Type: application/json" \
  -d '{"session_id": "default"}'

# Get QR for first session
curl "http://localhost:3002/qr?session_id=default"

# Create second session
curl -X POST http://localhost:3002/connect \
  -H "Content-Type: application/json" \
  -d '{"session_id": "business"}'

# Get QR for second session
curl "http://localhost:3002/qr?session_id=business"

# Send message from first account
curl -X POST http://localhost:3002/send \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "default",
    "number": "573001234567",
    "message": "Message from my personal account"
  }'

# Send message from second account
curl -X POST http://localhost:3002/send \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "business",
    "number": "573007654321",
    "message": "Message from my business account"
  }'
```

## 🔐 Session Storage

Each session's authentication data is stored in separate folders:

```
sessions/
├── default/          # Default session
│   ├── creds.json
│   └── ...
├── session1/         # Custom session 1
│   ├── creds.json
│   └── ...
└── session2/         # Custom session 2
    ├── creds.json
    └── ...
```

Once authenticated, sessions persist across server restarts - no need to scan QR codes again unless you log out or delete the session.

## 🛡️ Automatic Reconnection (Per Session)

Each session has its own independent reconnection system:

### Protection Features
- **Per-session reconnection tracking**: Each session manages its own reconnect attempts
- **Exponential backoff**: Delays increase progressively (3s, 6s, 12s, 24s, 30s max)
- **Maximum attempts limit**: 5 consecutive failed attempts per session
- **Proper cleanup**: Removes event listeners and closes sockets before reconnecting

### Connection States
- `disconnected`: Not connected
- `connecting`: Attempting to connect
- `qr_ready`: QR code ready to scan
- `connected`: Successfully connected
- `error`: Connection error
- `failed`: Max reconnection attempts reached

## 📝 Notes

- **Session IDs** can be any alphanumeric string (e.g., "session1", "client_abc", "business")
- The **"default"** session is created automatically and cannot be deleted
- **Phone numbers** should include country code without the + symbol
- **QR codes** expire after a short time - generate a new one if needed
- Each session operates **completely independently** of others

## ⚠️ Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (missing parameters, invalid session)
- `404`: Resource not found (no QR code available)
- `500`: Server error

## 🎨 Web Interface Screenshot

The web interface provides:
- **Grid layout** showing all active sessions
- **Real-time status** with color-coded badges
- **QR code display** for easy scanning
- **Quick actions** for each session (Connect, Get QR, Check Status, Disconnect)
- **Session creation** with custom IDs
- **Session deletion** (except default)
- **Auto-refresh** every 5 seconds

## 🔧 Troubleshooting

### Session won't connect
1. Check your internet connection
2. Verify the session isn't logged in elsewhere
3. Try disconnecting and reconnecting
4. Delete and recreate the session if needed

### QR code not appearing
1. Make sure you called `/connect` first
2. Check the session status with `/status`
3. Generate a new QR if it expired

### Max reconnection attempts reached
1. Use `POST /reset-reconnect` with the session_id
2. Or restart the server
3. Check for network issues

## 📦 Dependencies

- `@whiskeysockets/baileys` - WhatsApp Web API library
- `express` - Web framework
- `qrcode` - QR code generation
- `pino` - Logging
- `swagger-jsdoc` - API documentation
- `swagger-ui-express` - Swagger UI

## 📄 License

ISC
