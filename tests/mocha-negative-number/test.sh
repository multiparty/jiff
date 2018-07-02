echo "====================" >> tests/mocha-negative-number/test.log
echo "====================" >> tests/mocha-negative-number/test.log
echo "NEW TEST $(date)" >> tests/mocha-negative-number/test.log
echo "====================" >> tests/mocha-negative-number/test.log

node tests/mocha-negative-number/server.js >> tests/mocha-negative-number/test.log &
sleep 2

node_modules/mocha/bin/mocha --reporter spec tests/mocha-negative-number/index.js
kill $(ps aux | grep "node tests/mocha-negative-number/server\.js" | awk '{ print $2}')
