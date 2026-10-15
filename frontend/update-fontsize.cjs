const fs = require('fs');
const path = require('path');

/**
 * Update all fontSize hardcoded values to CSS variables
 * Run from your project root: node update-fontsize.js
 */

const REPLACEMENTS = {
  "fontSize: 9": "fontSize: 'var(--text-xs)'",
  "fontSize: 10": "fontSize: 'var(--text-xs)'",
  "fontSize: 11": "fontSize: 'var(--text-xs)'",
  "fontSize: 12": "fontSize: 'var(--text-sm)'",
  "fontSize: 13": "fontSize: 'var(--text-base)'",
  "fontSize: 14": "fontSize: 'var(--text-md)'",
  "fontSize: 15": "fontSize: 'var(--text-md)'",
  "fontSize: 16": "fontSize: 'var(--text-lg)'",
  "fontSize: 18": "fontSize: 'var(--text-xl)'",
  "fontSize: 20": "fontSize: 'var(--text-xl)'",
  "fontSize: 24": "fontSize: 'var(--text-2xl)'",
  "fontSize: 28": "fontSize: 'var(--text-3xl)'",
};

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let replacementCount = 0;

    // Replace each fontSize value
    for (const [find, replace] of Object.entries(REPLACEMENTS)) {
      const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = content.match(regex);
      
      if (matches) {
        content = content.replace(regex, replace);
        replacementCount += matches.length;
      }
    }

    // Only write if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      return replacementCount;
    }
    return 0;
  } catch (err) {
    console.error(`❌ Error processing ${filePath}:`, err.message);
    return 0;
  }
}

function getFilesRecursive(dirPath, fileList = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and hidden directories
      if (!file.startsWith('.') && file !== 'node_modules') {
        getFilesRecursive(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Main execution
console.log('🚀 Starting fontSize update...\n');

const srcPath = path.join(process.cwd(), 'src');

if (!fs.existsSync(srcPath)) {
  console.error('❌ Error: src/ directory not found. Run this script from your project root.');
  process.exit(1);
}

const files = getFilesRecursive(srcPath);
let totalReplacements = 0;
let filesUpdated = 0;

console.log(`📁 Found ${files.length} TypeScript files to scan...\n`);

files.forEach(filePath => {
  const replacements = updateFile(filePath);
  if (replacements > 0) {
    filesUpdated++;
    totalReplacements += replacements;
    const relativePath = path.relative(process.cwd(), filePath);
    console.log(`✅ ${relativePath} — ${replacements} replacement${replacements !== 1 ? 's' : ''}`);
  }
});

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`✨ Update Complete!`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`📊 Total replacements: ${totalReplacements}`);
console.log(`📄 Files updated: ${filesUpdated}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

if (totalReplacements === 0) {
  console.log('ℹ️  No fontSize values found. Your files might already be updated!\n');
} else {
  console.log('🎉 All fontSize values updated to CSS variables!\n');
  console.log('📝 Next steps:');
  console.log('   1. Review your files to ensure they look correct');
  console.log('   2. Test your application');
  console.log('   3. To adjust font sizes globally, edit index.css variables\n');
}