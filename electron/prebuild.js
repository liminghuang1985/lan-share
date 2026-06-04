const fs = require('fs');
const path = require('path');

const dirs = ['server', 'client', 'admin'];
const electronDir = __dirname;

for (const dir of dirs) {
    const src = path.join(electronDir, '..', dir);
    const dest = path.join(electronDir, dir);
    
    // Remove existing
    if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true });
    }
    
    // Copy
    function copyDir(src, dest) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                copyDir(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
    
    if (fs.existsSync(src)) {
        copyDir(src, dest);
        console.log(`Copied ${dir}/ to electron/${dir}/`);
    } else {
        console.error(`Warning: ${src} not found`);
    }
}
console.log('Prebuild copy done.');
