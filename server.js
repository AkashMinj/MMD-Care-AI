const express = require('express');
const cors = require('cors');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TAMBO_API_KEY = process.env.TAMBO_API_KEY || 'YOUR_TAMBO_API_KEY';

app.use(cors());
app.use(express.json());

// MySQL Database Connection using Sequelize ORM
const sequelize = new Sequelize(
    process.env.DB_NAME || 'mmdcare_db',
    process.env.DB_USER || 'mmduser',
    process.env.DB_PASSWORD || 'mmdpassword',
    {
        host: process.env.DB_HOST || 'mysql_db',
        dialect: 'mysql',
        logging: false,
        retry: {
            max: 10 // Retry connection while MySQL initializes
        }
    }
);

// Database Schemas
const User = sequelize.define('User', {
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false }
});

const Message = sequelize.define('Message', {
    userEmail: { type: DataTypes.STRING, allowNull: false },
    sender: { type: DataTypes.STRING, allowNull: false }, // 'user' or 'ai'
    text: { type: DataTypes.TEXT, allowNull: false },
    timestamp: { type: DataTypes.BIGINT, allowNull: false }
});

// Auto-sync Database Tables on startup
async function initDB() {
    try {
        await sequelize.authenticate();
        await sequelize.sync();
        console.log('Successfully connected to MySQL database.');
    } catch (error) {
        console.error('MySQL Connection Error:', error.message);
        setTimeout(initDB, 5000); // Retry every 5s if DB is starting up
    }
}
initDB();

// API 1: User Login/Register
app.post('/api/users/login', async (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email || !name) {
            return res.status(400).json({ error: 'Email and name are required' });
        }
        
        let [user] = await User.findOrCreate({
            where: { email },
            defaults: { name }
        });

        if (user.name !== name) {
            user.name = name;
            await user.save();
        }

        res.json(user);
    } catch (error) {
        console.error('Error in /api/users/login:', error.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// API 2: Fetch Chat History for returning users
app.get('/api/chats/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const messages = await Message.findAll({
            where: { userEmail: email },
            order: [['timestamp', 'ASC']]
        });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching chat history:', error.message);
        res.status(500).json({ error: 'Failed to retrieve chat history' });
    }
});

// API 3: Handle AI Query & MySQL Storage
app.post('/api/chat', async (req, res) => {
    try {
        const { userEmail, userMessage, messages = [], userLanguage } = req.body;
        const fetch = (await import('node-fetch')).default;

        // 1. Save User Message to MySQL Database
        if (userEmail && userEmail !== 'anonymous@mmdcare.com') {
            await Message.create({
                userEmail,
                sender: 'user',
                text: userMessage,
                timestamp: Date.now()
            });
        }

        // 2. Comprehensive System Prompt for tailored AI Answers
        const systemInstruction = {
            role: 'system',
            content: `You are MMDCARE, an intelligent, empathetic, and highly capable AI mental health companion and therapist assistant. 

YOUR GOALS:
1. Provide thoughtful, well-reasoned, and supportive answers to user questions.
2. Validate user emotions authentically before giving actionable guidance.
3. Suggest evidence-based mindfulness exercises, cognitive reframing, or stress-management habits when appropriate.
4. Keep answers concise, clear, and easy to read (use 2-3 short paragraphs or clean bullet points).

SAFETY & BOUNDARIES:
- Never give direct medical advice or prescribe medication/dosages.
- Never encourage self-harm or unsafe behaviors.
- For severe distress or crises, gently guide users to professional crisis resources.

Language Context: Respond naturally in ${userLanguage || 'en'}.`
        };

        // 3. Map frontend conversation array to standard API role/content structure
        const formattedHistory = Array.isArray(messages) ? messages.map(m => ({
            role: m.role || (m.sender === 'user' ? 'user' : 'assistant'),
            content: m.content || m.text || ''
        })) : [];

        const payloadMessages = [
            systemInstruction,
            ...formattedHistory
        ];

        // 4. Send payload to Tambo AI
        // 4. Send payload to Tambo AI
        const response = await fetch('https://api.tambo.co/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TAMBO_API_KEY.trim()}`
            },
            body: JSON.stringify({
                model: 'gpt-5.2',
                messages: payloadMessages,
                temperature: 0.7,
                max_tokens: 600
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Tambo API raw error response (${response.status}):`, errorText);
            throw new Error(`Tambo API error: ${response.status}`);
        }

        const data = await response.json();
        const aiResponseText = data.choices[0].message.content;

        // 5. Save AI Response to MySQL Database
        if (userEmail && userEmail !== 'anonymous@mmdcare.com') {
            await Message.create({
                userEmail,
                sender: 'ai',
                text: aiResponseText,
                timestamp: Date.now()
            });
        }

        res.json(data);
    } catch (error) {
        console.error('Error processing AI response:', error.message);
        res.status(500).json({ error: 'Failed to generate AI response' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server active on port ${PORT}`);
});