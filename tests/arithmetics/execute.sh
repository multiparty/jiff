#!/usr/bin/env bash

# Run Test
ts-node ./tests/arithmetics/server.ts &
ts-node ./tests/arithmetics/arithmetics.ts &
npx jest ./tests/arithmetics/arithmetics.test.ts &
wait