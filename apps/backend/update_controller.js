const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.controller.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /@RequirePermissions\('billing:write'\)\n  @Post\('receipt'\)/,
  `@RequirePermissions('billing:read')\n  @Post('receipt')`
);

content = content.replace(
  /@RequirePermissions\('billing:write'\)\n  @Post\('bulk-receipt'\)/,
  `@RequirePermissions('billing:read')\n  @Post('bulk-receipt')`
);

const newEndpoints = `
  @ApiOperation({ summary: 'Approve a payment receipt' })
  @RequirePermissions('billing:write')
  @Post('receipt/:id/approve')
  async approvePayment(@Param('id') id: string, @Req() req: any) {
    const result = await this.maintenanceService.approvePayment(id, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Reject a payment receipt' })
  @RequirePermissions('billing:write')
  @Post('receipt/:id/reject')
  async rejectPayment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const result = await this.maintenanceService.rejectPayment(id, body.reason, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'List and filter invoices/bills' })`;

content = content.replace(/@ApiOperation\(\{ summary: 'List and filter invoices\/bills' \}\)/, newEndpoints.trim());

fs.writeFileSync(file, content);
