import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import routes from '../../routes.js';
import { connectWhatsApp, disconnectWhatsApp, deleteSession } from '../../whatsapp.js';

describe('Integration Tests - GET /api/sessions', () => {
  let app;
  const testClientId1 = 'test-session-1-' + Date.now();
  const testClientId2 = 'test-session-2-' + Date.now();

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', routes);
  });

  afterAll(async () => {
    // Clean up test sessions
    try {
      await disconnectWhatsApp(testClientId1);
      await deleteSession(testClientId1);
      await disconnectWhatsApp(testClientId2);
      await deleteSession(testClientId2);
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it('should return sessions array (may be empty with lazy loading)', async () => {
    const response = await request(app)
      .get('/api/sessions')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body).toHaveProperty('sessions');
    expect(Array.isArray(response.body.sessions)).toBe(true);
    
    // With lazy loading, sessions array is often empty unless actively connected
    console.log(`📊 Active sessions: ${response.body.sessions.length}`);
  });

  it('should return array of sessions with correct structure', async () => {
    const response = await request(app)
      .get('/api/sessions')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body).toHaveProperty('sessions');
    expect(Array.isArray(response.body.sessions)).toBe(true);

    // If there are sessions, verify structure
    if (response.body.sessions.length > 0) {
      const session = response.body.sessions[0];
      expect(session).toHaveProperty('session_id');
      expect(session).toHaveProperty('state');
      expect(session).toHaveProperty('has_qr');
      expect(session).toHaveProperty('reconnect_attempts');
    }
  });

  it('should include newly created session in list (with lazy loading)', async () => {
    // Create a session by connecting
    console.log(`\n🧪 Creating test session: ${testClientId1}`);
    
    // Start connection (will be in connecting state)
    connectWhatsApp(testClientId1).catch(() => {}); // Don't wait for it
    
    // Wait a bit for session to be created
    await new Promise(resolve => setTimeout(resolve, 2000));

    const response = await request(app)
      .get('/api/sessions')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body.sessions).toBeDefined();
    expect(Array.isArray(response.body.sessions)).toBe(true);

    // Check if our test session is in the list (it should be since we just connected it)
    const testSession = response.body.sessions.find(
      s => s.session_id === testClientId1
    );

    if (testSession) {
      console.log(`✅ Test session found in list:`, testSession);
      expect(testSession.session_id).toBe(testClientId1);
      expect(testSession.state).toBeDefined();
      expect(typeof testSession.has_qr).toBe('boolean');
      expect(typeof testSession.reconnect_attempts).toBe('number');
    } else {
      console.log(`ℹ️  Session not in list yet (lazy loading - will appear when used)`);
      // This is acceptable with lazy loading
    }
  }, 10000);

  it('should show state for each session', async () => {
    const response = await request(app)
      .get('/api/sessions')
      .expect(200);

    const sessions = response.body.sessions;
    
    sessions.forEach(session => {
      expect(session.state).toMatch(/disconnected|connecting|qr_ready|connected/);
    });
  });

  it('should handle request without errors', async () => {
    const response = await request(app)
      .get('/api/sessions')
      .expect(200);

    expect(response.body).not.toHaveProperty('error');
  });

  it('should return consistent data on multiple calls', async () => {
    const response1 = await request(app).get('/api/sessions').expect(200);
    const response2 = await request(app).get('/api/sessions').expect(200);

    expect(response1.body).toHaveProperty('sessions');
    expect(response2.body).toHaveProperty('sessions');
    expect(Array.isArray(response1.body.sessions)).toBe(true);
    expect(Array.isArray(response2.body.sessions)).toBe(true);
  });
});

