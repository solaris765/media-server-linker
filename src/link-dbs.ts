import PouchDB from 'pouchdb'

if (!process.env.DB_PATH) {
  throw new Error('DB_PATH is not defined')
}

export interface DBEntryLike {
  _id: string;
  _rev?: string;
  realPath: string;
  mediaServers: Record<string, string>;
}
export class DBEntry {
  _id: string;
  _rev?: string;
  realPath: string;
  mediaServers: Record<string, string>;

  constructor(id: string, realPath: string, mediaServers: Record<string, string>, rev?:string) {
    this._id = id;
    this._rev = rev;
    this.realPath = realPath;
    this.mediaServers = mediaServers;
  }

  static fromDoc(doc: DBEntryLike): DBEntry {
    return new DBEntry(doc._id, doc.realPath, doc.mediaServers, doc._rev);
  }

  toDoc(): DBEntryLike {
    return {
      _id: this._id,
      _rev: this._rev,
      realPath: this.realPath,
      mediaServers: this.mediaServers,
    };
  }

  updateMediaServerPath(mediaServerPath: string, path: string|undefined) {
    if (path === undefined) {
      delete this.mediaServers[mediaServerPath];
    } else {
    this.mediaServers[mediaServerPath] = path;  
    }
  }
}

export type MinDBImplementation = Pick<PouchDB.Database<DBEntryLike>, 'get' | 'put'>;

export const tvDb = new PouchDB('tvdb', { prefix: process.env.DB_PATH })

export const movieDb = new PouchDB('moviedb', { prefix: process.env.DB_PATH })
