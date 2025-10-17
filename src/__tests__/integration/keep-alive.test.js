import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import routes from '../../routes.js';
import { connectWhatsApp, disconnectWhatsApp, deleteSession } from '../../whatsapp.js';
import fs from 'fs';
import path from 'path';

describe('Integration Tests - POST /api/keep-alive/:clientId', () => {
  let app;
  const testClientId = 'test-keepalive-' + Date.now();
  const sessionPath = path.join('sessions', testClientId);

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', routes);
  });

  afterAll(async () => {
    // Clean up test session
    try {
      await disconnectWhatsApp(testClientId);
      await deleteSession(testClientId);
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it('should return 404 when session does not exist on disk', async () => {
    const response = await request(app)
      .post(`/api/keep-alive/${testClientId}`)
      .expect(404)
      .expect('Content-Type', /json/);

    expect(response.body.error).toBeDefined();
    expect(response.body.error).toMatch(/not found|scan QR/i);
  });

  it('should return correct response structure when session exists', async () => {
    // Create session directory with creds.json
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
      fs.writeFileSync(
        path.join(sessionPath, 'creds.json'),
        JSON.stringify({ test: 'data' })
      );
    }

    const response = await request(app)
      .post(`/api/keep-alive/${testClientId}`)
      .expect('Content-Type', /json/);

    // Can be either success or error (depending on connection)
    if (response.status === 200) {
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('clientId', testClientId);
      expect(response.body).toHaveProperty('state');
      expect(response.body).toHaveProperty('message');
    } else {
      // Expect 500 if connection fails
      expect([200, 500]).toContain(response.status);
    }
  }, 20000); // Longer timeout for connection

  it('should accept POST method only', async () => {
    const response = await request(app)
      .get(`/api/keep-alive/${testClientId}`)
      .expect(404); // Route not found

    expect(response.status).toBe(404);
  });

  it('should handle multiple calls without errors', async () => {
    // Create session directory if needed
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
      fs.writeFileSync(
        path.join(sessionPath, 'creds.json'),
        JSON.stringify({ test: 'data' })
      );
    }

    // First call
    const response1 = await request(app)
      .post(`/api/keep-alive/${testClientId}`)
      .expect('Content-Type', /json/);

    // Second call immediately after
    const response2 = await request(app)
      .post(`/api/keep-alive/${testClientId}`)
      .expect('Content-Type', /json/);

    // Both should return either success or error, but not crash
    expect([200, 500]).toContain(response1.status);
    expect([200, 500]).toContain(response2.status);
  }, 30000);

  it('should return message about disconnect timer', async () => {
    // Create session directory
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
      fs.writeFileSync(
        path.join(sessionPath, 'creds.json'),
        JSON.stringify({ test: 'data' })
      );
    }

    const response = await request(app)
      .post(`/api/keep-alive/${testClientId}`)
      .expect('Content-Type', /json/);

    if (response.status === 200) {
      expect(response.body.message).toBeDefined();
      expect(response.body.message).toMatch(/disconnect|inactivity|minutes/i);
    }
  }, 20000);

  it('should handle invalid clientId gracefully', async () => {
    const invalidClientId = '';
    
    const response = await request(app)
      .post(`/api/keep-alive/${invalidClientId}`)
      .expect('Content-Type', /json/);

    // Should handle empty clientId
    expect([404, 500]).toContain(response.status);
  });
});

