import { expect, mock, describe, beforeEach, it, beforeAll } from "bun:test";
import { getFilesFromMediaPath } from '../../src/util/filesystem';
import fs from 'fs/promises';
import { resolve } from 'path';


describe('getFilesFromMediaPath', () => {
  beforeAll(async () => {
    await fs.mkdir('./tmp').catch(() => { });
  });
  beforeEach(async () => {
    await fs.writeFile('./tmp/test-file.txt', 'test').catch(() => { });
    await fs.mkdir('./tmp/test-folder').catch(() => { });
    await fs.writeFile('./tmp/test-folder/test-file.txt', 'test').catch(() => { });
    await fs.mkdir('./tmp/test-folder/test-folder').catch(() => { });
  });


  it('should return an array of file paths', async () => {
    const path = resolve('./tmp')
    const result = await getFilesFromMediaPath(path);
    expect(result).toEqual([
      path + '/test-file.txt',
      path + '/test-folder/test-file.txt'
    ]);
  });

  it('should return an empty array if no files are found', async () => {
    const path = './tmp/test-folder/test-folder';
    const result = await getFilesFromMediaPath(path);
    expect(result).toEqual([]);
  });
});