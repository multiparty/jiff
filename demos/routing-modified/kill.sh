kill $(ps aux | grep "node server\.js" | awk '{ print $2 }') >/dev/null 2>&1
kill $(ps aux | grep "node backend-server" | awk '{ print $2 }') >/dev/null 2>&1
kill $(ps aux | grep "node frontend-server" | awk '{ print $2 }') >/dev/null 2>&1
