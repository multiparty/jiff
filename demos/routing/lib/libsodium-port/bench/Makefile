.PHONY: clean

%.o: %.c
	gcc $< -o $@ -lsodium

bench: benchAdd.o benchSub.o benchMult.o
	bash -c "time ./benchAdd.o"
	bash -c "time node benchAdd.js"
	@echo ""
	@echo ""
	@echo ""
	bash -c "time ./benchSub.o"
	bash -c "time node benchSub.js"
	@echo ""
	@echo ""
	@echo ""
	bash -c "time ./benchMult.o"
	bash -c "time node benchMult.js"

clean:
	rm -rf *.o


