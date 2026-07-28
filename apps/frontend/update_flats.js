const fs = require('fs');

const file1 = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/flats/page.tsx';
let content1 = fs.readFileSync(file1, 'utf8');

// Add import
content1 = content1.replace(/import { apiClient } from '\.\.\/\.\.\/\.\.\/lib\/api\/client';/, `import { apiClient } from '../../../lib/api/client';\nimport { PromptModal, PromptModalConfig } from '../../../components/prompt-modal';`);

// Add state
content1 = content1.replace(/const \[isAddFlatModalOpen, setIsAddFlatModalOpen\] = useState<boolean>\(false\);/, `const [isAddFlatModalOpen, setIsAddFlatModalOpen] = useState<boolean>(false);\n  const [promptConfig, setPromptConfig] = useState<PromptModalConfig>({ isOpen: false, title: '', label: '', placeholder: '', onSubmit: () => {}, onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })) });`);

// Update Building
content1 = content1.replace(/const handleCreateBuilding = async \(\) => \{[\s\S]*?const name = window\.prompt\('Enter new building\/tower name \(e\.g\. Tower A\):'\);[\s\S]*?if \(!name\) return;[\s\S]*?try \{[\s\S]*?const res = await apiClient\.post\('\/flats\/layout\/building', \{ name \}\);[\s\S]*?if \(res\.data\?\.success\) \{[\s\S]*?setSelectedLayoutBuildingId\(res\.data\.data\.id\);[\s\S]*?const resLayout = await apiClient\.get\('\/flats\/layout'\);[\s\S]*?if \(resLayout\.data\?\.success\) setLayoutHierarchy\(resLayout\.data\.data\);[\s\S]*?\}[\s\S]*?\} catch \(err\) \{[\s\S]*?alert\('Failed to create building'\);[\s\S]*?\}[\s\S]*?\};/, `const handleCreateBuilding = () => {
    setPromptConfig({
      isOpen: true,
      title: 'Add Building / Tower',
      subtitle: 'Create a new main structure in your society',
      label: 'Building Name',
      placeholder: 'e.g. Tower A',
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (name) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await apiClient.post('/flats/layout/building', { name });
          if (res.data?.success) {
            setSelectedLayoutBuildingId(res.data.data.id);
            const resLayout = await apiClient.get('/flats/layout');
            if (resLayout.data?.success) setLayoutHierarchy(resLayout.data.data);
          }
        } catch (err) {
          alert('Failed to create building');
        }
      }
    });
  };`);

// Update Wing
content1 = content1.replace(/const handleCreateWing = async \(\) => \{[\s\S]*?if \(!selectedLayoutBuildingId\) return alert\('Select a building first'\);[\s\S]*?const name = window\.prompt\('Enter new wing name \(e\.g\. Wing A1\):'\);[\s\S]*?if \(!name\) return;[\s\S]*?try \{[\s\S]*?const res = await apiClient\.post\('\/flats\/layout\/wing', \{ buildingId: selectedLayoutBuildingId, name \}\);[\s\S]*?if \(res\.data\?\.success\) \{[\s\S]*?setSelectedLayoutWingId\(res\.data\.data\.id\);[\s\S]*?const resLayout = await apiClient\.get\('\/flats\/layout'\);[\s\S]*?if \(resLayout\.data\?\.success\) setLayoutHierarchy\(resLayout\.data\.data\);[\s\S]*?\}[\s\S]*?\} catch \(err\) \{[\s\S]*?alert\('Failed to create wing'\);[\s\S]*?\}[\s\S]*?\};/, `const handleCreateWing = () => {
    if (!selectedLayoutBuildingId) return alert('Select a building first');
    setPromptConfig({
      isOpen: true,
      title: 'Add Wing',
      subtitle: 'Create a new wing inside the selected building',
      label: 'Wing Name',
      placeholder: 'e.g. Wing A1',
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (name) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await apiClient.post('/flats/layout/wing', { buildingId: selectedLayoutBuildingId, name });
          if (res.data?.success) {
            setSelectedLayoutWingId(res.data.data.id);
            const resLayout = await apiClient.get('/flats/layout');
            if (resLayout.data?.success) setLayoutHierarchy(resLayout.data.data);
          }
        } catch (err) {
          alert('Failed to create wing');
        }
      }
    });
  };`);

// Update Floor
content1 = content1.replace(/const handleCreateFloor = async \(\) => \{[\s\S]*?if \(!selectedLayoutWingId\) return alert\('Select a wing first'\);[\s\S]*?const numberStr = window\.prompt\('Enter floor number \(e\.g\. 1\):'\);[\s\S]*?if \(!numberStr\) return;[\s\S]*?const number = parseInt\(numberStr, 10\);[\s\S]*?if \(isNaN\(number\)\) return alert\('Invalid floor number'\);[\s\S]*?try \{[\s\S]*?const res = await apiClient\.post\('\/flats\/layout\/floor', \{ wingId: selectedLayoutWingId, number \}\);[\s\S]*?if \(res\.data\?\.success\) \{[\s\S]*?setSelectedFloorId\(res\.data\.data\.id\);[\s\S]*?const resLayout = await apiClient\.get\('\/flats\/layout'\);[\s\S]*?if \(resLayout\.data\?\.success\) setLayoutHierarchy\(resLayout\.data\.data\);[\s\S]*?\}[\s\S]*?\} catch \(err\) \{[\s\S]*?alert\('Failed to create floor'\);[\s\S]*?\}[\s\S]*?\};/, `const handleCreateFloor = () => {
    if (!selectedLayoutWingId) return alert('Select a wing first');
    setPromptConfig({
      isOpen: true,
      title: 'Add Floor',
      subtitle: 'Add a new floor to the selected wing',
      label: 'Floor Number',
      placeholder: 'e.g. 1, 2, 3...',
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (numberStr) => {
        const number = parseInt(numberStr, 10);
        if (isNaN(number)) return alert('Invalid floor number');
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await apiClient.post('/flats/layout/floor', { wingId: selectedLayoutWingId, number });
          if (res.data?.success) {
            setSelectedFloorId(res.data.data.id);
            const resLayout = await apiClient.get('/flats/layout');
            if (resLayout.data?.success) setLayoutHierarchy(resLayout.data.data);
          }
        } catch (err) {
          alert('Failed to create floor');
        }
      }
    });
  };`);

// Render Modal at bottom
content1 = content1.replace(/\{\/\* Add Flat Master Entry Modal \*\/\}/, `<PromptModal config={promptConfig} />\n\n      {/* Add Flat Master Entry Modal */}`);

fs.writeFileSync(file1, content1);
