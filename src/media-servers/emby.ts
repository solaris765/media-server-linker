import { MediaServer } from ".";
import type { EpisodeResource, SeriesResource } from "../media-managers/sonarr/types/api";
import type { WebhookEpisode, WebhookEpisodeChangePayload, WebhookSeries } from "../media-managers/sonarr/types/webhooks";
import type { Logger } from "../types";
import { createHardLink } from "../util/filesystem";

import {sonarrDB as db} from "../media-managers/sonarr";

export default class EmbyMediaServer extends MediaServer {
  mediaServerPath: string = 'emby';

  seriesFolderName(series: SeriesResource) {
    return `${series.title} (${series.year}) [imdbid-${series.imdbId}]`;
  }

  seasonFolderName(seasonNumber: number) {
    return `Season ${seasonNumber}`;
  }

  episodeFileName(seriesTitle: string, episode: EpisodeResource) {
    return `${seriesTitle} - S${episode.seasonNumber}E${episode.absoluteEpisodeNumber} - ${episode.title}`;

  }

  mediaServerPathForEpisode(series: SeriesResource, episode: EpisodeResource) {
    const seriesFolder = this.seriesFolderName(series);
    const seasonFolder = this.seasonFolderName(episode.seasonNumber);
    const episodeFile = this.episodeFileName(series.title, episode);
    return `${this.mediaRootPath}/${this.mediaServerPath}/${seriesFolder}/${seasonFolder}/${episodeFile}`;
  }

  async linkEpisodeToLibrary(episodeResource: EpisodeResource) {
    const series = episodeResource.series;
    const linkPath = this.mediaServerPathForEpisode(series, episodeResource);
    let realPath = ''
    
    if (episodeResource.hasFile) {
      // not null b/c of hasFile
      realPath = episodeResource.episodeFile.relativePath!;
    }

    const dbEntry = await db.get(episodeResource.id.toString());
    
    if (
      !dbEntry ||
      dbEntry.realPath !== realPath ||
      !dbEntry.mediaServers[this.mediaServerPath] ||
      dbEntry.mediaServers[this.mediaServerPath] !== linkPath
    ) {
      this.logger.info(`Linking ${linkPath} to ${realPath}`);
      await createHardLink(realPath, linkPath);
      await db.put({
        _id: episodeResource.id.toString(),
        _rev: dbEntry?._rev,
        realPath,
        mediaServers: {
          ...dbEntry?.mediaServers,
          [this.mediaServerPath]: linkPath,
        }
      });
    }

    return true;
  }
}