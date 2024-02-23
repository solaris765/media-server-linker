import { QualitySource, type EpisodeResource, type SeasonResource, type SeriesResource } from "../../src/media-managers/sonarr/types/api";
import { faker } from '@faker-js/faker';
import path from 'path';
import { mkdirSync, writeFileSync } from 'fs';

if (!process.env.MEDIA_ROOT_PATH) {
  throw new Error('MEDIA_ROOT_PATH not set');
}
if (!process.env.MEDIA_SOURCE_DIR) {
  throw new Error('MEDIA_SOURCE_DIR not set');
}
const DATA_DIR = path.resolve(process.env.MEDIA_ROOT_PATH,process.env.MEDIA_SOURCE_DIR);
mkdirSync(DATA_DIR, { recursive: true });

interface GenerateSeriesOptions {
  seasonCount: number;
  episodeCountPerSeason: number;
  libraryDir: string;
}
export function generateSeries(options: GenerateSeriesOptions = {seasonCount:3,episodeCountPerSeason:10,libraryDir:'tv'}): SeriesResource {
  const title = faker.word.words(3);

  let seasons: SeasonResource[] = [];
  for (let i = 1; i <= options.seasonCount; i++) {
    seasons.push({
      seasonNumber: i,
      monitored: true,
      statistics: {
        previousAiring: faker.date.recent(),
        episodeFileCount: options.episodeCountPerSeason,
        episodeCount: options.episodeCountPerSeason,
        totalEpisodeCount: options.episodeCountPerSeason,
        sizeOnDisk: options.episodeCountPerSeason * 1000000,
        percentOfEpisodes: 0
      }
    });
  }

  const series: SeriesResource = {
    id: faker.number.int(),
    title,
    added: faker.date.recent(),
    seasonFolder: true,
    monitored: true,
    useSceneNumbering: true,
    runtime: 60,
    tvdbId: faker.number.int(),
    tvRageId: faker.number.int(),
    tvMazeId: faker.number.int(),
    firstAired: faker.date.past(),
    path: path.resolve(DATA_DIR, options.libraryDir, title),
    qualityProfileId: 1,
    languageProfileId: 1,
    status: 'continuing',
    overview: 'Test Series Overview',
    ended: false,
    year: 2021,
    monitorNewItems: 'all',
    rootFolderPath: path.resolve(DATA_DIR, options.libraryDir),
    seriesType: 'standard',
    addOptions: {
      ignoreEpisodesWithFiles: false,
      ignoreEpisodesWithoutFiles: false,
      searchForMissingEpisodes: false,
      monitor: 'all',
      searchForCutoffUnmetEpisodes: false
    },
    statistics: {
      seasonCount: 1,
      episodeFileCount: 1,
      episodeCount: 1,
      totalEpisodeCount: 1,
      sizeOnDisk: 1,
      percentOfEpisodes: 0
    },
    tags: [],
    ratings: {
      votes: 1,
      value: 1
    },
    images: [],
    seasons
  }

  return series;
}

interface GenerateEpisodeForSeasonOptions {
  multiEpisodeFilesPerSeason: number;
}
export function generateEpisodesForSeries(series: SeriesResource, options: GenerateEpisodeForSeasonOptions = {multiEpisodeFilesPerSeason: 2}): EpisodeResource[] {
  let episodes: EpisodeResource[] = [];
  if (!series.seasons) {
    return episodes;
  }

  let absoluteEpisodeNumber = 1;
  for (let i = 1; i <= series.seasons.length; i++) {
    let multiEpisodeRange: [number,number] = [ -1, -1]
    multiEpisodeRange[0] = faker.number.int({min:1,max:series.seasons[i-1].statistics.episodeCount - options.multiEpisodeFilesPerSeason});
    multiEpisodeRange[1] = multiEpisodeRange[0] + options.multiEpisodeFilesPerSeason;
    
    let multiEpisode: {
      path: string;
      fileId: number;
    } = {
      path: '',
      fileId: 0
    }
    for (let j = 1; j <= series.seasons[i-1].statistics.episodeCount; j++) {
      let isMultiEpisode = false;
      let relativePath = `${series.title}/Season ${i}/${series.title} - S${i}E${j} - ${faker.word.words(3)}.mkv`
      let filePath = path.resolve(series.rootFolderPath!, relativePath);
      if (j >= multiEpisodeRange[0] && j <= multiEpisodeRange[1]) {
        isMultiEpisode = true;
        if (j === multiEpisodeRange[0]) {
          multiEpisode.path = filePath
          multiEpisode.fileId = faker.number.int();
        }
      }
      episodes.push(generateEpisode({
        series,
        seasonNumber: i,
        episodeNumber: j,
        absoluteEpisodeNumber,
        filePath,
        fileId: isMultiEpisode ? multiEpisode.fileId : faker.number.int()
      }));

      absoluteEpisodeNumber++;
    }
  }
  return episodes;
}

interface GenerateEpisodeOptions {
  series: SeriesResource;
  seasonNumber: number;
  episodeNumber: number;
  absoluteEpisodeNumber: number;
  filePath: string;
  fileId: number;
}
export function generateEpisode(options: GenerateEpisodeOptions): EpisodeResource {
  let relativePath = options.filePath.replace(options.series.rootFolderPath!, '');
  mkdirSync(path.dirname(options.filePath), { recursive: true });
  writeFileSync(options.filePath, new Uint8Array(0));
  return {
    id: faker.number.int(),
    seriesId: options.series.id,
    seasonNumber: options.seasonNumber,
    episodeNumber: options.episodeNumber,
    absoluteEpisodeNumber: options.absoluteEpisodeNumber,
    title: faker.word.words(3),
    airDate: faker.date.future().toString(),
    airDateUtc: faker.date.future().toString(),
    overview: faker.lorem.paragraph(),
    hasFile: true,
    customFormatScore: 0,
    episodeFileId: options.fileId,
    finaleType: 'season',
    mediaInfo: {
      id: faker.number.int(),
      audioBitrate: faker.number.int(),
      audioChannels: faker.number.int(),
      audioCodec: faker.datatype.boolean() ? null : faker.lorem.word(),
      audioLanguages: faker.datatype.boolean() ? null : faker.lorem.word(),
      audioStreamCount: faker.number.int(),
      videoBitDepth: faker.number.int(),
      videoBitrate: faker.number.int(),
      videoCodec: faker.datatype.boolean() ? null : faker.lorem.word(),
      videoFps: faker.number.int(),
      videoDynamicRange: faker.datatype.boolean() ? null : faker.lorem.word(),
      videoDynamicRangeType: faker.datatype.boolean() ? null : faker.lorem.word(),
      resolution: faker.datatype.boolean() ? null : faker.lorem.word(),
      runTime: faker.datatype.boolean() ? null : faker.lorem.word(),
      scanType: faker.datatype.boolean() ? null : faker.lorem.word(),
      subtitles: faker.datatype.boolean() ? null : faker.lorem.word(),
    },
    qualityCutoffNotMet: false,
    series: options.series,
    runtime: 60,
    tvdbId: faker.number.int(),
    episodeFile: {
      languages: [],
      relativePath: relativePath,
      releaseGroup: faker.word.noun(),
      sceneName: faker.word.noun(),
      seasonNumber: options.seasonNumber,
      size: faker.number.int(),
      seriesId: options.series.id,
      customFormats: [],
      dateAdded: faker.date.recent().toString(),
      id: options.fileId,
      path: options.filePath,
      quality: {
        quality: {
          id: faker.number.int(),
          name: faker.word.words(3),
          source: faker.helpers.arrayElement(Object.keys(QualitySource)) as QualitySource,
          resolution: faker.number.int(),
        },
        revision: {
          version: 1,
          real: 1,
          isRepack: false,
        }
      },
  }}
}
