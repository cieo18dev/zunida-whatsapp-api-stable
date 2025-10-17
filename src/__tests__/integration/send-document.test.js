import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import routes from '../../routes.js';

describe('Integration Tests - POST /api/send-document/:clientId', () => {
  let app;
  const testClientId = 'test-doc-client';
  const validBase64PDF = 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlIC9QYWdlCi9QYXJlbnQgMSAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8L0xlbmd0aCA0ND4+CnN0cmVhbQpCVAovRjEgMTIgVGYKNTAgNzAwIFRkCihUZXN0IFBERikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoxIDAgb2JqCjw8L1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZwovUGFnZXMgMSAwIFIKPj4KZW5kb2JqCjYgMCBvYmoKPDwvQ3JlYXRvciAoVGVzdCkKPj4KZW5kb2JqCnhyZWYKMCA3CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDE4MyAwMDAwMCBuIAowMDAwMDAwMDAwIDAwMDAwIG4gCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDEwNiAwMDAwMCBuIAowMDAwMDAwMjU3IDAwMDAwIG4gCjAwMDAwMDAzMDYgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDcKL1Jvb3QgNSAwIFIKL0luZm8gNiAwIFIKPj4Kc3RhcnR4cmVmCjM0MwolJUVPRg==';

  beforeAll(() => {
    app = express();
    app.use(express.json({ limit: '50mb' })); // Support large base64 files
    app.use('/api', routes);
  });

  it('should return 400 when "to" is missing', async () => {
    const response = await request(app)
      .post(`/api/send-document/${testClientId}`)
      .send({
        documentData: validBase64PDF,
        filename: 'test.pdf'
      })
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error).toContain('Missing');
  });

  it('should return 400 when "documentData" is missing', async () => {
    const response = await request(app)
      .post(`/api/send-document/${testClientId}`)
      .send({
        to: '+573001234567',
        filename: 'test.pdf'
      })
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error).toContain('Missing');
  });

  it('should return 400 when "filename" is missing', async () => {
    const response = await request(app)
      .post(`/api/send-document/${testClientId}`)
      .send({
        to: '+573001234567',
        documentData: validBase64PDF
      })
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error).toContain('Missing');
  });

  it('should return 400 for invalid phone number format', async () => {
    const response = await request(app)
      .post(`/api/send-document/${testClientId}`)
      .send({
        to: 'invalid',
        documentData: validBase64PDF,
        filename: 'test.pdf'
      })
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error).toContain('Invalid phone number');
  });

  it('should return 400 for invalid documentData format (not base64)', async () => {
    const response = await request(app)
      .post(`/api/send-document/${testClientId}`)
      .send({
        to: '+573001234567',
        documentData: 'not-a-base64-string',
        filename: 'test.pdf'
      })
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error).toContain('Invalid documentData format');
  });

  it('should return 400 for URL format (only base64 supported)', async () => {
    const response = await request(app)
      .post(`/api/send-document/${testClientId}`)
      .send({
        to: '+573001234567',
        documentData: 'https://example.com/file.pdf',
        filename: 'test.pdf'
      })
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error).toContain('Invalid documentData format');
  });

  it('should accept valid base64 PDF data format', async () => {
    const response = await request(app)
      .post(`/api/send-document/${testClientId}`)
      .send({
        to: '+573001234567',
        documentData: validBase64PDF,
        filename: 'test.pdf',
        message: 'Here is your document'
      })
      .expect('Content-Type', /json/);

    // Will fail because session doesn't exist (404), but format is valid
    expect([200, 404, 500]).toContain(response.status);
  });

  it('should accept valid base64 without optional message', async () => {
    const response = await request(app)
      .post(`/api/send-document/${testClientId}`)
      .send({
        to: '+573001234567',
        documentData: validBase64PDF,
        filename: 'test.pdf'
      })
      .expect('Content-Type', /json/);

    // Will fail because session doesn't exist (404), but format is valid
    expect([200, 404, 500]).toContain(response.status);
  });

  it('should return 404 when session does not exist on disk', async () => {
    const response = await request(app)
      .post(`/api/send-document/${testClientId}`)
      .send({
        to: '+573001234567',
        documentData: validBase64PDF,
        filename: 'test.pdf'
      })
      .expect(404)
      .expect('Content-Type', /json/);

    expect(response.body.error).toBeDefined();
    expect(response.body.error).toMatch(/not found|scan QR/i);
  });
});

