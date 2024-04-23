#!/usr/bin/env bash

mkdir -p ../../logs
logs="../../logs/array-mpc-as-a-service.log"
logss="../../logs/array-mpc-as-a-service-client.log"
# Check if the file exists
if [ -f "$logss" ]; then
    # If the file exists, delete it
    rm "$logss"
fi

for config in tests/*.json; do
  # run server
  node server.js $config > $logs &
  serverID=$!
  sleep 1

  # run a bunch of compute parties
  count=$(sed '3q;d' $config | (read line; wc -c <<< "${line//[^,]}"))  # -OR-  tr "," "\n" | wc -l
  count=$((count-1))
  allIDs=$serverID
  for ((j=1;j<=$count;j++)); do
    node compute-party.js $config 'test' $j >> $logss &
    allIDs="$allIDs $!"
  done

  # run a bunch of input parties via test.js
  export TEST_CONFIG="$config"
  ../../node_modules/.bin/mocha --full-trace --reporter spec tests/test.js $config  # DEBUG add  --inspect--brk
  EXIT_CODE=$?

  kill $allIDs 2> /dev/null
  wait $allIDs 2> /dev/null
  if [[ "${EXIT_CODE}" != "0" ]]; then
    exit "$EXIT_CODE"
  fi
done

exit 0
