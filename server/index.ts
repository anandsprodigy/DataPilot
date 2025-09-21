import express, { type Request, Response, NextFunction, response } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cors from "cors";
import { initDb } from "./db.js";
import crypto from "crypto";
import { any } from "zod";
import { request } from "http";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

let db: any;


// Hash function (SHA256)
function hashPassword(password: crypto.BinaryLike) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Register API
app.post("/api/register", async (req, res) => {
  try {
    const { firstName, lastName, emailAddress, password } = req.body;

    if (!firstName || !lastName || !emailAddress || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const hashed = hashPassword(password);

    await db.run(
      "INSERT INTO users (firstName, lastName, emailAddress, password) VALUES (?, ?, ?, ?)",
      [firstName , lastName, emailAddress, hashed]
    );

    res.json({ message: "User registered successfully" });
  } catch (err: any) {
    if (err.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "emailAddress already registered" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error"+err.message });
  }
});

app.get("/api/health", async(request, response)=>{
  response.send("abhi jinda hu").status(200);
})


// Login API
app.post("/api/login", async (req, res) => {
  try {
    const { emailAddress, password } = req.body;

    if (!emailAddress || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    console.log(emailAddress+" "+password)

    const hashed = hashPassword(password);

    const user = await db.get(
      "SELECT id, firstName, lastName, emailAddress FROM users WHERE emailAddress = ? AND password = ?",
      [emailAddress, hashed]
    );


    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json({ message: "Login successful", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


(async () => {
  db = await initDb();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "127.0.0.1"
  }, () => {
    log(`serving on port ${port}`);
  });
})();
