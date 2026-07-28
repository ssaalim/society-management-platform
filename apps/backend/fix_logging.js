const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.service.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/metadata: \{ amount: payAmount, status: isResident \? 'REVIEW' : 'CLEARED' \},/g, "newValues: { amount: payAmount, status: isResident ? 'REVIEW' : 'CLEARED' },");
content = content.replace(/metadata: \{ amount: receipt.amountPaid, status: 'CLEARED' \},/g, "newValues: { amount: receipt.amountPaid, status: 'CLEARED' },");
content = content.replace(/metadata: \{ reason \},/g, "newValues: { reason },");

fs.writeFileSync(file, content);
