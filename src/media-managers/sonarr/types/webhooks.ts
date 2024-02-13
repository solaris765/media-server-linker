///////////////////
// Webhook Types
///////////////////

export enum WebhookEventType {
  Test = "Test",
  Grab = "Grab",
  Download = "Download",
  Rename = "Rename",
  SeriesAdd = "SeriesAdd",
  SeriesDelete = "SeriesDelete",
  EpisodeFileDelete = "EpisodeFileDelete",
  Health = "Health",
  ApplicationUpdate = "ApplicationUpdate",
  HealthRestored = "HealthRestored",
  ManualInteractionRequired = "ManualInteractionRequired",
}

export enum SeriesTypes {
  Standard = 0,
  Daily = 1,
  Anime = 2,
}

export interface WebhookSeries {
  id: number;
  title: string;
  titleSlug: string;
  path: string;
  tvdbId: number;
  tvMazeId: number;
  imdbId: string;
  type: SeriesTypes;
  year: number;
}

export interface WebhookRelease {
  quality: string;
  qualityVersion: number;
  releaseGroup: string;
  releaseTitle: string;
  indexer: string;
  size: number;
  customFormatScore: number;
  customFormats: string[];
}

export interface WebhookCustomFormat {
  id: number;
  name: string;
}

export interface WebhookCustomFormatInfo {
  customFormats: WebhookCustomFormat[];
  customFormatScore: number;
}

export interface WebhookEpisode {
  id: number;
  episodeNumber: number;
  seasonNumber: number;
  title: string;
  overview: string;
  airDate: string;
  airDateUtc: Date | null;
  seriesId: number;
  tvdbId: number;
}

export interface WebhookEpisodeFileMediaInfo {
  audioChannels: number;
  audioCodec: string;
  audioLanguages: string[];
  height: number;
  width: number;
  subtitles: string[];
  videoCodec: string;
  videoDynamicRange: string;
  videoDynamicRangeType: string;
}

export interface WebhookEpisodeFile {
  id: number;
  relativePath: string;
  path: string;
  quality: string;
  qualityVersion: number;
  releaseGroup: string;
  sceneName: string;
  size: number;
  dateAdded: Date;
  mediaInfo?: WebhookEpisodeFileMediaInfo;
  recycleBinPath?: string;
}

export interface WebhookGrabbedRelease {
  releaseTitle: string;
  indexer: string;
  size: number;
}

export enum DeleteMediaFileReason {
  missingFromDisk = "missingFromDisk",
  manual = "manual",
  upgrade = "upgrade",
  noLinkedEpisodes = "noLinkedEpisodes",
  manualOverride = "manualOverride"
}

export interface WebhookRenamedEpisodeFile extends WebhookEpisodeFile {
  previousRelativePath: string;
  previousPath: string;
}
export enum HealthCheckResult {
  Ok = 0,
  Notice = 1,
  Warning = 2,
  Error = 3
}

export interface WebhookDownloadClientItem {
  quality: string;
  qualityVersion: number;
  title: string;
  indexer: string;
  size: number;
}

///////////////////
// Payloads
///////////////////

export interface WebhookPayload {
  eventType: WebhookEventType;
  instanceName: string;
  applicationUrl: string;
}

export interface WebhookSeriesChangePayload extends WebhookPayload {
  eventType: WebhookEventType.Grab | WebhookEventType.Download | WebhookEventType.Rename | WebhookEventType.EpisodeFileDelete | WebhookEventType.SeriesAdd | WebhookEventType.SeriesDelete | WebhookEventType.ManualInteractionRequired | WebhookEventType.Test;
  series: WebhookSeries;
}

export interface WebhookEpisodeChangePayload extends WebhookSeriesChangePayload {
  episodes: WebhookEpisode[];
}

export interface WebhookGrabPayload extends WebhookEpisodeChangePayload {
  eventType: WebhookEventType.Grab;
  release: WebhookRelease;
  downloadClient: string;
  downloadClientType: string;
  downloadId: string;
  customFormatInfo: WebhookCustomFormatInfo;
}

export interface WebhookImportPayload extends WebhookEpisodeChangePayload {
  eventType: WebhookEventType.Download;
  episodeFile: WebhookEpisodeFile;
  isUpgrade: boolean;
  downloadClient: string;
  downloadClientType: string;
  downloadId: string;
  deletedFiles: WebhookEpisodeFile[];
  customFormatInfo: WebhookCustomFormatInfo;
  release: WebhookGrabbedRelease;
}

export interface WebhookEpisodeDeletePayload extends WebhookEpisodeChangePayload {
  eventType: WebhookEventType.EpisodeFileDelete;
  episodeFile: WebhookEpisodeFile;
  deleteReason: DeleteMediaFileReason;
}

export interface WebhookSeriesAddPayload extends WebhookSeriesChangePayload {
  eventType: WebhookEventType.SeriesAdd;
}

export interface WebhookSeriesDeletePayload extends WebhookSeriesChangePayload {
  eventType: WebhookEventType.SeriesDelete;
  deletedFiles: boolean;
}

export interface WebhookRenamePayload extends WebhookSeriesChangePayload {
  eventType: WebhookEventType.Rename;
  renamedEpisodeFiles: WebhookRenamedEpisodeFile[];
}

export interface WebhookHealthPayload extends WebhookPayload {
  eventType: WebhookEventType.Health | WebhookEventType.HealthRestored;
  level: HealthCheckResult;
  message: string;
  type: string;
  wikiUrl: string;
}

export interface WebhookApplicationUpdatePayload extends WebhookPayload {
  eventType: WebhookEventType.ApplicationUpdate;
  message: string;
  previousVersion: string;
  newVersion: string;
}

export interface WebhookManualInteractionPayload extends WebhookEpisodeChangePayload {
  eventType: WebhookEventType.ManualInteractionRequired;
  downloadInfo: WebhookDownloadClientItem;
  downloadClient: string;
  downloadClientType: string;
  downloadId: string;
  customFormatInfo: WebhookCustomFormatInfo;
  release: WebhookGrabbedRelease;
}

export interface WebhookTestPayload extends WebhookEpisodeChangePayload {
  eventType: WebhookEventType.Test;
}
