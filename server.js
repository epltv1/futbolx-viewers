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
// Health check
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    service: "FutbolX Viewer Counter",
    status: "online",
    events: getCounts()
  });
});

// Public count endpoint
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
