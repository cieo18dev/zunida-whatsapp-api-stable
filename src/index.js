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

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'WhatsApp API Documentation'
}));

// API routes
app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`🚀 WhatsApp API Server running on port ${PORT}`);
  console.log(`📚 Swagger documentation: http://localhost:${PORT}/api-docs`);
  console.log(`📱 GET /api/connect/:clientId - Start WhatsApp connection`);
  console.log(`💬 POST /api/send/:clientId - Send messages`);
  console.log(`📄 POST /api/send-document/:clientId - Send documents`);
  console.log(`📊 GET /api/status/:clientId - Check connection status`);
});

