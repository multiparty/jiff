#!/usr/bin/env bash
target='arithmetics.test.js'

node ./tests/arithmetics/server.js &
npx jest ./tests/arithmetics/$target&
wait