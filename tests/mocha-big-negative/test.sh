echo "====================" >> tests/mocha-big-negative/test.log
echo "====================" >> tests/mocha-big-negative/test.log
echo "NEW TEST $(date)" >> tests/mocha-big-negative/test.log
echo "====================" >> tests/mocha-big-negative/test.log

node tests/mocha-big-negative/server.js >> tests/mocha-big-negative/test.log &
sleep 2

node_modules/mocha/bin/mocha --reporter spec tests/mocha-big-negative/index.js
kill $(ps aux | grep "node tests/mocha-big-negative/server\.js" | awk '{ print $2}')
