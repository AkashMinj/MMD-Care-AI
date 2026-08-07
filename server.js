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

// MySQL Database Connection Configuration
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'mysql_db',
    user: process.env.DB_USER || 'mmduser',
    password: process.env.DB_PASSWORD || 'mmdpassword',
    database: process.env.DB_NAME || 'mmdcare_db'
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
    } else {
        console.log('Successfully connected to MySQL database.');
    }
});

// Root / Health Check Route
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Backend server is running smoothly.' });
});

// AI Chat Endpoint using Google Gemini API
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;

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
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY.trim()}`, {
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

        res.json({ reply: aiReply });

    } catch (err) {
        console.error('Error processing AI response:', err.message);
        res.status(500).json({ error: 'Failed to communicate with AI service.' });
    }
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`Backend server active on port ${PORT}`);
});