from sys import argv
from random import randint

parties = int(argv[1])
tests_count = int(argv[2])

min = 0
max = 1030


def gen(parties):
    return [str(randint(min, max)) for i in range(parties)]


result = "[\n  "
for i in range(tests_count):
    if i % 3 == 0 and i > 0:
        result = result + "\n  "

    tmp = '[' + (', '.join(gen(parties))) + "]"
    result = result + tmp
    if i < tests_count - 1:
        result = result + ", "

result = result + "\n]"
print result
