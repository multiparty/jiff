echo "====================" >> tests/mocha/test.log
echo "====================" >> tests/mocha/test.log
echo "NEW TEST $(date)" >> tests/mocha/test.log
echo "====================" >> tests/mocha/test.log

node index.js >> tests/mocha/test.log &
sleep 2

node_modules/mocha/bin/mocha --reporter spec tests/mocha/index.js
kill $(ps aux | grep "node index\.js" | awk '{ print $2}')
