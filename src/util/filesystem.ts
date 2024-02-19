import fs from 'fs/promises';

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