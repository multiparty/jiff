#!/usr/bin/env bash
i=0
for f in tests/suite/config/*; do
    if [[ -d $f ]]; then
      FULLNAME=$(basename "$f")
      ./tests/suite/suite.sh "$FULLNAME" "$1"
    fi
done
