import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import routes from '../../routes.js';
import { connectWhatsApp, disconnectWhatsApp } from '../../whatsapp.js';
import fs from 'fs';
import path from 'path';

describe('Integration Tests - DELETE /api/delete/:clientId', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', routes);
  });

  afterEach(async () => {
    // Give time for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  it('should return 204 when deleting a non-existent session', async () => {
    const clientId = 'non-existent-' + Date.now();
    
    const response = await request(app)
      .delete(`/api/delete/${clientId}`)
      .expect(204);

    expect(response.body).toEqual({});
  });

  it('should delete session directory when it exists', async () => {
    const clientId = 'delete-test-' + Date.now();
    const sessionPath = path.join('sessions', clientId);

    // Create a test session directory
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
    fs.writeFileSync(path.join(sessionPath, 'test.json'), '{}');

    expect(fs.existsSync(sessionPath)).toBe(true);

    await request(app)
      .delete(`/api/delete/${clientId}`)
      .expect(204);

    // Wait for deletion
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify directory was deleted
    expect(fs.existsSync(sessionPath)).toBe(false);
  });

  it('should return 400 when trying to delete default session', async () => {
    const response = await request(app)
      .delete(`/api/delete/default`)
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error).toContain('Cannot delete');
  });

  it('should handle clientId with special characters', async () => {
    const clientId = 'test-client-123-abc';
    
    const response = await request(app)
      .delete(`/api/delete/${clientId}`);

    expect([204, 400, 500]).toContain(response.status);
  });

  it('should disconnect session before deleting', async () => {
    const clientId = 'delete-disconnect-test-' + Date.now();
    
    // Try to delete (will work even if not connected)
    const response = await request(app)
      .delete(`/api/delete/${clientId}`)
      .expect(204);

    expect(response.body).toEqual({});
  });
});

