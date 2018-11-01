.PHONY: clean

bench.o: bench.c
	gcc bench.c -o bench.o -lsodium

bench: bench.o
	bash -c "time ./bench.o"
	bash -c "time node bench.js"

clean:
	rm -rf *.o


