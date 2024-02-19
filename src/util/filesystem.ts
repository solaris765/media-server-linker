import fs from 'fs/promises';


export interface DBEntryLike {
  _id: string;
  _rev?: string;
  realPath: string;
  mediaServers: Record<string, string>;
}
export class DBEntry {
  _id: string;
  _rev?: string;
  realPath: string;
  mediaServers: Record<string, string>;

  constructor(id: string, realPath: string, mediaServers: Record<string, string>, rev?:string) {
    this._id = id;
    this._rev = rev;
    this.realPath = realPath;
    this.mediaServers = mediaServers;
  }

  static fromDoc(doc: DBEntryLike): DBEntry {
    return new DBEntry(doc._id, doc.realPath, doc.mediaServers, doc._rev);
  }

  toDoc(): DBEntryLike {
    return {
      _id: this._id,
      _rev: this._rev,
      realPath: this.realPath,
      mediaServers: this.mediaServers,
    };
  }

  updateMediaServerPath(mediaServerPath: string, path: string|undefined) {
    if (path === undefined) {
      delete this.mediaServers[mediaServerPath];
    } else {
    this.mediaServers[mediaServerPath] = path;  
    }
  }
}

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