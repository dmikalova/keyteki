const fs = require('fs');
const path = require('path');

let cards = {};

function loadDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            loadDirectory(fullPath);
        } else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
            const card = require(fullPath);
            cards[card.id] = card;
        }
    }
}

loadDirectory(__dirname);

module.exports = cards;
