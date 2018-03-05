import random
p = 15485867

keys = [ 9441934,
  290863,
  10865761,
  8308953,
  1715709,
  5242753,
  11903601,
  3864140,
  4577249,
  9896234 ]

def inverse(x):
  return pow(x, p-2, p)

def Lag(a):
  pw = (p-1)/2
  return pow(a, pw, p)

def nLag(a):
  a = Lag(a)
  a = a + 1
  a = a * inverse(2)
  return a % p

counter = 0
def prf(x, k):
  global counter
  counter += len(k)
  s = [ pow(2, i) * nLag(k[i] + x + k[i]) for i in range(0, len(k)) ]
  return sum(s) % p

""""
def fprf(x, keys, initial=10, interval=5):
  outputs = []
  def tmp(x):
    o = prf(x, keys[:initial])
    t = 0
    while o in outputs:
      o = (o, prf(x, keys[initial + interval*t : initial + interval*(t+1)]))
      t = t+1
      if initial + interval*(t+1) >= len(keys):
        break      
    outputs.append(o)
  for xi in x: tmp(xi)
  return outputs
""""



x = range(1, 50001)
keys = [ random.randint(1, p-1) for i in range(0, 50) ]
outputs = fprf(x, keys, 10, 5)
print len(set(outputs))

pairs = filter(lambda x: type(x) != int, outputs)
print len(pairs)
