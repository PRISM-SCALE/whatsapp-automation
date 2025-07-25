# WhatsApp Auto-Reply Bot

An automated background service that sends replies to unknown numbers when it receives messages on WhatsApp.

## Features

✅ **QR Code Authentication** - Scan QR via Web UI  
✅ **Custom Auto-Reply** - Set personalized auto-reply messages  
✅ **Smart Filtering** - Auto-reply to unknown numbers only  
✅ **Bot Control** - Pause/Resume functionality  
✅ **Activity Logging** - Track all interactions  
✅ **Background Operation** - Works even when user isn't logged in  

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: Vanilla JavaScript, TailwindCSS
- **WhatsApp Integration**: whatsapp-web.js
- **Database**: PostgreSQL
- **Real-time Communication**: Socket.io
- **Authentication**: JWT tokens

## Setup Instructions

### 1. Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- Chrome/Chromium browser (for WhatsApp Web)

### 2. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd whatsapp-auto-reply

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 3. Environment Configuration

Edit `.env` file with your settings:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/whatsapp_bot
JWT_SECRET=your-super-secret-jwt-key-here
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3001
```

### 4. Database Setup

Create a PostgreSQL database and update the `DATABASE_URL` in your `.env` file. The application will automatically create the required tables on startup.

### 5. Start the Application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:3001`

## How It Works

### User Flow

1. **Sign Up/Login** - User creates account with email and password
2. **Dashboard Access** - User logs in and accesses the dashboard
3. **Session Check** - Backend checks if user has an active WhatsApp session
4. **QR Code Scan** - If no session exists, user scans QR code to connect WhatsApp
5. **Bot Configuration** - User can set auto-reply message and control bot status
6. **Background Operation** - Bot continues working even when user is offline

### Technical Flow

1. **WhatsApp Integration** - Uses `whatsapp-web.js` to connect to WhatsApp Web
2. **Message Processing** - Monitors incoming messages in real-time
3. **Contact Filtering** - Identifies unknown contacts (not in user's contact list)
4. **Auto-Reply** - Sends configured message to unknown contacts
5. **Activity Logging** - Records all interactions in PostgreSQL database
6. **Real-time Updates** - Uses Socket.io for live dashboard updates

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Bot Management
- `GET /api/bot/status` - Get bot status and configuration
- `PUT /api/bot/message` - Update auto-reply message
- `PUT /api/bot/toggle-pause` - Pause/resume bot
- `GET /api/bot/activity` - Get activity logs
- `POST /api/bot/start-session` - Start WhatsApp session
- `POST /api/bot/stop-session` - Stop WhatsApp session
- `GET /api/bot/qr-code` - Get QR code for authentication

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### User Sessions Table
```sql
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_data TEXT,
  is_active BOOLEAN DEFAULT false,
  auto_reply_message TEXT DEFAULT 'Thank you for your message. I will get back to you soon.',
  is_paused BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Activity Logs Table
```sql
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  contact_number VARCHAR(50),
  message_received TEXT,
  reply_sent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt for password security
- **Rate Limiting** - Prevents API abuse
- **CORS Protection** - Configurable cross-origin requests
- **Session Isolation** - Each user has isolated WhatsApp sessions

## Deployment Notes

### Production Considerations

1. **Environment Variables** - Set `NODE_ENV=production`
2. **Database** - Use managed PostgreSQL service
3. **SSL** - Enable SSL for database connections
4. **Process Management** - Use PM2 or similar for process management
5. **Reverse Proxy** - Use nginx for static file serving and SSL termination

### Scaling

- **Horizontal Scaling** - Multiple server instances supported
- **Session Persistence** - WhatsApp sessions stored per user
- **Database Connection Pooling** - Built-in PostgreSQL connection pooling
- **No Local Storage Dependencies** - All state stored in database

## Troubleshooting

### Common Issues

1. **QR Code Not Generating** - Check if Chrome/Chromium is installed
2. **Database Connection** - Verify DATABASE_URL format and credentials
3. **WhatsApp Disconnection** - Normal behavior, user needs to re-scan QR
4. **Port Conflicts** - Change PORT in .env if 3001 is occupied

### Logs

Check console output for detailed error messages and debugging information.

## License

MIT License - Feel free to use and modify as needed.