exports.jiff = require('../../lib/jiff-client.js');
exports.options = {
  logs: true,
  party_count: 3,
  sodium: false,
  hooks: {
    beforeOperation: [ function (jiff, opName, msg) {
      console.log('Before', opName, msg);
      return msg;
    }],
    afterOperation: [ function (jiff, opName, msg) {
      console.log('After', opName, msg);
      return msg;
    }]
  }
};

