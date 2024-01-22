const path = require('path');
const fs = require('fs');
const readline = require('readline');

const SEP = "\t"

// TODO: command line param
const USE_REGEXP = false; // this is very slow. maybe set dynamically based on the presence of something in the pattern?
const IGNORE_CASE = true;
const START = false; // epoch ts in ms, e.g. 1705256400000
const END = false; // START + 1800 * 1000
const RESOLUTION = 1; // seconds

// format the timestamp in the output
const FORMATTER = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });

function err(line) {
    process.stderr.write(`${line}\n`);
}

function usage() {
    err('Usage: node logan.js <logfiles .. > --  <patterns ..>');
    process.exit(1);
}

if (process.argv.length < 3) {
  usage();
}

let logfiles = []
let patterns = []
let data = {}
let filesEnded = false
for (let i = 2; i < process.argv.length; i++) {
  let a = process.argv[i];
  if (a == "--") {
    filesEnded = true;
  } else if (filesEnded) {
    patterns.push({ name: IGNORE_CASE ? a.toLowerCase() : a, pattern: new RegExp(`.*${a}.*`, IGNORE_CASE ? "i" : "") });
  } else {
    logfiles.push(a);
  }
}

if (!logfiles.length) {
  err('No files specified');
  usage();
}
if (!patterns.length) {
  err('No patterns specified');
  usage();
}

const NGINX_PATTERN = /\d+\.\d+\.X\.X /;
function extractTime(line) {
    // Ignore subsequent lines from multi-line logs (which may otherwise contain a timestamp)
    if (/^\s/.test(line)) return;
    const s = line.split(/[ ,]+/)
    if (s.length < 3) return;

    let d;
    if (line.startsWith("Jicofo")) {
      d = new Date(`${s[1]} ${s[2]}Z`);
    } else if (NGINX_PATTERN.test(line)) {
      if (s.length < 4) return;
      // 10.123.X.X - - [22/Jan/2024:21:12:49 +0000] GET /
      d = new Date(s[3].replaceAll('[', '').replace(':', ' ') + 'Z');
    } else {
      // prosody log format, year is missing
      d = new Date(`${s[0]} ${s[1]} ${new Date().getFullYear()} ${s[2]}Z`);
    }

    // 1 second resolution
    return d.getTime() - d.getTime() % (1000 * RESOLUTION);
}

function processLine(line) {
  const ts = extractTime(line);
  if (!ts) return;

  if (IGNORE_CASE && !USE_REGEXP) {
    line = line.toLowerCase();
  }
  
  if (START && ts < START) return;
  if (END && ts > END) return;
  
  let d = data[ts];
  if (!d) {
    d = { ts: ts };
    data[ts] = d;
  }
  
  for (let i = 0; i < patterns.length; i++) {
    let p = patterns[i];
    let match = false;
    if (USE_REGEXP) {
      // This is very slow
      match = p.pattern.test(line);
    } else {
      match = line.indexOf(p.name) >= 0;
    }

    if (match) {
      let value = d[p.name] || 0
      d[p.name] = value + 1;
    }
  }
}


let latch = logfiles.length;
function onClose() {
  latch--;
  if (latch) return;
  
  let sorted = []
  for (let d in data) {
    sorted.push(data[d]);
  }
  sorted.sort(function(a, b) { return a.ts - b.ts });
  
  process.stdout.write("time");
  for (let i = 0; i < patterns.length; i++) {
    process.stdout.write(`${SEP}${patterns[i].name}`);
  }
  process.stdout.write("\n");

  for (let i = 0; i < sorted.length; i++) {
    let d = sorted[i];
    process.stdout.write(FORMATTER.format(d.ts));
    for (let j = 0; j < patterns.length; j++) {
      let name = patterns[j].name
      process.stdout.write(`${SEP}${d[name] || 0}`);
    }
    process.stdout.write("\n");
  }
  err(`Used ${process.memoryUsage().heapUsed / 1024 / 1024} MB`);
}

for (let i = 0; i < logfiles.length; i++) {
  err("Reading logfile " + logfiles[i]);
  const rl = readline.createInterface({
    input: fs.createReadStream(logfiles[i]),
    crlfDelay: Infinity,
  });

  rl.on('line', processLine);
  rl.once('close', onClose);
}

