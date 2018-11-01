cd scrape

wget http://download.osgeo.org/libspatialindex/spatialindex-src-1.8.5.tar.gz
tar -xzf spatialindex-src-1.8.5.tar.gz

cd spatialindex-src-1.8.5/

./configure
make
sudo make install
sudo ldconfig

cd ..

rm -rf spatialindex-src-1.8.5.tar.gz*

