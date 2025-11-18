import express from 'express';
import bodyParser from 'body-parser';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

import { formatWhatsAppId } from './helper.js'; 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// --- WhatsApp Client Setup ---
const client = new Client({
    authStrategy: new LocalAuth(),
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
 *   "recipient": "919876543210",
 *   "message": "Hello, this is a single message!"
 * }
 * 
 * FOR BULK MESSAGES:
 * {
 *   "recipients": [
 *     "919876543210",
 *     "15551234567"
 *   ],
 *   "message": "Hello, this is a bulk message!"
 * }
 */

// POST /send-message
app.post('/send-message', async (req, res) => {
    const { recipient, recipients, message } = req.body;

    // --- Input Validation ---
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'Message content is required and must be a string.' });
    }
    
    if (!client.info) {
        return res.status(503).json({ success: false, error: 'WhatsApp client is not ready. Please scan the QR code.' });
    }

    // --- Single Message Logic ---
    if (recipient && typeof recipient === 'string') {
        const formattedRecipient = formatWhatsAppId(recipient);

        if (!formattedRecipient) {
            return res.status(400).json({ 
                success: false, 
                error: `Invalid recipient number: "${recipient}". It must be 12 digits after removing non-numeric characters.` 
            });
        }

        let contentToSend;

        // --- Check if media is provided ---
        if (media) {
            // Validate required media fields
            if (!media.mimetype || !media.data) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Media object must contain "mimetype" and "data" fields.' 
                });
            }
            // Create a MessageMedia object from the payload
            contentToSend = new MessageMedia(media.mimetype, media.data, media.filename, media.caption);
        } 
        // --- If no media, use the text message ---
        else {
            if (!message) {
                 return res.status(400).json({ success: false, error: 'Message content is required for non-media messages.' });
            }
            contentToSend = message;
        }

        try {
            await client.sendMessage(formattedRecipient, contentToSend);
            console.log(`Single message sent to ${formattedRecipient}`);
            return res.status(200).json({ success: true, message: `Message sent to ${formattedRecipient}` });
        } catch (error) {
            console.error(`Failed to send single message to ${formattedRecipient}:`, error);
            return res.status(500).json({ success: false, error: `Failed to send message to ${formattedRecipient}.` });
        }
    } 
    // --- Bulk Message Logic ---
    else if (recipients && Array.isArray(recipients)) {
        if (recipients.length === 0) {
            return res.status(400).json({ success: false, error: 'Recipients array cannot be empty.' });
        }

        // --- Validate and format all recipients first ---
        const validRecipients = [];
        const invalidNumbers = [];

        for (const number of recipients) {
            const formattedId = formatWhatsAppId(number);
            if (formattedId) {
                validRecipients.push(formattedId);
            } else {
                invalidNumbers.push(number);
            }
        }

        if (invalidNumbers.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'The following numbers are invalid (must be 12 digits):', 
                invalidNumbers: invalidNumbers 
            });
        }
        
        console.log(`Starting bulk send to ${validRecipients.length} valid recipients.`);
        
        // Process messages asynchronously
        setImmediate(async () => {
            for (const recipientId of validRecipients) {
                try {
                    await client.sendMessage(recipientId, message);
                    console.log(`Bulk message sent successfully to ${recipientId}`);
                } catch (error) {
                    console.error(`Failed to send bulk message to ${recipientId}:`, error);
                }
            }
            console.log('Bulk sending process completed.');
        });

        return res.status(202).json({ 
            success: true, 
            message: `Bulk message dispatch started for ${validRecipients.length} recipients.` 
        });
    } 
    // --- Invalid Payload ---
    else {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid payload. Please provide either a "recipient" (string) or "recipients" (array).' 
        });
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