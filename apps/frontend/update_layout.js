const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/flats/layout/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
content = content.replace(/import \{ apiClient \} from '\.\.\/\.\.\/\.\.\/lib\/api\/client';/, `import { apiClient } from '../../../lib/api/client';\nimport { PromptModal, PromptModalConfig } from '../../../components/prompt-modal';`);

// Add State
content = content.replace(/const \[hierarchy, setHierarchy\] = useState<any\[\]>\(\[\]\);/, `const [hierarchy, setHierarchy] = useState<any[]>([]);\n  const [promptConfig, setPromptConfig] = useState<PromptModalConfig>({ isOpen: false, title: '', label: '', placeholder: '', onSubmit: () => {}, onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })) });`);

// handleEditBuilding
content = content.replace(/const handleEditBuilding = async \(id: string, currentName: string\) => \{[\s\S]*?const newName = window\.prompt\('Enter new building name:', currentName\);[\s\S]*?if \(!newName \|\| newName === currentName\) return;[\s\S]*?try \{[\s\S]*?await apiClient\.patch\(`\/flats\/layout\/building\/\$\{id\}`\, \{ name: newName \}\);[\s\S]*?fetchLayout\(\);[\s\S]*?\} catch \(err\) \{[\s\S]*?alert\('Failed to update building'\);[\s\S]*?\}[\s\S]*?\};/, `const handleEditBuilding = (id: string, currentName: string) => {
    setPromptConfig({
      isOpen: true,
      title: 'Edit Building',
      label: 'Building Name',
      placeholder: 'e.g. Tower A',
      initialValue: currentName,
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (newName) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        if (newName === currentName) return;
        try {
          await apiClient.patch(\`/flats/layout/building/\${id}\`, { name: newName });
          fetchLayout();
        } catch (err) {
          alert('Failed to update building');
        }
      }
    });
  };`);

// handleEditWing
content = content.replace(/const handleEditWing = async \(id: string, currentName: string\) => \{[\s\S]*?const newName = window\.prompt\('Enter new wing name:', currentName\);[\s\S]*?if \(!newName \|\| newName === currentName\) return;[\s\S]*?try \{[\s\S]*?await apiClient\.patch\(`\/flats\/layout\/wing\/\$\{id\}`\, \{ name: newName \}\);[\s\S]*?fetchLayout\(\);[\s\S]*?\} catch \(err\) \{[\s\S]*?alert\('Failed to update wing'\);[\s\S]*?\}[\s\S]*?\};/, `const handleEditWing = (id: string, currentName: string) => {
    setPromptConfig({
      isOpen: true,
      title: 'Edit Wing',
      label: 'Wing Name',
      placeholder: 'e.g. Wing A1',
      initialValue: currentName,
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (newName) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        if (newName === currentName) return;
        try {
          await apiClient.patch(\`/flats/layout/wing/\${id}\`, { name: newName });
          fetchLayout();
        } catch (err) {
          alert('Failed to update wing');
        }
      }
    });
  };`);

// handleEditFloor
content = content.replace(/const handleEditFloor = async \(id: string, currentNum: number\) => \{[\s\S]*?const newNumStr = window\.prompt\('Enter new floor number:', String\(currentNum\)\);[\s\S]*?if \(!newNumStr\) return;[\s\S]*?const newNum = parseInt\(newNumStr, 10\);[\s\S]*?if \(isNaN\(newNum\) \|\| newNum === currentNum\) return;[\s\S]*?try \{[\s\S]*?await apiClient\.patch\(`\/flats\/layout\/floor\/\$\{id\}`\, \{ number: newNum \}\);[\s\S]*?fetchLayout\(\);[\s\S]*?\} catch \(err\) \{[\s\S]*?alert\('Failed to update floor'\);[\s\S]*?\}[\s\S]*?\};/, `const handleEditFloor = (id: string, currentNum: number) => {
    setPromptConfig({
      isOpen: true,
      title: 'Edit Floor',
      label: 'Floor Number',
      placeholder: 'e.g. 1',
      initialValue: String(currentNum),
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (newNumStr) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        const newNum = parseInt(newNumStr, 10);
        if (isNaN(newNum) || newNum === currentNum) return;
        try {
          await apiClient.patch(\`/flats/layout/floor/\${id}\`, { number: newNum });
          fetchLayout();
        } catch (err) {
          alert('Failed to update floor');
        }
      }
    });
  };`);

// handleAddBuilding
content = content.replace(/const handleAddBuilding = async \(\) => \{[\s\S]*?const name = window\.prompt\('Enter building name \(e\.g\. Tower A\):'\);[\s\S]*?if \(!name\) return;[\s\S]*?try \{[\s\S]*?await apiClient\.post\('\/flats\/layout\/building', \{ name \}\);[\s\S]*?fetchLayout\(\);[\s\S]*?\} catch \(err\) \{[\s\S]*?alert\('Failed to create building'\);[\s\S]*?\}[\s\S]*?\};/, `const handleAddBuilding = () => {
    setPromptConfig({
      isOpen: true,
      title: 'Add Building / Tower',
      label: 'Building Name',
      placeholder: 'e.g. Tower A',
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (name) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await apiClient.post('/flats/layout/building', { name });
          fetchLayout();
        } catch (err) {
          alert('Failed to create building');
        }
      }
    });
  };`);

// handleAddWing
content = content.replace(/const handleAddWing = async \(buildingId: string\) => \{[\s\S]*?const name = window\.prompt\('Enter wing name \(e\.g\. Wing A1\):'\);[\s\S]*?if \(!name\) return;[\s\S]*?try \{[\s\S]*?await apiClient\.post\('\/flats\/layout\/wing', \{ buildingId, name \}\);[\s\S]*?fetchLayout\(\);[\s\S]*?\} catch \(err\) \{[\s\S]*?alert\('Failed to create wing'\);[\s\S]*?\}[\s\S]*?\};/, `const handleAddWing = (buildingId: string) => {
    setPromptConfig({
      isOpen: true,
      title: 'Add Wing',
      label: 'Wing Name',
      placeholder: 'e.g. Wing A1',
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (name) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await apiClient.post('/flats/layout/wing', { buildingId, name });
          fetchLayout();
        } catch (err) {
          alert('Failed to create wing');
        }
      }
    });
  };`);

// handleAddFloor
content = content.replace(/const handleAddFloor = async \(wingId: string\) => \{[\s\S]*?const numberStr = window\.prompt\('Enter floor number \(e\.g\. 1\):'\);[\s\S]*?if \(!numberStr\) return;[\s\S]*?const number = parseInt\(numberStr, 10\);[\s\S]*?if \(isNaN\(number\)\) return alert\('Invalid floor number'\);[\s\S]*?try \{[\s\S]*?await apiClient\.post\('\/flats\/layout\/floor', \{ wingId, number \}\);[\s\S]*?fetchLayout\(\);[\s\S]*?\} catch \(err\) \{[\s\S]*?alert\('Failed to create floor'\);[\s\S]*?\}[\s\S]*?\};/, `const handleAddFloor = (wingId: string) => {
    setPromptConfig({
      isOpen: true,
      title: 'Add Floor',
      label: 'Floor Number',
      placeholder: 'e.g. 1',
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (numberStr) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        const number = parseInt(numberStr, 10);
        if (isNaN(number)) return alert('Invalid floor number');
        try {
          await apiClient.post('/flats/layout/floor', { wingId, number });
          fetchLayout();
        } catch (err) {
          alert('Failed to create floor');
        }
      }
    });
  };`);

// Render Modal at bottom
content = content.replace(/<\/main>/, `  <PromptModal config={promptConfig} />\n    </main>`);

fs.writeFileSync(file, content);
