echo "====================" >> tests/mocha-fixedpoint/test.log
echo "====================" >> tests/mocha-fixedpoint/test.log
echo "NEW TEST $(date)" >> tests/mocha-fixedpoint/test.log
echo "====================" >> tests/mocha-fixedpoint/test.log

node tests/mocha-fixedpoint/server.js >> tests/mocha-fixedpoint/test.log &
sleep 2

node_modules/mocha/bin/mocha --reporter spec tests/mocha-fixedpoint/index.js
kill $(ps aux | grep "node tests/mocha-fixedpoint/server\.js" | awk '{ print $2}')
