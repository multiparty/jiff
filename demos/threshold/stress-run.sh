#!/bin/bash

node server.js "suppress" &
sleep 1

for (( i=1; i<=$1; i++ ))
do
    node party.js $i $(( $1 / 2 )) $1 $2 "stress-test" $i &
    pids[${i}]=$!
done

sleep 1
for (( i=1; i<=$2; i++ ))
do
    node party.js 0 $(( $1 / 2 )) $1 $2 "stress-test" $(( $1 + i )) &
    pids[${i}]=$!
done

# wait for all parties
for pid in ${pids[*]}; do
    wait $pid
done

echo "Result should be $(( ($1 + 1) / 2 ))"
kill $(ps aux | grep "node server\.js" | awk '{ print $2 }') >/dev/null 2>&1
