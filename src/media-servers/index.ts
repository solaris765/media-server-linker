import type { EpisodeResource } from "../media-managers/sonarr/types/api";
import type { Logger } from "../types";
import fs from "fs/promises";
import { createSymLink, doesFileExist, removeLink } from "../util/filesystem";
import type { MinDBImplementation } from "../link-dbs";
import PouchDB from "pouchdb";

interface MinFSImplementation {
  createSymLink: (target: string, linkPath: string) => Promise<void>;
  doesFileExist: (path: string) => Promise<boolean>;
  removeLink: (linkPath: string) => Promise<void>;
}

export interface MediaServerOptions {
  logger: Logger;
  tvDb?: MinDBImplementation;
  movieDb?: MinDBImplementation;
  fileSystem?: MinFSImplementation
}
export abstract class MediaServer {
  protected logger: Logger;
  protected mediaRootPath = process.env.MEDIA_ROOT_PATH || '/media';
  protected mediaSourceDir = process.env.MEDIA_SOURCE_DIR || 'data';
  abstract mediaServerPath: string;

  protected fileSystem: MinFSImplementation
  tvDb: MinDBImplementation;
  movieDb: MinDBImplementation;

  constructor(options: MediaServerOptions) {
    this.logger = options.logger;
    this.fileSystem = options.fileSystem || { createSymLink, doesFileExist, removeLink };
    this.tvDb = options.tvDb || new PouchDB('tvdb', { prefix: process.env.DB_PATH });
    this.movieDb = options.movieDb  || new PouchDB('moviedb', { prefix: process.env.DB_PATH });
  }

  abstract linkEpisodeToLibrary(episode: EpisodeResource[]): Promise<boolean> | boolean;
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

export async function linkEpisodeToLibrary(
  episode: EpisodeResource[],
  logger: Logger,
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