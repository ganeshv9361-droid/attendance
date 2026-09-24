#!/bin/bash
echo "========================================================"
echo "           EduTrack Campus - Wi-Fi IP Finder            "
echo "========================================================"
echo ""
IP=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7}')
if [ -z "$IP" ]; then
  IP=$(hostname -I | awk '{print $1}')
fi

echo "Your Computer's Current Wi-Fi IP Address:"
echo "-----------------------------------------"
echo "  >>  $IP  <<"
echo ""
echo "Mobile APK Backend Server URL:"
echo "-----------------------------------------"
echo "  http://$IP:5000"
echo ""
echo "Enter this URL in the mobile app under 'Server Config'."
echo "Make sure your mobile phone is connected to the same Wi-Fi"
echo "or your phone's mobile hotspot!"
echo "========================================================"
