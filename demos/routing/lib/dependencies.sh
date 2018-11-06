#!/bin/bash
LIBSODIUM="lib/libsodium-noclamp"

if [ ! -d $LIBSODIUM/.git ]
then
  rm -rf lib/libsodium-noclamp
  git clone https://github.com/KinanBab/libsodium.git lib/libsodium-noclamp
  cd lib/libsodium-noclamp 
else
  cd lib/libsodium-noclamp
  git pull
fi

./install.sh
