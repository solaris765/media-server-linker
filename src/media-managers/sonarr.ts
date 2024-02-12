

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

async function _callAPI(req: {}) {
  
}

export default function (body: BaseSonarrBody) {
  return body;
}
