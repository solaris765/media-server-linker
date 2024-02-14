import pouchdb from "pouchdb";
import { MediaManager, type TypedResponse } from "../../types";
import type { DBEntry } from "../../util/filesystem";
import {
  type EpisodeResource,
  type SeriesResource,
} from "./types/api"
import { type WebhookPayload, type WebhookTestPayload, WebhookEventType, type WebhookGrabPayload, type WebhookImportPayload, type WebhookRenamePayload, type WebhookSeriesAddPayload, type WebhookSeriesDeletePayload, type WebhookEpisodeDeletePayload, type WebhookHealthPayload, type WebhookApplicationUpdatePayload, type WebhookManualInteractionPayload, type WebhookEpisodeChangePayload } from "./types/webhooks";
import { saveCurlToFile } from "../../util/curl";

export const sonarrDB = new pouchdb<DBEntry>('sonarrDB');


const API = (process.env.SONARR_BASE_URL as string).replace(/\/$/, '');
const API_KEY = process.env.SONARR_API_KEY as string;

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
  async getSeries(seriesId?: number,
    options?: Record<string,
      string>) {
    const query = new URLSearchParams(options).toString();
    const response = await this._callAPI<SeriesResource[]>(`/series/${seriesId}${query ? '?' + query : ''}`,
      {
        method: 'GET',
      });

    return await response.json();
  }

  async getEpisode(episodeId: number): Promise<EpisodeResource> {
    const response = await this._callAPI(
      `/episode/${episodeId}`,
      {
        method: 'GET',
      });

    return await response.json();
  }

  async processEpisodeChanged(body: WebhookEpisodeChangePayload) {
    for (const episode of body.episodes) {
      const episodeResource = await this.getEpisode(episode.id);
      this.logger.info(`Processing episode: ${episodeResource.title}`);
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
}

export const name = 'sonarr';
export default SonarrHandler;
