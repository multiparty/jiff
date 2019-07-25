#!/usr/bin/env bash

export JIFF_TEST_NAME=$1

mkdir -p "tests/suite/logs/${JIFF_TEST_NAME}"

logs="tests/suite/logs/${JIFF_TEST_NAME}/suite.logs"
echo "====================" >> "${logs}"
echo "====================" >> "${logs}"
echo "NEW TEST $(date)" >> "${logs}"
echo "====================" >> "${logs}"

EXIT_CODE=0
i=0
for f in tests/suite/config/${JIFF_TEST_NAME}/*.json; do
    FULLNAME=$(basename "$f")
    export JIFF_TEST_SUITE="${FULLNAME%.json}"

    echo "test name ${JIFF_TEST_NAME}"
    echo "test suite ${JIFF_TEST_SUITE}"

    node tests/suite/server.js >> "${logs}" &

    if [ "$2" == "parallel" ]
    then
        ./node_modules/.bin/mocha --reporter spec tests/suite/index.js &
        tests_pids[${i}]=$!
        i=$((i+1))
        sleep 1
    else
        ./node_modules/.bin/mocha --reporter spec tests/suite/index.js
        CODE=$?
        if [[ "${CODE}" != "0" ]]; then
          EXIT_CODE=$CODE
        fi
    fi

    kill $(ps aux | grep "node tests/suite/server\.js" | awk '{ print $2}')
done

if [ "$2" == "parallel" ]
then
    for tpid in ${tests_pids[*]}; do
        CODE=0
        wait $tpid || CODE=$?
        if [[ "${CODE}" != "0" ]]; then
          EXIT_CODE=$CODE
        fi
    done
fi

kill $(ps aux | grep "node tests/suite/server\.js" | awk '{ print $2}')
exit "$EXIT_CODE"
