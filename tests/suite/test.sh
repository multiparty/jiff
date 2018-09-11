#!/usr/bin/env bash
export JIFF_TEST_EXT=$1
export JIFF_TEST_SUITE=$2

logs="tests/suite/logs/${JIFF_TEST_EXT}/${JIFF_TEST_SUITE}.log"

mkdir -p "tests/suite/logs/${JIFF_TEST_EXT}"
echo "====================" >> "${logs}"
echo "====================" >> "${logs}"
echo "NEW TEST $(date)" >> "${logs}"
echo "====================" >> "${logs}"

node tests/suite/server.js >> "${logs}" &

./node_modules/.bin/mocha --reporter spec tests/suite/index.js
kill $(ps aux | grep "node tests/suite/server\.js" | awk '{ print $2}')