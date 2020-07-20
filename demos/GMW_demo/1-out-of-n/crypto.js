module.exports = function (sodium, util) {

  // PRF of length m
  const PRF = function (k, I) {
    var x = Uint8Array.from(util.to_bits(I, 32));
    return sodium.crypto_aead_chacha20poly1305_encrypt(x, null, null, new Uint8Array(8), k);
  };

  // KDF of length t
  const KDF = function () {
    return sodium.randombytes_buf(32);
  };

  const encrypt_generic = function (plaintext, key) {
    return sodium.crypto_aead_chacha20poly1305_encrypt(plaintext, null, null, new Uint8Array(8), key);
  };

  const decrypt_generic = function (ciphertext, key) {
    return sodium.crypto_aead_chacha20poly1305_decrypt(null, ciphertext, null, new Uint8Array(8), key);
  };

  return {
    PRF: PRF,
    KDF: KDF,
    encrypt_generic: encrypt_generic,
    decrypt_generic: decrypt_generic
  };
};
