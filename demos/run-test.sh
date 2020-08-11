#!/usr/bin/env bash

mkdir -p logs

if [ "$1" == "*" ]; then
    EXIT_CODE=0
    for i in demos/*; do
        if [ -f "$i/test.js" ] || [ -f "$i/test.sh" ]; then
            if ! [[ "$i" =~ ^demos/(pca|template)$ ]]; then
                npm run-script test-demo -- "$i"
                CODE=$?
                if [[ "${CODE}" != "0" ]]; then
                  EXIT_CODE=$CODE
                fi
            fi
        fi
    done
    exit "$EXIT_CODE"
else
    OLD_PWD=$(pwd)
    TESTDIR=${1%/}
    NAME=$(basename $TESTDIR)
    logs="logs/${NAME}.log"
    echo "Server logs at ${logs}"

    if [ -f "$TESTDIR/test.sh" ]; then
      # demo has custom test bash script, run it
      (cd "$TESTDIR" && ./test.sh)
      exit $?
    else
      # generic demo, run generic tests

      # Run server
      if [[ $NAME != "web-mpc" ]]; then
        echo "====================" >> "${logs}"
        echo "====================" >> "${logs}"
        echo "NEW TEST $(date)" >> "${logs}"
        echo "====================" >> "${logs}"
        node ${TESTDIR}/server.js >> "${logs}" &
        sleep 1
      fi

      # Run test
      ./node_modules/.bin/mocha --full-trace --reporter spec ${TESTDIR}/test.js  # add --inspect--brk to debug
      EXIT_CODE=$?

      kill $(ps aux | grep " ${TESTDIR}/server\.js" | awk '{ print $2}')
      exit "$EXIT_CODE"
    fi
fi
