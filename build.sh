#!/bin/bash

yarn build
rm -rf ../plain-app/app/src/main/resources/web/*
cp -r dist/* ../plain-app/app/src/main/resources/web/

