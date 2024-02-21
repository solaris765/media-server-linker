import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'
import fs from "fs";
import { EventEmitter } from 'events';

PouchDB.plugin(PouchDBFind);

export const DB_EVENT_EMITTER = new EventEmitter();

export interface DBEntryLike {
  _id: string;
  fileId?: number;
  oldFileIds: number[];
  _rev?: string;
  dataPath: string;
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
  public set fileId(value: number | undefined)
  {
    if (this._fileId !== undefined)
      this.oldFileIds.push(this._fileId);
    this._fileId = value;
  }
  oldFileIds: number[]
  _rev?: string;
  dataPath: string;
  episodeIds: number[]
  mediaServers: Record<string, string>;

  constructor(emitterName: string, entry: DBEntryLike) {
    this.emitterName = emitterName;
    this._id = entry._id;
    this._fileId = entry.fileId;
    this.oldFileIds = entry.oldFileIds;
    this.dataPath = entry.dataPath;
    this.episodeIds = entry.episodeIds;
    this.mediaServers = entry.mediaServers;
  }

  private toDoc(): DBEntryLike {
    return {
      _id: this._id,
      fileId: this.fileId,
      oldFileIds: this.oldFileIds,
      dataPath: this.dataPath,
      episodeIds: this.episodeIds,
      mediaServers: this.mediaServers
    }
  }

  async save() {
    const res = await tvDb.put(this.toDoc());
    this._rev = res.rev;
    DB_EVENT_EMITTER.emit(this.emitterName, this);
  }

  updateMediaServerPath(mediaServerPath: string, path: string|undefined) {
    if (path === undefined) {
      delete this.mediaServers[mediaServerPath];
    } else {
    this.mediaServers[mediaServerPath] = path;  
    }
  }
}

export class TvDbEntry extends DBEntry {
  constructor(entry: DBEntryLike) {
    super('tv', entry);
  }

  static async findByEpisodeId(episodeId: number): Promise<DBEntry|null> {
    const res = await tvDb.find({
      selector: {
        episodeIds: { $elemMatch: { $eq: episodeId } }
      }
    });
    if (res.docs.length > 1) {
      console.warn(`Found multiple entries for episodeId ${episodeId}`);
    } else if (res.docs.length === 0) {
      return null;
    }
    return new TvDbEntry(res.docs[0]);
  }

  static async findByFileId(fileId: number): Promise<DBEntry|null> {
    const res = await tvDb.find({
      selector: {
        fileId: fileId
      }
    });
    if (res.docs.length > 1) {
      console.warn(`Found multiple entries for fileId ${fileId}`);
    } else if (res.docs.length === 0) {
      return null;
    }
    return new TvDbEntry(res.docs[0]);
  }
}

export type MinDBImplementation = Pick<PouchDB.Database<DBEntryLike>, 'get' | 'put' | 'find'>;

if (process.env.DB_PATH) {
  fs.mkdirSync(process.env.DB_PATH, { recursive: true });
}

export const tvDb = new PouchDB<DBEntryLike>('tvdb', { prefix: process.env.DB_PATH })

export const movieDb = new PouchDB<DBEntryLike>('moviedb', { prefix: process.env.DB_PATH })
