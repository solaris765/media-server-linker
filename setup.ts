import path from 'path';
import fs from 'fs';
const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.resolve(import.meta.dir, 'db.sqlite');
const DATA_DIR = path.resolve('__tests__/__fixtures__/data');
try {
  fs.unlinkSync(path.resolve(DB_PATH, process.env.DB_NAME ?? 'db.sqlite'))
} catch (e) {
  console.error(e);
}


process.env.MEDIA_ROOT_PATH = path.resolve('__tests__/__fixtures__/media');
try {
  fs.rmdirSync(process.env.MEDIA_ROOT_PATH, { recursive: true })
} catch (e) {
  console.error(e);
}
