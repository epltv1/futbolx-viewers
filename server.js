const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// eventId -> Set of WebSocket connections
const events = new Map();

// How long a viewer can go without a heartbeat
const VIEWER_TIMEOUT = 45_000;

// --------------------------------------------------
// FutbolX Dashboard
// --------------------------------------------------

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>FutbolX Viewer Counter</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: #07080b;
      color: #fff;
      font-family: "Outfit", sans-serif;
    }

    .container {
      width: min(900px, calc(100% - 30px));
      margin: 0 auto;
      padding: 35px 0 50px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 25px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo {
      width: 45px;
      height: 45px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ff3b30;
      font-size: 23px;
    }

    .title {
      margin: 0;
      font-family: "Kanit", sans-serif;
      font-size: 25px;
      font-weight: 600;
      letter-spacing: .2px;
    }

    .subtitle {
      margin: 2px 0 0;
      color: #777d8a;
      font-size: 13px;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 13px;
      border-radius: 20px;
      background: #10131a;
      border: 1px solid #1d222c;
      color: #aeb5c1;
      font-size: 13px;
      white-space: nowrap;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #35d07f;
      box-shadow: 0 0 10px rgba(53, 208, 127, .7);
    }

    .total-card {
      position: relative;
      overflow: hidden;
      background: linear-gradient(135deg, #11141c, #0c0e13);
      border: 1px solid #1c212b;
      border-radius: 18px;
      padding: 30px;
      text-align: center;
      margin-bottom: 25px;
    }

    .total-card::before {
      content: "";
      position: absolute;
      width: 180px;
      height: 180px;
      background: rgba(255, 59, 48, .08);
      border-radius: 50%;
      top: -90px;
      right: -50px;
      pointer-events: none;
    }

    .total-label {
      color: #858c99;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 5px;
    }

    .total-number {
      font-family: "Kanit", sans-serif;
      font-size: 64px;
      line-height: 1;
      font-weight: 600;
      color: #fff;
    }

    .total-description {
      color: #676e7b;
      font-size: 13px;
      margin-top: 8px;
    }

    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .section-title h2 {
      margin: 0;
      font-family: "Kanit", sans-serif;
      font-size: 18px;
      font-weight: 500;
    }

    .event-count {
      color: #777d8a;
      font-size: 13px;
    }

    .events {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .event {
      background: #0f1117;
      border: 1px solid #1b2029;
      border-radius: 14px;
      padding: 17px 19px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      transition: border-color .2s ease, transform .2s ease;
    }

    .event:hover {
      border-color: #2a303c;
      transform: translateY(-1px);
    }

    .event-info {
      min-width: 0;
    }

    .event-name {
      font-family: "Kanit", sans-serif;
      font-size: 16px;
      font-weight: 500;
      color: #e9ebef;
      overflow-wrap: anywhere;
    }

    .event-label {
      color: #666d7a;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .8px;
      margin-top: 2px;
    }

    .event-viewers {
      display: flex;
      align-items: center;
      gap: 7px;
      color: #ffc107;
      font-family: "Kanit", sans-serif;
      font-size: 20px;
      font-weight: 500;
      flex-shrink: 0;
    }

    .eye {
      font-family: Arial, sans-serif;
      font-size: 16px;
    }

    .empty {
      background: #0f1117;
      border: 1px dashed #242a34;
      border-radius: 14px;
      padding: 35px 20px;
      text-align: center;
      color: #626976;
      font-size: 14px;
    }

    .footer {
      text-align: center;
      color: #4f5560;
      font-size: 12px;
      margin-top: 25px;
    }

    .updated {
      color: #777d88;
    }

    @media (max-width: 600px) {
      .container {
        width: min(100% - 20px, 900px);
        padding-top: 20px;
      }

      .header {
        align-items: flex-start;
      }

      .title {
        font-size: 21px;
      }

      .logo {
        width: 40px;
        height: 40px;
      }

      .status {
        padding: 7px 10px;
        font-size: 12px;
      }

      .total-card {
        padding: 25px 15px;
      }

      .total-number {
        font-size: 55px;
      }

      .event {
        padding: 15px;
      }
    }
  </style>
</head>

<body>

  <div class="container">

    <div class="header">
      <div class="brand">
        <div class="logo">⚽</div>

        <div>
          <h1 class="title">FutbolX Viewer Counter</h1>
          <div class="subtitle">Live event viewer monitoring</div>
        </div>
      </div>

      <div class="status">
        <span class="status-dot"></span>
        ONLINE
      </div>
    </div>

    <div class="total-card">
      <div class="total-label">Total Viewers</div>
      <div class="total-number" id="totalViewers">0</div>
      <div class="total-description">Across all active events</div>
    </div>

    <div class="section-title">
      <h2>Active Events</h2>
      <span class="event-count" id="eventCount">0 events</span>
    </div>

    <div class="events" id="events">
      <div class="empty">No active events</div>
    </div>

    <div class="footer">
      Last updated <span class="updated" id="updated">just now</span>
    </div>

  </div>

  <script>
    const totalViewers = document.getElementById("totalViewers");
    const eventCount = document.getElementById("eventCount");
    const eventsContainer = document.getElementById("events");
    const updated = document.getElementById("updated");

    function formatNumber(number) {
      return Number(number || 0).toLocaleString();
    }

    function updateDashboard(data) {
      const entries = Object.entries(data || {});

      let total = 0;

      entries.forEach(([eventId, viewers]) => {
        total += Number(viewers) || 0;
      });

      totalViewers.textContent = formatNumber(total);

      eventCount.textContent =
        entries.length === 1
          ? "1 event"
          : entries.length + " events";

      eventsContainer.replaceChildren();

      if (entries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "No active events";
        eventsContainer.appendChild(empty);
      } else {

        entries.sort((a, b) => {
          return Number(b[1]) - Number(a[1]);
        });

        entries.forEach(([eventId, viewers]) => {

          const event = document.createElement("div");
          event.className = "event";

          const info = document.createElement("div");
          info.className = "event-info";

          const name = document.createElement("div");
          name.className = "event-name";
          name.textContent = eventId;

          const label = document.createElement("div");
          label.className = "event-label";
          label.textContent = "Live event";

          info.appendChild(name);
          info.appendChild(label);

          const viewerBox = document.createElement("div");
          viewerBox.className = "event-viewers";

          const eye = document.createElement("span");
          eye.className = "eye";
          eye.textContent = "👁";

          const number = document.createElement("span");
          number.textContent = formatNumber(viewers);

          viewerBox.appendChild(eye);
          viewerBox.appendChild(number);

          event.appendChild(info);
          event.appendChild(viewerBox);

          eventsContainer.appendChild(event);
        });
      }

      updated.textContent = "just now";
    }

    async function refreshDashboard() {
      try {
        const response = await fetch("/counts", {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to fetch counts");
        }

        const data = await response.json();

        updateDashboard(data);

      } catch (error) {
        console.error("Dashboard update failed:", error);
      }
    }

    refreshDashboard();

    setInterval(refreshDashboard, 3000);
  </script>

</body>
</html>`);
});

// --------------------------------------------------
// Public count endpoint
// --------------------------------------------------

app.get("/count/:eventId", (req, res) => {
  const eventId = cleanEventId(req.params.eventId);

  res.json({
    event: eventId,
    viewers: getEventCount(eventId)
  });
});

// All event counts
app.get("/counts", (req, res) => {
  res.json(getCounts());
});

// --------------------------------------------------
// WebSocket connections
// --------------------------------------------------

wss.on("connection", (ws) => {
  ws.eventId = null;
  ws.lastHeartbeat = Date.now();

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      // Join an event
      if (message.type === "join") {
        const eventId = cleanEventId(message.eventId);

        if (!eventId) {
          ws.send(JSON.stringify({
            type: "error",
            message: "Missing eventId"
          }));
          return;
        }

        // Remove from previous event if necessary
        if (ws.eventId) {
          removeViewer(ws);
        }

        ws.eventId = eventId;
        ws.lastHeartbeat = Date.now();

        if (!events.has(eventId)) {
          events.set(eventId, new Set());
        }

        events.get(eventId).add(ws);

        sendCount(ws);

        console.log(
          `[JOIN] ${eventId} | viewers=${getEventCount(eventId)}`
        );

        return;
      }

      // Heartbeat
      if (message.type === "heartbeat") {
        ws.lastHeartbeat = Date.now();

        if (ws.eventId) {
          sendCount(ws);
        }

        return;
      }

      // Leave manually
      if (message.type === "leave") {
        removeViewer(ws);
        return;
      }

    } catch (error) {
      console.error("Invalid WebSocket message:", error.message);
    }
  });

  ws.on("close", () => {
    removeViewer(ws);
  });

  ws.on("error", () => {
    removeViewer(ws);
  });
});

// --------------------------------------------------
// Viewer cleanup
// --------------------------------------------------

setInterval(() => {
  const now = Date.now();

  for (const [eventId, viewers] of events) {
    for (const ws of viewers) {
      if (now - ws.lastHeartbeat > VIEWER_TIMEOUT) {
        try {
          ws.terminate();
        } catch {}

        viewers.delete(ws);
      }
    }

    if (viewers.size === 0) {
      events.delete(eventId);
    }
  }
}, 10_000);

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function cleanEventId(value) {
  if (!value) return null;

  return String(value)
    .trim()
    .slice(0, 150)
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

function getEventCount(eventId) {
  const viewers = events.get(eventId);
  return viewers ? viewers.size : 0;
}

function getCounts() {
  const result = {};

  for (const [eventId, viewers] of events) {
    result[eventId] = viewers.size;
  }

  return result;
}

function sendCount(ws) {
  if (!ws.eventId) return;

  ws.send(JSON.stringify({
    type: "viewer_count",
    eventId: ws.eventId,
    viewers: getEventCount(ws.eventId)
  }));
}

function removeViewer(ws) {
  if (!ws.eventId) return;

  const eventId = ws.eventId;
  const viewers = events.get(eventId);

  if (viewers) {
    viewers.delete(ws);

    if (viewers.size === 0) {
      events.delete(eventId);
    }
  }

  ws.eventId = null;
}

// --------------------------------------------------
// Start server
// --------------------------------------------------

server.listen(PORT, "0.0.0.0", () => {
  console.log(`FutbolX Viewer Server running on port ${PORT}`);
});
