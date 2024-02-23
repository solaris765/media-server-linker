import { MediaManager, type TypedResponse } from "../../types";
import {
  type EpisodeFileResource,
  type EpisodeResource,
  type SeriesResource,
} from "./types/api"
import {
  type WebhookPayload,
  type WebhookTestPayload, WebhookEventType,
  type WebhookGrabPayload,
  type WebhookImportPayload,
  type WebhookRenamePayload,
  type WebhookSeriesAddPayload,
  type WebhookSeriesDeletePayload,
  type WebhookEpisodeDeletePayload,
  type WebhookHealthPayload,
  type WebhookApplicationUpdatePayload,
  type WebhookManualInteractionPayload,
  type WebhookEpisodeFileChangePayload
} from "./types/webhooks";
import { saveCurlToFile } from "../../util/curl";
import { TvDbEntry } from "../../link-dbs";
import { Stingray, startMarker } from "../../util/performance";

function isTestEvent(eventPayload: WebhookPayload): eventPayload is WebhookTestPayload {
  return eventPayload.eventType === WebhookEventType.Test;
}

function isGrabEvent(eventPayload: WebhookPayload): eventPayload is WebhookGrabPayload {
  return eventPayload.eventType === WebhookEventType.Grab;
}

function isImportEvent(eventPayload: WebhookPayload): eventPayload is WebhookImportPayload {
  return eventPayload.eventType === WebhookEventType.Download;
}

function isRenameEvent(eventPayload: WebhookPayload): eventPayload is WebhookRenamePayload {
  return eventPayload.eventType === WebhookEventType.Rename;
}

function isSeriesAddEvent(eventPayload: WebhookPayload): eventPayload is WebhookSeriesAddPayload {
  return eventPayload.eventType === WebhookEventType.SeriesAdd;
}

function isSeriesDeleteEvent(eventPayload: WebhookPayload): eventPayload is WebhookSeriesDeletePayload {
  return eventPayload.eventType === WebhookEventType.SeriesDelete;
}

function isDeleteEvent(eventPayload: WebhookPayload): eventPayload is WebhookEpisodeDeletePayload {
  return eventPayload.eventType === WebhookEventType.EpisodeFileDelete;
}

function isHealthEvent(eventPayload: WebhookPayload): eventPayload is WebhookHealthPayload {
  return eventPayload.eventType === WebhookEventType.Health;
}

function isApplicationUpdateEvent(eventPayload: WebhookPayload): eventPayload is WebhookApplicationUpdatePayload {
  return eventPayload.eventType === WebhookEventType.ApplicationUpdate;
}

function isManualInteractionEvent(eventPayload: WebhookPayload): eventPayload is WebhookManualInteractionPayload {
  return eventPayload.eventType === WebhookEventType.ManualInteractionRequired;
}

class SonarrHandler extends MediaManager<WebhookPayload> {
  private async _callAPI<T>(route: string, req?: RequestInit): Promise<TypedResponse<T>> {
    const API = (process.env.SONARR_BASE_URL as string).replace(/\/$/, '');
    const API_KEY = process.env.SONARR_API_KEY as string;
    let init = {
      ...req,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
        ...req?.headers
      },
    }
    saveCurlToFile({
      url: `${API}/api/v3${route}`,
      init: init as any,
    }, 'sonarr-api.log');
    let res = await fetch(`${API}/api/v3${route}`, init);

    return res as TypedResponse<T>
  }

  /**
   * 
   * @param seriesId The Sonarr series ID
   * @param options 
   * @returns 
   */
  async getSeries(seriesId?: number, options?: Record<string, string>): Promise<SeriesResource[]> {
    const query = new URLSearchParams(options).toString();
    if (seriesId) {
      const response = await this._callAPI<SeriesResource[]>(`/series/${seriesId}?${query}`,
        {
          method: 'GET',
        });

      return await response.json();
    } else {
      const response = await this._callAPI<SeriesResource[]>(`/series?${query}`,
        {
          method: 'GET',
        });

      return await response.json();
    }
  }

  async getEpisodeFileById(episodeFileId: number): Promise<EpisodeFileResource> {
    const response = await this._callAPI(`/episodeFile/${episodeFileId}`, {
      method: 'GET',
    });

    return response.json<EpisodeFileResource>();
  }

  async getEpisode(episodeId: number): Promise<EpisodeResource> {
    const response = await this._callAPI(
      `/episode/${episodeId}`,
      {
        method: 'GET',
      });

    return response.json<EpisodeResource>();
  }

  async getEpisodeBySeriesId(seriesId: number): Promise<EpisodeResource[]> {
    const response = await this._callAPI(
      `/episode?seriesId=${seriesId}`,
      {
        method: 'GET',
      });

    const json = response.json<EpisodeResource[]>();
    return json;
  }

  async getEpisodeByFileId(fileId: number): Promise<EpisodeResource[]> {
    const response = await this._callAPI(
      `/episode?episodeFileId=${fileId}`,
      {
        method: 'GET',
      });

    const json = response.json<EpisodeResource[]>();
    return json;
  }

  async processEpisodeById(episodeId: number) {
    const episodeResource = await this.getEpisode(episodeId);
    const dbRecord = await TvDbEntry.upsertEpisodeResource(episodeResource);
    return dbRecord;
  }

  async processEpisodeByFileId(fileId: number) {
    if (fileId === 0) {
      return {
        success: false,
        message: '0 is not a valid file ID'
      }
    }
    let marker = startMarker('processEpisodeByFileId.TimePerFile');
    marker.split('getEpisodeByFileId.start');
    const episodeResources = await this.getEpisodeByFileId(fileId);
    marker.split('getEpisodeByFileId.end');
    if (episodeResources.length === 0) {
      this.logger.warn(`No episodes found for fileId ${fileId}`);
      return { success: false, message: `No episodes found for fileId ${fileId}` };
    }
    if (episodeResources.length > 1) {
      this.logger.warn(`Found multiple episodes for fileId ${fileId}`);
    }
    marker.split('upsertBulkEpisodeResource.start');
    let dbRecords = await TvDbEntry.upsertBulkEpisodeResource(episodeResources);
    marker.split('upsertBulkEpisodeResource.end');
    marker.endMarker();
    return dbRecords;
  }

  async processEpisodeChanged(body: WebhookEpisodeFileChangePayload) {
    return {
      success: true,
      data: await this.processEpisodeByFileId(body.episodeFile.id),
    };
  }

  protected processGrab(body: WebhookGrabPayload) {
    return this.fallbackPayloadHandler(body);
  }
  protected processImport(body: WebhookImportPayload) {
    return this.processEpisodeChanged(body);
  }
  protected processDelete(body: WebhookEpisodeDeletePayload) {
    if (body.deleteReason === 'upgrade') {
      this.logger.info(`Episode ${body.episodes[0].title} is being upgraded`);
      return {
        success: true,
        message: `Episode ${body.episodes[0].title} is being upgraded`,
      };
    }
    return this.processEpisodeChanged(body);
  }
  protected processSeriesAdd(body: WebhookSeriesAddPayload) {
    return this.fallbackPayloadHandler(body);
  }
  protected processSeriesDelete(body: WebhookSeriesDeletePayload) {
    return this.fallbackPayloadHandler(body);
  }
  protected processRename(body: WebhookRenamePayload) {
    return this.fallbackPayloadHandler(body);
  }

  protected fallbackPayloadHandler(body: WebhookPayload) {
    this.logger.info(`Unhandled payload: ${body.eventType}`);
    return {
      success: false,
      message: `Unhandled payload: ${body.eventType}`,
    };
  }

  async processWebhook(body: WebhookPayload) {
    if (isGrabEvent(body)) {
      return this.processGrab(body);
    } else if (isImportEvent(body)) {
      return this.processImport(body);
    } else if (isDeleteEvent(body)) {
      return this.processDelete(body);
    } else if (isSeriesAddEvent(body)) {
      return this.processSeriesAdd(body);
    } else if (isSeriesDeleteEvent(body)) {
      return this.processSeriesDelete(body);
    } else if (isRenameEvent(body)) {
      return this.processRename(body);
    } else if (isTestEvent(body)) {
      return this.fallbackPayloadHandler(body);
    }
    return this.fallbackPayloadHandler(body);
  }

  async bulkProcess(quick?: boolean) {
    const allseries = await this.getSeries();
    let counters = {
      series: 0,
      episodes: 0,
      success: 0,
      skipped: 0,
      error: 0,
    };
    for (const series of allseries) {
      let marker = startMarker('bulkProcess.TimePerSeries');
      counters.series++;
      marker.split('getEpisodeBySeriesId.start')
      const episodes =  await this.getEpisodeBySeriesId(series.id);
      marker.split('getEpisodeBySeriesId.end')

      this.logger.info(JSON.stringify(counters));
      this.logger.info(`Processing ${episodes.length} episodes for series ${series.title}`);

      let i = 0;
      for (const episode of episodes) {
        i++;
        if (quick && i > 5) break;
        counters.episodes++;
        if (episode.episodeFileId === 0) {
          counters.skipped++;
          continue;
        }
        marker.split(`processEpisodeByFileId.start`);
        await this.processEpisodeByFileId(episode.episodeFileId).then((record) => {
          counters.success++;
        }).catch((error) => {
          this.logger.error(`Error processing episode ${episode.id}: ${JSON.stringify(error)}`);
          counters.error++;
        })
        marker.split(`processEpisodeByFileId.end`);
      }
      marker.endMarker();
      this.logger.info(`Processed ${i} episodes for series ${series.title} in ${marker.duration / 1000} seconds`);
    }
    return counters;
  }
}

export const name = 'sonarr';

const MonitoredSonarrHandler = Stingray(SonarrHandler);
export default MonitoredSonarrHandler;
