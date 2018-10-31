#!/bin/bash

# change directory
cd scrape

# Empty output directory
rm -rf output
mkdir output

# activate python virtual env
if [ ! -d env ]; then
  echo "Virtual Env does not exists: Creating..."
  virtualenv env
  . env/bin/activate
  
  echo "Installing Dependencies..."
  pip install -r requirements.txt
else
  . env/bin/activate
fi

# Run scrape script
echo "Scraping..."
python get_data.py
deactivate

# Hash and move outputs
echo "Hashing..."
node hash.js
mv output/client-hashed-data.js ../data/client-map.js
mv output/server-hashed-data.json ../data/server-map.json

# cleanup
echo "Clean up..."
rm -rf output



