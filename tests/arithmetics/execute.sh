#!/usr/bin/env bash

# Run Test
ts-node ./tests/arithmetics/server.ts &
server_pid=$!
ts-node ./tests/arithmetics/arithmetics.ts &
test_pid=$!
npx jest ./tests/arithmetics/arithmetics.test.ts &
jest_pid=$!

# Wait for 1.5 minutes (90 seconds)
sleep 30

# Kill the processes if they are still running
kill $server_pid $test_pid $jest_pid 2>/dev/null

# Using wait to clean up the terminated processes
wait $server_pid $test_pid $jest_pid
