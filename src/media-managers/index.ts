import fs from 'fs';
import path from 'path';
import type { MediaManager, MediaManagerConstructor } from '../types';


export const mediaManagers = fs.readdirSync(__dirname)
  .filter(file => {
    let isDir = fs.lstatSync(path.join(__dirname, file)).isDirectory();
    if (!isDir) return file.endsWith('.ts') && file !== 'index.ts';

    return fs.existsSync(path.join(__dirname, file, 'index.ts'));
  })
  .map(file => {
    const module = require(path.join(__dirname, file));
    if (!module.default) throw new Error(`Module ${file} does not have a default export`);
    if (!module.name) throw new Error(`Module ${file} does not have a name export`);
    return {
      name: module.name as string,
      handler: module.default as MediaManagerConstructor
    }
  })


