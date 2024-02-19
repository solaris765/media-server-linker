import fs from 'fs/promises';
import path from 'path';
import type { MediaManagerConstructor } from '../types';


let mediaManagers: {
  name: string,
  handler: MediaManagerConstructor
}[] = []

export async function getMediaManagers() {
  if (mediaManagers.length > 0) return mediaManagers;

  const files = (await fs.readdir(import.meta.dir)).filter(async file => {
    let isDir = await (await fs.lstat(path.join(__dirname, file))).isDirectory()
    if (!isDir) return file.endsWith('.ts') && file !== 'index.ts';
  
    let hasIndex = true;
    try {
      await fs.access(path.join(__dirname, file, 'index.ts'));
    } catch (error) {
      hasIndex = false;
    }
    return hasIndex;
  })

  mediaManagers = files
    .map(file => {
      const module = require(path.join(__dirname, file));
      if (!module.default) {
        console.warn(`Module ${file} does not have a default export`);
        return null
      }
      if (!module.name) {
        console.warn(`Module ${file} does not have a name export`);
        return null
      }
      return {
        name: module.name as string,
        handler: module.default as MediaManagerConstructor
      }
    }).filter(Boolean) as {
      name: string,
      handler: MediaManagerConstructor
    }[];
  
  return mediaManagers;
}
