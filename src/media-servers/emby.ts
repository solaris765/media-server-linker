import { MediaServer } from ".";
import { default as SonarrHandler } from "../media-managers/sonarr";
import type { TvDbEntry } from "../link-dbs";
import type { EpisodeResource, SeriesResource } from "../media-managers/sonarr/types/api";
import filenamify from 'filenamify';

export default class EmbyMediaServer extends MediaServer {
  mediaServerPath: string = 'emby';

  libraryDir(episode: EpisodeResource) {
    const fullPath = episode.episodeFile?.path;
    if (!fullPath) {
      throw new Error('No path found');
    }
    const root = this.mediaRootPath + '/' + this.mediaSourceDir + '/';
    return fullPath.replace(root, '').split('/')[0]
  }

  seriesFolderName(series: SeriesResource) {
    switch (series.seriesType) {
      case 'anime':
        return `${series.title} (${series.year}) [tvdbId-${series.tvdbId}]`;
      default:
        return `${series.title} (${series.year}) [tvdbId-${series.tvdbId}]`;
    }
  }

  seasonFolderName(seasonNumber: number) {
    return `Season ${seasonNumber}`;
  }

  episodeFileName(series: SeriesResource, episode: EpisodeResource[]) {
    const episodeResource = episode[0];

    if (!episodeResource.episodeFile) {
      throw new Error('No episode file found');
    }

    let seriesSection = ''
    let episodeSection = ''
    let titleSection = ''
    if (episodeResource.title) {
      titleSection = episodeResource.title
    }

    let tvdbId = ''
    if (episodeResource.tvdbId) {
      tvdbId = `[tvdbId-${episodeResource.tvdbId}]`
    }

    let num = ''
    let abs = ''

    if (episode.length > 1) {
      // Ensure the episodes are sorted by episode number
      episode = episode.sort((a, b) => a.episodeNumber - b.episodeNumber);

      num = `E${episode[0].episodeNumber.toString().padStart(2, '0')}-E${episode[episode.length - 1].episodeNumber.toString().padStart(2, '0')}`
      if (episodeResource.absoluteEpisodeNumber && episode[episode.length - 1].absoluteEpisodeNumber)
        abs = `E${episodeResource.absoluteEpisodeNumber.toString().padStart(3, '0')}-E${episode[episode.length - 1].absoluteEpisodeNumber!.toString().padStart(3, '0')}`
      titleSection = episode.map(e => e.title).join(' + ')
      tvdbId = episode.reduce((acc, curr) => `${acc}[tvdbId-${curr.tvdbId}]`, '')
    } else {
      num = `E${episodeResource.episodeNumber.toString().padStart(2, '0')}`
      if (episodeResource.absoluteEpisodeNumber)
        abs = `E${episodeResource.absoluteEpisodeNumber.toString().padStart(3, '0')}`
    }

    let fileName = ''
    let fileNameLong = ''
    seriesSection = `${series.title} (${series.year})`

    switch (series.seriesType) {
      case 'anime':
        episodeSection = `S${episodeResource.seasonNumber.toString().padStart(2, '0')}`
        if (episodeResource.absoluteEpisodeNumber)
          episodeSection += abs
        else
          episodeSection += num

        fileName = `${seriesSection} - ${episodeSection} - ${tvdbId}`;
        fileNameLong = `${seriesSection} - ${episodeSection} - ${titleSection} ${tvdbId}`;
        break;
      default:
        episodeSection = `S${episodeResource.seasonNumber.toString().padStart(2, '0')}${num}`

        fileName = `${seriesSection} - ${episodeSection} - ${tvdbId}`;
        fileNameLong = `${seriesSection} - ${episodeSection} - ${titleSection} ${tvdbId}`;
        break;
    }

    if (fileNameLong.length <= 245) {
      return fileNameLong;
    }

    return fileName;
  }

  async mediaServerPathForEpisode(doc: TvDbEntry) {
    const sonarrHandler = new SonarrHandler({ logger: this.logger });
    let eps: EpisodeResource[] = []
    for (const episodeId of doc.episodeIds) {
      const episode = await sonarrHandler.getEpisode(episodeId);
      eps.push(episode);
    }
    if (eps.length === 0) {
      throw new Error('No episodes found');
    }
    // We can assume that all episodes are from the same series
    let series = eps[0].series;

    const libraryDir = this.libraryDir(eps[0]);
    const seriesFolder = this.seriesFolderName(series);
    const seasonFolder = this.seasonFolderName(eps[0].seasonNumber);
    const episodeFile = this.episodeFileName(series, eps);
    const extention = eps[0].episodeFile?.path?.split('.').pop();
    const filename = filenamify(episodeFile + '.' + extention, { replacement: ' ', maxLength: 255 });

    const finalFile = `${this.mediaRootPath}/${this.mediaServerPath}/${libraryDir}/${seriesFolder}/${seasonFolder}/${filename}`;
    if (finalFile.includes('undefined')) {
      throw new Error('Undefined in path');
    }
    if (finalFile.includes('null')) {
      throw new Error('Null in path');
    }
    if (finalFile.includes('//')) {
      throw new Error('Double slashes in path');
    }
    return finalFile;
  }

  async linkEpisodeToLibrary(doc: TvDbEntry): Promise<{id: number, result:string}> {
    const linkPath = await this.mediaServerPathForEpisode(doc);

    const mediaSrvSavedPath = await doc.getMediaServerPath(this.mediaServerPath);
    let mediaSrvSavedPathExists = false;
    if (mediaSrvSavedPath !== null) {
      mediaSrvSavedPathExists = await this.fileSystem.doesFileExist(mediaSrvSavedPath);
    }

    // Clean up the link if the file doesn't exist
    if (!doc.dataPath) {
      if (mediaSrvSavedPathExists) {
        this.logger.info(`Removing link for ${mediaSrvSavedPath}`);
        if (mediaSrvSavedPath)
          await this.fileSystem.removeLink(mediaSrvSavedPath);
        delete doc.mediaServers[this.mediaServerPath];
        await doc.save(false);
        return { id: doc.fileId!, result: 'Removed' };
      } else if (mediaSrvSavedPath) {
        this.logger.info(`Link for ${mediaSrvSavedPath} doesn't exist`);
        delete doc.mediaServers[this.mediaServerPath];
        await doc.save(false);
        return { id: doc.fileId!, result: 'Removed' };
      } else {
        return { id: doc.fileId!, result: 'No file or record found' };
      }
    }

    // If the file exists and the link is correct, do nothing
    if (mediaSrvSavedPathExists && mediaSrvSavedPath === linkPath) {
      return { id: doc.fileId!, result: 'Exists' };
    }

    // If the file exists and the link is incorrect, remove the link and create a new one
    if (mediaSrvSavedPathExists && mediaSrvSavedPath !== linkPath) {
      this.logger.info(`Removing link for ${mediaSrvSavedPath}`);
      if (mediaSrvSavedPath)
          await this.fileSystem.removeLink(mediaSrvSavedPath);
      this.logger.info(`Creating link for ${linkPath}`);
      await this.fileSystem.createSymLink(doc.dataPath, linkPath);
      doc.mediaServers[this.mediaServerPath] = linkPath;
      await doc.save(false);
      return { id: doc.fileId!, result: 'Updated' };
    }

    // If the file doesn't exist, create a new link
    if (!mediaSrvSavedPathExists) {
      this.logger.info(`Creating link for ${linkPath}`);
      await this.fileSystem.createSymLink(doc.dataPath, linkPath);
      doc.mediaServers[this.mediaServerPath] = linkPath;
      await doc.save(false);
      return { id: doc.fileId!, result: 'Created' };
    }

    return { id: doc.fileId!, result: 'Unknown' };
  }
}