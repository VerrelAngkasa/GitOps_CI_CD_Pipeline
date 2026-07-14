const crypto = require('crypto');

// Uppercase letters and digits, minus visually ambiguous characters (0/O, 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateRecoveryCode() {
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let group = '';
    for (let i = 0; i < 4; i++) {
      const idx = crypto.randomInt(ALPHABET.length);
      group += ALPHABET[idx];
    }
    groups.push(group);
  }
  return groups.join('-'); // e.g. "7XJK-3PQR-M2VN-8DTY"
}

module.exports = { generateRecoveryCode };
