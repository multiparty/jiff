if [ "$(basename $(pwd))" == "scripts" ]
then
  cd ..
fi

node server.js &
node parties/backend-server.js &

read -p $'Press enter party connects\n\n'

node parties/frontend-server.js 2 &
node parties/frontend-server.js 3 &


