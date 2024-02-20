import { MediaServer } from ".";
import { DBEntry } from "../link-dbs";
import type { EpisodeResource, SeriesResource } from "../media-managers/sonarr/types/api";
import filenamify from 'filenamify';

export default class EmbyMediaServer extends MediaServer {
  mediaServerPath: string = 'emby2';

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
      num = `E${episodeResource.episodeNumber.toString().padStart(2, '0')}-E${episode[episode.length - 1].episodeNumber.toString().padStart(2, '0')}`
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

  mediaServerPathForEpisode(series: SeriesResource, episode: EpisodeResource[]) {
    const episodeResource = episode[0];
    const libraryDir = this.libraryDir(episodeResource);
    const seriesFolder = this.seriesFolderName(series);
    const seasonFolder = this.seasonFolderName(episodeResource.seasonNumber);
    const episodeFile = this.episodeFileName(series, episode);
    const extention = episodeResource.episodeFile?.path?.split('.').pop();
    const filename = filenamify(episodeFile + '.' + extention, { replacement: ' ', maxLength: 255});

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

  async linkEpisodeToLibrary(episodeResource: EpisodeResource[]) {
    const firstEpisode = episodeResource[0];
    if (!firstEpisode) {
      this.logger.error('No episode found');
      return []
    }

    let realPath = ''
    if (firstEpisode.hasFile) {
      if (!firstEpisode.episodeFile?.path) {
        // This case indicates that the episode is part of a multi-episode file
        // this.logger.error(`No path found for ${firstEpisode.id}`);
        return [];
      }
      realPath = firstEpisode.episodeFile.path;
    }

    const series = firstEpisode.series;
    const linkPath = this.mediaServerPathForEpisode(series, episodeResource);

    let results = [];
    for (const episode of episodeResource) {

      let dbEntry: DBEntry | null = null;
      try {
        dbEntry = DBEntry.fromDoc(await this.tvDb.get(episode.id.toString()));
      } catch (e) {
        // this.logger.info(`No entry found for ${episode.id}`);
      }

      // if the entry doesn't exist, go ahead and create it
      if (!dbEntry) {
        if (!realPath) {
          // this.logger.error(`Neither realPath nor savedLinkPath exist for ${episode.id}`);
          results.push({ id: episode.id, result: 'No file or record found' });
          continue;
        }
        dbEntry = DBEntry.fromDoc({
          _id: episode.id.toString(),
          realPath,
          mediaServers: {
            [this.mediaServerPath]: linkPath,
          }
        });
        await this.fileSystem.createSymLink(realPath, linkPath);
        await this.tvDb.put(dbEntry.toDoc());
        results.push({ id: episode.id, result: 'Created' });
        continue;
      }

      const savedLinkPath = dbEntry.mediaServers[this.mediaServerPath];

      // if the linkFile doesn't exist
      if (!savedLinkPath) {
        if (!realPath) {
          // this.logger.error(`Neither realPath nor savedLinkPath exist for ${episode.id}`);
          results.push({ id: episode.id, result: 'No file or record found'});
          continue;
        }
        this.logger.info(`Creating link for ${linkPath}`);
        await this.fileSystem.createSymLink(realPath, linkPath);
        dbEntry.mediaServers[this.mediaServerPath] = linkPath;
        await this.tvDb.put(dbEntry.toDoc());
        results.push({ id: episode.id, result: 'Created' });
        continue;
      }

      // if realPath doesn't exist, remove the link
      if (!await this.fileSystem.doesFileExist(realPath)) {
        this.logger.info(`Removing link for ${linkPath}`);
        await this.fileSystem.removeLink(savedLinkPath);
        dbEntry.realPath = '';
        delete dbEntry.mediaServers[this.mediaServerPath];
        await this.tvDb.put(dbEntry.toDoc());
        results.push({ id: episode.id, result: 'Removed' });
        continue;
      }

      // if the the linkPath doesn't match the dbEntry, fix it
      if (linkPath !== savedLinkPath) {
        this.logger.info(`Fixing link for ${linkPath}\nWas ${savedLinkPath}`);
        await this.fileSystem.removeLink(savedLinkPath);
        await this.fileSystem.createSymLink(realPath, linkPath);
        dbEntry.mediaServers[this.mediaServerPath] = linkPath;
        await this.tvDb.put(dbEntry.toDoc());
        results.push({ id: episode.id, result: 'Fixed' });
        continue;
      }

      if (!await this.fileSystem.doesFileExist(linkPath)) {
        this.logger.info(`Link for ${linkPath} doesn't exist`);
        await this.fileSystem.createSymLink(realPath, linkPath);
        results.push({ id: episode.id, result: 'Recreated' });
        continue;
      }

      // this.logger.info(`Link for ${linkPath} already exists`);
    }
    
    return results;
  }
}