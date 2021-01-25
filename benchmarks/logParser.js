var fs = require('fs');

try {
    var data = fs.readFileSync('./logtimes/avg.log', 'utf8');

    var lines = data.split("\n");

    lines.forEach(line => {
        if(line.startsWith("TIME")) {
            console.log(line);
        }
    })
} catch(e) {
    console.log("Error:", e.stack);
}