// mcp-server.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const API_BASE = process.env.API_BASE_URL || 'https://your-railway-url.com';

const server = new Server({
  name: 'chaz-chess',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler('tools/list', async () => ({
  tools: [
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
      description: 'Make a chess move',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: { type: 'string' },
          token: { type: 'string' },
          move: { type: 'string', description: 'Move in SAN notation (e.g., "e4", "Nf3")' }
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
    }
  ]
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let response;

    switch (name) {
      case 'join_room':
        response = await fetch(`${API_BASE}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: args.keyword })
        });
        break;

      case 'set_ready':
        response = await fetch(`${API_BASE}/api/sessions/ready?keyword=${args.keyword}&token=${args.token}`, {
          method: 'POST'
        });
        break;

      case 'get_state':
        const url = new URL(`${API_BASE}/api/sessions`);
        url.searchParams.set('keyword', args.keyword);
        if (args.token) url.searchParams.set('token', args.token);
        response = await fetch(url);
        break;

      case 'make_move':
        response = await fetch(`${API_BASE}/api/sessions/move?keyword=${args.keyword}&token=${args.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ move: args.move })
        });
        break;

      case 'resign':
        response = await fetch(`${API_BASE}/api/sessions/resign?keyword=${args.keyword}&token=${args.token}`, {
          method: 'POST'
        });
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
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

const transport = new StdioServerTransport();
server.connect(transport);
