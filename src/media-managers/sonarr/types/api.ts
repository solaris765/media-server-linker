export interface AlternateTitleResource {
  title: string;
  seasonNumber?: number;
  sceneSeasonNumber?: number;
  sceneOrigin?: string;
  comment?: string;
}

export interface MediaCover {
  coverType: 'unknown' | 'poster' | 'banner' | 'fanart' | 'screenshot' | 'headshot' | 'clearlogo';
  url?: string;
  remoteUrl?: string;
}

export interface Language {
  id: number;
  name: string;
}

export interface SeasonStatisticsResource {
  nextAiring?: Date;
  previousAiring?: Date;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  sizeOnDisk: number;
  releaseGroups?: string[];
  percentOfEpisodes: number;
}

export interface SeasonResource {
  seasonNumber: number;
  monitored: boolean;
  statistics: SeasonStatisticsResource;
  images?: MediaCover[];
}

export interface MediaCover {
  coverType: 'unknown' | 'poster' | 'banner' | 'fanart' | 'screenshot' | 'headshot' | 'clearlogo';
  url?: string;
  remoteUrl?: string;
}

export interface SeriesResource {
  id: number;
  title: string;
  alternateTitles?: AlternateTitleResource[];
  sortTitle?: string;
  status: 'continuing' | 'ended' | 'upcoming' | 'deleted';
  ended: boolean;
  readOnly?: boolean;
  profileName?: string;
  overview?: string;
  nextAiring?: Date;
  previousAiring?: Date;
  network?: string;
  airTime?: string;
  images?: MediaCover[];
  originalLanguage?: Language;
  remotePoster?: string;
  seasons?: SeasonResource[];
  year: number;
  path?: string;
  qualityProfileId: number;
  seasonFolder: boolean;
  monitored: boolean;
  monitorNewItems: 'all' | 'none';
  useSceneNumbering: boolean;
  runtime: number;
  tvdbId: number;
  tvRageId: number;
  tvMazeId: number;
  firstAired?: Date;
  lastAired?: Date;
  seriesType: 'standard' | 'daily' | 'anime';
  cleanTitle?: string;
  imdbId?: string;
  titleSlug?: string;
  rootFolderPath?: string;
  folder?: string;
  certification?: string;
  genres?: string[];
  tags?: number[];
  added: Date;
  addOptions: {
      ignoreEpisodesWithFiles: boolean;
      ignoreEpisodesWithoutFiles: boolean;
      monitor: 'unknown' | 'all' | 'future' | 'missing' | 'existing' | 'firstSeason' | 'lastSeason' | 'latestSeason' | 'pilot' | 'recent' | 'monitorSpecials' | 'unmonitorSpecials' | 'none';
      searchForMissingEpisodes: boolean;
      searchForCutoffUnmetEpisodes: boolean;
  };
  ratings: {
      votes: number;
      value: number;
  };
  statistics: {
      seasonCount: number;
      episodeFileCount: number;
      episodeCount: number;
      totalEpisodeCount: number;
      sizeOnDisk: number;
      releaseGroups?: string[];
      percentOfEpisodes: number;
      readOnly?: boolean;
  };
  episodesChanged?: boolean;
  languageProfileId: number;
  deprecated?: boolean;
}

export interface SelectOption {
  value: number;
  name: string | null;
  order: number;
  hint: string | null;
}

export interface Field {
  order: number;
  name: string | null;
  label: string | null;
  unit: string | null;
  helpText: string | null;
  helpTextWarning: string | null;
  helpLink: string | null;
  value: any | null;
  type: string | null;
  advanced: boolean;
  selectOptions: SelectOption[] | null;
  selectOptionsProviderAction: string | null;
  section: string | null;
  hidden: string | null;
  privacy: PrivacyLevel;
  placeholder: string | null;
  isFloat: boolean;
}

export interface CustomFormatSpecificationSchema {
  id: number;
  name: string | null;
  implementation: string | null;
  implementationName: string | null;
  infoLink: string | null;
  negate: boolean;
  required: boolean;
  fields: Field[] | null;
}

export interface CustomFormatResource {
  id: number;
  name: string | null;
  includeCustomFormatWhenRenaming: boolean | null;
  specifications: CustomFormatSpecificationSchema[] | null;
}

export interface Quality {
  id: number;
  name: string | null;
  source: QualitySource;
  resolution: number;
}

export interface Revision {
  version: number;
  real: number;
  isRepack: boolean;
}

export interface QualityModel {
  quality: Quality | null;
  revision: Revision | null;
}

export interface EpisodeFileResource {
  id: number;
  seriesId: number;
  seasonNumber: number;
  relativePath: string | null;
  path: string | null;
  size: number;
  dateAdded: string;
  sceneName: string | null;
  releaseGroup: string | null;
  languages: Language[] | null;
  quality: QualityModel | null;
  customFormats: CustomFormatResource[] | null;
}

export interface MediaInfoResource {
  id: number;
  audioBitrate: number;
  audioChannels: number;
  audioCodec: string | null;
  audioLanguages: string | null;
  audioStreamCount: number;
  videoBitDepth: number;
  videoBitrate: number;
  videoCodec: string | null;
  videoFps: number;
  videoDynamicRange: string | null;
  videoDynamicRangeType: string | null;
  resolution: string | null;
  runTime: string | null;
  scanType: string | null;
  subtitles: string | null;
}

export interface Ratings {
  votes: number;
  value: number;
}

export interface SeriesStatisticsResource {
  seasonCount: number;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  sizeOnDisk: number;
  releaseGroups: string[] | null;
  percentOfEpisodes: number;
}

export interface AddSeriesOptions {
  ignoreEpisodesWithFiles: boolean;
  ignoreEpisodesWithoutFiles: boolean;
  monitor: MonitorTypes;
  searchForMissingEpisodes: boolean;
  searchForCutoffUnmetEpisodes: boolean;
}

export interface EpisodeResource {
  id: number;
  seriesId: number;
  tvdbId: number;
  episodeFileId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  airDate: string | null;
  airDateUtc: string | null;
  runtime: number;
  finaleType: string | null;
  overview: string | null;
  episodeFile: EpisodeFileResource;
  customFormatScore: number;
  mediaInfo: MediaInfoResource;
  qualityCutoffNotMet: boolean;
  series: SeriesResource;
  absoluteEpisodeNumber: number;
  hasFile: boolean;
}

enum QualitySource {
  unknown = "unknown",
  television = "television",
  televisionRaw = "televisionRaw",
  web = "web",
  webRip = "webRip",
  dvd = "dvd",
  bluray = "bluray",
  blurayRaw = "blurayRaw",
}

enum PrivacyLevel {
  normal = "normal",
  password = "password",
  apiKey = "apiKey",
  userName = "userName",
}

enum MediaCoverTypes {
  unknown = "unknown",
  poster = "poster",
  banner = "banner",
  fanart = "fanart",
  screenshot = "screenshot",
  headshot = "headshot",
  clearlogo = "clearlogo",
}

enum SeriesStatusType {
  continuing = "continuing",
  ended = "ended",
  upcoming = "upcoming",
  deleted = "deleted",
}

enum MonitorTypes {
  unknown = "unknown",
  all = "all",
  future = "future",
  missing = "missing",
  existing = "existing",
  firstSeason = "firstSeason",
  lastSeason = "lastSeason",
  latestSeason = "latestSeason",
  pilot = "pilot",
  recent = "recent",
  monitorSpecials = "monitorSpecials",
  unmonitorSpecials = "unmonitorSpecials",
  none = "none",
}

enum NewItemMonitorTypes {
  all = "all",
  none = "none",
}

enum SeriesTypes {
  standard = "standard",
  daily = "daily",
  anime = "anime",
}

