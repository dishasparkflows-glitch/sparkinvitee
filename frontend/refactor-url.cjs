const fs = require('fs');
const path = require('path');

const directory = 'C:\\Users\\c computer\\Desktop\\spark flows\\sparkinvitee\\frontend\\src\\pages';

function refactor(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      refactor(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('http://localhost:5000')) {
        // Replace string concatenations with template literals if needed, 
        // but it's simpler to just replace the hardcoded string with the variable.
        // Wait, some use backticks: `http://localhost:5000/api/...`
        // We can replace http://localhost:5000 with ${import.meta.env.VITE_API_URL} inside backticks.
        // And replace 'http://localhost:5000/api/...' with `${import.meta.env.VITE_API_URL}/api/...`
        
        // 1. Replace single quotes: 'http://localhost:5000/api/...' -> `${import.meta.env.VITE_API_URL}/api/...`
        content = content.replace(/'http:\/\/localhost:5000([^']*)'/g, '`${import.meta.env.VITE_API_URL}$1`');
        
        // 2. Replace double quotes: "http://localhost:5000/api/..." -> `${import.meta.env.VITE_API_URL}/api/...`
        content = content.replace(/"http:\/\/localhost:5000([^"]*)"/g, '`${import.meta.env.VITE_API_URL}$1`');

        // 3. Replace inside existing backticks: `http://localhost:5000/api/...` -> `${import.meta.env.VITE_API_URL}/api/...`
        content = content.replace(/http:\/\/localhost:5000/g, '${import.meta.env.VITE_API_URL}');

        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated:', fullPath);
      }
    }
  }
}

refactor(directory);
