
/**
 * MCP Proxy for Claude Desktop
 * 
 * This script acts as a bridge. 
 * 1. It connects to the running OR Planner Web App via SSE (Server-Sent Events).
 * 2. It pipes messages from Claude Desktop (Stdio) to the Web App (HTTP POST).
 * 3. It pipes messages from the Web App (SSE) back to Claude Desktop (Stdio).
 */

import EventSource from 'eventsource';

// Default to local dev port if not specified
const BASE_URL = process.env.MCP_URL || 'http://localhost:8080';
const SSE_URL = `${BASE_URL}/api/mcp/sse`;

console.error(`[MCP Proxy] Connecting to ${SSE_URL}...`);

// 1. Establish SSE Connection
const eventSource = new EventSource(SSE_URL);
let postUrl = null;

eventSource.onopen = () => {
    console.error("[MCP Proxy] Connected to OR Planner.");
};

eventSource.onerror = (err) => {
    console.error("[MCP Proxy] Connection Error:", err);
};

// 2. Handle Incoming Messages from Server (SSE) -> Send to Claude (Stdout)
eventSource.addEventListener("message", (event) => {
    try {
        // The server sends JSON-RPC messages wrapped in the data field
        const message = JSON.parse(event.data);
        console.log(JSON.stringify(message)); // Write to Stdout
    } catch (error) {
        console.error("[MCP Proxy] Error parsing SSE message:", error);
    }
});

// 3. Handle Endpoint Discovery (The server tells us where to POST messages)
eventSource.addEventListener("endpoint", (event) => {
    // The server sends the endpoint URI (e.g., /api/mcp/messages?sessionId=xyz)
    const uri = event.data;
    postUrl = new URL(uri, BASE_URL).toString();
    console.error(`[MCP Proxy] Endpoint discovered: ${postUrl}`);
});

// 4. Handle Outgoing Messages from Claude (Stdin) -> Send to Server (HTTP POST)
process.stdin.setEncoding('utf8');

let buffer = '';

process.stdin.on('data', (chunk) => {
    buffer += chunk;
    
    // JSON-RPC messages are newline delimited
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete chunk in buffer

    for (const line of lines) {
        if (line.trim()) {
            handleStdinMessage(line);
        }
    }
});

async function handleStdinMessage(line) {
    if (!postUrl) {
        console.error("[MCP Proxy] Cannot send message: No endpoint URL received yet.");
        return;
    }

    try {
        const response = await fetch(postUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: line
        });

        if (!response.ok) {
            console.error(`[MCP Proxy] POST failed: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error("[MCP Proxy] Network error sending message:", error);
    }
}
