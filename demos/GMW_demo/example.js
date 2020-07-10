const ascii = require('./ascii.js');

/*
 *  This is the setup for a secure 1-out-of-3 oblivious transfer using
 *  the methods in IO to send public messages between the two parties.
 */
var IO = require('./io-example.js');
//const OT = require('../index.js')(IO);
const OT = require('1-out-of-n')(IO);
const N = 11;

OT.then(function (OT) {

  /*
   *  The sender calls:
   */
  const secrets = [
    'A zeroth secret!',
    'A first secret!!',
    'A second secret!',
    'A third secret!!',
    'A fourth secret!',
    'A fifth secret!!',
    'A sixth secret!!',
    'A seventh secret',
    'A eighth secret!',
    'A nineth secret!',
    'A tenth secret!!'
  ].map(ascii.to_array);
  

  OT.send(secrets, N);


  /*
   *  The receiver calls:
   */
  OT.receive(6, N).then(function (array) {
    console.log('The chosen secret is:', ascii.to_ascii(array));
  });

});
