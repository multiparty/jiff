###############################################################################
## 
## geoql.py
##
##   Library for performing queries and transformations on GeoJSON data (with
##   emphasis on support for abstract graph representations).
##
##   Web:     github.com/data-mechanics/geoql
##   Version: 0.0.8.0
##
##

import types
import json
import geojson
import geopy.distance
import rtree
import shapely.geometry
from tqdm import tqdm

###############################################################################
##

class GeoQLError(Exception):
    """
    A GeoQL error is a general-purpose catch-all for any usage error.
    """
    def __init__(self, value):
        self.value = value
    def __str__(self):
        return repr(self.value)

def match(value, query):
    """
    Determine whether a value satisfies a query.
    """
    if type(query) in [str, int, float, type(None)]:
        return value == query
    elif type(query) == dict and len(query.keys()) == 1:
        for op in query:
            if op == "$eq": return value == query[op]
            elif op == "$lt": return value < query[op]
            elif op == "$lte": return value <= query[op]
            elif op == "$gt": return value > query[op]
            elif op == "$gte": return value >= query[op]
            elif op == "$ne": return value != query[op]
            elif op == "$in": return value in query[op]
            elif op == "$nin": return value not in query[op]
            else: GeoQLError("Not a valid query operator: " + op)
    else:
        raise GeoQLError("Not a valid query: " + str(query))

def features_properties_null_remove(obj):
    """
    Remove any properties of features in the collection that have 
    entries mapping to a null (i.e., None) value
    """
    features = obj['features']
    for i in tqdm(range(len(features))):
        if 'properties' in features[i]:
            properties = features[i]['properties']
            features[i]['properties'] = {p:properties[p] for p in properties if properties[p] is not None}
    return obj

def features_tags_parse_str_to_dict(obj):
    """
    Parse tag strings of all features in the collection into a Python
    dictionary, if possible.
    """
    features = obj['features']
    for i in tqdm(range(len(features))):
        tags = features[i]['properties'].get('tags')
        if tags is not None:
            try:
                tags = json.loads("{" + tags.replace("=>", ":") + "}")
            except:
                try:
                    tags = eval("{" + tags.replace("=>", ":") + "}")
                except:
                    tags = None
        if type(tags) == dict:
            features[i]['properties']['tags'] = {k:tags[k] for k in tags}
        elif tags is None and 'tags' in features[i]['properties']:
            del features[i]['properties']['tags']
    return obj

def features_keep_by_property(obj, query):
    """
    Filter all features in a collection by retaining only those that
    satisfy the provided query.
    """
    features_keep = []
    for feature in tqdm(obj['features']):
        if all([match(feature['properties'].get(prop), qry) for (prop, qry) in query.items()]):
            features_keep.append(feature)
    obj['features'] = features_keep
    return obj

def features_keep_within_radius(obj, center, radius, units):
    """
    Filter all features in a collection by retaining only those that
    fall within the specified radius.
    """
    features_keep = []
    for feature in tqdm(obj['features']):
        if all([getattr(geopy.distance.vincenty((lat,lon), center), units) < radius for (lon,lat) in geojson.utils.coords(feature)]):
            features_keep.append(feature)
    obj['features'] = features_keep
    return obj

def features_keep_using_features(obj, bounds):
    """
    Filter all features in a collection by retaining only those that
    fall within the features in the second collection.
    """
    # Build an R-tree index of bound features and their shapes.
    bounds_shapes = [
        (feature, shapely.geometry.shape(feature['geometry'])) 
        for feature in tqdm(bounds['features'])
        if feature['geometry'] is not None
      ]
    index = rtree.index.Index()
    for i in tqdm(range(len(bounds_shapes))):
        (feature, shape) = bounds_shapes[i]
        index.insert(i, shape.bounds)

    features_keep = []
    for feature in tqdm(obj['features']):
        if 'geometry' in feature and 'coordinates' in feature['geometry']:
            coordinates = feature['geometry']['coordinates']
            if any([
                shape.contains(shapely.geometry.Point(lon, lat))
                for (lon, lat) in coordinates
                for (feature, shape) in [bounds_shapes[i]
                for i in index.nearest((lon,lat,lon,lat), 1)]
              ]):
                features_keep.append(feature)
                continue
    obj['features'] = features_keep
    return obj

def features_keep_intersecting_features(obj, bounds):
    """
    Filter all features in a collection by retaining only those that
    fall within the features in the second collection.
    """
    return features_keep_using_features(obj, bounds)

def features_node_edge_graph(obj):
    """
    Transform the features into a more graph-like structure by
    appropriately splitting LineString features into two-point
    "edges" that connect Point "nodes".
    """
    points = {}
    features = obj['features']
    for feature in tqdm(obj['features']):
        for (lon, lat) in geojson.utils.coords(feature):
            points.setdefault((lon, lat), 0)
            points[(lon, lat)] += 1
    points = [p for (p, c) in points.items() if c > 1]
    features = [geojson.Point(p) for p in points]

    # For each feature, split it into "edge" features
    # that occur between every point.
    for f in tqdm(obj['features']):
        seqs = []
        seq = []
        for point in geojson.utils.coords(f):
            if len(seq) > 0:
                seq.append(point)
            if point in points:
                seq.append(point)
                if len(seq) > 1 and seq[0] in points:
                    seqs.append(seq)
                    seq = [point]
        for seq in seqs:
            features.append(geojson.Feature(geometry={"coordinates":seq, "type":f['geometry']['type']}, properties=f['properties'], type=f['type']))

    obj['features'] = features
    return obj

class geoql(geojson.feature.FeatureCollection):
    """
    Represents a queryable FeatureCollection, a collection of multiple
    Feature objects that support geoql query methods.
    """

    @staticmethod
    def load(fp,
             cls=json.JSONDecoder,
             parse_constant=geojson.codec._enforce_strict_numbers,
             object_hook=geojson.base.GeoJSON.to_instance,
             **kwargs):
        return geoql(json.load(fp,
                         cls=cls, object_hook=object_hook,
                         parse_constant=parse_constant,
                         **kwargs))

    @staticmethod
    def loads(s,
              cls=json.JSONDecoder,
              parse_constant=geojson.codec._enforce_strict_numbers,
              object_hook=geojson.base.GeoJSON.to_instance,
              **kwargs):
        return geoql(json.loads(s,
                          cls=cls, object_hook=object_hook,
                          parse_constant=parse_constant,
                          **kwargs))

    def __init__(self, feature_collection, **extra):
        """
        Initialises a geoql object given a FeatureCollection.
        :param feature_collection: FeatureCollection object.
        :type feature_collection: FeatureCollection
        :return: geoql object
        :rtype: geoql
        """
        super(geojson.feature.FeatureCollection, self).__init__(**extra)
        self["features"] = feature_collection["features"]

    def properties_null_remove(self):
        return features_properties_null_remove(self)

    def tags_parse_str_to_dict(self):
        return features_tags_parse_str_to_dict(self)

    def keep_by_property(self, query):
        return features_keep_by_property(self, query)

    def keep_within_radius(self, center, radius, units):
        return features_keep_within_radius(self, center, radius, units)

    def keep_using_features(self, bounds):
        return features_keep_using_features(self, bounds)

    def keep_that_intersect(self, bounds):
        return features_keep_intersecting_features(self, bounds)

    def node_edge_graph(self):
        return features_node_edge_graph(self)
        
    def dump(self, fp, cls=geojson.codec.GeoJSONEncoder, allow_nan=False, **kwargs):
        return geojson.dump(self, fp, cls=cls, allow_nan=allow_nan, **kwargs)

    def dumps(self, cls=geojson.codec.GeoJSONEncoder, allow_nan=False, **kwargs):
        return geojson.dumps(self, cls=cls, allow_nan=allow_nan, **kwargs)

## eof