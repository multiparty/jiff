#!/usr/bin/env bash
export JIFF_TEST_NAME=$1
export JIFF_TEST_SUITE=$2

if [ "$1" == "" ] || [[ "$1" == "-"* ]]
then
  ./tests/suite/all.sh "${1:1}"
elif [[ "$2" == "" ]] || [[ "$2" == "-"* ]]
then
  ./tests/suite/suite.sh "$1" "${2:1}"
else
  logs="tests/suite/logs/${JIFF_TEST_NAME}/${JIFF_TEST_SUITE}.log"

  mkdir -p "tests/suite/logs/${JIFF_TEST_NAME}"
  echo "====================" >> "${logs}"
  echo "====================" >> "${logs}"
  echo "NEW TEST $(date)" >> "${logs}"
  echo "====================" >> "${logs}"

  node tests/suite/server.js >> "${logs}" &

  ./node_modules/.bin/mocha --max-old-space-size=8192 --reporter spec tests/suite/index.js
  CODE=$?
  kill $(ps aux | grep "node tests/suite/server\.js" | awk '{ print $2}')
  exit "$CODE"
fi
