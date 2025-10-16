import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Multi-Session API with Baileys',
      version: '2.0.0',
      description: 'REST API for WhatsApp using Baileys library with multi-session support. Connect multiple WhatsApp accounts simultaneously, scan QR codes, and send messages programmatically.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3006',
        description: 'Development server',
      },
    ],
    tags: [
      {
        name: 'Connection',
        description: 'WhatsApp connection management for individual sessions',
      },
      {
        name: 'Sessions',
        description: 'Multi-session management - Create, list, and delete sessions',
      },
      {
        name: 'Messaging',
        description: 'Send messages from specific sessions',
      },
      {
        name: 'Health',
        description: 'Server health check',
      },
    ],
  },
  apis: ['./src/routes.js'],
};

export const specs = swaggerJsdoc(options);

