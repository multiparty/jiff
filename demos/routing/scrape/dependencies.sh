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

# activate python virtual env
if [ ! -d env ]; then
  echo "Virtual Env does not exists: Creating..."
  virtualenv env
fi

# install dependencies
. env/bin/activate
echo "Installing Dependencies..."
pip install -r requirements.txt

cd env/lib/python2.7/site-packages/geoql
sed -i -e 's/geoql\.geoql/geoql/g' __init__.py
rm -rf __init__.pyc

deactivate