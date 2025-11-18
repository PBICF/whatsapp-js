const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const formatWhatsAppId = require('./helper.js')


// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(express.static('public'));

// --- WhatsApp Client Setup ---
const client = new Client({
    authStrategy: new LocalAuth(), // Uses a local session to keep you logged in
    puppeteer: {
        headless: 'new',
        args: ['--no-sandbox'] // Recommended for running on servers
    }
});

// --- WhatsApp Client Event Handlers ---

// Event: QR Code received
client.on('qr', (qr) => {
    console.log('QR Code Received! Please scan:');
    qrcode.generate(qr, { small: true });
});

// Event: Client is successfully authenticated and ready
client.on('ready', () => {
    console.log('WhatsApp client is ready!');
});

// Event: Authentication failed
client.on('auth_failure', msg => {
    console.error('Authentication failure:', msg);
});

// Event: Client is disconnected
client.on('disconnected', (reason) => {
    console.log('Client was logged out:', reason);
    // You might want to implement a reconnection strategy here
});

// Initialize the WhatsApp client
client.initialize();


// --- API Endpoints ---

/**
 * Standardized Payload Format:
 * 
 * FOR A SINGLE MESSAGE:
 * {
 *   "recipient": "919876543210@c.us",
 *   "message": "Hello, this is a single message!"
 * }
 * 
 * FOR BULK MESSAGES:
 * {
 *   "recipients": [
 *     "919876543210@c.us",
 *     "15551234567@c.us"
 *   ],
 *   "message": "Hello, this is a bulk message!"
 * }
 */

// POST /send-message
app.post('/send-message', async (req, res) => {
    const { recipient, recipients, message, media } = req.body;

    if (!client.info) {
        return res.status(503).json({ success: false, error: 'WhatsApp client is not ready. Please scan the QR code.' });
    }

    // Function to create MessageMedia if media is provided
    const createMedia = (mediaObj) => {
        if (!mediaObj || !mediaObj.data || !mediaObj.mimetype) return null;
        return new MessageMedia(mediaObj.mimetype, mediaObj.data, mediaObj.filename);
    };

    // --- Single Recipient ---
    if (recipient && typeof recipient === 'string') {
        const formattedRecipient = formatWhatsAppId(recipient);
        if (!formattedRecipient) {
            return res.status(400).json({ success: false, error: 'Invalid recipient number.' });
        }

        let contentToSend = createMedia(media) || message;
        if (!contentToSend) {
            return res.status(400).json({ success: false, error: 'Message or media is required.' });
        }

        try {
            await client.sendMessage(formattedRecipient, contentToSend, { caption: media?.caption || '' });
            return res.status(200).json({ success: true, message: `Message sent to ${formattedRecipient}` });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ success: false, error: 'Failed to send message.' });
        }
    }

    // --- Bulk Recipients ---
    else if (recipients && Array.isArray(recipients) && recipients.length > 0) {
        // Validate and format all recipients
        const validRecipients = [];
        const invalidNumbers = [];

        for (const number of recipients) {
            const formattedId = formatWhatsAppId(number);
            if (formattedId) validRecipients.push(formattedId);
            else invalidNumbers.push(number);
        }

        if (invalidNumbers.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Some numbers are invalid.', 
                invalidNumbers 
            });
        }

        const contentToSend = createMedia(media) || message;
        if (!contentToSend) {
            return res.status(400).json({ success: false, error: 'Message or media is required.' });
        }

        // Use a **throttled loop** to send messages in batches
        const batchSize = 20; // adjust depending on server load
        let sentCount = 0;

        for (let i = 0; i < validRecipients.length; i += batchSize) {
            const batch = validRecipients.slice(i, i + batchSize);
            await Promise.all(batch.map(async (recipientId) => {
                try {
                    await client.sendMessage(recipientId, contentToSend, { 
                        linkPreview: true,
                        caption: media?.caption || '' 
                    });
                    sentCount++;
                    console.log(`Sent to ${recipientId}`);
                } catch (err) {
                    console.error(`Failed to send to ${recipientId}:`, err.message);
                }
            }));

            // Optional delay between batches to avoid WhatsApp throttling
            await new Promise(r => setTimeout(r, 2000)); 
        }

        return res.status(202).json({ 
            success: true, 
            message: `Bulk message sending started. Successfully sent to ${sentCount} recipients.` 
        });
    }

    else {
        return res.status(400).json({ success: false, error: 'Invalid payload. Provide "recipient" or "recipients".' });
    }
});

// GET /status
// A simple endpoint to check if the WhatsApp client is ready
app.get('/status', (req, res) => {
    if (client.info) {
        res.status(200).json({ success: true, status: 'Client is ready', user: client.info.pushname });
    } else {
        res.status(503).json({ success: false, status: 'Client is not ready. Please scan the QR code.' });
    }
});


// --- Start Express Server ---
app.listen(PORT, () => {
    console.log(`Express server is running on http://localhost:${PORT}`);
});