class MPC {
  private jiff_instance: any;

  constructor(hostname: string, computation_id: number, thisComputation: Function, this_input: number[], options: Cypress.MPC_Option) {
    let opt = Object.assign({}, options, { crypto_provider: true });

    // eslint-disable-next-line no-undef
    let JIFFClient = require('../../lib/jiff-client');
    
    // eslint-disable-next-line no-undef
    let jiff_websockets = require('../../lib/ext/jiff-client-websockets.js');

    // Prep jiff_instance
    // eslint-disable-next-line no-undef
    this.jiff_instance = new JIFFClient(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    this.jiff_instance.apply_extension(jiff_websockets, opt);
  }

  compute(thisComputation: Function, this_input: number[]) {
    let promise = thisComputation(this_input);
    promise.then(function (v: any) {
      this.jiff_instance.disconnect(false, true);
      return v;
    });
  }
}
module.exports = MPC;
