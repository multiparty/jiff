kill $(ps aux | grep "node server\.js" | awk '{ print $2 }') >/dev/null 2>&1
kill $(ps aux | grep "node parties/backend-server\.js" | awk '{ print $2 }') >/dev/null 2>&1
kill $(ps aux | grep "node parties/frontend-server\.js" | awk '{ print $2 }') >/dev/null 2>&1
