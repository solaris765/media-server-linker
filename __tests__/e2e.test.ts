import { describe, it, expect, beforeAll, beforeEach, afterAll, mock } from 'bun:test';
import type { Mock } from 'bun:test';
import { fastify } from 'fastify';
import supertest from 'supertest';
import {db} from '../src/link-dbs';
import path from 'path';
import {app} from '../src/index';
import fs from 'fs/promises';
import { generateEpisode, generateEpisodesForSeries, generateSeries } from './__fixtures__/sonarrApi';

const EMBY_DIR = path.resolve(process.env.MEDIA_ROOT_PATH!, process.env.MEDIA_SOURCE_DIR!);
fs.mkdir(EMBY_DIR, { recursive: true });

interface SonarrRoutes {
  [route: string]: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    handler: Mock<(request: any, reply: any) => any>;
  }
}
let sonarrRoutes: SonarrRoutes = {
  '/episodeFile': {
    method: 'GET',
    handler: mock()
  },
  '/series': {
    method: 'GET',
    handler: mock()
  },
  '/episode': {
    method: 'GET',
    handler: mock()
  },
  '/episode/:id': {
    method: 'GET',
    handler: mock()
  },
}

describe('e2e', () => {
  let sonarrApi;
  beforeAll(async () => {
    sonarrApi = fastify({});
    const sonarrBaseUrl = process.env.SONARR_BASE_URL && new URL(process.env.SONARR_BASE_URL);
    if (!sonarrBaseUrl) {
      throw new Error('SONARR_BASE_URL not set');
    }

    for (const route in sonarrRoutes) {
      const { method, handler } = sonarrRoutes[route];
      const url = `/api/v3${route}`;
      console.error('Adding route', method, url);
      sonarrApi.route({
        method,
        url,
        handler
      });
    }
    
    await sonarrApi.listen({
      port: Number.parseInt(sonarrBaseUrl.port),
      host: '0.0.0.0',
    });
    await app.ready();
  });

  beforeEach(async () => {
    await db.exec('DELETE FROM tv');
    await db.exec('DELETE FROM tv_media_servers');
  });


  afterAll(async () => {
    await sonarrApi!.close();
    await app.close();
    await db.close();
  });

  describe('GET /tv', () => {
    it('should return 200', async () => {
      let series = generateSeries();
      let episodes = generateEpisodesForSeries(series);
      sonarrRoutes['/series'].handler.mockImplementation((req,reply)=>{
        reply.send([series]);
      });
      sonarrRoutes['/episode'].handler.mockImplementation((req,reply)=>{
        if (req.query.episodeFileId) {
          reply.send(episodes.filter(e=>e.episodeFileId === Number.parseInt(req.query.episodeFileId)));
          return;
        }
        if (req.query.seriesId) {
          reply.send(episodes);
          return;
        }
        reply.send(episodes);
      });
      sonarrRoutes['/episode/:id'].handler.mockImplementation((req,reply)=>{
        const episodeId = req.params.id;
        reply.send(episodes.find(e=>e.id === Number.parseInt(episodeId)));
      });
      sonarrRoutes['/episodeFile'].handler.mockImplementation((req,reply)=>{
        const episodeId = req.query.episodeId;
        reply.send(episodes.find(e=>e.id === episodeId));
      });

      await supertest(app.server).get('/tv').expect(200);

      for (const episode of episodes) {
        const stmt = db.prepare('SELECT * FROM tv WHERE episodeId = ?');
        const row = stmt.get(episode.id);

        expect(row).toEqual({
          episodeId: episode.id,
          fileId: episode.episodeFileId,
          dataPath: episode.episodeFile?.path,
        });

        const stmt2 = db.prepare('SELECT * FROM tv_media_servers WHERE fileId = ? AND mediaServerPath = ?');
        const rows = stmt2.all(episode.episodeFileId, 'emby');
        expect(rows).toEqual([{
          fileId: episode.episodeFileId.toString(),
          mediaServerPath: 'emby',
          path: expect.any(String)
        }]);
      } 
    });

    it('should only link one file for multiple episodes', async () => {
      const series = generateSeries({
        seasonCount: 1,
        libraryDir: 'tv',
        episodeCountPerSeason: 4
      });
      const epBase = {
        series,
        seasonNumber: 1,
        episodeNumber: 1,
        absoluteEpisodeNumber: 1,
        fileId: 1,
        filePath: path.resolve(series.rootFolderPath!, 'series/Season 1/episode1234.mp4')
      }
      const episodes = [
        generateEpisode(epBase),
        generateEpisode({...epBase, episodeNumber: 2, absoluteEpisodeNumber: 2}),
        generateEpisode({...epBase, episodeNumber: 3, absoluteEpisodeNumber: 3}),
        generateEpisode({...epBase, episodeNumber: 4, absoluteEpisodeNumber: 4}),
      ]

      sonarrRoutes['/series'].handler.mockImplementation((req,reply)=>{
        reply.send([series]);
      });
      sonarrRoutes['/episode'].handler.mockImplementation((req,reply)=>{
        if (req.query.episodeFileId) {
          reply.send(episodes.filter(e=>e.episodeFileId === Number.parseInt(req.query.episodeFileId)));
          return;
        }
        if (req.query.seriesId) {
          reply.send(episodes);
          return;
        }
        reply.send(episodes);
      });
      sonarrRoutes['/episode/:id'].handler.mockImplementation((req,reply)=>{
        const episodeId = req.params.id;
        reply.send(episodes.find(e=>e.id === Number.parseInt(episodeId)));
      });
      sonarrRoutes['/episodeFile'].handler.mockImplementation((req,reply)=>{
        const episodeId = req.query.episodeId;
        reply.send(episodes.find(e=>e.id === episodeId));
      });

      await supertest(app.server).get('/tv').expect(200);

      const stmt = db.prepare('SELECT * FROM tv WHERE fileId = ?');
      const entries = stmt.all(episodes[0].episodeFileId);

      expect(entries).toHaveLength(4);

      const stmt2 = db.prepare('SELECT * FROM tv_media_servers WHERE fileId = ?');
      const rows = stmt2.all(episodes[0].episodeFileId);
      expect(rows).toEqual([{
        fileId: '1',
        mediaServerPath: 'emby',
        path: expect.stringContaining('S01E01-E04')
      }]);

      const files = await fs.readdir(path.dirname((rows[0] as any).path))
      expect(files).toHaveLength(1);
    });
  });
});
