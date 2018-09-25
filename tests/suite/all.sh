#!/usr/bin/env bash
EXIT_CODE=0
i=0
for f in tests/suite/config/*; do
    if [[ -d $f ]]; then
      FULLNAME=$(basename "$f")
      ./tests/suite/suite.sh "$FULLNAME" "$1"
      CODE=$?
      if [[ "${CODE}" != "0" ]]; then
        EXIT_CODE=$CODE
      fi
    fi
done

exit "$EXIT_CODE"
