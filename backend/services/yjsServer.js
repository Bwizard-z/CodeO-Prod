// services/yjsServer.js - Yjs Real-time Collaborative Synchronization Server
const Y = require('yjs');
const sync = require('y-protocols/dist/sync.cjs');
const awareness = require('y-protocols/dist/awareness.cjs');
const encoding = require('lib0/dist/encoding.cjs');
const decoding = require('lib0/dist/decoding.cjs');
const { supabaseAdmin } = require('./supabase');

// Constants for Yjs binary protocol message types
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// In-memory cache for room documents and awareness states
// Map<string, { doc: Y.Doc, awareness: awareness.Awareness, conns: Map<WebSocket, Set<number>>, saveTimeout: any }>
const rooms = new Map();

/**
 * Send an encoded Yjs message to a specific WebSocket client
 */
function send(conn, message) {
  if (conn.readyState === 1) { // WebSocket.OPEN
    try {
      conn.send(message, (err) => {
        if (err) conn.close();
      });
    } catch {
      conn.close();
    }
  }
}

/**
 * Persist document content to Supabase database
 */
async function persistRoomContent(roomCode, doc) {
  try {
    const cleanCode = roomCode.toUpperCase().trim();
    const yText = doc.getText('monaco');
    const content = yText.toString();

    // 1. Update latest code in rooms table
    const { data: updatedRoom } = await supabaseAdmin
      .from('rooms')
      .update({
        code_content: content,
        updated_at: new Date().toISOString(),
      })
      .eq('code', cleanCode)
      .select('id, language')
      .maybeSingle();

    // 2. Snapshot to code_history table if room exists and has code
    if (updatedRoom && content.trim().length > 0) {
      await supabaseAdmin.from('code_history').insert({
        room_id: updatedRoom.id,
        code_content: content,
        language: updatedRoom.language || 'javascript',
        status: 'synced',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn(`[Yjs Server] Failed to persist room ${roomCode} content:`, err.message);
  }
}

/**
 * Retrieve or initialize a Yjs Document and Awareness synchronously
 * and asynchronously preload saved code from the database.
 */
function getOrCreateRoom(roomCode) {
  const code = roomCode.toUpperCase().trim();
  if (rooms.has(code)) {
    const existing = rooms.get(code);
    if (existing.evictionTimeout) {
      clearTimeout(existing.evictionTimeout);
      existing.evictionTimeout = null;
    }
    return existing;
  }

  const doc = new Y.Doc();
  const aw = new awareness.Awareness(doc);
  const conns = new Map(); // ws => Set of clientIDs

  const roomData = {
    doc,
    awareness: aw,
    conns,
    saveTimeout: null,
    evictionTimeout: null,
    initPromise: null,
  };
  rooms.set(code, roomData);

  // Asynchronously load saved code content from Supabase
  roomData.initPromise = supabaseAdmin
    .from('rooms')
    .select('code_content, language')
    .eq('code', code)
    .maybeSingle()
    .then(({ data: roomRecord }) => {
      const yText = doc.getText('monaco');
      if (yText.length === 0) {
        let codeToLoad = '';
        if (roomRecord && typeof roomRecord.code_content === 'string' && roomRecord.code_content.length > 0) {
          codeToLoad = roomRecord.code_content;
        } else if (roomRecord?.language) {
          const l = roomRecord.language.toLowerCase().trim();
          const STARTER_SNIPPETS = {
            javascript: '// JavaScript in CodeO\nconsole.log("Hello from CodeO!");\n',
            python: '# Python in CodeO\nprint("Hello from CodeO!")\n',
            cpp: '// C++ in CodeO\n#include <iostream>\n\nint main() {\n    std::cout << "Hello from CodeO!" << std::endl;\n    return 0;\n}\n',
            'c++': '// C++ in CodeO\n#include <iostream>\n\nint main() {\n    std::cout << "Hello from CodeO!" << std::endl;\n    return 0;\n}\n',
            java: '// Java in CodeO\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from CodeO!");\n    }\n}\n',
            typescript: '// TypeScript in CodeO\nconsole.log("Hello from CodeO!");\n',
          };
          codeToLoad = STARTER_SNIPPETS[l] || STARTER_SNIPPETS.javascript;
        }
        if (codeToLoad) {
          doc.transact(() => {
            yText.insert(0, codeToLoad);
          }, 'initial-load');
        }
      }
    })
    .catch((err) => {
      console.warn(`[Yjs Server] Note loading initial code for ${code}:`, err.message);
    });

  // On document update: broadcast and debounce auto-save to database
  doc.on('update', (update, origin) => {
    // 1. Broadcast update to all other connected peers
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    sync.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    conns.forEach((_, conn) => {
      if (conn !== origin) {
        send(conn, message);
      }
    });

    // 2. Debounce auto-save to database (every 2 seconds)
    if (roomData.saveTimeout) {
      clearTimeout(roomData.saveTimeout);
    }
    roomData.saveTimeout = setTimeout(() => {
      persistRoomContent(code, doc);
      roomData.saveTimeout = null;
    }, 2000);
  });

  // On awareness update: track controlled client IDs per connection and broadcast to all others
  aw.on('update', ({ added, updated, removed }, origin) => {
    if (origin && conns.has(origin)) {
      const controlled = conns.get(origin);
      added.forEach((id) => controlled.add(id));
      updated.forEach((id) => controlled.add(id));
      removed.forEach((id) => controlled.delete(id));
    }

    const changedClients = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, awareness.encodeAwarenessUpdate(aw, changedClients));
    const buff = encoding.toUint8Array(encoder);

    conns.forEach((_, conn) => {
      if (conn !== origin) {
        send(conn, buff);
      }
    });
  });

  return roomData;
}

/**
 * Handle new WebSocket connection from y-websocket client synchronously
 */
async function setupYjsConnection(conn, req) {
  conn.binaryType = 'arraybuffer';

  // Extract roomCode from URL path or query params
  // Examples: /yjs/ABC123, /yjs?room=ABC123, or standard /ABC123
  let roomCode = 'DEFAULT';
  try {
    const urlObj = new URL(req.url, 'http://localhost:5000/');
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      roomCode = pathParts[pathParts.length - 1];
      if (roomCode.toLowerCase() === 'yjs' && urlObj.searchParams.get('room')) {
        roomCode = urlObj.searchParams.get('room');
      }
    } else if (urlObj.searchParams.get('room')) {
      roomCode = urlObj.searchParams.get('room');
    }
  } catch {
    roomCode = 'DEFAULT';
  }

  roomCode = roomCode.toUpperCase().trim();
  const room = getOrCreateRoom(roomCode);
  const controlledIds = new Set();
  room.conns.set(conn, controlledIds);

  // Handle incoming binary messages from client
  conn.on('message', (data) => {
    try {
      const uint8 = Buffer.isBuffer(data)
        ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : new Uint8Array(data);
      const decoder = decoding.createDecoder(uint8);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MESSAGE_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          sync.readSyncMessage(decoder, encoder, room.doc, conn);
          if (encoding.length(encoder) > 1) {
            send(conn, encoding.toUint8Array(encoder));
          }
          break;
        }
        case MESSAGE_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder);
          awareness.applyAwarenessUpdate(room.awareness, update, conn);
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.warn(`[Yjs Server] Error parsing WS message in ${roomCode}:`, err.message);
    }
  });

  // Await initial code preloading from database before sending SyncStep 1
  if (room.initPromise) {
    try {
      await room.initPromise;
    } catch (e) {
      console.warn(`[Yjs Server] Note awaiting initPromise for ${roomCode}:`, e.message);
    }
  }

  if (conn.readyState !== 1) return;

  // Step 1: Send initial SyncStep 1 to client
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    sync.writeSyncStep1(encoder, room.doc);
    send(conn, encoding.toUint8Array(encoder));
  }

  // Step 2: Send current awareness state to client
  {
    const awarenessStates = room.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awareness.encodeAwarenessUpdate(room.awareness, Array.from(awarenessStates.keys()))
      );
      send(conn, encoding.toUint8Array(encoder));
    }
  }

  // Handle connection cleanup on close
  conn.on('close', () => {
    if (room.conns.has(conn)) {
      const controlled = room.conns.get(conn);
      room.conns.delete(conn);
      // Remove awareness entries belonging to this connection
      if (controlled && controlled.size > 0) {
        awareness.removeAwarenessStates(room.awareness, Array.from(controlled), null);
      }
      // If all connections closed, flush persistence and schedule room doc destruction
      if (room.conns.size === 0) {
        if (room.saveTimeout) {
          clearTimeout(room.saveTimeout);
          room.saveTimeout = null;
        }
        persistRoomContent(roomCode, room.doc);

        const cleanCode = roomCode.toUpperCase().trim();

        // Deactivate room members in DB when all connections have left
        supabaseAdmin
          .from('rooms')
          .select('id')
          .eq('code', cleanCode)
          .maybeSingle()
          .then(({ data: r }) => {
            if (r) {
              supabaseAdmin
                .from('room_members')
                .update({ is_active: false })
                .eq('room_id', r.id)
                .then(() => {});
            }
          })
          .catch(() => {});

        if (room.evictionTimeout) {
          clearTimeout(room.evictionTimeout);
        }
        room.evictionTimeout = setTimeout(() => {
          if (room.conns.size === 0) {
            try {
              room.awareness.destroy();
              room.doc.destroy();
            } catch (destroyErr) {
              console.warn(`[Yjs Server] Error destroying room ${cleanCode}:`, destroyErr.message);
            }
            rooms.delete(cleanCode);
          }
        }, 30000);
      }
    }
  });

  conn.on('error', (err) => {
    console.warn(`[Yjs Server] WS error in ${roomCode}:`, err.message);
    conn.close();
  });
}

module.exports = {
  setupYjsConnection,
  getOrCreateRoom,
  persistRoomContent,
};
