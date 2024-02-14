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

const DONT_LOG_HEADERS = [
  'content-length',
  'user-agent',
]
export function saveCurlToFile(curl: curler, filename: string) {
  if ((curl.init.headers as { [key: string]: string })['is-copy'] === 'true') {
    return;
  } else {
    (curl.init.headers as { [key: string]: string })['is-copy'] = 'true';
  }
  for (const key in curl.init.headers) {
    if (DONT_LOG_HEADERS.includes(key.toLowerCase())) {
      delete curl.init.headers[key];
    }
  }
  let str = makeCurl(curl.url, curl.init);

  let p = path.resolve(import.meta.dir, '../../logs/')
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p);
  }
  p = path.resolve(p, filename);
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