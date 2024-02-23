import fs from "fs";
import { EventEmitter } from 'events';
import type { EpisodeResource } from './media-managers/sonarr/types/api';
import { Stingray } from './util/performance';
import path from 'path';
import { Database } from "bun:sqlite";
import { default as SonarrHandler } from './media-managers/sonarr';

if (process.env.DB_PATH) {
  fs.mkdirSync(process.env.DB_PATH, { recursive: true });
}

export const DB_EVENT_EMITTER = new EventEmitter();

export const db = new Database(path.resolve(process.env.DB_PATH || import.meta.dir, 'db.sqlite'));
db.exec("PRAGMA journal_mode = WAL;");

interface TvTable {
  _id: string;
  episodeId: number;
  fileId: number;
  dataPath?: string;
}
db.run("CREATE TABLE IF NOT EXISTS tv (_id TEXT NOT NULL, episodeId INTEGER NOT NULL, fileId INTEGER, dataPath TEXT, PRIMARY KEY (_id, episodeId))");
interface TvMediaServersTable {
  _id: string;
  mediaServerPath: string;
  path: string;
}
db.run("CREATE TABLE IF NOT EXISTS tv_media_servers (_id TEXT NOT NULL, mediaServerPath TEXT NOT NULL, path TEXT, PRIMARY KEY (_id, mediaServerPath))");

export interface DBEntryLike {
  _id: string;
  fileId?: number;
  _rev?: string;
  dataPath?: string;
  episodeIds: number[];
  mediaServers: Record<string, string>;
}
class DBEntry {
  _id: string
  private _fileId?: number | undefined;
  private emitterName: string;
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

  constructor(emitterName: string, entry: DBEntryLike) {
    this.emitterName = emitterName;
    this._id = entry._id;
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
      db.exec(`INSERT INTO tv (_id, episodeId, fileId, dataPath) VALUES (?, ?, ?, ?) ON CONFLICT (_id, episodeId) DO UPDATE SET fileId = ?, dataPath = ?`, [this._id, episodeId, this._fileId!, this.dataPath || null, this._fileId!, this.dataPath || null]);
    }

    // table tv_media_servers: _id, mediaServerPath, path -> batch upsert
    for (const [mediaServerPath, path] of Object.entries(this.mediaServers)) {
      db.exec(`INSERT INTO tv_media_servers (_id, mediaServerPath, path) VALUES (?, ?, ?) ON CONFLICT (_id, mediaServerPath) DO UPDATE SET path = ?`, [this._id, mediaServerPath, path, path]);
    }
    if (emit)
      DB_EVENT_EMITTER.emit(this.emitterName, this);
  }

  static fromDoc(doc: DBEntryLike): DBEntry {
    return new DBEntry(doc._id, doc);
  }
}

class _TvDbEntry extends DBEntry {
  constructor(entry: DBEntryLike) {
    super('tv', entry);
  }

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
      SELECT * tv_media_servers
      WHERE tv._id = ?
    `);
    const mediaSrvs = tvStmt.all(item._id) as (TvMediaServersTable)[];

    return new _TvDbEntry({
      _id: item._id,
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

    const mediaServersStmt = db.query(`SELECT * FROM tv_media_servers WHERE _id = ?`);
    const mediaServers = mediaServersStmt.all(item._id) as TvMediaServersTable[];

    return new _TvDbEntry({
      _id: item._id,
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
      let firstId = items[0]._id;
      if (items.some(i => i._id !== firstId)) {
        console.warn(`Found multiple entries that match the episodeId ${episodeId} or fileId ${fileId}`);
      }
    }

    return new _TvDbEntry({
      _id: items[0]._id,
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
        _id: `tv-${episode.id}`,
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
      DB_EVENT_EMITTER.emit('tv', record);
    }
    return records;
  }
}

export interface TvDbEntry extends _TvDbEntry { }
export const TvDbEntry = Stingray(_TvDbEntry);
