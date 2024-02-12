#! /bin/bash
cd "$(dirname "$0")"

set -eo pipefail

# loop over all dirs in /media/dataALL_

SINGLE_SERIES=""
echo $sonarr_series_id
if [ -z "$sonarr_series_id" ]; then
  echo "Getting all series from Sonarr"

  readarray -t ALL_SERIES < <(curl -X 'GET' \
  "http://192.168.1.7:8989/sonarr/api/v3/series?includeSeasonImages=false" \
  -H 'accept: application/json' \
  -H 'X-Api-Key: ' | jq -c '.[]')
else
  echo "Getting single series from Sonarr"
  SINGLE_SERIES="/$sonarr_series_id"

  readarray -t ALL_SERIES < <(curl -X 'GET' \
  "http://192.168.1.7:8989/sonarr/api/v3/series$SINGLE_SERIES?includeSeasonImages=false" \
  -H 'accept: application/json' \
  -H 'X-Api-Key: ' | jq -c '.')
fi

ROOT_PATH='/media/data'

# {
#   "some_id": {
#     "name": "series title",
#     "path": "/path/to/series",
#     "plex_path": "/path/to/plex/series",
#     "emby_path": "/path/to/emby/series",
#     "jellyfin_path": "/path/to/jellyfin/series"
#   }
# }
STATE=$(cat ./link_missing_records.state.json)

#  Iterate over all series with jq
for series in "${ALL_SERIES[@]}"; do
    echo "Series: $(echo $series | jq -r '.title')"
    export sonarr_series_id=$(echo $series | jq -r '.id')
    echo "Series ID: $sonarr_series_id"
    
    export sonarr_series_path=$(echo "$series" | jq -r '.path')
    echo "Series Path: $sonarr_series_path"
    
    export sonarr_eventtype='Rename'
    
    export sonarr_series_title=$(echo "$series" | jq -r '.title')
    echo "Series Title: $sonarr_series_title"

    export sonarr_series_tvdbid=$(echo "$series" | jq -r '.tvdbId')
    echo "Series TVDB ID: $sonarr_series_tvdbid"

    PATH_PARTS=""
    IFS='/' read -ra PATH_PARTS <<< "$sonarr_series_path"
    SERIES_DIR_NAME="${PATH_PARTS[-1]}"
    LIBRARY_DIR_NAME="${PATH_PARTS[-2]}"
    echo "Series dir name: $SERIES_DIR_NAME"
    echo "Library dir name: $LIBRARY_DIR_NAME"

    echo $STATE | jq -r "."
    SAVED_STATE=$(echo $STATE | jq -r ".\"$sonarr_series_id\"")
    if [ "$SAVED_STATE" == "null" ]; then
        echo "Series not in state. Adding"
        # add id to top level then add name and path
        STATE=$(echo $STATE | jq --arg id "$sonarr_series_id" '. + {($id): { path: "", plex_path: "", emby_path: "", jellyfin_path: "" }}')
    fi

    echo "Updating path saved in state"
    STATE=$(echo $STATE | jq --arg id "$sonarr_series_id" --arg path "$sonarr_series_path" '.[$id].path = $path')

    echo $STATE | jq --arg id "$sonarr_series_id" '.[$id]'


    function create_link {
      local series=$1
      local media_server=$2
      local path_key="$media_server""_path"
      local link_name_pattern=$3

      local series_id=$(echo "$series" | jq -r '.id')
      local series_path=$(echo "$series" | jq -r '.path')
      local series_title=$(echo "$series" | jq -r '.title')
      local series_tvdbid=$(echo "$series" | jq -r '.tvdbId')

      # check if path_key exists in state
      if [ -z "$(echo $STATE | jq -r --arg id "$series_id" ".[\$id].$path_key")" ]; then
        # create path_key as a link to series_path
        echo "Creating $path_key as a link to series path"
        mkdir -p "/media/$media_server/$LIBRARY_DIR_NAME"
        ln -sfn "$series_path" "/media/$media_server/$LIBRARY_DIR_NAME/$(printf "$link_name_pattern" "$series_title" "$series_tvdbid")"

        # add path to link to state
        STATE=$(echo $STATE | jq --arg id "$series_id" --arg path "/media/$media_server/$LIBRARY_DIR_NAME/$(printf "$link_name_pattern" "$series_title" "$series_tvdbid")" ".[\$id].$path_key = \$path")
      else
        if [ "$(readlink "$(echo $STATE | jq -r --arg id "$series_id" ".[\$id].$path_key")")" == "$series_path" ] && [ "$(echo $STATE | jq -r --arg id "$series_id" ".[\$id].$path_key")" == "/media/$media_server/$LIBRARY_DIR_NAME/$(printf "$link_name_pattern" "$series_title" "$series_tvdbid")" ]; then
          echo "$(echo $STATE | jq -r --arg id "$series_id" ".[\$id].$path_key") == $series_path"
          echo "$media_server exists and is a link to series path"
        else
          echo "$media_server exists but is not a link to series path"
          # Delete link
          if [ -L "$(echo $STATE | jq -r --arg id "$series_id" ".[\$id].$path_key")" ]; then
            echo "Removing link"
            rm "$(echo $STATE | jq -r --arg id "$series_id" ".[\$id].$path_key")"
          fi
          # create path_key as a link to series_path
          echo "Creating $path_key as a link to series path"
          mkdir -p "/media/$media_server/$LIBRARY_DIR_NAME"
          ln -sfn "$series_path" "/media/$media_server/$LIBRARY_DIR_NAME/$(printf "$link_name_pattern" "$series_title" "$series_tvdbid")"

          # add path to link to state
          STATE=$(echo $STATE | jq --arg id "$series_id" --arg path "/media/$media_server/$LIBRARY_DIR_NAME/$(printf "$link_name_pattern" "$series_title" "$series_tvdbid")" ".[\$id].$path_key = \$path")
        fi
      fi
    }

    create_link "$series" "plex" "%s (%s)"
    create_link "$series" "emby" "%s [tvdbid=%s]"
    create_link "$series" "jellyfin" "%s [tvdbid-%s]"

    echo "Series: $(echo $series | jq -r '.title')"
done

echo "Saving state"
echo $STATE | jq -r "." > ./link_missing_records.state.json
