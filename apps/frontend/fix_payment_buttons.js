const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/maintenance/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Bulk action bar
content = content.replace(
  /\{isManagementRole && selectedBillIds\.length > 0 && activeView === 'bills' && \(/,
  "{selectedBillIds.length > 0 && activeView === 'bills' && ("
);

// 2. Select All Checkbox th
// We can just find `{isManagementRole && (\n                        <th className="p-4 w-10">`
content = content.replace(
  /\{isManagementRole && \(\s*<th className="p-4 w-10">/,
  "<th className=\"p-4 w-10\">"
);
// And the closing brace for that block
// It's after `</button>\n                        </th>\n                      )}`
content = content.replace(
  /<\/button>\s*<\/th>\s*\)}/,
  "</button>\n                        </th>"
);

// 3. Select single bill td
content = content.replace(
  /\{isManagementRole && \(\s*<td className="p-4">/,
  "<td className=\"p-4\">"
);
content = content.replace(
  /<\/CheckCircle>\s*<\/td>\s*\)}/,
  "</CheckCircle>\n                            </td>"
);
// Wait, the icon is <CheckCircle className="..." /> so the tag is self-closing
content = content.replace(
  /<\/CheckCircle>\n\s*<\/td>\n\s*\)}/, // This is wrong if it's self closing. Let's see how it looks.
  ""
);

