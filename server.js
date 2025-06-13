import express from "express";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;

// Configure Vite middleware for React client
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});
app.use(vite.middlewares);

// API route for token generation
app.get("/token", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "verse",
        }),
      },
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// API route for Logotel employees
let logotelEmployeesCache = null;
app.get('/logotel-employees', async (req, res) => {
  console.log("Fetching Logotel employees");
  let response = null;
  try {
    if (logotelEmployeesCache) {
      console.log('Returning cached data');
      response = logotelEmployeesCache;
    } else {
      console.log('Fetching new data');
      response = await axios.get('https://www.logotel.it/chi-siamo/logotel-people/');
    }
    logotelEmployeesCache = response;
    const html = response.data;
    const $ = cheerio.load(html);
    
    const employees = [];
    
    $('li.lglt-team--person').each((i, elem) => {
      const name = $(elem).find('h3').text().trim();
      const role = $(elem).find('h4').text().trim();
      if (name && role) {
        employees.push({ name, role });
      }
    });

    console.log(employees);
    
    res.json(employees);
  } catch (error) {
    console.error('Error fetching Logotel employees:', error);
    res.status(500).json({ error: 'Unable to fetch employees' });
  }
});

// Render the React client
app.use("*", async (req, res, next) => {
  const url = req.originalUrl;

  try {
    const template = await vite.transformIndexHtml(
      url,
      fs.readFileSync("./client/index.html", "utf-8"),
    );
    const { render } = await vite.ssrLoadModule("./client/entry-server.jsx");
    const appHtml = await render(url);
    const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  } catch (e) {
    vite.ssrFixStacktrace(e);
    next(e);
  }
});

app.listen(port, () => {
  console.log(`Express server running on *:${port}`);
});
