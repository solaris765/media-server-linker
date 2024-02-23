import type { EpisodeResource } from "../media-managers/sonarr/types/api";
import type { Logger } from "../types";
import fs from "fs/promises";
import path from "path";
import { createSymLink, doesFileExist, removeLink, getFilesFromMediaPath} from "../util/filesystem";
import { DB_EVENT_EMITTER } from "../link-dbs";
import  { TvDbEntry } from "../link-dbs";

interface MinFSImplementation {
  createSymLink: (target: string, linkPath: string) => Promise<void>;
  doesFileExist: (path: string) => Promise<boolean>;
  removeLink: (linkPath: string) => Promise<void>;
}

export interface MediaServerOptions {
  logger: Logger;
  fileSystem?: MinFSImplementation
}
export abstract class MediaServer {
  protected logger: Logger;
  mediaRootPath = process.env.MEDIA_ROOT_PATH || '/media';
  protected mediaSourceDir = process.env.MEDIA_SOURCE_DIR || 'data';
  abstract mediaServerPath: string;

  protected fileSystem: MinFSImplementation

  constructor(options: MediaServerOptions) {
    this.logger = options.logger;
    this.fileSystem = options.fileSystem || { createSymLink, doesFileExist, removeLink };
  }

  abstract linkEpisodeToLibrary(episode: TvDbEntry): Promise<{id: string, result:string}> | {id: string, result:string};
}

export interface MediaServerConstructor {
  new (options: MediaServerOptions): MediaServer;
}

let mediaServerModules: MediaServerConstructor[] = [];

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
      if (!module.default) {
        logger.error(`No default export found in ${file}`);
        continue;
      }
      mediaServerModules.push(module.default);
      mediaServers.push(new module.default({ logger }));
    }
  } else {
    mediaServers = mediaServerModules.map(module => new module({ logger }));
  }

  return mediaServers;
}

DB_EVENT_EMITTER.on('tv', async (doc: TvDbEntry) => {
  const mediaServers = await getMediaServers(console);
  for (const mediaServer of mediaServers) {
    try {
      await mediaServer.linkEpisodeToLibrary(doc);
    } catch (e) {
      console.error(`Error linking episode to ${mediaServer.mediaServerPath}: ${e}`);
    }
  }
});
