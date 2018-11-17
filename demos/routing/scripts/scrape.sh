#!/bin/bash

# change directory
cd scrape

# Empty output directory
rm -rf output
mkdir output

# activate python virtual env
if [ -d env ]; then
  . env/bin/activate

  # Run scrape script
  echo "Scraping..."
  python get_data.py
  deactivate

  # Hash and move outputs
  echo "Hashing..."
  node hash.js
  
  mkdir -p ../data
  mv output/client-hashed-data.js ../data/client-map.js
  mv output/server-hashed-data.json ../data/server-map.json

  # cleanup
  echo "Clean up..."
  rm -rf output
else
  echo "Please run npm install for dependencies"
fi



