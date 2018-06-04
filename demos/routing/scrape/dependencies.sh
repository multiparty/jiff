wget http://download.osgeo.org/libspatialindex/spatialindex-src-1.8.5.tar.gz
tar -xzf spatialindex-src-1.8.5.tar.gz

cd spatialindex-src-1.8.5/

./configure
make
sudo make install

rm spatialindex-src-1.8.5.tar.gz
rm -r spatialindex-src-1.8.5
