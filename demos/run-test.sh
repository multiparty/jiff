#!/usr/bin/env bash

mkdir -p logs

TESTDIR=${1%/}
NAME=$(basename $TESTDIR)
logs="logs/${NAME}.log"
echo "Server logs at ${logs}"

# Run server
echo "====================" >> "${logs}"
echo "====================" >> "${logs}"
echo "NEW TEST $(date)" >> "${logs}"
echo "====================" >> "${logs}"
node ${TESTDIR}/server.js >> "${logs}" &


# Run test
./node_modules/.bin/mocha --full-trace --reporter spec ${TESTDIR}/test.js
EXIT_CODE=$?

kill $(ps aux | grep " ${TESTDIR}/server\.js" | awk '{ print $2}')
exit "$EXIT_CODE"
