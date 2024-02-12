import fs from 'fs';
import path from 'path';


export const mediaManagers = fs.readdirSync(__dirname)
  .filter(file => file !== 'index.ts')
  .map(file => {
    const manager = require(path.join(__dirname, file)).default;
    return {
      name: file.slice(0, -3),
      manager: manager
    }
  })


