#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE = process.env.API_BASE_URL || 'https://chaz-production.up.railway.app';

const server = new Server(
  {
    name: 'chaz-chess',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'offer_draw',
        description: 'Offer a draw to your opponent',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            token: { type: 'string' }
          },
          required: ['keyword', 'token']
        }
      },
      {
        name: 'accept_draw',
        description: 'Accept a draw offer and end the game as a draw',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            token: { type: 'string' }
          },
          required: ['keyword', 'token']
        }
      },
      {
        name: 'join_room',
        description: 'Join or create a chess game room',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string', description: 'Room keyword' }
          },
          required: ['keyword']
        }
      },
      {
        name: 'sit',
        description: 'Choose your seat/color in the game',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            token: { type: 'string' },
            color: { type: 'string', enum: ['white', 'black'] }
          },
          required: ['keyword', 'token', 'color']
        }
      },
      {
        name: 'set_ready',
        description: 'Mark yourself as ready to start the game',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            token: { type: 'string' }
          },
          required: ['keyword', 'token']
        }
      },
      {
        name: 'get_state',
        description: 'Get current game state',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            token: { type: 'string' }
          },
          required: ['keyword']
        }
      },
      {
        name: 'make_move',
        description: 'Make a chess move in SAN notation (e.g., "e4", "Nf3", "O-O")',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            token: { type: 'string' },
            move: { type: 'string', description: 'Move in SAN notation' }
          },
          required: ['keyword', 'token', 'move']
        }
      },
      {
        name: 'resign',
        description: 'Resign from the game',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            token: { type: 'string' }
          },
          required: ['keyword', 'token']
        }
      },
      {
        name: 'start',
        description: 'Start the game (both players must be ready)',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            token: { type: 'string' }
          },
          required: ['keyword', 'token']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let response;

    // Build headers with keyword/token
    const headers = {
      'Content-Type': 'application/json'
    };
    if (args.keyword) headers['x-session-keyword'] = args.keyword;
    if (args.token) headers['x-session-token'] = args.token;

    switch (name) {
      case 'offer_draw':
        response = await fetch(`${API_BASE}/api/sessions/offer-draw`, {
          method: 'POST',
          headers
        });
        break;

      case 'accept_draw':
        response = await fetch(`${API_BASE}/api/sessions/accept-draw`, {
          method: 'POST',
          headers
        });
        break;
      case 'join_room':
        response = await fetch(`${API_BASE}/api/sessions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ keyword: args.keyword })  // Also in body for join
        });
        break;

      case 'sit':
        response = await fetch(`${API_BASE}/api/sessions/sit`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ color: args.color })
        });
        break;

      case 'set_ready':
        response = await fetch(`${API_BASE}/api/sessions/ready`, {
          method: 'POST',
          headers
        });
        break;

      case 'get_state':
        response = await fetch(`${API_BASE}/api/sessions`, {
          method: 'GET',
          headers
        });
        break;

      case 'make_move':
        response = await fetch(`${API_BASE}/api/sessions/move`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ move: args.move })
        });
        break;

      case 'resign':
        response = await fetch(`${API_BASE}/api/sessions/resign`, {
          method: 'POST',
          headers
        });
        break;

      case 'start':
        response = await fetch(`${API_BASE}/api/sessions/start`, {
          method: 'POST',
          headers
        });
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }],
      isError: true
    };
  }
});




async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Chaz Chess MCP server running');
}

main().catch(console.error);