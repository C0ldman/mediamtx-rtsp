#Start stream from file

ffmpeg -re -stream_loop -1 -i ./PICT0083.AVI -c:v libx264 -preset ultrafast -tune zerolatency -c:a libopus -f rtsp -rtsp_transport tcp rtsp://username:userpass@localhost:8554/mystream