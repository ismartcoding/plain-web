#!/bin/bash

yarn build
setopt localoptions rmstarsilent
rm -rf ../plain-app/app/src/main/resources/web/*
cp -r dist/* ../plain-app/app/src/main/resources/web/

