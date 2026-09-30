// components/CursorDisplay.jsx - Remote Collaborator Cursor Styles & Presence
import React, { useMemo } from 'react';

/**
 * CursorDisplay
 * Injects dynamically-scoped CSS for remote collaborator cursors and selection ranges into Monaco.
 * Clamps and filters cursors to valid document boundaries, preventing cursors from jumping or
 * lingering out of bounds when content is deleted or cleared.
 *
 * @param {Array} remoteUsers - Array of remote collaborator objects { clientID, name, color, colorLight, cursor }
 * @param {number|null} codeLength - Optional current code length to validate cursor boundaries
 */
export function CursorDisplay({ remoteUsers = [], codeLength = null }) {
  // Filter and deduplicate valid, in-bounds remote users (only 1 cursor per user)
  const validUsers = useMemo(() => {
    if (!Array.isArray(remoteUsers) || remoteUsers.length === 0) return [];

    const map = new Map();
    remoteUsers.forEach((u) => {
      if (!u || !u.clientID) return;
      // If cursor coordinates are present, ensure they are positive
      if (u.cursor) {
        if (typeof u.cursor.line === 'number' && u.cursor.line < 1) return;
        if (typeof u.cursor.column === 'number' && u.cursor.column < 1) return;
        if (codeLength !== null && typeof u.cursor.offset === 'number') {
          if (u.cursor.offset < 0 || u.cursor.offset > codeLength) return;
        }
      }
      const key = (u.id || u.name || '').trim().toLowerCase() || String(u.clientID);
      map.set(key, u);
    });

    return Array.from(map.values());
  }, [remoteUsers, codeLength]);

  if (validUsers.length === 0) {
    return null;
  }

  return (
    <style>{`
      /* Base Remote Selection Range */
      .yRemoteSelection {
        opacity: 0.35;
        border-radius: 2px;
        transition: background-color 0.15s ease;
      }

      /* Remote Cursor Head (smooth 2px vertical indicator line) */
      .yRemoteSelectionHead {
        position: absolute;
        box-sizing: border-box;
        height: 100%;
        border-left: 2px solid;
        pointer-events: none;
        z-index: 50;
        transition: transform 0.08s ease-out, border-color 0.15s ease;
      }

      /* Cursor top anchor dot */
      .yRemoteSelectionHead::after {
        position: absolute;
        content: ' ';
        border: 2px solid;
        border-radius: 50%;
        left: -3px;
        top: -3px;
        width: 4px;
        height: 4px;
      }

      /* Floating User Name Tag positioned neatly above the cursor line */
      .yRemoteSelectionHead::before {
        position: absolute;
        top: -18px;
        left: -2px;
        font-size: 9px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-weight: 700;
        padding: 0 4px;
        height: 15px;
        line-height: 15px;
        border-radius: 3px 3px 3px 0;
        white-space: nowrap;
        pointer-events: none;
        z-index: 60;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
        opacity: 0.95;
      }

      /* Per-User Dynamic Colors */
      ${validUsers
        .map(
          (u) => `
        .yRemoteSelectionHead-${u.clientID} {
          border-color: ${u.color || '#3b82f6'} !important;
        }
        .yRemoteSelectionHead-${u.clientID}::after {
          border-color: ${u.color || '#3b82f6'} !important;
          background-color: ${u.color || '#3b82f6'} !important;
        }
        .yRemoteSelectionHead-${u.clientID}::before {
          content: '${(u.name || 'Collaborator').replace(/'/g, "\\'")}';
          background-color: ${u.color || '#3b82f6'} !important;
          color: #000000 !important;
        }
        .yRemoteSelection-${u.clientID} {
          background-color: ${u.colorLight || 'rgba(59, 130, 246, 0.25)'} !important;
        }
      `
        )
        .join('\n')}
    `}</style>
  );
}

export default CursorDisplay;
