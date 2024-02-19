import { MediaServer } from ".";
import { DBEntry } from "../link-dbs";
import type { EpisodeResource, SeriesResource } from "../media-managers/sonarr/types/api";
import sanitize from "sanitize-filename";

export default class EmbyMediaServer extends MediaServer {
  mediaServerPath: string = 'emby2';

  libraryDir(episode: EpisodeResource) {
    const fullPath = episode.episodeFile?.path;
    if (!fullPath) {
      return '';
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
    let customFormatsAndQuality = ''
    if (!episodeResource.episodeFile) {
      return '';
    }
    if (episodeResource.episodeFile.customFormats && episodeResource.episodeFile.customFormats?.length > 0) {
      customFormatsAndQuality += episodeResource.episodeFile.customFormats.reduce((acc, curr) => `${acc} ${curr.name}`, '').trim()
    }
    if (episodeResource.episodeFile.quality?.quality?.name) {
      customFormatsAndQuality += ` ${episodeResource.episodeFile.quality.quality.name}`
    }
    if (episodeResource.episodeFile.quality?.revision?.version) {
      customFormatsAndQuality += ` v${episodeResource.episodeFile.quality.revision.version}`
    }
    customFormatsAndQuality = `[${customFormatsAndQuality.trim().replace(/ +/g, ' ')}]`

    let videoDynamicRangeType = ''
    if (episodeResource.mediaInfo?.videoDynamicRangeType) {
      videoDynamicRangeType = `[${episodeResource.mediaInfo.videoDynamicRangeType}]`
    }

    let videoBitDepth = ''
    if (episodeResource.mediaInfo?.videoBitDepth) {
      videoBitDepth = `[${episodeResource.mediaInfo.videoBitDepth}bit]`
    }
    let videoCodec = ''
    if (episodeResource.mediaInfo?.videoCodec) {
      videoCodec = `[${episodeResource.mediaInfo.videoCodec}]`
    }
    let audioCodec = ''
    if (episodeResource.mediaInfo?.audioCodec) {
      audioCodec = `[${episodeResource.mediaInfo.audioCodec} ${episodeResource.mediaInfo.audioChannels}]`
    }
    let audioLanguages = ''
    if (episodeResource.mediaInfo?.audioLanguages) {
      audioLanguages = `[${episodeResource.mediaInfo.audioLanguages}]`
    }
    let releaseGroup = ''
    if (episodeResource.episodeFile.releaseGroup) {
      releaseGroup = `-${episodeResource.episodeFile.releaseGroup}`
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
    } else {
      num = `E${episodeResource.episodeNumber.toString().padStart(2, '0')}`
      if (episodeResource.absoluteEpisodeNumber)
        abs = `E${episodeResource.absoluteEpisodeNumber.toString().padStart(3, '0')}`
    }

    let fileName = ''
    switch (series.seriesType) {
      case 'anime':
        // {Series TitleYear} - S{season:00}E{episode:00} - {absolute:000} - {Episode CleanTitle} [{Custom Formats }{Quality Full}]{[MediaInfo VideoDynamicRangeType]}[{MediaInfo VideoBitDepth}bit]{[MediaInfo VideoCodec]}[{Mediainfo AudioCodec} { Mediainfo AudioChannels}]{MediaInfo AudioLanguages}{-Release Group}
        /**
         * Single Episode:
          The Series Title! (2010) - S01E01 - 001 - Episode Title 1 [iNTERNAL HDTV-720p v2][HDR10][10bit][x264][DTS 5.1][JA]-RlsGrp
          Multi Episode:
          The Series Title! (2010) - S01E01-E03 - 001-003 - Episode Title [iNTERNAL HDTV-720p v2][HDR10][10bit][x264][DTS 5.1][JA]-RlsGrp
         */
        seriesSection = `${series.title} (${series.year})`


        episodeSection = `S${episodeResource.seasonNumber.toString().padStart(2, '0')}`
        if (episodeResource.absoluteEpisodeNumber)
          episodeSection += abs
        else
          episodeSection += num

        fileName = `${seriesSection} - ${episodeSection} - ${titleSection} ${tvdbId}${customFormatsAndQuality}${videoDynamicRangeType}${videoBitDepth}${videoCodec}${audioCodec}${audioLanguages}${releaseGroup}`;
        break;
      default:
        /**
         * {Series TitleYear} - S{season:00}E{episode:00} - {Episode CleanTitle} [{Custom Formats }{Quality Full}]{[MediaInfo VideoDynamicRangeType]}{[Mediainfo AudioCodec}{ Mediainfo AudioChannels]}{[MediaInfo VideoCodec]}{-Release Group}
         * Single Episode:
          The Series Title! (2010) - S01E01 - Episode Title 1 [AMZN WEBDL-1080p Proper][DV HDR10][DTS 5.1][x264]-RlsGrp
          Multi Episode:
          The Series Title! (2010) - S01E01-E03 - Episode Title [AMZN WEBDL-1080p Proper][DV HDR10][DTS 5.1][x264]-RlsGrp
         */
        seriesSection = `${series.title} (${series.year})`
        episodeSection = `S${episodeResource.seasonNumber.toString().padStart(2, '0')}${num}`


        fileName = `${seriesSection} - ${episodeSection} - ${titleSection} ${tvdbId}${customFormatsAndQuality}${videoDynamicRangeType}${audioCodec}${videoCodec}${releaseGroup}`;
        break;
    }

    return sanitize(fileName);
  }

  mediaServerPathForEpisode(series: SeriesResource, episode: EpisodeResource[]) {
    const episodeResource = episode[0];
    const libraryDir = this.libraryDir(episodeResource);
    const seriesFolder = this.seriesFolderName(series);
    const seasonFolder = this.seasonFolderName(episodeResource.seasonNumber);
    const episodeFile = this.episodeFileName(series, episode);
    const extention = episodeResource.episodeFile?.path?.split('.').pop();
    return `${this.mediaRootPath}/${this.mediaServerPath}/${libraryDir}/${seriesFolder}/${seasonFolder}/${episodeFile}.${extention}`;
  }

  async linkEpisodeToLibrary(episodeResource: EpisodeResource[]) {
    const firstEpisode = episodeResource[0];
    if (!firstEpisode) {
      this.logger.error('No episode found');
      return false;
    }

    let realPath = ''
    if (firstEpisode.hasFile) {
      if (!firstEpisode.episodeFile?.path) {
        // This case indicates that the episode is part of a multi-episode file
        // this.logger.error(`No path found for ${firstEpisode.id}`);
        return false;
      }
      realPath = firstEpisode.episodeFile.path;
    }

    const series = firstEpisode.series;
    const linkPath = this.mediaServerPathForEpisode(series, episodeResource);

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
          return true;
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
        return true;
      }

      const savedLinkPath = dbEntry.mediaServers[this.mediaServerPath];

      // if the linkFile doesn't exist
      if (!savedLinkPath) {
        if (!realPath) {
          this.logger.error(`Neither realPath nor savedLinkPath exist for ${episode.id}`);
          return true;
        }
        this.logger.info(`Creating link for ${linkPath}`);
        await this.fileSystem.createSymLink(realPath, linkPath);
        dbEntry.mediaServers[this.mediaServerPath] = linkPath;
        await this.tvDb.put(dbEntry.toDoc());
        return true;
      }

      // if realPath doesn't exist, remove the link
      if (!await this.fileSystem.doesFileExist(realPath)) {
        this.logger.info(`Removing link for ${linkPath}`);
        await this.fileSystem.removeLink(savedLinkPath);
        dbEntry.realPath = '';
        delete dbEntry.mediaServers[this.mediaServerPath];
        await this.tvDb.put(dbEntry.toDoc());
        return true;
      }

      // if the the linkPath doesn't match the dbEntry, fix it
      if (linkPath !== savedLinkPath) {
        this.logger.info(`Fixing link for ${linkPath}`);
        await this.fileSystem.removeLink(savedLinkPath);
        await this.fileSystem.createSymLink(realPath, linkPath);
        dbEntry.mediaServers[this.mediaServerPath] = linkPath;
        await this.tvDb.put(dbEntry.toDoc());
        return true;
      }

      if (!await this.fileSystem.doesFileExist(linkPath)) {
        this.logger.info(`Link for ${linkPath} doesn't exist`);
        await this.fileSystem.createSymLink(realPath, linkPath);
        return true;
      }

      // this.logger.info(`Link for ${linkPath} already exists`);
    }
    return false;
  }
}