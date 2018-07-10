echo "====================" >> tests/mocha-bignumber/test.log
echo "====================" >> tests/mocha-bignumber/test.log
echo "NEW TEST $(date)" >> tests/mocha-bignumber/test.log
echo "====================" >> tests/mocha-bignumber/test.log

node tests/mocha-bignumber/server.js >> tests/mocha-bignumber/test.log &
sleep 2

node_modules/.bin/mocha --reporter spec tests/mocha-bignumber/index.js
kill $(ps aux | grep "node tests/mocha-bignumber/server\.js" | awk '{ print $2}')
