import { mock } from "bun:test";

export const mockFsUnlink = mock();
export const mockFsAccess = mock(()=>Promise.resolve());
const mockFs: any = {
  unlink: mockFsUnlink,
  access: mockFsAccess,
};
mockFs.default = mockFs;
mock.module('fs/promises', ()=>{
  return mockFs;
});



export const mockPouchDBGet = mock();
export const mockPouchDBPut = mock();
class MockPouchDB {
  get = mockPouchDBGet;
  put = mockPouchDBPut;
}
const mockPouchDB: any = {
  default: MockPouchDB,
};
mock.module('pouchdb', ()=>(mockPouchDB));