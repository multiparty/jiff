#!/bin/sh

# node party.js [number of inputs] [protocol to run] [computationID] >> [path to logfile]
node.exe party.js 10 stdev stdevtest10 >> logtimes/stdev.log
node.exe party.js 100 stdev stdevtest100 >> logtimes/stdev.log
node.exe party.js 500 stdev stdevtest500 >> logtimes/stdev.log

node.exe party.js 10 sum sumtest10 >> logtimes/sum.log
node.exe party.js 100 sum sumtest100 >> logtimes/sum.log
node.exe party.js 500 sum sumtest500 >> logtimes/sum.log

node.exe party.js 10 avg avgtest10 >> logtimes/avg.log
node.exe party.js 100 avg avgtest100 >> logtimes/avg.log
node.exe party.js 500 avg avgtest500 >> logtimes/avg.log

# node party.js 10 min mintest10 >> logtimes/min.log
# node party.js 50 min mintest50 >> logtimes/min.log
#node party.js 500 min mintest500 >> logtimes/min.log

# node party.js 10 max maxtest10 >> logtimes/max.log
# node party.js 50 max maxtest50 >> logtimes/max.log
#node party.js 500 min maxtest500 >> logtimes/max.log
