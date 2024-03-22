#!/usr/bin/env bash
target='arithmetics.test.ts'

node ./tests/arithmetics/server.ts &
node ./tests/arithmetics/arithmetics.ts&
npx jest ./tests/arithmetics/$target&
wait