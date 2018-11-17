#include <sodium.h>
#include <napi.h>
//#include <stdlib.h>
//#include <stdio.h>

// allocate static memory for result
static unsigned char resultPoint[crypto_scalarmult_ed25519_BYTES];
static unsigned char resultScalar[crypto_scalarmult_ed25519_SCALARBYTES];
static unsigned char error = 0;

Napi::ArrayBuffer ApplyPRF(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  unsigned char* scalar = (unsigned char*) info[0].As<Napi::ArrayBuffer>().Data();
  unsigned char* point = (unsigned char*) info[1].As<Napi::ArrayBuffer>().Data();

  // Scalar Multpoint
  if(crypto_scalarmult_ed25519_noclamp(resultPoint, scalar, point) != 0) {
    return Napi::ArrayBuffer::New(env, &error, 1);
  }

  return Napi::ArrayBuffer::New(env, resultPoint, crypto_scalarmult_ed25519_BYTES);
}

Napi::ArrayBuffer HashToPoint(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Read
  unsigned char* label = (unsigned char*) info[0].As<Napi::ArrayBuffer>().Data();

  // Perform Elligator to map label to a point on the EC
  crypto_core_ed25519_from_uniform(resultPoint, label);
  return Napi::ArrayBuffer::New(env, resultPoint, crypto_scalarmult_ed25519_BYTES);
}

Napi::ArrayBuffer RandomScalar(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  randombytes_buf(resultScalar, crypto_scalarmult_ed25519_SCALARBYTES);
  return Napi::ArrayBuffer::New(env, resultScalar, crypto_scalarmult_ed25519_SCALARBYTES);
}

Napi::Boolean InitSodium(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (sodium_init() == -1) {
    return Napi::Boolean::New(env, false);
  }
  return Napi::Boolean::New(env, true);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "initSodium"), Napi::Function::New(env, InitSodium));
  exports.Set("hashToPoint", Napi::Function::New(env, HashToPoint));
  exports.Set("applyPRF", Napi::Function::New(env, ApplyPRF));
  exports.Set("randomScalar", Napi::Function::New(env, RandomScalar));
  return exports;
}

NODE_API_MODULE(hello, Init)
