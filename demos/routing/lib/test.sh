#!/usr/bin/env bash
cd lib/libsodium-port

echo "Running Scalar Multiplication tests using native build"
echo "------------------------------------------------------"
cd test
make test

echo ""
echo ""

echo "Running benchmarks"
echo "------------------"
cd ../bench
make bench

echo ""
echo ""

echo "Running Browser Compatibility Checks..."
echo "...."
echo "Verify the output in the browser is equal to the output below:"
echo "------------------------------------------------------------------"
cd ../browser-test
node test.js

echo ""
echo ""

firefox test.html &