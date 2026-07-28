const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.service.ts';
let content = fs.readFileSync(file, 'utf8');

// The logic needs to be careful. Let's see the recordPayment signature
// async recordPayment(dto: CreateReceiptDto, userId: string)
// We need to fetch the user's roles first to see if they are a resident or management.
