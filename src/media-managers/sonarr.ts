

interface BaseSonarrBody {
  series: {
    "id": number
    "title": string
    "path": string
    "tvdbId": number
    "tvMazeId": number
    "type": string
    "year": number
  },
  "episodes": {
    "id":number
    "episodeNumber": number
    "seasonNumber": number
    "title": string
    "seriesId": number
    "tvdbId": number
  }[],
  "eventType": string
  "instanceName": string
  "applicationUrl": string
}

const API = process.env.SONARR_API_URL;
const API_KEY = process.env.SONARR_API_KEY;


function _callAPI(route: string, req?: RequestInit) {
  return fetch(API + route, {
    ...req,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': API_KEY,
      ...req?.headers
    },
  });
}

export default function (body: BaseSonarrBody) {
  return body;
}
