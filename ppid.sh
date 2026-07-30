#!/bin/bash
# Find parent process of sekolahku
PPID=$(cat /proc/2839661/status | grep PPid | awk '{print $2}')
echo "PPID: $PPID"
echo "Parent comm:"
cat /proc/$PPID/comm
echo "Parent cmdline:"
cat /proc/$PPID/cmdline | tr '\0' ' '
echo ""
echo "Grandparent:"
GPPID=$(cat /proc/$PPID/status | grep PPid | awk '{print $2}')
echo "GPPID: $GPPID"
echo "Grandparent comm:"
cat /proc/$GPPID/comm
echo "Grandparent cmdline:"
cat /proc/$GPPID/cmdline | tr '\0' ' '
