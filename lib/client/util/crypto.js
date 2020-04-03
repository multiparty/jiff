/**
 * Encrypts and signs the given message.
 * @ignore
 * @memberof jiff.utils
 * @param {number|string} message - the message to encrypt.
 * @param {Uint8Array} encryption_public_key - ascii-armored public key to encrypt with.
 * @param {Uint8Array} signing_private_key - the private key of the encrypting party to sign with.
 * @returns {object} the signed cipher, includes two properties: 'cipher' and 'nonce'.
 */
exports.encrypt_and_sign = function (jiff, message, encryption_public_key, signing_private_key) {
  var nonce = jiff.sodium_.randombytes_buf(jiff.sodium_.crypto_box_NONCEBYTES);
  var cipher = jiff.sodium_.crypto_box_easy(message, nonce, encryption_public_key, signing_private_key);

  var result = { nonce: '[' + nonce.toString() + ']', cipher: '[' + cipher.toString() + ']' };
  return result;
};

/**
 * Decrypts and checks the signature of the given cipher text.
 * @ignore
 * @memberof jiff.utils
 * @param {object} cipher_text - the cipher text to decrypt, includes two properties: 'cipher' and 'nonce'.
 * @param {Uint8Array} decryption_secret_key - the secret key to decrypt with.
 * @param {Uint8Array} signing_public_key - ascii-armored public key to verify against signature.
 * @returns {number|string} the decrypted message if the signature was correct, the decrypted message type should
 *                          the type of operation, such that the returned value has the appropriate type and does
 *                          not need any type modifications.
 * @throws error if signature or nonce was forged/incorrect.
 */
exports.decrypt_and_sign = function (jiff, cipher_text, decryption_secret_key, signing_public_key) {
  var nonce = new Uint8Array(JSON.parse(cipher_text.nonce));
  cipher_text = new Uint8Array(JSON.parse(cipher_text.cipher));

  try {
    return jiff.sodium_.crypto_box_open_easy(cipher_text, nonce, signing_public_key, decryption_secret_key, 'text');
  } catch (_) {
    throw new Error('Bad signature or Bad nonce: Cipher: ' + cipher_text + '.  DecSKey: ' + decryption_secret_key + '.  SignPKey: ' + signing_public_key);
  }
};