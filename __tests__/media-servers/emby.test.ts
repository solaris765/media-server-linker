import { expect, mock, describe, beforeEach, it } from "bun:test";
import { default as EmbyMediaServer } from '../../src/media-servers/emby';

const mockCreateSymLink = mock();
const mockDoesFileExist = mock();
const mockRemoveLink = mock();

const mockPouchDBGet = mock();
const mockPouchDBPut = mock();

const mockPouchDB: any = {
    get: mockPouchDBGet,
    put: mockPouchDBPut,
};

const MOCKED_REAL_FILE_PATH = '/media/data/tv/series-folder/season-folder/episode-file.mp4';
describe('EmbyMediaServer', () => {
  let embyMediaServer: EmbyMediaServer;

  beforeEach(() => {
    mockCreateSymLink.mockClear();
    mockDoesFileExist.mockClear();
    mockRemoveLink.mockClear();
    mockPouchDBGet.mockClear();
    mockPouchDBPut.mockClear();
    
    embyMediaServer = new EmbyMediaServer({ 
      logger: console, 
      tvDb: mockPouchDB,
      movieDb: mockPouchDB,
      fileSystem: { 
        createSymLink: mockCreateSymLink,
        doesFileExist: mockDoesFileExist,
        removeLink: mockRemoveLink,
      }});
  });

  describe('libraryDir', () => {
    it('should return the correct library directory', () => {
      const episode = {
        episodeFile: {
          path: MOCKED_REAL_FILE_PATH,
        },
      };
      const result = embyMediaServer.libraryDir(episode as any);
      expect(result).toBe('tv');
    });

    it('should return an empty string if fullPath is not provided', () => {
      const episode = {
        episodeFile: {
          path: '',
        },
      };
      const result = embyMediaServer.libraryDir(episode as any);
      expect(result).toBe('');
    });
  });

  describe('seriesFolderName', () => {
    it('should return the correct series folder name', () => {
      const series = {
        title: 'Friends',
        year: 1994,
        tvdbId: 1234,
      };
      const result = embyMediaServer.seriesFolderName(series as any);
      expect(result).toBe('Friends (1994) [tvdbId-1234]');
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
        absoluteEpisodeNumber: 111,
        episodeNumber: 1,
        episodeFile: {
          CustomFormatFormats: [{ name: 'CustomFormat' }],
          quality: {
            quality: {
              name: 'HDTV-720p',
            },
            revision: {
              version: 1
            },
          },
          releaseGroup: 'RlsGrp',
        },
        mediaInfo: {
          videoDynamicRangeType: 'SDR',
          videoBitDepth: 8,
          videoCodec: 'H.264',
          audioCodec: 'AAC 2.0',
          audioLanguages: 'EN',
          audioChannels: 5.1,
        },
        title: 'The One Where Monica Gets a Roommate',
      };
      const result = embyMediaServer.episodeFileName({ title: seriesTitle, year: 1994 } as any, [episode] as any);
      expect(result).toBe('Friends (1994) - S01E01 - The One Where Monica Gets a Roommate [HDTV-720p v1][SDR][AAC 2.0 5.1][H.264]-RlsGrp');
    });

    it('should return the correct episode file name for an anime series', () => {
      const seriesTitle = 'Friends';
      const episode = {
        seasonNumber: 1,
        absoluteEpisodeNumber: 111,
        episodeNumber: 1,
        episodeFile: {
          CustomFormatFormats: [{ name: 'CustomFormat' }],
          quality: {
            quality: {
              name: 'HDTV-720p',
            },
            revision: {
              version: 1
            },
          },
          releaseGroup: 'RlsGrp',
        },
        mediaInfo: {
          videoDynamicRangeType: 'SDR',
          videoBitDepth: 8,
          videoCodec: 'H.264',
          audioCodec: 'AAC 2.0',
          audioLanguages: 'EN',
          audioChannels: 5.1,
        },
        title: 'The One Where Monica Gets a Roommate',
      };
      const result = embyMediaServer.episodeFileName({ title: seriesTitle, year: 1994, seriesType: 'anime' } as any, [episode] as any);
      expect(result).toBe('Friends (1994) - S01E111 - The One Where Monica Gets a Roommate [HDTV-720p v1][SDR][8bit][H.264][AAC 2.0 5.1][EN]-RlsGrp');
    });

  });

  describe('mediaServerPathForEpisode', () => {
    it('should return the correct media server path for an episode', () => {
      const series = {
        title: 'Friends',
        tvdbId: 1234,
        year: 1994,
      };
      const episode = {
        seasonNumber: 1,
        absoluteEpisodeNumber: 111,
        episodeNumber: 1,
        episodeFile: {
          path: MOCKED_REAL_FILE_PATH,
          CustomFormatFormats: [{ name: 'CustomFormat' }],
          quality: {
            quality: {
              name: 'HDTV-720p',
            },
            revision: {
              version: 1
            },
          },
          releaseGroup: 'RlsGrp',
        },
        mediaInfo: {
          videoDynamicRangeType: 'SDR',
          videoBitDepth: 8,
          videoCodec: 'H.264',
          audioCodec: 'AAC 2.0',
          audioLanguages: 'EN',
          audioChannels: 5.1,
        },
        title: 'The One Where Monica Gets a Roommate',
      };
      const result = embyMediaServer.mediaServerPathForEpisode(series as any, [episode] as any);
      expect(result).toBe('/media/emby2/tv/Friends (1994) [tvdbId-1234]/Season 1/Friends (1994) - S01E01 - The One Where Monica Gets a Roommate [HDTV-720p v1][SDR][AAC 2.0 5.1][H.264]-RlsGrp.mp4');
    });
  });

  describe('linkEpisodeToLibrary', () => {
    it('should create a symlink for a new episode', async () => {
      const episode = {
        id: 1,
        series: {
          title: 'Friends',
          tvdbId: 1234,
          year: 1994,
        },
        seasonNumber: 1,
        absoluteEpisodeNumber: 1,
        episodeNumber: 1,
        title: 'The One Where Monica Gets a Roommate',
        episodeFile: {
          path: MOCKED_REAL_FILE_PATH,
          CustomFormatFormats: [{ name: 'CustomFormat' }],
          quality: {
            quality: {
              name: 'HDTV-720p',
            },
            revision: {
              version: 1
            },
          },
          releaseGroup: 'RlsGrp',
        },
        mediaInfo: {
          videoDynamicRangeType: 'SDR',
          videoBitDepth: 8,
          videoCodec: 'H.264',
          audioCodec: 'AAC 2.0',
          audioLanguages: 'EN',
          audioChannels: 5.1,
        },
        hasFile: true,
      };
      await embyMediaServer.linkEpisodeToLibrary([episode] as any);
      expect(mockPouchDBGet).toHaveBeenCalledWith('1');
      expect(mockPouchDBPut).toHaveBeenCalledWith({
        _id: '1',
        realPath: MOCKED_REAL_FILE_PATH,
        mediaServers: {
          emby2: '/media/emby2/tv/Friends (1994) [tvdbId-1234]/Season 1/Friends (1994) - S01E01 - The One Where Monica Gets a Roommate [HDTV-720p v1][SDR][AAC 2.0 5.1][H.264]-RlsGrp.mp4',
        },
      });
      expect(mockCreateSymLink).toHaveBeenCalledWith(MOCKED_REAL_FILE_PATH, '/media/emby2/tv/Friends (1994) [tvdbId-1234]/Season 1/Friends (1994) - S01E01 - The One Where Monica Gets a Roommate [HDTV-720p v1][SDR][AAC 2.0 5.1][H.264]-RlsGrp.mp4');
    });

    it('should update the symlink for an existing episode if the real path has changed', async () => {
      const episode = {
        id: 1,
        series: {
          title: 'Friends',
          tvdbId: 1234,
          year: 1994,
        },
        seasonNumber: 1,
        absoluteEpisodeNumber: 1,
        episodeNumber: 1,
        title: 'The One Where Monica Gets a Roommate',
        episodeFile: {
          path: MOCKED_REAL_FILE_PATH,
          CustomFormatFormats: [{ name: 'CustomFormat' }],
          quality: {
            quality: {
              name: 'HDTV-720p',
            },
            revision: {
              version: 1
            },
          },
          releaseGroup: 'RlsGrp',
        },
        mediaInfo: {
          videoDynamicRangeType: 'SDR',
          videoBitDepth: 8,
          videoCodec: 'H.264',
          audioCodec: 'AAC 2.0',
          audioLanguages: 'EN',
          audioChannels: 5.1,
        },
        hasFile: true,
      };
      await embyMediaServer.linkEpisodeToLibrary([episode] as any);
      expect(mockPouchDBGet).toHaveBeenCalledWith('1');
      expect(mockCreateSymLink).toHaveBeenCalledWith(MOCKED_REAL_FILE_PATH, '/media/emby2/tv/Friends (1994) [tvdbId-1234]/Season 1/Friends (1994) - S01E01 - The One Where Monica Gets a Roommate [HDTV-720p v1][SDR][AAC 2.0 5.1][H.264]-RlsGrp.mp4');
    });

    it('should remove the symlink for an existing episode if the real path has been removed', async () => {
      mockPouchDBGet.mockResolvedValue({
        _id: '1',
        realPath: MOCKED_REAL_FILE_PATH,
        mediaServers: {
          emby2: '/media/emby2/tv/Friends (1994) [tvdbId-1234]/Season 1/Friends (1994) - S01E01 - The One Where Monica Gets a Roommate [HDTV-720p v1][SDR][AAC 2.0 5.1][H.264]-RlsGrp.mp4',
        },
      });
      const episode = {
        id: 1,
        series: {
          title: 'Friends',
          tvdbId: 1234,
          year: 1994,
        },
        seasonNumber: 1,
        absoluteEpisodeNumber: 1,
        episodeNumber: 1,
        title: 'The One Where Monica Gets a Roommate',
        episodeFile: {
          path: '',
        },
        hasFile: false,
      };
      await embyMediaServer.linkEpisodeToLibrary([episode] as any);
      expect(mockPouchDBGet).toHaveBeenCalledWith('1');
      expect(mockPouchDBPut).toHaveBeenCalledWith({
        _id: '1',
        _rev: undefined,
        realPath: '',
        mediaServers: {},
      });
    });

    it('should not create a symlink for an episode without a file', async () => {
      const episode = {
        id: 1,
        series: {
          title: 'Friends',
          tvdbId: 1234,
          year: 1994,
        },
        seasonNumber: 1,
        absoluteEpisodeNumber: 1,
        episodeNumber: 1,
        title: 'The One Where Monica Gets a Roommate',
        episodeFile: {
          path: '',
        },
        hasFile: false,
      };

      await embyMediaServer.linkEpisodeToLibrary([episode] as any);
      expect(mockPouchDBGet).toHaveBeenCalledWith('1');
      expect(mockPouchDBPut).toHaveBeenCalledTimes(0);
      console.log(mockCreateSymLink.mock.calls);
      expect(mockCreateSymLink).toHaveBeenCalledTimes(0);
    });

    it('should not do anything if the real path and saved link path both match the db entry', async () => {
      mockPouchDBGet.mockResolvedValue({
        _id: '1',
        realPath: MOCKED_REAL_FILE_PATH,
        mediaServers: {
          emby2: '/media/emby2/tv/Friends (1994) [tvdbId-1234]/Season 1/Friends (1994) - S01E01 - The One Where Monica Gets a Roommate [HDTV-720p v1][SDR][AAC 2.0 5.1][H.264]-RlsGrp.mp4',
        },
      });
      mockDoesFileExist.mockResolvedValue(true);
      const episode = {
        id: 1,
        series: {
          title: 'Friends',
          tvdbId: 1234,
          year: 1994,
        },
        seasonNumber: 1,
        absoluteEpisodeNumber: 1,
        episodeNumber: 1,
        title: 'The One Where Monica Gets a Roommate',
        episodeFile: {
          path: MOCKED_REAL_FILE_PATH,
          CustomFormatFormats: [{ name: 'CustomFormat' }],
          quality: {
            quality: {
              name: 'HDTV-720p',
            },
            revision: {
              version: 1
            },
          },
          releaseGroup: 'RlsGrp',
        },
        mediaInfo: {
          videoDynamicRangeType: 'SDR',
          videoBitDepth: 8,
          videoCodec: 'H.264',
          audioCodec: 'AAC 2.0',
          audioLanguages: 'EN',
          audioChannels: 5.1,
        },
        hasFile: true,
      };
      await embyMediaServer.linkEpisodeToLibrary([episode] as any);
      expect(mockPouchDBGet).toHaveBeenCalledWith('1');
      expect(mockPouchDBPut).toHaveBeenCalledTimes(0);
      expect(mockCreateSymLink).toHaveBeenCalledTimes(0);
    });
  });
});