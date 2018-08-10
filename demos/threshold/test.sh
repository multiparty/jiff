#!/bin/bash

node server.js &

printf 'Press enter when all lower parties have connected.\n'

for (( i=1; i<=$1; i++ ))
do
    node lower-party.js &
    sleep 0.1
done

read -p ''
printf 'Press enter to clean up after computation is done.\n'

for (( i=1; i<=$2; i++ ))
do
    node upper-party.js &
    sleep 0.1
done

read -p ''

kill $(ps aux | grep "node lower-party\.js" | awk '{ print $2 }') >/dev/null 2>&1
kill $(ps aux | grep "node upper-party\.js" | awk '{ print $2 }') >/dev/null 2>&1
kill $(ps aux | grep "node server\.js" | awk '{ print $2 }') >/dev/null 2>&1
