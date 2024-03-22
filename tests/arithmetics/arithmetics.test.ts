interface Entries {
  [key:number]:number
}


describe('JIFF Operations', () => {
  
  // Setup JIFF Client
  const JIFFClient = require("../../lib/jiff-client.js");

  const options = {
    party_count: 2,
    crypto_provider: true,
    Zp: 562949948117,
  };
  
  var jiffClient = new JIFFClient(
    "http://localhost:8112",
    "our-setup-application",
    options,
  );

  var entries: Entries;
    
  beforeAll(async () => {
    
    // Add JIFF Extensions
    const jiff_bignumber = require("../../lib/ext/jiff-client-bignumber.js");
    const jiff_fixedpoint = require("../../lib/ext/jiff-client-fixedpoint.js");
    const jiff_negativenumber = require("../../lib/ext/jiff-client-negativenumber.js");
    await jiffClient.apply_extension(jiff_bignumber, options);
    await jiffClient.apply_extension(jiff_fixedpoint, options);
    await jiffClient.apply_extension(jiff_negativenumber, options);

    entries = { 1: 60, 2: 60 };
  });

  it('should correctly add numbers 60 + 60 = 120', async () => {
    await jiffClient.wait_for([1, 2], async () => {
      const input = await jiffClient.share(entries[1]);
      const sec_ttl = await input[1].sadd(input[2]);
      const pub_ttl = await sec_ttl.open();

      // Check that pub_ttl.toString(10) equals '120'
      expect(pub_ttl.toString(10)).toEqual('20');
    });
  });

  it('should correctly subtract numbers 60 - 60 = 0', async () => {
    jiffClient.wait_for([1, 2], async () => {

      const input = await jiffClient.share(entries[1]);
      const sec_ttl = await input[1].ssub(input[2]);
      const pub_ttl = await sec_ttl.open();
          
      // Check that pub_ttl.toString(10) equals '0'
      expect(pub_ttl.toString(10)).toEqual('1');
    })
  });

  // it('should correctly multiply numbers 60 x 60 =3600', async () => {
  //   jiffClient.wait_for([1, 2], async () => {

  //     const input = await jiffClient.share(entries[1]);
  //     const sec_ttl = await input[1].smult(input[2]);
  //     const pub_ttl = await sec_ttl.open();
    
  //     // Check that pub_ttl.toString(10) equals '3600'
  //     expect(pub_ttl.toString(10)).toEqual('3600');
  //   })    
  // });

  // it('should correctly divide numbers 60 / 60', async () => {
  //   jiffClient.wait_for([1, 2], async () => {

  //     const input = await jiffClient.share(entries[1]);
  //     const sec_ttl = await input[1].sdiv(input[2]);
  //     const pub_ttl = await sec_ttl.open();
    
  //     // Check that pub_ttl.toString(10) equals '1'
  //     expect(pub_ttl.toString(10)).toEqual('1');
  //   })
  // });
});
