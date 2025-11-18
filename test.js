const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const contacts  = ['919840404328@c.us', '918248015147@c.us', '919363842815@c.us', '919677166297@c.us', '919677717097@c.us'];
const message = 'Hello I am Pravinkumar👋, this is a test bulk message!';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: 'new',
        webCache: false 
    }
});

client.on('qr', qr => {
    console.log('QR Code received, please scan!');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
     contacts.forEach(number => {
        client.sendMessage(number, message).then(response => {
            console.log('Message sent to', number, response);
        }).catch(err => {
            console.error('Failed to send to', number, err);
        });
    });
});

client.on('authenticated', () => {
    console.log('Authenticated');
});

client.on('auth_failure', msg => {
    console.error('Authentication failure', msg);
});

client.initialize();