const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const path = 'SERVICE_ACCOUNT_JSON';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = [
  'https://ai-maathan.ddns.net',
  'https://ai-chat-bot-sand-ten.vercel.app',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,POST',
  allowedHeaders: 'Content-Type,Authorization',
  credentials: true
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());

// Google Cloud TTS Client
const ttsClient = new textToSpeech.TextToSpeechClient({
  keyFilename: path
});

// Google Gemini AI Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let chatHistory = []

// Chatbot Endpoint
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro-latest" });

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0.9,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
      },
      systemInstruction: {
        role: "user",
        parts: [
          {
            text: `
You are Maathan, a cheerful bilingual chatbot who speaks like a close Malayali friend.
- Respond in the same language as the user (Malayalam or English).
- If the user speaks Malayalam, reply in casual Malayalam.
- Be natural, like someone chatting at a tea shop.
- Keep responses short and friendly.
- Ignore emojis completely. Do not describe or mention them in any way.
`,
          },
        ],
      },
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

      chatHistory.push(
      { role: "user", parts: [{ text: message }] },
      { role: "model", parts: [{ text: response }] }
    );

    if (chatHistory.length > 20) {
      chatHistory = chatHistory.slice(-20); // Keep last 10 exchanges
    }

    res.json({ reply: response });

  } catch (error) {
    console.error("Gemini AI error:", error);
    res.status(500).json({ error: "Gemini AI processing failed" });
  }
});

// Text-to-Speech Endpoint
app.post('/api/speak', async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim() === "") {
    return res.status(400).send("Text is required for speech synthesis");
  }

  const isMalayalam = /[\u0D00-\u0D7F]/.test(text);
  const languageCode = isMalayalam ? 'ml-IN' : 'en-US';

  const request = {
    input: { text },
    voice: { languageCode, ssmlGender: isMalayalam ? 'MALE' : 'NEUTRAL' },
    audioConfig: { audioEncoding: 'MP3' },
  };

  try {
    const [response] = await ttsClient.synthesizeSpeech(request);
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.audioContent);
  } catch (error) {
    console.error('Text-to-speech error:', error);
    res.status(500).send('Speech synthesis failed');
  }
});

// Start Server
app.listen(port, () => {
  console.log(`✅ Server listening on http://localhost:${port}`);
});
