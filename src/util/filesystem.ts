import fs from 'fs/promises';
import { glob,  } from 'glob';

async function ensurePathExists(path: string): Promise<void> {
  // ensure the destination directory exists creating its parent directories if necessary
  const destinationDirectory = path.split('/').slice(0, -1)

  await fs.mkdir(destinationDirectory.join('/'), { recursive: true });
}
export async function createSymLink(source: string, destination: string): Promise<void> {
  await ensurePathExists(destination);

  // if the destination exists, remove it
  if (await doesFileExist(destination)) {
    await fs.unlink(destination);
  }
  return fs.link(source, destination);
}

export async function doesFileExist(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export async function removeLink(linkPath: string): Promise<void> {
  await ensurePathExists(linkPath);
  if (await doesFileExist(linkPath)) {
    return fs.unlink(linkPath);
  }
}

export async function getFilesFromMediaPath(path:string): Promise<string[]> {
  return glob(`${path}/**/*.*`,{withFileTypes: true}).then((files) => {
    return files.filter((file) => file.isFile()).map((file) => file.path)
  });
}