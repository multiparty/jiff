#!/usr/bin/env bash

export JIFF_TEST_EXT=$1

mkdir -p "tests/suite/logs/${JIFF_TEST_EXT}"

logs="tests/suite/logs/${JIFF_TEST_EXT}/suite.logs"
echo "====================" >> "${logs}"
echo "====================" >> "${logs}"
echo "NEW TEST $(date)" >> "${logs}"
echo "====================" >> "${logs}"

node tests/suite/server.js >> "${logs}" &

i=0
for f in tests/suite/config/${JIFF_TEST_EXT}/*.json; do
    FULLNAME=$(basename "$f")
    export JIFF_TEST_SUITE="${FULLNAME%.json}"

    if [ "$2" == "parallel" ]
    then
        ./node_modules/.bin/mocha --reporter spec tests/suite/index.js &
        tests_pids[${i}]=$!
        i=$((i+1))
        sleep 1
    else
        ./node_modules/.bin/mocha --reporter spec tests/suite/index.js
    fi
done

if [ "$2" == "parallel" ]
then
    for tpid in ${tests_pids[*]}; do
        wait $tpid
    done
fi

kill $(ps aux | grep "node tests/suite/server\.js" | awk '{ print $2}')