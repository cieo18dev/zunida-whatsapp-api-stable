import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { specs } from './swagger.js';
import routes from './routes.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3006;

app.use(express.json());

// Serve static files
app.use(express.static(join(__dirname, '../public')));

// Middleware for logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Global error handler for uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ [UNCAUGHT EXCEPTION]:', error.message);
  console.error('Stack:', error.stack);
  // Don't exit, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [UNHANDLED REJECTION] at:', promise, 'reason:', reason);
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
  console.log(`🚀 WhatsApp API Server running on port ${PORT}`);
  console.log(`📚 Swagger documentation: http://localhost:${PORT}/api-docs`);
  console.log(`📱 GET /api/connect/:clientId - Start WhatsApp connection`);
  console.log(`💬 POST /api/send/:clientId - Send messages`);
  console.log(`📄 POST /api/send-document/:clientId - Send documents`);
  console.log(`📊 GET /api/status/:clientId - Check connection status`);
  console.log('');
  
  // Lazy Loading enabled - sessions will connect on-demand
  console.log('🔄 [LAZY LOADING] Sessions will connect automatically when needed');
  console.log('📱 Benefit: Phone receives notifications when sessions are inactive');
});

