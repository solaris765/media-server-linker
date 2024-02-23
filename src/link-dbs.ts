import fs from "fs";
import type { EpisodeResource } from './media-managers/sonarr/types/api';
import { Stingray } from './util/performance';
import path from 'path';
import { Database } from "bun:sqlite";
import { default as SonarrHandler } from './media-managers/sonarr';
import { linkEpisodeToLibrary } from "./media-servers";

const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.resolve(import.meta.dir, 'db.sqlite');
if (process.env.DB_PATH) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

export const db = new Database(path.resolve(DB_PATH, process.env.DB_NAME ?? 'db.sqlite'));
db.exec("PRAGMA journal_mode = WAL;");

interface TvTable {
  episodeId: number;
  fileId: number;
  dataPath?: string;
}
db.run("CREATE TABLE IF NOT EXISTS tv (episodeId INTEGER NOT NULL, fileId INTEGER, dataPath TEXT, PRIMARY KEY (episodeId))");
interface TvMediaServersTable {
  mediaServerPath: string;
  path: string;
}
db.run("CREATE TABLE IF NOT EXISTS tv_media_servers (fileId TEXT NOT NULL, mediaServerPath TEXT NOT NULL, path TEXT, PRIMARY KEY (fileId, mediaServerPath))");

export interface DBEntryLike {
  fileId?: number;
  _rev?: string;
  dataPath?: string;
  episodeIds: number[];
  mediaServers: Record<string, string>;
}
class DBEntry {
  private _fileId?: number | undefined;
  public get fileId(): number | undefined {
    return this._fileId;
  }
  public set fileId(value: number | undefined) {
    this._fileId = value;
  }
  _rev?: string;
  dataPath?: string;
  episodeIds: Set<number>;
  mediaServers: Record<string, string>;

  constructor(entry: DBEntryLike) {
    this._rev = entry._rev;
    this._fileId = entry.fileId;
    this.dataPath = entry.dataPath;
    this.episodeIds = new Set(entry.episodeIds);
    this.mediaServers = entry.mediaServers;
  }

  async save(emit: boolean = true) {
    // const res = await tvDb.put(this.toDoc());
    // insert into db
    
    // table tv_episode_ids: _id, episodeId
    // table tv_media_servers: _id, mediaServerPath, path
    
    // table tv: _id, fileId, dataPath -> upsert    
    for (const episodeId of this.episodeIds) {
      db.exec(`INSERT INTO tv (episodeId, fileId, dataPath) VALUES (?, ?, ?) ON CONFLICT (episodeId) DO UPDATE SET fileId = ?, dataPath = ?`, [episodeId, this.fileId || null, this.dataPath || null, this.fileId || null, this.dataPath || null]);
    }

    // table tv_media_servers: _id, mediaServerPath, path -> batch upsert
    for (const [mediaServerPath, path] of Object.entries(this.mediaServers)) {
      if (!this.fileId) {
        db.exec(`DELETE FROM tv_media_servers WHERE mediaServerPath = ? AND path = ?`, [mediaServerPath, path]);
      } else {
        db.exec(`INSERT INTO tv_media_servers (fileId, mediaServerPath, path) VALUES (?, ?, ?) ON CONFLICT (fileId, mediaServerPath) DO UPDATE SET path = ?`, [this.fileId, mediaServerPath, path, path]);
      }
    }
  }

  static fromDoc(doc: DBEntryLike): DBEntry {
    return new DBEntry(doc);
  }

  async getMediaServerPath(mediaServerPath: string) {
    const stmt = db.query(`SELECT * FROM tv_media_servers WHERE fileId = ? AND mediaServerPath = ?`);
    const items = stmt.all(this.fileId!, mediaServerPath) as TvMediaServersTable[];
    if (!items) return null;
    if (items.length > 1) {
      console.warn(`Found multiple entries for fileId ${this.fileId} and mediaServerPath ${mediaServerPath}`);
    } else if (items.length === 0) {
      return null;
    }
    return items[0].path;
  }
}

class _TvDbEntry extends DBEntry {
  static async findByEpisodeId(episodeId: number): Promise<DBEntry | null> {
    const stmt = db.query(`SELECT * FROM tv WHERE episodeId = ?`);
    const items = stmt.all(episodeId) as TvTable[];

    if (items.length === 0) return null;
    if (items.length > 1) {
      console.warn(`Found multiple entries for episodeId ${episodeId}`);
    } else if (items.length === 0) {
      return null;
    }

    const item = items[0];
    // join tables tv_episode_ids, tv, tv_file_ids, tv_media_servers even if tv_file_ids and tv_media_servers are empty
    const tvStmt = db.query(`
      SELECT * FROM tv_media_servers WHERE fileId = ?
    `);
    const mediaSrvs = tvStmt.all(item.fileId) as (TvMediaServersTable)[];

    return new _TvDbEntry({
      fileId: item.fileId,
      episodeIds: items.map(i => i.episodeId),
      dataPath: item.dataPath,
      mediaServers: Object.fromEntries(mediaSrvs.map(i => [i.mediaServerPath, i.path]))
    });
  }

  static async findByFileId(fileId: number): Promise<DBEntry | null> {
    const stmt = db.query(`SELECT * FROM tv WHERE fileId = ?`);
    const items = stmt.all(fileId) as TvTable[];
    
    if (items.length === 0) return null;
    if (items.length > 1) {
      console.warn(`Found multiple entries for fileId ${fileId}`);
    } else if (items.length === 0) {
      return null;
    }

    const item = items[0];

    const mediaServersStmt = db.query(`SELECT * FROM tv_media_servers WHERE fileId = ?`);
    const mediaServers = mediaServersStmt.all(item.fileId) as TvMediaServersTable[];

    return new _TvDbEntry({
      fileId: item.fileId,
      episodeIds: items.map(i => i.episodeId),
      dataPath: item.dataPath,
      mediaServers: Object.fromEntries(mediaServers.map(i => [i.mediaServerPath, i.path]))
    });
  }

  static async findExistingRecord(episodeId: number, fileId: number): Promise<DBEntry | null> {
    const stmt = db.query(`SELECT * FROM tv WHERE episodeId = ? OR fileId = ?`);
    const items = stmt.all(episodeId, fileId) as TvTable[];
    if (items.length === 0) return null;
    if (items.length > 1) {
      let firstId = items[0].episodeId;
      if (items.some(i => i.episodeId !== firstId)) {
        console.warn(`Found multiple entries that match the episodeId ${episodeId} or fileId ${fileId}`);
      }
    }

    return new _TvDbEntry({
      fileId: items[0].fileId,
      episodeIds: items.map(i => i.episodeId),
      dataPath: items[0].dataPath,
      mediaServers: {}
    });
  }

  static async loadEpisodeResource(episode: EpisodeResource): Promise<DBEntry> {
    let record = await _TvDbEntry.findExistingRecord(episode.id, episode.episodeFileId);
    if (record === null) {
      record = new _TvDbEntry({
        fileId: episode.episodeFileId,
        dataPath: episode.episodeFile?.path || undefined,
        episodeIds: [episode.id],
        mediaServers: {}
      });
    } else {
      record.fileId = episode.episodeFileId;
      record.dataPath = episode.episodeFile?.path || undefined;
      record.episodeIds.add(episode.id);
    }
    if (!record.dataPath && episode.episodeFileId) {
      const sonarrHandler = new SonarrHandler({ logger: console });
      const episodeFile = await sonarrHandler.getEpisodeFileById(episode.episodeFileId);
      record.dataPath = episodeFile.path || undefined;
    }
    return record;
  }

  static async upsertEpisodeResource(episode: EpisodeResource): Promise<DBEntry> {
    const record = await _TvDbEntry.loadEpisodeResource(episode);
    await record.save();
    return record;
  }

  static async upsertBulkEpisodeResource(episodes: EpisodeResource[]): Promise<DBEntry[]> {
    const records = await Promise.all(episodes.map(episode => _TvDbEntry.loadEpisodeResource(episode)));
    await Promise.all(records.map(record => record.save(false)));
    for (const record of records) {
      await linkEpisodeToLibrary(record, console);
    }
    return records;
  }
}

export interface TvDbEntry extends _TvDbEntry {}
export const TvDbEntry = Stingray(_TvDbEntry);
