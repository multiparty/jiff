echo "====================" >> tests/mocha/test.log
echo "====================" >> tests/mocha/test.log
echo "NEW TEST $(date)" >> tests/mocha/test.log
echo "====================" >> tests/mocha/test.log

node tests/mocha/server.js >> tests/mocha/test.log &
sleep 2

node_modules/.bin/mocha --reporter spec tests/mocha/index.js
kill $(ps aux | grep "node tests/mocha/server\.js" | awk '{ print $2}')
