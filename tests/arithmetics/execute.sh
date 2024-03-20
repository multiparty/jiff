#!/usr/bin/env bash
target='arithmetics.test.js'

node ./tests/arithmetics/server.js &
npx jest ./tests/arithmetics/$target 1 &
npx jest ./tests/arithmetics/$target 2 &
wait