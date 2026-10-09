import "server-only";
import { existsSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";
import { SCREENSHOT } from "@/lib/config";

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const LOCAL_CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function findLocalChrome(): string | null {
  const fromEnv = process.env.CHROME_EXECUTABLE_PATH;
  if (fromEnv) return fromEnv;
  return LOCAL_CHROME_CANDIDATES.find((p) => existsSync(p)) ?? null;
}

async function launch(): Promise<Browser> {
  const viewport = { width: SCREENSHOT.width, height: SCREENSHOT.height, deviceScaleFactor: 1 };

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    chromium.setGraphicsMode = false;
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
      defaultViewport: viewport,
    });
  }

  const executablePath = findLocalChrome();
  if (!executablePath) {
    throw new Error(
      "No local Chrome/Chromium found. Set CHROME_EXECUTABLE_PATH in .env.local to generate previews in development.",
    );
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: viewport,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars"],
  });
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[?::1\]?$|172\.(1[6-9]|2\d|3[01])\.|.*\.internal$|.*\.local$)/i;

/** Only let the page talk to the public internet (CDNs, fonts, public APIs). */
function requestAllowed(url: string): boolean {
  if (url.startsWith("data:") || url.startsWith("blob:") || url === "about:blank") return true;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  return !PRIVATE_HOST.test(u.hostname);
}

/**
 * Render an HTML document in headless Chrome and return a JPEG of the first
 * viewport. Throws on failure; callers decide how to record that.
 */
export async function screenshotHtml(html: string): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (requestAllowed(req.url())) void req.continue();
      else void req.abort("blockedbyclient");
    });
    page.on("dialog", (d) => void d.dismiss());

    try {
      await page.setContent(html, { waitUntil: "load", timeout: SCREENSHOT.loadTimeoutMs });
      await page.waitForNetworkIdle({ idleTime: 500, timeout: SCREENSHOT.loadTimeoutMs });
    } catch {
      // Pages that keep polling never go idle; take the shot anyway.
    }
    await new Promise((r) => setTimeout(r, SCREENSHOT.settleMs));

    const shot = await page.screenshot({
      type: "jpeg",
      quality: SCREENSHOT.jpegQuality,
      clip: { x: 0, y: 0, width: SCREENSHOT.width, height: SCREENSHOT.height },
    });
    return Buffer.from(shot);
  } finally {
    await browser.close().catch(() => {});
  }
}
