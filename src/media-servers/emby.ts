import { MediaServer } from ".";
import type { EpisodeResource, SeriesResource } from "../media-managers/sonarr/types/api";
import { DBEntry } from "../util/filesystem";

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
    switch (series.seriesType) {
      case 'anime':
        return `${series.title} (${series.year}) [imdbid-${series.imdbId}]`;
      default:
        return `${series.title} (${series.year}) [imdbid-${series.imdbId}]`;
    }
  }

  seasonFolderName(seasonNumber: number) {
    return `Season ${seasonNumber}`;
  }

  episodeFileName(series: SeriesResource, episode: EpisodeResource) {
    let customFormatsAndQuality = ''
    if (episode.episodeFile.customFormats && episode.episodeFile.customFormats?.length > 0) {
      customFormatsAndQuality += episode.episodeFile.customFormats.reduce((acc, curr) => `${acc} ${curr.name}`, '').trim()
    }
    if (episode.episodeFile.quality?.quality?.name) {
      customFormatsAndQuality += ` ${episode.episodeFile.quality.quality.name}`
    }
    if (episode.episodeFile.quality?.quality?.resolution) {
      customFormatsAndQuality += ` ${episode.episodeFile.quality.quality.resolution}`
    }
    if (episode.episodeFile.quality?.revision) {
      customFormatsAndQuality += ` ${episode.episodeFile.quality.revision}`
    }
    customFormatsAndQuality = `[${customFormatsAndQuality.trim().replace(/ +/g, ' ')}]`

    let videoDynamicRangeType = ''
    if (episode.mediaInfo?.videoDynamicRangeType) {
      videoDynamicRangeType = `[${episode.mediaInfo.videoDynamicRangeType}]`
    }

    let videoBitDepth = ''
    if (episode.mediaInfo?.videoBitDepth) {
      videoBitDepth = `[${episode.mediaInfo.videoBitDepth}bit]`
    }
    let videoCodec = ''
    if (episode.mediaInfo?.videoCodec) {
      videoCodec = `[${episode.mediaInfo.videoCodec}]`
    }
    let audioCodec = ''
    if (episode.mediaInfo?.audioCodec) {
      audioCodec = `[${episode.mediaInfo.audioCodec} ${episode.mediaInfo.audioChannels}]`
    }
    let audioLanguages = ''
    if (episode.mediaInfo?.audioLanguages) {
      audioLanguages = `[${episode.mediaInfo.audioLanguages}]`
    }
    let releaseGroup = ''
    if (episode.episodeFile.releaseGroup) {
      releaseGroup = `-${episode.episodeFile.releaseGroup}`
    }

    let seriesSection = ''
    let episodeSection = ''
    let absoluteSection = ''
    let titleSection = ''
    if (episode.title) {
      titleSection = episode.title
    }
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
        episodeSection = `S${episode.seasonNumber.toString().padStart(2, '0')}E${episode.episodeNumber.toString().padStart(2, '0')}`
        absoluteSection = episode.absoluteEpisodeNumber.toString().padStart(3, '0')

        return `${seriesSection} - ${episodeSection} - ${absoluteSection} - ${titleSection} ${customFormatsAndQuality}${videoDynamicRangeType}${videoBitDepth}${videoCodec}${audioCodec}${audioLanguages}${releaseGroup}`;
      default:
        /**
         * {Series TitleYear} - S{season:00}E{episode:00} - {Episode CleanTitle} [{Custom Formats }{Quality Full}]{[MediaInfo VideoDynamicRangeType]}{[Mediainfo AudioCodec}{ Mediainfo AudioChannels]}{[MediaInfo VideoCodec]}{-Release Group}
         * Single Episode:
          The Series Title! (2010) - S01E01 - Episode Title 1 [AMZN WEBDL-1080p Proper][DV HDR10][DTS 5.1][x264]-RlsGrp
          Multi Episode:
          The Series Title! (2010) - S01E01-E03 - Episode Title [AMZN WEBDL-1080p Proper][DV HDR10][DTS 5.1][x264]-RlsGrp
         */
        seriesSection = `${series.title} (${series.year})`
        episodeSection = `S${episode.seasonNumber.toString().padStart(2, '0')}E${episode.episodeNumber.toString().padStart(2, '0')}`


        return `${seriesSection} - ${episodeSection} - ${titleSection} ${customFormatsAndQuality}${videoDynamicRangeType}${audioCodec}${videoCodec}${releaseGroup}`;
    }
  }

  mediaServerPathForEpisode(series: SeriesResource, episode: EpisodeResource) {
    const libraryDir = this.libraryDir(episode);
    const seriesFolder = this.seriesFolderName(series);
    const seasonFolder = this.seasonFolderName(episode.seasonNumber);
    const episodeFile = this.episodeFileName(series, episode);
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

    let dbEntry: DBEntry | null = null;
    try {
      dbEntry = DBEntry.fromDoc(await this.db.get(episodeResource.id.toString()));
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
      await this.fileSystem.createSymLink(realPath, linkPath);
      await this.db.put(dbEntry.toDoc());
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
      await this.fileSystem.createSymLink(realPath, linkPath);
      dbEntry.mediaServers[this.mediaServerPath] = linkPath;
      await this.db.put(dbEntry.toDoc());
      return true;
    }

    // if realPath doesn't exist, remove the link
    if (!await this.fileSystem.doesFileExist(realPath)) {
      this.logger.info(`Removing link for ${linkPath}`);
      await this.fileSystem.removeLink(savedLinkPath);
      dbEntry.realPath = '';
      delete dbEntry.mediaServers[this.mediaServerPath];
      await this.db.put(dbEntry.toDoc());
      return true;
    }

    // if the the linkPath doesn't match the dbEntry, fix it
    if (linkPath !== savedLinkPath) {
      this.logger.info(`Fixing link for ${linkPath}`);
      await this.fileSystem.removeLink(savedLinkPath);
      await this.fileSystem.createSymLink(realPath, linkPath);
      dbEntry.mediaServers[this.mediaServerPath] = linkPath;
      await this.db.put(dbEntry.toDoc());
      return true;
    }

    this.logger.info(`Link for ${linkPath} already exists`);
    return false;
  }
}