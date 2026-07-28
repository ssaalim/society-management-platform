const fs = require('fs');

// 1. Controller
let controllerFile = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.controller.ts';
let controller = fs.readFileSync(controllerFile, 'utf8');
controller = controller.replace(/@Query\('status'\) status\?: string,/, `@Query('status') status?: string,\n    @Query('mine') mine?: string,`);
controller = controller.replace(/const list = await this\.maintenanceService\.findAll\(\{ search, status \}, req\.user\?\.id\);/, `const list = await this.maintenanceService.findAll({ search, status, mine: mine === 'true' }, req.user?.id);`);
fs.writeFileSync(controllerFile, controller);

// 2. Service
let serviceFile = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.service.ts';
let service = fs.readFileSync(serviceFile, 'utf8');
service = service.replace(/async findAll\(filters: \{ search\?: string; status\?: string \}, userId\?: string\) \{/, `async findAll(filters: { search?: string; status?: string; mine?: boolean }, userId?: string) {`);
fs.writeFileSync(serviceFile, service);

// 3. Repository
let repoFile = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.repository.ts';
let repo = fs.readFileSync(repoFile, 'utf8');
repo = repo.replace(/async searchBills\(filters: \{\s*search\?: string;\s*status\?: string;\s*userId\?: string;\s*\}\) \{/, `async searchBills(filters: {\n    search?: string;\n    status?: string;\n    userId?: string;\n    mine?: boolean;\n  }) {`);
repo = repo.replace(/if \(\['OWNER', 'TENANT'\]\.includes\(userRoleName\) && filters\.userId\) \{/, `if ((filters.mine || ['OWNER', 'TENANT'].includes(userRoleName)) && filters.userId) {`);
fs.writeFileSync(repoFile, repo);

console.log('Backend updated');
