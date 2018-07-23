echo "====================" >> tests/mocha-fixed-negative/test.log
echo "====================" >> tests/mocha-fixed-negative/test.log
echo "NEW TEST $(date)" >> tests/mocha-fixed-negative/test.log
echo "====================" >> tests/mocha-fixed-negative/test.log

node tests/mocha-fixed-negative/server.js >> tests/mocha-fixed-negative/test.log &
sleep 2

node_modules/mocha/bin/mocha --reporter spec tests/mocha-fixed-negative/index.js
kill $(ps aux | grep "node tests/mocha-fixed-negative/server\.js" | awk '{ print $2}')
