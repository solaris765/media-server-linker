import curlString, { type Options } from "curl-string";
import fs from "fs";
import path from "path";

export function makeCurl(url: string, init: Options) {
  let [curl, data] = curlString(url, {
    ...init,
    headers: {
      ...init.headers,
      'is-copy': 'true'
    },
  } as Options, { colorJson: false, jsonIndentWidth: 0 }).split('--data', 2);
  if (!data) {
    return curl;
  }
  data = data.replaceAll('\n', '')
  return curl + '--data' + data
}

interface curler {
  url: string,
  init: Options
}
export function saveCurlToFile(curl: string | curler, filename: string) {
  let str;
  if (typeof curl === 'string') {
    str = curl;
  } else {
    str = makeCurl(curl.url, curl.init);
  }

  const p = path.resolve(import.meta.dir, '../../', filename)
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, '');
  }
  fs.appendFile(p,
    str + '\n\n',
    {
      encoding: 'utf8'
    }, (err) => {
      if (err) {
        console.error('Error writing to log file');
      }
    });
}