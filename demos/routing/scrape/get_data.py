import geojson
from geoql import geoql
import geoleaflet
import requests

url = 'https://raw.githubusercontent.com/Data-Mechanics/geoql/master/examples/'

# Boston ZIP Codes regions.
z = geoql.loads(requests.get(url + 'example_zips.geojson').text, encoding="latin-1")

# Extract of street data.
g = geoql.loads(requests.get(url + 'example_extract.geojson').text, encoding="latin-1")

g = g.properties_null_remove()\
     .tags_parse_str_to_dict()\
     .keep_by_property({"highway": {"$in": ["residential", "secondary", "tertiary"]}})
g = g.keep_within_radius((42.344936, -71.086976), 0.6, 'miles') # 0.75 miles from Boston Common.


g = g.keep_that_intersect(z) # Only those entries found in a Boston ZIP Code regions.
g = g.node_edge_graph() # Converted into a graph with nodes and edges.
open('../leaflet.html', 'w').write(geoleaflet.html(g)) # Create visualization.
