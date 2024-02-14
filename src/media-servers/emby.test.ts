import { expect, test, describe, beforeEach, it, beforeAll, afterAll } from "bun:test";
import mockFs from 'mock-fs';
import { default as EmbyMediaServer } from '/home/mason/repos/media-srv-linker/src/media-servers/emby';

const MOCKED_REAL_FILE_PATH = '/media/data/tv/series-folder/season-folder/episode-file.mp4';
describe('EmbyMediaServer', () => {
  let embyMediaServer: EmbyMediaServer;

  beforeAll(() => {
    mockFs({
      [`${MOCKED_REAL_FILE_PATH}`]: 'file content',
    });
  });

  afterAll(() => {
    mockFs.restore();
  });

  beforeEach(() => {
    embyMediaServer = new EmbyMediaServer({ logger: console });
  });

  describe('libraryDir', () => {
    it('should return the correct library directory', () => {
      const episode = {
        episodeFile: {
          path: MOCKED_REAL_FILE_PATH,
        },
      };
      const result = embyMediaServer.libraryDir(episode);
      expect(result).toBe('tv');
    });

    it('should return an empty string if fullPath is not provided', () => {
      const episode = {
        episodeFile: {
          path: '',
        },
      };
      const result = embyMediaServer.libraryDir(episode);
      expect(result).toBe('');
    });
  });

  describe('seriesFolderName', () => {
    it('should return the correct series folder name', () => {
      const series = {
        title: 'Friends',
        year: 1994,
        imdbId: 'tt0108778',
      };
      const result = embyMediaServer.seriesFolderName(series);
      expect(result).toBe('Friends (1994) [imdbid-tt0108778]');
    });
  });

  describe('seasonFolderName', () => {
    it('should return the correct season folder name', () => {
      const seasonNumber = 1;
      const result = embyMediaServer.seasonFolderName(seasonNumber);
      expect(result).toBe('Season 1');
    });
  });

  describe('episodeFileName', () => {
    it('should return the correct episode file name', () => {
      const seriesTitle = 'Friends';
      const episode = {
        seasonNumber: 1,
        absoluteEpisodeNumber: 1,
        title: 'The One Where Monica Gets a Roommate',
      };
      const result = embyMediaServer.episodeFileName(seriesTitle, episode);
      expect(result).toBe('Friends - S1E1 - The One Where Monica Gets a Roommate');
    });
  });

  describe('mediaServerPathForEpisode', () => {
    it('should return the correct media server path for an episode', () => {
      const series = {
        title: 'Friends',
        imdbId: 'tt0108778',
        year: 1994,
      };
      const episode = {
        seasonNumber: 1,
        absoluteEpisodeNumber: 1,
        title: 'The One Where Monica Gets a Roommate',
        episodeFile: {
          path: MOCKED_REAL_FILE_PATH,
        },
      };
      const result = embyMediaServer.mediaServerPathForEpisode(series, episode);
      expect(result).toBe('/media/emby2/tv/Friends (1994) [imdbid-tt0108778]/Season 1/Friends - S1E1 - The One Where Monica Gets a Roommate.mp4');
    });
  });

  describe('linkEpisodeToLibrary', () => {
    // TODO: Add test cases for linkEpisodeToLibrary method
  });
});