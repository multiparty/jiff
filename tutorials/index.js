const Neptune = require('neptune-notebook');

const neptune = new Neptune();
neptune.addDocument('intro', '1-intro.md', true);
neptune.addDocument('inner-product', '2-innerprod.md', true);
neptune.addDocument('standard-deviation', '3-standarddev.md', true);
neptune.addDocument('preprocessing', '4-preprocessing.md', true);
neptune.addDocument('binary-search', '5-binarysearch.md', true);
neptune.addDocument('voting', '6-voting.md', true);
neptune.addDocument('ifelse', '7-ifelse.md', true);

neptune.start(9111);
