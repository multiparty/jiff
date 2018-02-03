echo "====================" >> test.log
echo "====================" >> test.log
echo "NEW TEST $(date)" >> test.log
echo "====================" >> test.log

node server.js >> test.log &
sleep 2

../../node_modules/mocha/bin/mocha --reporter spec index.js
kill $(ps aux | grep "node server\.js" | awk '{ print $2}')
