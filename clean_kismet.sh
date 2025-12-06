#!/bin/bash

# Stop Kismet service to release the lock on DB files
echo "Stopping Kismet..."
sudo systemctl stop kismet

# Wait a moment for shutdown
sleep 2

# Remove Kismet Logs/DBs
# Kismet usually logs to the directory it was started in, or /var/log/kismet
# We will target the common pattern "Kismet-*.kismet"
echo "Removing Kismet Database files..."
rm -f Kismet-*.kismet
rm -f Kismet-*.kismet-journal
rm -f Kismet-*.pcapng

# Restart Kismet
echo "Restarting Kismet..."
sudo systemctl start kismet

echo "Purge Complete."
