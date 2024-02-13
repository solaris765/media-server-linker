import type { EpisodeResource, SeriesResource } from "../media-managers/sonarr/types/api";
import type { WebhookEpisodeChangePayload } from "../media-managers/sonarr/types/webhooks";
import type { Logger } from "../types";

export interface MediaServerOptions {
  logger: Logger;
}
export abstract class MediaServer {
  protected logger: Logger;
  protected mediaRootPath = process.env.MEDIA_ROOT_PATH || '/media';
  abstract mediaServerPath: string;

  constructor(options: MediaServerOptions) {
    this.logger = options.logger;
  }

  abstract linkEpisodeToLibrary(episode: EpisodeResource): Promise<boolean> | boolean;
}