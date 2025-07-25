const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Import WhatsApp bot instance (will be injected)
let whatsappBot = null;

// Middleware to inject bot instance
router.use((req, res, next) => {
  if (!whatsappBot && req.app.locals.whatsappBot) {
    whatsappBot = req.app.locals.whatsappBot;
  }
  next();
});

// Get user session status and data
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_sessions WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // Create session if doesn't exist
      await pool.query(
        'INSERT INTO user_sessions (user_id) VALUES ($1)',
        [req.user.id]
      );
      return res.json({
        isActive: false,
        isPaused: false,
        autoReplyMessage: 'Thank you for your message. I will get back to you soon.'
      });
    }

    const session = result.rows[0];
    res.json({
      isActive: session.is_active,
      isPaused: session.is_paused,
      autoReplyMessage: session.auto_reply_message
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update auto-reply message
router.put('/message', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    await pool.query(
      'UPDATE user_sessions SET auto_reply_message = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [message.trim(), req.user.id]
    );

    res.json({ message: 'Auto-reply message updated successfully' });
  } catch (error) {
    console.error('Message update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle pause/resume
router.put('/toggle-pause', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE user_sessions SET is_paused = NOT is_paused, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING is_paused',
      [req.user.id]
    );

    const isPaused = result.rows[0].is_paused;
    res.json({ 
      message: isPaused ? 'Bot paused' : 'Bot resumed',
      isPaused 
    });
  } catch (error) {
    console.error('Toggle pause error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get activity logs
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      'SELECT * FROM activity_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM activity_logs WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Activity logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start WhatsApp session
router.post('/start-session', authenticateToken, async (req, res) => {
  try {
    if (!whatsappBot) {
      return res.status(500).json({ error: 'WhatsApp bot not initialized' });
    }

    await whatsappBot.startSession(req.user.id);
    res.json({ message: 'Session started successfully' });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// Stop WhatsApp session
router.post('/stop-session', authenticateToken, async (req, res) => {
  try {
    if (!whatsappBot) {
      return res.status(500).json({ error: 'WhatsApp bot not initialized' });
    }

    await whatsappBot.stopSession(req.user.id);
    res.json({ message: 'Session stopped successfully' });
  } catch (error) {
    console.error('Stop session error:', error);
    res.status(500).json({ error: 'Failed to stop session' });
  }
});

// Get QR code for authentication
router.get('/qr-code', authenticateToken, async (req, res) => {
  try {
    if (!whatsappBot) {
      return res.status(500).json({ error: 'WhatsApp bot not initialized' });
    }

    const qrCode = whatsappBot.getQRCode(req.user.id);
    if (qrCode) {
      res.json({ qrCode });
    } else {
      res.json({ qrCode: null, message: 'No QR code available. Try starting a session first.' });
    }
  } catch (error) {
    console.error('QR code error:', error);
    res.status(500).json({ error: 'Failed to get QR code' });
  }
});

module.exports = router;