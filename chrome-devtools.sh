#!/usr/bin/env bash

mkdir -p ".well-known/appspecific"

cat > ".well-known/appspecific/com.chrome.devtools.json" << EOF
{ 
    "workspace": {
           "root": "$PWD",
           "uuid": "5015777c-67bb-11f0-92da-762385b5200b"
       }
}
EOF
