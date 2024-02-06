#!/bin/sh


SMB_FOLDER="/home/pi/cncjs_custom/gcode_storage"

inotifywait -m "$SMB_FOLDER" -e create -e moved_to -e modify |
while read -r directory action file; do
    filename="$SMB_FOLDER/$file"
    echo "$filename"
    python /home/pi/cncjs_custom/cncjs-hotwire-tablet/scripts/remove_substring.py "$filename" G64
done

#start this script ons tartup by ediditing 
#sudo nano /etc/rc.local       
#/path/to/script.sh &