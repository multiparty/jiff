mkdir -p data

if [ ! -f data/server-map.json ]
then
  ./scripts/scrape.sh
fi

curl "http://localhost:9111/recompute/server-map"
