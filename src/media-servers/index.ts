import type { EpisodeResource } from "../media-managers/sonarr/types/api";
import type { Logger } from "../types";
import fs from "fs/promises";
import fsSync from "fs";
import type { DBEntryLike } from "../util/filesystem";
import PouchDB from "pouchdb";
import { createSymLink, doesFileExist, removeLink } from "../util/filesystem";

export function getCacheDB(name: string) {
  if (!process.env.DB_PATH) {
    throw new Error('DB_PATH is not defined');
  }
  if (!process.env.DB_PATH.endsWith('/')) {
    process.env.DB_PATH += '/';
  }
  if (!name) {
    throw new Error('DB name is not defined');
  }
  const dbPath = process.env.DB_PATH || '/data/db/';
  fsSync.mkdirSync(dbPath, { recursive: true });
  return new PouchDB<DBEntryLike>(name, {
    prefix: dbPath,
  });
}

interface MinFSImplementation {
  createSymLink: (target: string, linkPath: string) => Promise<void>;
  doesFileExist: (path: string) => Promise<boolean>;
  removeLink: (linkPath: string) => Promise<void>;
}
type MinDBImplementation = Pick<PouchDB.Database<DBEntryLike>, 'get' | 'put'>;
export interface MediaServerOptions {
  logger: Logger;
  db: MinDBImplementation;
  fileSystem?: MinFSImplementation
}
export abstract class MediaServer {
  protected logger: Logger;
  protected mediaRootPath = process.env.MEDIA_ROOT_PATH || '/media';
  protected mediaSourceDir = process.env.MEDIA_SOURCE_DIR || 'data';
  abstract mediaServerPath: string;

  private _db: MinDBImplementation;
  protected fileSystem: MinFSImplementation

  protected getDB(libraryType: string) {
    return {
      get: (id: string) => this._db.get(libraryType+id),
      put: (doc: DBEntryLike) => {
        doc._id = libraryType+doc._id;
        return this._db.put(doc)
      }
    }
  }

  constructor(options: MediaServerOptions) {
    this.logger = options.logger;
    this._db = options.db;
    this.fileSystem = options.fileSystem || { createSymLink, doesFileExist, removeLink };
  }

  abstract linkEpisodeToLibrary(episode: EpisodeResource[]): Promise<boolean> | boolean;
}

export interface MediaServerConstructor {
  new (options: MediaServerOptions): MediaServer;
}

let mediaServerModules: [string, MediaServerConstructor][] = [];

async function getMediaServers(logger: Logger): Promise<MediaServer[]> {
  let mediaServers: MediaServer[] = [];
  
  if (mediaServerModules.length === 0) {
    const files = (await fs.readdir(import.meta.dir)).filter((file) => 
      file.endsWith('.ts') && 
      file !== 'index.ts' &&
      !file.endsWith('test.ts')
      );
    for (const file of files) {
      const module = await import(`./${file}`);
      const moduleName = file.split('.')[0];
      if (!module.default) {
        logger.error(`No default export found in ${file}`);
        continue;
      }
      mediaServerModules.push([moduleName, module.default]);
      mediaServers.push(new module.default({ logger, db: getCacheDB(moduleName)}));
    }
  } else {
    mediaServers = mediaServerModules.map(([name, module]) => new module({ logger, db: getCacheDB(name) }));
  }

  return mediaServers;
}

export async function linkEpisodeToLibrary(
  episode: EpisodeResource[],
  logger: Logger
): Promise<boolean> {
  const mediaServers = await getMediaServers(logger);

  let success = true;
  for (const mediaServer of mediaServers) {
    try {
      await mediaServer.linkEpisodeToLibrary(episode);
    } catch (e) {
      logger.error(`Error linking episode to ${mediaServer.mediaServerPath}: ${e}`);
      success = false;
    }
  }
  return success;
}