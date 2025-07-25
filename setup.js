const { Pool } = require('pg');
require('dotenv').config();

async function setupDatabase() {
  console.log('🔧 Setting up WhatsApp Auto-Reply Bot...\n');

  // Check if .env file exists
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL not found in .env file');
    console.log('📝 Please copy .env.example to .env and configure your database settings');
    process.exit(1);
  }

  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Create tables
    console.log('📊 Creating database tables...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_data TEXT,
        is_active BOOLEAN DEFAULT false,
        auto_reply_message TEXT DEFAULT 'Thank you for your message. I will get back to you soon.',
        is_paused BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        contact_number VARCHAR(50),
        message_received TEXT,
        reply_sent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables created successfully');

    // Check table counts
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const sessionCount = await pool.query('SELECT COUNT(*) FROM user_sessions');
    const activityCount = await pool.query('SELECT COUNT(*) FROM activity_logs');

    console.log('\n📈 Database Status:');
    console.log(`   Users: ${userCount.rows[0].count}`);
    console.log(`   Sessions: ${sessionCount.rows[0].count}`);
    console.log(`   Activity Logs: ${activityCount.rows[0].count}`);

    await pool.end();

    console.log('\n🎉 Setup completed successfully!');
    console.log('\n🚀 Next steps:');
    console.log('   1. Run: npm start');
    console.log('   2. Open: http://localhost:3001');
    console.log('   3. Register a new account');
    console.log('   4. Scan QR code with WhatsApp');
    console.log('   5. Configure your auto-reply message');
    console.log('\n💡 The bot will automatically reply to unknown numbers!');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Troubleshooting:');
      console.log('   - Make sure PostgreSQL is running');
      console.log('   - Check your DATABASE_URL in .env file');
      console.log('   - Verify database credentials');
    }
    
    process.exit(1);
  }
}

setupDatabase();