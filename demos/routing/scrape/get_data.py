import json
import geojson
# if this does not work [specifically on Linux]: 
# 1. Open the geoql __init__.py file inside the installed package with an editor
# 2. replace all "from geoql.geoql import <whatever>" with "from geoql import <whatever>"
from geoql import geoql
import requests
from Queue import Queue

############################ SCRAPE MAP

url = 'https://raw.githubusercontent.com/Data-Mechanics/geoql/master/examples/'

# Boston ZIP Codes regions.
z = geoql.loads(requests.get(url + 'example_zips.geojson').text, encoding="latin-1")

# Extract of street data.
g = geoql.loads(requests.get(url + 'example_extract.geojson').text, encoding="latin-1")


############################ FILTER MAP

g = g.properties_null_remove()\
     .tags_parse_str_to_dict()\
     .keep_by_property({"highway": {"$in": ["residential", "secondary", "tertiary"]}})
g = g.keep_within_radius((42.344936, -71.086976), 0.4, 'miles') # 0.6 miles from Boston Common.


g = g.keep_that_intersect(z) # Only those entries found in a Boston ZIP Code regions.
g = g.node_edge_graph() # Converted into a graph with nodes and edges.
g.dump(open('boston_0.6.geojson', 'w'))

########################### FORMAT MAP AS A GRAPH

points = []
shapes = []
for k in g["features"]:
  if k.type == 'Point':
    points.append(k)
  else:
    shapes.append(k)


# make points in the format of client
nodes = []
coordinates2ID = {}
for i in range(len(points)):
  points[i].properties = { 'point_id': i+1 }
  coords = points[i]['coordinates']
  coordinates2ID[(coords[0], coords[1])] = i+1
  nodes.append(i+1)


# Print out JSON object for client  
client = { 'features': points }
clientFile = open('client.js', 'w')
clientFile.write('exports.obj = ' + json.dumps(client) + ';')
clientFile.close()

# format edges
edges = { src: [] for src in nodes }
for shape in shapes:
  coords = [ tuple(p) for p in shape['geometry']['coordinates'] ]
  if coords[0] in coordinates2ID and coords[1] in coordinates2ID:
    src = coordinates2ID[coords[0]]
    dst = coordinates2ID[coords[1]]
    edges[src].append(dst)
    edges[dst].append(src) # bi-directional graph


############################ ALL PAIRS SHORTEST PATHS USING BFS
table = []
for src in nodes:
  jumps = { src: src }
  BFS = Queue()
  visited = { src }

  # direct neighbors of src
  for n in edges[src]:
    jumps[n] = n
    BFS.put((n, n))
    visited.add(n)

  # BFS
  while not BFS.empty():
    dst, jump = BFS.get()
    for n in edges[dst]:
      if n not in visited:
        jumps[n] = jump
        visited.add(n)
        BFS.put((n, jump))

  # Format as table
  for dst in nodes:
    table.append([src, dst, jumps.get(dst, 0)])

# Check unreachables""
for t in table:
  if t[2] == 0:
    print "unreachable: ", (t[0], t[1])

# write out JSON object for server
clientFile = open('server.json', 'w')
clientFile.write(json.dumps(table))
clientFile.close()



