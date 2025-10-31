import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { specs } from './swagger.js';
import routes from './routes.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './logger.js';
import { restoreAllSessions } from './whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3006;

app.use(express.json());

// Serve static files
app.use(express.static(join(__dirname, '../public')));

// Middleware for logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Global error handler for uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('❌ [UNCAUGHT EXCEPTION]:', { message: error.message, stack: error.stack });
  // Don't exit, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ [UNHANDLED REJECTION]', { promise, reason });
  // Don't exit, just log the error
});

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'WhatsApp API Documentation'
}));

// API routes
app.use('/api', routes);

app.listen(PORT, async () => {
  logger.info(`🚀 WhatsApp API Server running on port ${PORT}`);
  logger.info(`📚 Swagger documentation: http://localhost:${PORT}/api-docs`);
  logger.info(`📱 GET /api/connect/:clientId - Start WhatsApp connection`);
  logger.info(`💬 POST /api/send/:clientId - Send messages`);
  logger.info(`📄 POST /api/send-document/:clientId - Send documents`);
  logger.info(`📊 GET /api/status/:clientId - Check connection status`);
  logger.info('');
  
  // Lazy Loading enabled - sessions will connect on-demand
  logger.info('🔄 [LAZY LOADING] Sessions will connect automatically when needed');
  logger.info('📱 Benefit: Phone receives notifications when sessions are inactive');
  
  // Restore all sessions from disk
  await restoreAllSessions();
});

