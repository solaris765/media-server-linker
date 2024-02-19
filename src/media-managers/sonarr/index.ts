import pouchdb from "pouchdb";
import { MediaManager, type TypedResponse } from "../../types";
import type { DBEntryLike } from "../../util/filesystem";
import {
  type EpisodeResource,
  type ParseResource,
  type SeriesResource,
} from "./types/api"
import { type WebhookPayload, type WebhookTestPayload, WebhookEventType, type WebhookGrabPayload, type WebhookImportPayload, type WebhookRenamePayload, type WebhookSeriesAddPayload, type WebhookSeriesDeletePayload, type WebhookEpisodeDeletePayload, type WebhookHealthPayload, type WebhookApplicationUpdatePayload, type WebhookManualInteractionPayload, type WebhookEpisodeChangePayload } from "./types/webhooks";
import { saveCurlToFile } from "../../util/curl";
import { linkEpisodeToLibrary } from "../../media-servers";

export const sonarrDB = new pouchdb<DBEntryLike>('sonarrDB');

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

  async getEpisode(episodeId: number): Promise<EpisodeResource[]> {
    const response = await this._callAPI(
      `/episode/${episodeId}`,
      {
        method: 'GET',
      });

    const ep = await response.json<EpisodeResource>();

    let result: EpisodeResource[] = []
    if (!ep) {
      return result;
    }
    result = [ep];
    if (ep.title && ep.episodeFile?.path) {
      const parsedEpisode = await this.parse(ep.series.title, ep.episodeFile.path);
      if (parsedEpisode?.episodes?.length > 1) {
        // filter is a precaution to remove potential null entries
        result = result.concat(parsedEpisode.episodes.slice(1)).filter((e) => !!e)
      }
    }

    if (!result[0].series) {
      // fallback to get the series
      result[0].series = (await this.getSeries(result[0].seriesId))[0];
    }

    return result;
  }

  async parse(title: string, path: string): Promise<ParseResource> {
    const response = await this._callAPI<{ series: SeriesResource }>(`/parse?path=${path}&title=${title}`);
    return response.json();
  }

  async processEpisodeById(episodeId: number) {
    const episodeResource = await this.getEpisode(episodeId);
    await linkEpisodeToLibrary(episodeResource, this.logger);
    return true;
  }

  async processEpisodeChanged(body: WebhookEpisodeChangePayload) {
    for (const episode of body.episodes) {
      const episodeResource = await this.getEpisode(episode.id);
      this.logger.info(`Processing episode: ${episodeResource[0].title}`);
      await linkEpisodeToLibrary(episodeResource, this.logger);
    }

    return true;
  }

  protected processGrab(body: WebhookGrabPayload) {
    return this.processEpisodeChanged(body);
  }
  protected processImport(body: WebhookImportPayload) {
    return this.processEpisodeChanged(body);
  }
  protected processDelete(body: WebhookEpisodeDeletePayload) {
    if (body.deleteReason === 'upgrade') {
      this.logger.info(`Episode ${body.episodes[0].title} is being upgraded`);
      return true;
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
    return true;
  }

  processWebhook(body: WebhookPayload) {
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
    let seriesCount = 0;
    let episodeCount = 0;
    let failed = 0;
    let success = 0;
    for (const series of allseries) {
      seriesCount++;
      const seriesRes = await this._callAPI<EpisodeResource[]>(`/episode?seriesId=${series.id}`);
      const episodes = await seriesRes.json<EpisodeResource[]>();

      let i = 0;
      for (const episode of episodes) {
        i++;
        let isEveryFourth = i % 4 === 0;
        if (quick && !isEveryFourth) {
          continue;
        }
        const episodeResource = await this.getEpisode(episode.id);
        if (episodeResource.length === 0) {
          // skip episodes that don't have a file
          // seems to indicate multi-episode files
          continue;
        }
        episodeCount++;
        await linkEpisodeToLibrary(episodeResource, this.logger)
          .then(() => {
            success++;
          })
          .catch((e) => {
            failed++;
            this.logger.error(`Error linking episode: ${e}`);
          });
      }

    }
    return { seriesCount, episodeCount, failed, success };
  }
}

export const name = 'sonarr';
export default SonarrHandler;
