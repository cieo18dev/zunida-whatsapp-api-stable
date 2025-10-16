import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import routes from '../../routes.js';

describe('Integration Tests - GET /api/status/:clientId', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', routes);
  });

  it('should return status for non-existent client (disconnected)', async () => {
    const clientId = 'non-existent-client';
    
    const response = await request(app)
      .get(`/api/status/${clientId}`)
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body).toHaveProperty('clientId', clientId);
    expect(response.body).toHaveProperty('connected');
    expect(response.body.connected).toBe(false);
  });

  it('should return clientId in response', async () => {
    const clientId = 'test-status-client';
    
    const response = await request(app)
      .get(`/api/status/${clientId}`)
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body.clientId).toBe(clientId);
  });

  it('should handle special characters in clientId', async () => {
    const clientId = 'test-client-123';
    
    const response = await request(app)
      .get(`/api/status/${clientId}`)
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body.clientId).toBe(clientId);
    expect(typeof response.body.connected).toBe('boolean');
  });

  it('should return boolean for connected field', async () => {
    const clientId = 'another-test-client';
    
    const response = await request(app)
      .get(`/api/status/${clientId}`)
      .expect(200)
      .expect('Content-Type', /json/);

    expect(typeof response.body.connected).toBe('boolean');
  });
});

