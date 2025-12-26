import type { Application } from "express";
import express from "express";
import "dotenv/config";
import path from "path";
import setUpMiddleware from "./middlewares/index.middleware.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();

setUpMiddleware(app);

// Test route
// app.get("/test", (req, res) => {
//   const filePath = path.join(process.cwd(), "test-auth.html");
//   res.sendFile(filePath);
// });

app.get("/", (req, res) => {
  res.json({
    message: "Goodbudget API is running.",
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});
