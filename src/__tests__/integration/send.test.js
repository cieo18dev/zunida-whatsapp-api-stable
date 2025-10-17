import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import routes from '../../routes.js';

describe('Integration Tests - POST /api/send/:clientId', () => {
  let app;
  const testClientId = 'test-send-client';

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', routes);
  });

  it('should return 400 when "to" is missing', async () => {
    const response = await request(app)
      .post(`/api/send/${testClientId}`)
      .send({
        message: 'Test message'
      })
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error).toContain('Missing');
    expect(response.body.error).toMatch(/to|message/i);
  });

  it('should return 400 when "message" is missing', async () => {
    const response = await request(app)
      .post(`/api/send/${testClientId}`)
      .send({
        to: '+573001234567'
      })
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error).toContain('Missing');
    expect(response.body.error).toMatch(/to|message/i);
  });

  it('should return 400 for invalid phone number format - too short', async () => {
    const response = await request(app)
      .post(`/api/send/${testClientId}`)
      .send({
        to: '+123',
        message: 'Test'
      })
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error).toContain('Invalid phone number');
  });

  it('should return 400 for invalid phone number format - letters', async () => {
    const response = await request(app)
      .post(`/api/send/${testClientId}`)
      .send({
        to: '57abc1234567',
        message: 'Test'
      })
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error).toContain('Invalid phone number');
  });

  it('should return 400 for invalid phone number format - too long', async () => {
    const response = await request(app)
      .post(`/api/send/${testClientId}`)
      .send({
        to: '+1234567890123456',
        message: 'Test'
      })
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error).toContain('Invalid phone number');
  });

  it('should return 404 when session does not exist on disk', async () => {
    const response = await request(app)
      .post(`/api/send/${testClientId}`)
      .send({
        to: '+573001234567',
        message: 'Test message'
      })
      .expect(404)
      .expect('Content-Type', /json/);

    expect(response.body.error).toBeDefined();
    expect(response.body.error).toMatch(/not found|scan QR/i);
  });

  it('should accept valid phone numbers with + prefix', async () => {
    const response = await request(app)
      .post(`/api/send/${testClientId}`)
      .send({
        to: '+573001234567',
        message: 'Test message'
      })
      .expect('Content-Type', /json/);

    // Will fail because session doesn't exist (404), but format is valid
    expect([200, 404, 500]).toContain(response.status);
  });

  it('should accept valid phone numbers without + prefix', async () => {
    const response = await request(app)
      .post(`/api/send/${testClientId}`)
      .send({
        to: '573001234567',
        message: 'Test message'
      })
      .expect('Content-Type', /json/);

    // Will fail because session doesn't exist (404), but format is valid
    expect([200, 404, 500]).toContain(response.status);
  });
});

