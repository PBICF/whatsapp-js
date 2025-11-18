export function formatWhatsAppId(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') return null;

    const digitsOnly = phoneNumber.replace(/\D/g, '');

    if (digitsOnly.length !== 12) return null;

    return `${digitsOnly}@c.us`;
}
