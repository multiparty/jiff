import json
import geojson
# if this does not work [specifically on Linux]: 
# 1. Open the geoql __init__.py file inside the installed package with an editor
# 2. replace all "from geoql.geoql import <whatever>" with "from geoql import <whatever>"
from geoql import geoql
import requests

url = 'https://raw.githubusercontent.com/Data-Mechanics/geoql/master/examples/'

# Boston ZIP Codes regions.
z = geoql.loads(requests.get(url + 'example_zips.geojson').text, encoding="latin-1")

# Extract of street data.
g = geoql.loads(requests.get(url + 'example_extract.geojson').text, encoding="latin-1")

g = g.properties_null_remove()\
     .tags_parse_str_to_dict()\
     .keep_by_property({"highway": {"$in": ["residential", "secondary", "tertiary"]}})
g = g.keep_within_radius((42.344936, -71.086976), 0.4, 'miles') # 0.6 miles from Boston Common.


g = g.keep_that_intersect(z) # Only those entries found in a Boston ZIP Code regions.
g = g.node_edge_graph() # Converted into a graph with nodes and edges.
g.dump(open('boston_0.6.geojson', 'w'))

# format graph for client and server
points = []
edges = []
for k in g["features"]:
  if k.type == 'Point':
    points.append(k)
  else:
    edges.append(k)


# make points in the format of client
for i in range(len(points)):
  points[i].properties = { 'point_id': i+1 }


# Print out JSON object for client  
client = { 'features': points }
clientFile = open('client.js', 'w')
clientFile.write('var obj = ' + json.dumps(client) + ';')
clientFile.close()

# format edges
print len(edges)
