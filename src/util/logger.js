const util = require("util");
const path = require('path');
const fs = require('fs')
const { format, createLogger, config, transports } = require("winston");

const { combine, timestamp, label, printf, colorize } = format;
const DailyRotateFile = require('winston-daily-rotate-file');

const formatObjectsAndArrays = (obj) => {
  if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
          return `[${obj.map(formatObjectsAndArrays).join(', ')}]`;
      } else {
          return `{ ${Object.entries(obj).map(([key, value]) => `${key}: ${formatObjectsAndArrays(value)}`).join(', ')} }`;
      }
  } else {
      return util.format('%s', obj);
  }
};

const logFolder = process.env.LOG_FOLDER || "./logs"
const archivedFolder = logFolder+"/archived"
const logFile = "formio-%DATE%.log"

// Modified custom format to include tenant
const customFormat = printf(({ level, label, timestamp, tenantKey, ...meta}) => {
    const args = meta[Symbol.for('splat')];
    if(args) meta.message = util.format(meta.message, ...args);
    meta.message = formatObjectsAndArrays(meta.message);
    return `${timestamp} [${label}] [tenant: ${tenantKey || 'default'}] ${level} : ${meta.message}`;
});

const transport = new DailyRotateFile({
  filename: logFile,
  dirname: logFolder,
  maxFiles: "2",
  zippedArchive: true,
});

transport.on('archive', async function (file) {
  if (!fs.existsSync(archivedFolder)) {
    fs.mkdirSync(archivedFolder, { recursive: true });
  }

  const parsedData = path.parse(file);
  const pathName = parsedData.base;
  fs.promises.rename(path.join(logFolder, pathName), path.join(archivedFolder, pathName))
  .then(async(res) => {
    fs.readdir(archivedFolder, (err, files) => {
      if(files.length > 6){
        fs.unlink(path.join(archivedFolder, files[0]), (err) => {
          if(err) console.log(err)
        })
      }
    });
  })
});

// Modified logger function to accept tenantKey
const logger = (event, tenantKey) => {
  console.log(tenantKey,"tenantKey")
    const log = createLogger({
        levels: config.npm.levels,
        format: combine(
            label({ label: event }),
            timestamp(),
            format((info) => {
                info.tenantKey = tenantKey;
                return info;
            })(),
            customFormat,
            colorize()
        ),
        transports: [
            transport
        ],
    });
    
    // Uncomment for console logging in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      log.add(new transports.Console({
          format: combine(
              label({ label: event }),
              timestamp(),
              format((info) => {
                  info.tenantKey = tenantKey;
                  return info;
              })(),
              customFormat,
              colorize()
          ),
      }));
    }
    
    return log;
}

module.exports = logger;