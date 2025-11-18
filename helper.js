/**
 * Validates a phone number and formats it for WhatsApp.
 * - Checks if the number is exactly 12 digits.
 * - Removes any non-digit characters.
 * - Appends the @c.us suffix.
 * @param {string} phoneNumber - The phone number to validate and format.
 * @returns {string|null} The formatted WhatsApp ID (e.g., '919876543210@c.us') or null if invalid.
 */
export function formatWhatsAppId(phoneNumber) {
    // 1. Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');

    // 2. Check if the resulting number is exactly 12 digits
    if (digitsOnly.length !== 12) {
        return null; // Return null if the number is not 12 digits
    }

    // 3. Append the @c.us suffix
    return `${digitsOnly}@c.us`;
}