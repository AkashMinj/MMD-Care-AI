const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Load Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// MySQL Database Connection Configuration (promise wrapper for async/await)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'mysql_db',
    user: process.env.DB_USER || 'mmduser',
    password: process.env.DB_PASSWORD || 'mmdpassword',
    database: process.env.DB_NAME || 'mmdcare_db',
    waitForConnections: true,
    connectionLimit: 10
}).promise();

// Create tables if they don't exist, then confirm connectivity
async function initDb() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                email VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                sender ENUM('user', 'ai') NOT NULL,
                text TEXT NOT NULL,
                timestamp BIGINT NOT NULL,
                INDEX idx_user_email (user_email)
            )
        `);
        console.log('Successfully connected to MySQL database and verified schema.');
    } catch (err) {
        console.error('Database initialization failed:', err.message);
    }
}
initDb();

// Root / Health Check Route
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Backend server is running smoothly.' });
});

// User sign-in: upsert user by email
app.post('/api/users/login', async (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email || !name) {
            return res.status(400).json({ error: 'Both "email" and "name" are required.' });
        }

        await pool.query(
            `INSERT INTO users (email, name) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE name = VALUES(name)`,
            [email, name]
        );

        res.json({ email, name });
    } catch (err) {
        console.error('Error during user login:', err.message);
        res.status(500).json({ error: 'Failed to sign in.' });
    }
});

// Retrieve a user's chat history
app.get('/api/chats/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const [rows] = await pool.query(
            `SELECT sender, text, timestamp FROM messages WHERE user_email = ? ORDER BY timestamp ASC`,
            [email]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching chat history:', err.message);
        res.status(500).json({ error: 'Failed to load chat history.' });
    }
});

// AI Chat Endpoint using Google Gemini API
app.post('/api/chat', async (req, res) => {
    try {
        const { userEmail, userMessage, messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid payload: "messages" array is required.' });
        }

        if (!GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is missing in environment variables.');
            return res.status(500).json({ error: 'Server AI configuration missing.' });
        }

        // Transform incoming message structure to Gemini API payload format
        const geminiContents = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        // Fetch completion from Gemini REST endpoint
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY.trim()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: geminiContents
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API Error:', data);
            return res.status(response.status).json({ error: data.error?.message || 'Gemini API request failed' });
        }

        // Extract model output response text
        const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiReply) {
            return res.status(500).json({ error: 'Received an empty response from Gemini AI.' });
        }

        // Persist the exchange for logged-in (non-anonymous) users
        if (userEmail && userEmail !== 'anonymous@mmdcare.com') {
            const now = Date.now();
            await pool.query(
                `INSERT INTO messages (user_email, sender, text, timestamp) VALUES (?, 'user', ?, ?), (?, 'ai', ?, ?)`,
                [userEmail, userMessage, now, userEmail, aiReply, now + 1]
            ).catch(err => console.error('Failed to persist chat message:', err.message));
        }

        // Respond in the shape the frontend expects (data.choices[0].message.content)
        res.json({
            choices: [
                { message: { role: 'assistant', content: aiReply } }
            ]
        });

    } catch (err) {
        console.error('Error processing AI response:', err.message);
        res.status(500).json({ error: 'Failed to communicate with AI service.' });
    }
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`Backend server active on port ${PORT}`);
});