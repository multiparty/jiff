const Neptune = require('neptune-notebook');

const jsDependencies = ['../lib/jiff-client.js', '../lib/ext/jiff-client-bignumber.js', '../lib/ext/jiff-client-fixedpoint.js'];
const plotly = ['static/plotly-latest.min.js'];

const neptune = new Neptune();
neptune.addDocument('MPC', '0-intro-to-mpc.md', true, jsDependencies.concat(plotly));
neptune.addDocument('intro', '1-intro.md', true, jsDependencies);
neptune.addDocument('inner-product', '2-innerprod.md', true, jsDependencies);
neptune.addDocument('standard-deviation', '3-standarddev.md', true, jsDependencies);
neptune.addDocument('preprocessing', '4-preprocessing.md', true, jsDependencies);
neptune.addDocument('binary-search', '5-binarysearch.md', true, jsDependencies);
neptune.addDocument('voting', '6-voting.md', true, jsDependencies);
neptune.addDocument('ifelse', '7-ifelse.md', true, jsDependencies);

neptune.start(9111);
