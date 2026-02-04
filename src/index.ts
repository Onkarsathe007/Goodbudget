import "dotenv/config";
import app from "./app.js";
import logger from "./config/logs.config.js";

app.listen(process.env.PORT, () => {
  logger.info(`Server listening on port ${process.env.PORT}`);
});
