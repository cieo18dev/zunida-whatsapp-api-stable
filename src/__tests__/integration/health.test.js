import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import routes from '../../routes.js';

describe('Integration Tests - GET /api/health', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', routes);
  });

  it('should return 200 OK', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.text).toBe('OK');
  });

  it('should return plain text content type', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/text/);
  });

  it('should be fast (respond in less than 100ms)', async () => {
    const start = Date.now();
    
    await request(app)
      .get('/api/health')
      .expect(200);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('should always return the same response', async () => {
    const response1 = await request(app).get('/api/health');
    const response2 = await request(app).get('/api/health');
    
    expect(response1.text).toBe(response2.text);
    expect(response1.status).toBe(response2.status);
  });
});

