#!/usr/bin/env fish

# gen for CONTRIBUTING.md
./node_modules/.bin/jsdoc -R CONTRIBUTING.md -r -c docs/jsdoc.conf.json
mv docs/jsdoc/index.html docs/jsdoc/contributing.html

# gen for tests docs
./node_modules/.bin/jsdoc -R tests/suite/README.md -r -c docs/jsdoc.conf.json
mv docs/jsdoc/index.html docs/jsdoc/tests.html

# gen for extenstion.md
./node_modules/.bin/jsdoc -R lib/ext/README.md -r -c docs/jsdoc.conf.json
mv docs/jsdoc/index.html docs/jsdoc/extensions.html

# gen for hooks.md
./node_modules/.bin/jsdoc -R lib/ext/Hooks.md -r -c docs/jsdoc.conf.json
mv docs/jsdoc/index.html docs/jsdoc/hooks-overview.html

# final gen for README.md
./node_modules/.bin/jsdoc -R README.md -r -c docs/jsdoc.conf.json

#correct links
sed -i -e 's/lib\\/ext\\/README.md/extensions.html/g' docs/jsdoc/*.html
sed -i -e 's/tests\\/suite\\/README.md/tests.html/g' docs/jsdoc/*.html
sed -i -e 's/lib\\/ext\\/Hooks.md/hooks-overview.html/g' docs/jsdoc/*.html
sed -i -e 's/Hooks.md/hooks.html/g' docs/jsdoc/*.html
sed -i -e 's/CONTRIBUTING.md/contributing.html/g' docs/jsdoc/*.html
sed -i -e 's|https://github.com/multiparty/jiff/tree/master/tests.html|tests.html|g' docs/jsdoc/contributing.html
