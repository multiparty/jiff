#!/bin/bash
echo "FAILED"

if [[ $DEMOS == "TRUE" ]]; then
  # dump all logs marked as failed, or in .lastlog (timedout)
  FAILED_LOGS=$(cat '.failedlogs')
  LAST_LOG=$(cat '.lastlog')

  echo "Failed logs: $FAILED_LOGS"
  echo "========================="
  for log in $FAILED_LOGS; do
    if [[ $log != "" ]]; then
      cat "Failed logs: $log"
      head $log
      echo "----------------"
      echo ""
    fi
  done

  echo "Timed out logs: $LAST_LOG"
  echo "========================="
  for log in $LAST_LOG; do
    if [[ $log != "" ]]; then
      echo "Timedout logs:"
      cat $log
      echo "----------------"
      echo ""
    fi
  done
else
  # dump the test suite log
  if [[ TEST_SUITE == '' ]]; then
    TEST_SUITE='suite'
  fi
  cat "tests/suite/logs/${TEST_NAME}/${TEST_SUITE}.log"
fi