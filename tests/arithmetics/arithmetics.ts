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

var entries;
    
// Add JIFF Extensions
const jiff_bignumber = require("../../lib/ext/jiff-client-bignumber.js");
const jiff_fixedpoint = require("../../lib/ext/jiff-client-fixedpoint.js");
const jiff_negativenumber = require("../../lib/ext/jiff-client-negativenumber.js");
jiffClient.apply_extension(jiff_bignumber, options);
jiffClient.apply_extension(jiff_fixedpoint, options);
jiffClient.apply_extension(jiff_negativenumber, options);

entries = { 1: 60, 2: 60 };
jiffClient.wait_for([1, 2], async () => {
    const input = await jiffClient.share(entries[2]);
    const sec_ttl = await input[1].sadd(input[2]);
    const pub_ttl = await sec_ttl.open();
});


jiffClient.wait_for([1, 2], async () => {

    const input = await jiffClient.share(entries[2]);
    const sec_ttl = await input[1].ssub(input[2]);
    const pub_ttl = await sec_ttl.open();
})