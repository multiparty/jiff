#!/bin/bash

if [ "$1" == "+" ]; then
  firefox test-positive-add.html test-positive-add.html test-positive-add.html &
elif [ "$1" == "c+" ]; then
  firefox test-positive-cadd.html test-positive-cadd.html test-positive-cadd.html &
elif [ "$1" == "-" ]; then
  firefox test-positive-sub.html test-positive-sub.html test-positive-sub.html &
elif [ "$1" == "c-" ]; then
  firefox test-positive-csub.html test-positive-csub.html test-positive-csub.html &
elif [ "$1" == "*" ]; then
  firefox test-positive-mult.html test-positive-mult.html test-positive-mult.html & 
elif [ "$1" == "c*" ]; then
  firefox test-positive-cmult.html test-positive-cmult.html test-positive-cmult.html &
elif [ "$1" == ">=" ]; then
  firefox test-positive-gteq.html test-positive-gteq.html test-positive-gteq.html &
elif [ "$1" == "<" ]; then
  firefox test-positive-lessthan.html test-positive-lessthan.html test-positive-lessthan.html &
else
  echo "$1 Not recognizable"
fi
