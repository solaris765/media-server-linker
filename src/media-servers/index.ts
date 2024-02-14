import type { EpisodeResource, SeriesResource } from "../media-managers/sonarr/types/api";
import type { WebhookEpisodeChangePayload } from "../media-managers/sonarr/types/webhooks";
import type { Logger } from "../types";
import fs from "fs/promises";

export interface MediaServerOptions {
  logger: Logger;
}
export abstract class MediaServer {
  protected logger: Logger;
  protected mediaRootPath = process.env.MEDIA_ROOT_PATH || '/media';
  protected mediaSourceDir = process.env.MEDIA_SOURCE_DIR || 'data';
  abstract mediaServerPath: string;

  constructor(options: MediaServerOptions) {
    this.logger = options.logger;
  }

  abstract linkEpisodeToLibrary(episode: EpisodeResource): Promise<boolean> | boolean;
}

export interface MediaServerConstructor {
  new (options: MediaServerOptions): MediaServer;
}

let mediaServerModules: MediaServerConstructor[] = [];

async function getMediaServers(logger: Logger): Promise<MediaServer[]> {
  let mediaServers: MediaServer[] = [];
  
  if (mediaServerModules.length === 0) {
    const files = (await fs.readdir(import.meta.dir)).filter((file) => file.endsWith('.ts') && file !== 'index.ts');
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
    mediaServers = mediaServerModules.map((module) => new module({ logger }));
  }

  return mediaServers;
}

export async function linkEpisodeToLibrary(
  episode: EpisodeResource,
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