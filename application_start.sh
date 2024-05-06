#!/bin/bash

docker system prune -f
cd /home/public/OrthoApp-Backend
sh build-image.sh
sudo systemctl restart docker-compose-app.service

#
