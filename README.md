# Logan (log analyzer)

Extract a timeseries of the number of times given log messages occur in a set of log files (with 1 second resolution).

# Usage
`node logan.js <logfiles .. > --  <patterns ..>`

# Examples
Note regular expressions are disabled because they are very slow. Enable them in the code in needed.

`node logan.js jicofo.log prosody.log jicofo2.log -- "client disconnected" "conference request for" "iq rate exceeded" onMemberLeft onMemberJoined 'Received session-terminate.*restartRequested=true'`

# Output
The output is tab-separated, convenient to paste in a sheet where it can be plotted.

