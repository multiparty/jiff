###############################################################################
## 
## geoleaflet.py
##
##   Python library to quickly build a standalone HTML file with a Leaflet
##   visualization (see leafletjs.com) of a GeoJSON object.
##
##   Web:     github.com/data-mechanics/geoleaflet
##   Version: 0.0.1.0
##
##

import geojson

###############################################################################
##

"""
Function for computing the average coordinate for a GeoJSON object.
"""
def coordinates_center(obj):
    (lon, lat, count) = (0.0, 0.0, 0)
    for feature in obj['features']:
        for (lo, la) in geojson.utils.coords(feature):
            lon += lo
            lat += la
            count += 1
    return [lat/count, lon/count]

"""
Function that nests a GeoJSON object within an HTML document that renders it
as a Leaflet visualization.
"""
def html(obj,\
         src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.3',\
         service = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'\
        ):
    meta = '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    link = '<link rel="stylesheet" href="' + src + '/leaflet.css" />'
    body = '''
	<div id="leaflet" style="width:100vw; height:100vh;"></div>
	<script>\nvar obj = ''' + geojson.dumps(obj, sort_keys=True, indent=2) + ";\n" + '''    </script>
	<script src="''' + src + '''/leaflet.js"></script>
	<script>
      function randomColor() {
        var color = '', letters = '0123456'; //789ABCDEF
        for (var i=0; i<6; i++) {color += letters[Math.floor(Math.random() * letters.length)];}
        return '#' + color;
      }
      var leaflet = L.map('leaflet').setView(''' + str(coordinates_center(obj)) + ''', 13);
      L.tileLayer("''' + service + '''", {
        maxZoom:18, attribution:'', id:'mapbox.light'
      }).addTo(leaflet);
      function onEachFeature(feature, layer) {
        if (feature.properties) {
          var popupContent = "<p>" + feature.properties.name + '-' + feature.properties.osm_id + ".</p>";
          if (feature.properties.popupContent)
              popupContent += feature.properties.popupContent;
          layer.bindPopup(popupContent);
        }
      }
      L.geoJson(obj, {
        filter: function (feature, layer) { return true; },
        onEachFeature: onEachFeature,
        style: function (feature) { return {"color": randomColor()}; },
        pointToLayer:
          function (feature, latlng) {
            return L.circleMarker(latlng, {radius:4, weight:0.1, fillColor:"#6666AA", color:"#6666AA", opacity:1, fillOpacity:1});
          }
      }).addTo(leaflet);
	</script>'''
    return "<!DOCTYPE html>\n<html>\n  <head>\n    " + meta + "\n    " + link +\
           '\n  </head>\n  <body style="width:100%; height:100%; margin:0; padding:0;">' + body + "\n  </body>\n</html>"

## eof