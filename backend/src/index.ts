import "dotenv/config";
import cors from "cors";
import express from "express";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = process.env.PORT ?? 4000;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
