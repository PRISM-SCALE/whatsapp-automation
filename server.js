const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bot');
const WhatsAppBot = require('./services/whatsappBot');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bot', botRoutes);

// Initialize WhatsApp bot after database is ready
let whatsappBot = null;

// Function to initialize the bot
const initializeBot = async () => {
  try {
    // Import database initialization
    const { dbInitPromise } = require('./config/database');
    
    // Wait for database to be initialized
    await dbInitPromise;
    console.log('Database ready, initializing WhatsApp bot...');
    
    whatsappBot = new WhatsAppBot(io);
    app.locals.whatsappBot = whatsappBot;
    console.log('WhatsApp bot initialized successfully');
  } catch (error) {
    console.error('Failed to initialize WhatsApp bot:', error);
    // Retry after 5 seconds
    setTimeout(initializeBot, 5000);
  }
};

// Start bot initialization
initializeBot();

// Socket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('start_session', async (data) => {
    const { userId } = data;
    if (userId) {
      await whatsappBot.startSession(userId);
    }
  });

  socket.on('get_qr', (data) => {
    const { userId } = data;
    if (userId) {
      const qrCode = whatsappBot.getQRCode(userId);
      if (qrCode) {
        socket.emit(`qr_${userId}`, qrCode);
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});