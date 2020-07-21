module.exports = function (io, sodium) {
  const util = require('./util.js')(sodium);
  const crypto = require('./crypto.js')(sodium, util);

  // 1-out-of-2 OT sending
  const send_from_2 = function (X1, X2, op_id, jiff,session_id) {
    op_id = op_id + ':1in2ot';
    var get = io.get.bind(null, op_id,jiff,session_id);
    var give = io.give.bind(null, op_id, jiff,session_id);

    const a = sodium.crypto_core_ristretto255_scalar_random();
    const A = sodium.crypto_scalarmult_ristretto255_base(a);

    give('A', util.to_str(A));
    get('B').then(function (B_str) {
      const B = util.from_str(B_str);

      var k0 = sodium.crypto_scalarmult_ristretto255(a, B);
      var k1 = sodium.crypto_scalarmult_ristretto255(a, sodium.crypto_core_ristretto255_sub(B, A));

      k0 = sodium.crypto_generichash(32, k0);
      k1 = sodium.crypto_generichash(32, k1);

      const e0 = crypto.encrypt_generic(X1, k0);
      const e1 = crypto.encrypt_generic(X2, k1);
      give('e', util.to_str([e0, e1]));
    });
  };

  // 1-out-of-2 OT receiving
  const receive_from_2 = function (c, op_id, jiff,session_id) {
    op_id = op_id + ':1in2ot';
    var get = io.get.bind(null, op_id, jiff,session_id);
    var give = io.give.bind(null, op_id,jiff, session_id);

    const b = sodium.crypto_core_ristretto255_scalar_random();
    var B = sodium.crypto_scalarmult_ristretto255_base(b);

    return new Promise(function (resolve) {
      get('A').then(function (A_str) {
        const A = util.from_str(A_str);

        if (c === 1) {
          B = sodium.crypto_core_ristretto255_add(A, B);
        }
        give('B', util.to_str(B));
        get('e').then(function (both_e_str) {
          const e12 = util.from_str(both_e_str);
          const e = e12[c];  // e_c from [e_1, e_2]

          var k = sodium.crypto_scalarmult_ristretto255(b, A);
          k = sodium.crypto_generichash(32, k);

          var Xc = crypto.decrypt_generic(e, k);
          resolve(Xc);
        });
      });
    });
  };

  // 1-out-of-2 OT sending
  const send_from_N = function (X, N, op_id,jiff, session_id) {
    var I, j;
    op_id = op_id + ':1inNot';
    var give = io.give.bind(null, op_id, jiff,session_id);
    X = util.sanitize(X);  // Check padding and fix if not the right type

    if (N == null) {
      N = X.length;
    }

    const l = Math.ceil(Math.log2(N));  // N = 2^l

    var K = Array(l);
    for (j = 0; j < l; j++) {
      K[j] = Array(2);
      for (var b = 0; b <= 1; b++) {
        K[j][b] = crypto.KDF();  // {K_{j}}^{b}
      }
    }

    var Y = Array(N);
    for (I = 0; I < N; I++) {
      var i = util.to_bits(I, l);  // l bits of I

      Y[I] = X[I];  // new Uint8Array(m);
      for (j = 0; j < l; j++) {
        const i_j = i[j];
        const K_j = K[j];
        const Kj_ij = K_j[i_j];  // {K_{j}}^{i_j}
        Y[I] = util.xor(Y[I], crypto.PRF(Kj_ij, I));
      }
    }

    for (j = 0; j < l; j++) {
      const K_j = K[j];

      send_from_2(K_j[0], K_j[1], op_id+j,jiff, session_id);
    }

    for (I = 0; I < N; I++) {
      give('I' + String(I), util.to_str(Y[I]));  // reveal Y_I
    }
  };

  // 1-out-of-2 OT receiving
  const receive_from_N = function (I, N, op_id, jiff,session_id) {
    var j;
    op_id = op_id + ':1inNot';
    var get = io.get.bind(null, op_id, jiff,session_id);

    return new Promise(function (resolve) {
      const l = Math.ceil(Math.log2(N));  // N = 2^l
      const i = util.to_bits(I, l);  // l bits of I

      var K = Array(l);
      for (j = 0; j < l; j++) {
        const i_j = i[j];  // bit j=i_j of I
        K[j] = receive_from_2(i_j, op_id+j, jiff,session_id);  // pick {K_{j}}^{b} which is also {K_{j}}^{i_j}
      }

      Promise.all(K).then(function (K) {
        var Y_I = new Uint8Array(32);
        for (var pI = 0; pI < N; pI++) {
          const pY_pI = get('I' + String(pI));
          if (pI === I) {
            Y_I = pY_pI;
          }
        }

        Y_I.then(function (Y_I_str) {
          const Y_I = util.from_str(Y_I_str);

          var X_I = Y_I;  // new Uint8Array(m);
          for (j = 0; j < l; j++) {
            const Kj_ij = K[j];  // {K_{j}}^{i_j}
            X_I = util.xor(X_I, crypto.PRF(Kj_ij, I));
          }

          // Done
          resolve(X_I);
        });
      });
    });
  };

  return {
    send: send_from_N,
    receive: receive_from_N,
    single_send: send_from_2,
    single_receive: receive_from_2
  };
};
