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
  fileId: number;
  dataPath?: string;
}
db.run("CREATE TABLE IF NOT EXISTS tv (_id TEXT PRIMARY KEY NOT NULL, fileId INTEGER, dataPath TEXT)");
interface TvFileIdsTable {
  _id: string;
  fileId: number;
}
db.run("CREATE TABLE IF NOT EXISTS tv_file_ids (_id TEXT NOT NULL, fileId INTEGER NOT NULL, PRIMARY KEY (_id, fileId))");
interface TvEpisodeIdsTable {
  _id: string;
  episodeId: number;
}
db.run("CREATE TABLE IF NOT EXISTS tv_episode_ids (_id TEXT NOT NULL, episodeId INTEGER NOT NULL, PRIMARY KEY (_id, episodeId))");
interface TvMediaServersTable {
  _id: string;
  mediaServerPath: string;
  path: string;
}
db.run("CREATE TABLE IF NOT EXISTS tv_media_servers (_id TEXT NOT NULL, mediaServerPath TEXT NOT NULL, path TEXT, PRIMARY KEY (_id, mediaServerPath))");

export interface DBEntryLike {
  _id: string;
  fileId?: number;
  oldFileIds: number[];
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
    if (this._fileId !== undefined)
      this.oldFileIds.add(this._fileId);
    this._fileId = value;
  }
  private oldFileIds: Set<number>
  _rev?: string;
  dataPath?: string;
  episodeIds: Set<number>;
  mediaServers: Record<string, string>;

  constructor(emitterName: string, entry: DBEntryLike) {
    this.emitterName = emitterName;
    this._id = entry._id;
    this._rev = entry._rev;
    this._fileId = entry.fileId;
    this.oldFileIds = new Set(entry.oldFileIds);
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
    db.exec(`INSERT INTO tv (_id, fileId, dataPath) VALUES (?, ?, ?) ON CONFLICT (_id) DO UPDATE SET fileId = ?, dataPath = ?`, [this._id, this.fileId || null, this.dataPath || null, this.fileId || null, this.dataPath || null]);


    // table tv_file_ids: _id, fileId -> batch upsert
    for (const fileId of this.oldFileIds) {
      db.exec(`INSERT INTO tv_file_ids (_id, fileId) VALUES ('${this._id}', ${fileId}) ON CONFLICT (_id, fileId) DO NOTHING`);
    }

    // table tv_episode_ids: _id, episodeId -> batch upsert
    for (const episodeId of this.episodeIds) {
      db.exec(`INSERT INTO tv_episode_ids (_id, episodeId) VALUES ('${this._id}', ${episodeId}) ON CONFLICT (_id, episodeId) DO NOTHING`);
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

const t = DBEntry;
const tt = new DBEntry('tv', { _id: 'tv-1', oldFileIds: [], episodeIds: [], mediaServers: {} });
function test(t: DBEntry) {
  tt.dataPath
}
function test2(t: typeof DBEntry) {
  t.fromDoc({ _id: 'tv-1', oldFileIds: [], episodeIds: [], mediaServers: {} });
}
function test3<T extends new (...args: any[]) => any>(t: T): T {
  return t;
}
test3(DBEntry).fromDoc({ _id: 'tv-1', oldFileIds: [], episodeIds: [], mediaServers: {} });

class _TvDbEntry extends DBEntry {
  constructor(entry: DBEntryLike) {
    super('tv', entry);
  }

  static async findByEpisodeId(episodeId: number): Promise<DBEntry | null> {
    const stmt = db.query(`SELECT * FROM tv_episode_ids WHERE episodeId = ?`);
    const items = stmt.all(episodeId) as TvEpisodeIdsTable[];

    if (items.length > 1) {
      console.warn(`Found multiple entries for episodeId ${episodeId}`);
    } else if (items.length === 0) {
      return null;
    }

    const item = items[0];
    // join tables tv_episode_ids, tv, tv_file_ids, tv_media_servers even if tv_file_ids and tv_media_servers are empty
    const tv = db.query(`
      SELECT * FROM tv 
      LEFT JOIN tv_file_ids ON tv._id = tv_file_ids._id
      LEFT JOIN tv_media_servers ON tv._id = tv_media_servers._id
      WHERE tv._id = ?
    `);
    const restOfIt = tv.all(item._id) as (TvTable & TvFileIdsTable & TvMediaServersTable)[];

    return new _TvDbEntry({
      _id: item._id,
      fileId: restOfIt[0].fileId,
      oldFileIds: restOfIt.map(i => i.fileId),
      episodeIds: items.map(i => i.episodeId),
      dataPath: restOfIt[0].dataPath,
      mediaServers: Object.fromEntries(restOfIt.map(i => [i.mediaServerPath, i.path]))
    });
  }

  static async findByFileId(fileId: number): Promise<DBEntry | null> {
    const stmt = db.query(`SELECT * FROM tv WHERE fileId = ?`);
    const items = stmt.all(fileId) as TvTable[];
    
    if (items.length > 1) {
      console.warn(`Found multiple entries for fileId ${fileId}`);
    } else if (items.length === 0) {
      return null;
    }

    const item = items[0];
    // join tables tv_episode_ids, tv, tv_file_ids, tv_media_servers even if tv_file_ids and tv_media_servers are empty
    const tv = db.query(`
      SELECT * FROM tv 
      LEFT JOIN tv_episode_ids ON tv._id = tv_episode_ids._id
      LEFT JOIN tv_file_ids ON tv._id = tv_file_ids._id
      LEFT JOIN tv_media_servers ON tv._id = tv_media_servers._id
      WHERE tv._id = ?
    `);
    const restOfIt = tv.all(item._id) as (TvTable & TvFileIdsTable & TvMediaServersTable & TvEpisodeIdsTable)[];

    return new _TvDbEntry({
      _id: item._id,
      fileId: restOfIt[0].fileId,
      oldFileIds: restOfIt.map(i => i.fileId),
      episodeIds: restOfIt.map(i => i.episodeId),
      dataPath: restOfIt[0].dataPath,
      mediaServers: Object.fromEntries(restOfIt.map(i => [i.mediaServerPath, i.path]))
    });
  }

  static async findExistingRecord(episodeId: number, fileId: number): Promise<DBEntry | null> {
    const [byEpisodeId, byFileId] = await Promise.all([
      _TvDbEntry.findByEpisodeId(episodeId),
      _TvDbEntry.findByFileId(fileId)
    ]);
    if (!byEpisodeId && !byFileId) {
      return null;
    }
    if (byEpisodeId && byFileId) {
      if (byEpisodeId._id !== byFileId._id) {
        console.warn(`Found multiple entries that match the episodeId ${episodeId} or fileId ${fileId}`);
      }
      return byEpisodeId;
    }

    return byEpisodeId || byFileId;
  }

  static async loadEpisodeResource(episode: EpisodeResource): Promise<DBEntry> {
    let record = await _TvDbEntry.findExistingRecord(episode.id, episode.episodeFileId);
    if (record === null) {
      record = new _TvDbEntry({
        _id: `tv-${episode.id}`,
        fileId: episode.episodeFileId,
        oldFileIds: [],
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
