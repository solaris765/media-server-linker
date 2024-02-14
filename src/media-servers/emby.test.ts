import { expect, mock, describe, beforeEach, it } from "bun:test";
// import mockFs from 'mock-fs';
import { default as EmbyMediaServer } from '/home/mason/repos/media-srv-linker/src/media-servers/emby';

import { createSymLink } from "../util/filesystem";
import { mockPouchDBGet, mockPouchDBPut } from "../../my-preload";
mock.module('../util/filesystem', ()=>({createSymLink: mock()}));

const MOCKED_REAL_FILE_PATH = '/media/data/tv/series-folder/season-folder/episode-file.mp4';
describe('EmbyMediaServer', () => {
  let embyMediaServer: EmbyMediaServer;

  // beforeAll(() => {
  //   mockFs({
  //     [`${MOCKED_REAL_FILE_PATH}`]: 'file content',
  //   });
  // });

  // afterAll(() => {
  //   mockFs.restore();
  // });

  beforeEach(() => {
    mockPouchDBPut.mockReset();
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
    it('should create a symlink for a new episode', async () => {
      const episode = {
        id: 1,
        series: {
          title: 'Friends',
          imdbId: 'tt0108778',
          year: 1994,
        },
        seasonNumber: 1,
        absoluteEpisodeNumber: 1,
        title: 'The One Where Monica Gets a Roommate',
        episodeFile: {
          path: MOCKED_REAL_FILE_PATH,
        },
        hasFile: true,
      };
      await embyMediaServer.linkEpisodeToLibrary(episode);
      expect(mockPouchDBGet).toHaveBeenCalledWith('1');
      expect(mockPouchDBPut).toHaveBeenCalledWith({
        _id: '1',
        realPath: MOCKED_REAL_FILE_PATH,
        mediaServers: {
          emby2: '/media/emby2/tv/Friends (1994) [imdbid-tt0108778]/Season 1/Friends - S1E1 - The One Where Monica Gets a Roommate.mp4',
        },
      });
      expect(createSymLink).toHaveBeenCalledWith(MOCKED_REAL_FILE_PATH, '/media/emby2/tv/Friends (1994) [imdbid-tt0108778]/Season 1/Friends - S1E1 - The One Where Monica Gets a Roommate.mp4');
    });

    it('should update the symlink for an existing episode if the real path has changed', async () => {
      const episode = {
        id: 1,
        series: {
          title: 'Friends',
          imdbId: 'tt0108778',
          year: 1994,
        },
        seasonNumber: 1,
        absoluteEpisodeNumber: 1,
        title: 'The One Where Monica Gets a Roommate',
        episodeFile: {
          path: MOCKED_REAL_FILE_PATH,
        },
        hasFile: true,
      };
      await embyMediaServer.linkEpisodeToLibrary(episode);
      expect(mockPouchDBGet).toHaveBeenCalledWith('1');
      expect(createSymLink).toHaveBeenCalledWith(MOCKED_REAL_FILE_PATH, '/media/emby2/tv/Friends (1994) [imdbid-tt0108778]/Season 1/Friends - S1E1 - The One Where Monica Gets a Roommate.mp4');
    });

    it('should remove the symlink for an existing episode if the real path has been removed', async () => {
      mockPouchDBGet.mockResolvedValue({
        _id: '1',
        realPath: MOCKED_REAL_FILE_PATH,
        mediaServers: {
          emby2: '/media/emby2/tv/Friends (1994) [imdbid-tt0108778]/Season 1/Friends - S1E1 - The One Where Monica Gets a Roommate.mp4',
        },
      });
      const episode = {
        id: 1,
        series: {
          title: 'Friends',
          imdbId: 'tt0108778',
          year: 1994,
        },
        seasonNumber: 1,
        absoluteEpisodeNumber: 1,
        title: 'The One Where Monica Gets a Roommate',
        episodeFile: {
          path: '',
        },
        hasFile: false,
      };
      await embyMediaServer.linkEpisodeToLibrary(episode);
      expect(mockPouchDBGet).toHaveBeenCalledWith('1');
      expect(mockPouchDBPut).toHaveBeenCalledTimes(1);
      expect(mockPouchDBPut).toHaveBeenCalledWith({
        _id: '1',
        realPath: '',
        mediaServers: {
          emby2: undefined,
        },
      });
    });

    it('should not create a symlink for an episode without a file', async () => {
      const episode = {
        id: 1,
        series: {
          title: 'Friends',
          imdbId: 'tt0108778',
          year: 1994,
        },
        seasonNumber: 1,
        absoluteEpisodeNumber: 1,
        title: 'The One Where Monica Gets a Roommate',
        episodeFile: {
          path: '',
        },
        hasFile: false,
      };
      await embyMediaServer.linkEpisodeToLibrary(episode);
      expect(mockPouchDBGet).toHaveBeenCalledWith('1');
      expect(mockPouchDBPut).toHaveBeenCalledTimes(0);
      expect(createSymLink).toHaveBeenCalledTimes(0);
    });

    it('should not do anything if the real path and saved link path both match the db entry', async () => {
      mockPouchDBGet.mockResolvedValue({
        _id: '1',
        realPath: MOCKED_REAL_FILE_PATH,
        mediaServers: {
          emby2: '/media/emby2/tv/Friends (1994) [imdbid-tt0108778]/Season 1/Friends - S1E1 - The One Where Monica Gets a Roommate.mp4',
        },
      });
      const episode = {
        id: 1,
        series: {
          title: 'Friends',
          imdbId: 'tt0108778',
          year: 1994,
        },
        seasonNumber: 1,
        absoluteEpisodeNumber: 1,
        title: 'The One Where Monica Gets a Roommate',
        episodeFile: {
          path: MOCKED_REAL_FILE_PATH,
        },
        hasFile: true,
      };
      await embyMediaServer.linkEpisodeToLibrary(episode);
      expect(mockPouchDBGet).toHaveBeenCalledWith('1');
      expect(mockPouchDBPut).toHaveBeenCalledTimes(0);
      expect(createSymLink).toHaveBeenCalledTimes(0);
    });
  });
});