#!/bin/sh

node party.js 10 stdev stdevtest10 >> logtimes/stdev.log
node party.js 100 stdev stdevtest100 >> logtimes/stdev.log
node party.js 500 stdev stdevtest500 >> logtimes/stdev.log

node party.js 10 sum sumtest10 >> logtimes/sum.log
node party.js 100 sum sumtest100 >> logtimes/sum.log
node party.js 500 sum sumtest500 >> logtimes/sum.log
