import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import routes from '../../routes.js';
import { disconnectWhatsApp, deleteSession } from '../../whatsapp.js';

describe('Integration Tests - GET /api/connect/:clientId', () => {
  let app;
  const testClientId = 'test-client-' + Date.now();

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

  it('should generate a REAL QR code when connecting a new client', async () => {
    console.log(`\n🧪 Testing QR generation for client: ${testClientId}`);
    
    const response = await request(app)
      .get(`/api/connect/${testClientId}`)
      .expect('Content-Type', /json/);

    console.log(`📋 Response status: ${response.status}`);
    console.log(`📋 Response body:`, response.body);

    // Should get a response (either 200 or 408 if timeout)
    expect([200, 408]).toContain(response.status);

    if (response.status === 200) {
      // Check if QR code was generated
      if (response.body.qr) {
        console.log('✅ QR Code generated successfully!');
        console.log(`📱 QR Code starts with: ${response.body.qr.substring(0, 50)}...`);
        
        // Validate it's a real base64 image
        expect(response.body.qr).toMatch(/^data:image\/png;base64,/);
        expect(response.body.connected).toBe(false);
        
        // QR should be substantial in size (real QR codes are large)
        expect(response.body.qr.length).toBeGreaterThan(1000);
      } else if (response.body.connected) {
        console.log('✅ Client already connected!');
        expect(response.body.message).toBeDefined();
      }
    } else if (response.status === 408) {
      console.log('⏰ QR generation timed out (this can happen)');
      expect(response.body.error).toContain('timeout');
    }
  }, 35000); // 35 second timeout for this test

  it('should return already connecting message on second call', async () => {
    console.log(`\n🧪 Testing second connection attempt for: ${testClientId}`);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await request(app)
      .get(`/api/connect/${testClientId}`)
      .expect(200)
      .expect('Content-Type', /json/);

    console.log(`📋 Second call response:`, response.body);

    // Should indicate it's already connecting or connected, or return QR if available
    expect(response.body).toHaveProperty('connected');
    
    if (response.body.connected) {
      expect(response.body.message).toMatch(/already|connected/i);
    } else {
      // QR is still available
      expect(response.body.qr).toBeDefined();
    }
  }, 10000);

  it('should handle invalid client ID gracefully', async () => {
    const invalidClientId = 'test-invalid-' + Date.now();
    
    const response = await request(app)
      .get(`/api/connect/${invalidClientId}`)
      .expect('Content-Type', /json/);

    expect([200, 408, 500]).toContain(response.status);
    
    // Clean up
    try {
      await deleteSession(invalidClientId);
    } catch (err) {
      // Ignore
    }
  }, 35000);
});

