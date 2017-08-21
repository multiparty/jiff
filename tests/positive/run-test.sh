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
  firefox test-positive-greater-equal.html test-positive-greater-equal.html test-positive-greater-equal.html &
elif [ "$1" == ">" ]; then
  firefox test-positive-greater.html test-positive-greater.html test-positive-greater.html &
elif [ "$1" == "<=" ]; then
  firefox test-positive-less-equal.html test-positive-less-equal.html test-positive-less-equal.html &
elif [ "$1" == "<" ]; then
  firefox test-positive-less.html test-positive-less.html test-positive-less.html &
else
  echo "$1 Not recognizable"
fi
