import winston from "winston";
import LokiTransport from "winston-loki";
const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = winston.createLogger({
  level: "info",

  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat,
  ),
  defaultMeta: { service: "goodbudget-api-0.0.0" },
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),

    ...(process.env.SKIP_LOKI !== "true" && process.env.PROMETHEUS_LOKI
      ? [
          new LokiTransport({
            host: process.env.PROMETHEUS_LOKI,
            labels: {
              service: "goodbudget-api",
              env: process.env.NODE_ENV || "dev",
            },
            json: true,
          }),
        ]
      : []),

    //   (i.e., error, fatal, but not other levels)

    new winston.transports.File({
      filename: "./logs/error.log",
      level: "error",
    }),

    // - Write all logs with importance level of `info` or higher to `combined.log`
    //   (i.e., fatal, error, warn, and info, but not trace)

    new winston.transports.File({ filename: "./logs/combined.log" }),
  ],
});

export default logger;
