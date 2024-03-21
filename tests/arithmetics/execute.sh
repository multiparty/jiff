#!/usr/bin/env bash
target='arithmetics.test.ts'

node ./tests/arithmetics/server.ts &
npx jest ./tests/arithmetics/$target&
wait