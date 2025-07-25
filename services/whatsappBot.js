const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { pool } = require('../config/database');

class WhatsAppBot {
  constructor(io) {
    this.io = io;
    this.clients = new Map(); // userId -> client instance
    this.qrCodes = new Map(); // userId -> qr code
    this.initialized = false;

    // Delay initialization to ensure database is ready
    setTimeout(() => {
      this.initializeExistingSessions();
    }, 1000);
  }

  async initializeExistingSessions() {
    if (this.initialized) return;

    try {
      // Get all active sessions from database
      const result = await pool.query(
        'SELECT user_id FROM user_sessions WHERE is_active = true'
      );

      console.log(`Found ${result.rows.length} active sessions to restore`);

      for (const row of result.rows) {
        console.log(`Restoring WhatsApp client session for userId: ${row.user_id}`);
        await this.createClient(row.user_id);
      }

      this.initialized = true;
      console.log('Existing sessions initialized successfully');
    } catch (error) {
      console.error('Error initializing existing sessions:', error);
      // Retry after 5 seconds if database isn't ready yet
      setTimeout(() => {
        this.initializeExistingSessions();
      }, 5000);
    }
  }

  async createClient(userId) {
    if (this.clients.has(userId)) {
      console.log(`WhatsApp client already exists for userId: ${userId}`);
      return this.clients.get(userId);
    }

    console.log(`Creating new WhatsApp client for userId: ${userId}`);

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: `user_${userId}`
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    // QR Code generation
    client.on('qr', async (qr) => {
      try {
        console.log(`QR code generated for userId: ${userId}`);
        const qrCodeDataURL = await qrcode.toDataURL(qr);
        this.qrCodes.set(userId, qrCodeDataURL);
        this.io.emit(`qr_${userId}`, qrCodeDataURL);
      } catch (error) {
        console.error('QR code generation error:', error);
      }
    });

    // Client ready
    client.on('ready', async () => {
      console.log(`WhatsApp client ready for user ${userId}`);

      // Update session as active
      await pool.query(
        'UPDATE user_sessions SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );

      this.qrCodes.delete(userId);
      this.io.emit(`ready_${userId}`, { status: 'connected' });
    });

    // Handle incoming messages
    client.on('message', async (message) => {
      try {
        console.log(`Incoming message for user ${userId} from ${message.from}: ${message.body}`);
        await this.handleIncomingMessage(userId, message);
      } catch (error) {
        console.error('Message handling error:', error);
      }
    });

    // Handle disconnection
    client.on('disconnected', async (reason) => {
      console.log(`Client disconnected for user ${userId}:`, reason);

      // Update session as inactive
      await pool.query(
        'UPDATE user_sessions SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );

      this.clients.delete(userId);
      this.io.emit(`disconnected_${userId}`, { reason });
    });

    // Handle authentication failure
    client.on('auth_failure', async () => {
      console.log(`Authentication failed for user ${userId}`);

      await pool.query(
        'UPDATE user_sessions SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );

      this.clients.delete(userId);
      this.io.emit(`auth_failure_${userId}`, { error: 'Authentication failed' });
    });

    this.clients.set(userId, client);

    try {
      await client.initialize();
    } catch (error) {
      console.error(`Failed to initialize client for user ${userId}:`, error);
      this.clients.delete(userId);
    }

    return client;
  }

  async handleIncomingMessage(userId, message) {
    // Skip if message is from status broadcast
    if (message.from === 'status@broadcast') return;

    // Skip if message is from self
    if (message.fromMe) return;
    if (message.from.endsWith('@g.us')) return;

    // Get user session data
    const sessionResult = await pool.query(
      'SELECT * FROM user_sessions WHERE user_id = $1',
      [userId]
    );

    if (sessionResult.rows.length === 0 || sessionResult.rows[0].is_paused) {
      return;
    }

    const session = sessionResult.rows[0];
    const contact = await message.getContact();
    const contactNumber = contact.number;

    // Check if this is an unknown number (not in contacts)
    const isUnknown = !contact.isMyContact;

    if (isUnknown) {
      // Send auto-reply
      await message.reply(session.auto_reply_message);
      console.log(`Auto-reply sent to ${contactNumber} for user ${userId}: ${session.auto_reply_message}`);

      // Log the activity
      await pool.query(
        'INSERT INTO activity_logs (user_id, contact_number, message_received, reply_sent) VALUES ($1, $2, $3, $4)',
        [userId, contactNumber, message.body, session.auto_reply_message]
      );

      // Emit activity update to frontend
      this.io.emit(`activity_${userId}`, {
        contactNumber,
        messageReceived: message.body,
        replySent: session.auto_reply_message,
        timestamp: new Date()
      });
    }
  }

  async startSession(userId) {
    console.log(`Start session requested for userId: ${userId}`);
    return await this.createClient(userId);
  }

  async stopSession(userId) {
    console.log(`Stop session requested for userId: ${userId}`);
    const client = this.clients.get(userId);
    if (client) {
      await client.destroy();
      this.clients.delete(userId);

      // Update database
      await pool.query(
        'UPDATE user_sessions SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );
    }
  }

  getQRCode(userId) {
    console.log(`Get QR code requested for userId: ${userId}`);
    return this.qrCodes.get(userId);
  }

  isClientReady(userId) {
    const client = this.clients.get(userId);
    return client && client.info;
  }
}

module.exports = WhatsAppBot;
