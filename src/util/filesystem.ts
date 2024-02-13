import * as fs from 'fs';
import pouchdb from 'pouchdb';


export interface DBEntry {
  _id: string;
  realPath: string;
  mediaServers: Record<string, string>;
}

export async function createHardLink(source: string, destination: string): Promise<void> {
  // ensure the destination directory exists creating its parent directories if necessary
  const destinationDirectory = destination.split('/').slice(0, -1)

  await new Promise<void>((resolve, reject) => {
    fs.mkdir(destinationDirectory.join('/'), { recursive: true }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  return new Promise((resolve, reject) => {
    fs.link(source, destination, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}