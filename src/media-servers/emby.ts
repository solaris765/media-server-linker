import { MediaServer } from ".";
import type { EpisodeResource, SeriesResource } from "../media-managers/sonarr/types/api";
import { DBEntry, createSymLink, type DBEntryLike } from "../util/filesystem";
import fs from "fs/promises";

import {sonarrDB as db} from "../media-managers/sonarr";

export default class EmbyMediaServer extends MediaServer {
  mediaServerPath: string = 'emby2';

  libraryDir(episode: EpisodeResource) {
    const fullPath = episode.episodeFile.path;
    if (!fullPath) {
      return '';
    }
    const root = this.mediaRootPath + '/' + this.mediaSourceDir + '/';
    return fullPath.replace(root, '').split('/')[0]
  }

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
    const libraryDir = this.libraryDir(episode);
    const seriesFolder = this.seriesFolderName(series);
    const seasonFolder = this.seasonFolderName(episode.seasonNumber);
    const episodeFile = this.episodeFileName(series.title, episode);
    const extention = episode.episodeFile.path?.split('.').pop();
    return `${this.mediaRootPath}/${this.mediaServerPath}/${libraryDir}/${seriesFolder}/${seasonFolder}/${episodeFile}.${extention}`;
  }

  async linkEpisodeToLibrary(episodeResource: EpisodeResource) {
    const series = episodeResource.series;
    const linkPath = this.mediaServerPathForEpisode(series, episodeResource);
    let realPath = ''
    
    if (episodeResource.hasFile) {
      // not null b/c of hasFile
      realPath = episodeResource.episodeFile.path!;
    }

    let dbEntry = null;
    try {
      dbEntry = DBEntry.fromDoc(await db.get<DBEntryLike>(episodeResource.id.toString()));
    } catch (e) {
      this.logger.info(`No entry found for ${episodeResource.id}`);
    }

    // if the entry doesn't exist, go ahead and create it
    if (!dbEntry) {
      if (!realPath) {
        this.logger.error(`Neither realPath nor savedLinkPath exist for ${episodeResource.id}`);
        return true;
      }
      dbEntry = DBEntry.fromDoc({
        _id: episodeResource.id.toString(),
        realPath,
        mediaServers: {
          [this.mediaServerPath]: linkPath,
        }
      });
      await createSymLink(realPath, linkPath);
      await db.put(dbEntry.toDoc());
      return true;
    }

    const savedLinkPath = dbEntry.mediaServers[this.mediaServerPath];

    // if the linkFile doesn't exist
    if (!savedLinkPath) {
      if (!realPath) {
        this.logger.error(`Neither realPath nor savedLinkPath exist for ${episodeResource.id}`);
        return true;
      }
      this.logger.info(`Creating link for ${linkPath}`);
      await createSymLink(realPath, linkPath);
      dbEntry.mediaServers[this.mediaServerPath] = linkPath;
      await db.put(dbEntry.toDoc());
      return true;
    }

    // if realPath doesn't exist, remove the link
    if (!await fs.access(realPath).catch(() => false)) {
      this.logger.info(`Removing link for ${linkPath}`);
      await fs.unlink(savedLinkPath);
      delete dbEntry.mediaServers[this.mediaServerPath];
      await db.put(dbEntry.toDoc());
      return true;
    }

    // if the the linkPath doesn't match the dbEntry, fix it
    if (linkPath !== savedLinkPath) {
      this.logger.info(`Fixing link for ${linkPath}`);
      await fs.unlink(savedLinkPath);
      await createSymLink(realPath, linkPath);
      dbEntry.mediaServers[this.mediaServerPath] = linkPath;
      await db.put(dbEntry.toDoc());
      return true;
    }

    this.logger.info(`Link for ${linkPath} already exists`);
    return false;
  }
}