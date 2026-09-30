// components/ConnectionStatus.jsx - Real-Time Collaborative Connection & Fixed-Width Live Ping Indicator
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate,
  faCheck,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';

/**
 * Format ping value with leading zero-padding (digital clock style)
 * e.g. 8 -> "008", 245 -> "245", 1234 -> "1234"
 */
export function formatPing(pingMs) {
  if (typeof pingMs !== 'number' || isNaN(pingMs) || pingMs <= 0) return '000';
  const rounded = Math.round(pingMs);
  if (rounded > 9999) return '9999';
  return String(rounded).padStart(3, '0');
}

/**
 * Determine ping latency color:
 * - Green (<100ms): #10B981 (good connection)
 * - Yellow (100-300ms): #FBBF24 (okay connection)
 * - Red (>300ms): #EF4444 (poor connection)
 */
export function getQualityColor(ping) {
  if (!ping || ping < 100) return '#10B981';
  if (ping <= 300) return '#FBBF24';
  return '#EF4444';
}

/**
 * ConnectionStatus
 * Shows real-time connection state, fixed-width live dynamic ping latency (updating every 500ms),
 * sync progress, and collaborative user count.
 *
 * @param {string} status - 'connected' | 'connecting' | 'disconnected'
 * @param {boolean} isSynced - Whether document is currently synced with server
 * @param {string} saveStatus - 'saved' | 'saving' | 'synced'
 * @param {number} userCount - Number of active collaborators in the room
 * @param {number} ping - Live dynamic network round-trip time in ms
 * @param {number} latency - Optional fallback alias for ping
 * @param {'good'|'ok'|'bad'} quality - 'good' (<100ms) | 'ok' (100-300ms) | 'bad' (>300ms)
 */
export function ConnectionStatus({
  status = 'connected',
  isSynced = true,
  saveStatus = 'saved',
  userCount = 1,
  ping = 0,
  latency = null,
  quality = null,
}) {
  const livePing = ping || latency || 0;
  const isConnected = status === 'connected' || status === 'Connected' || (typeof ping === 'number' && ping > 0);
  const isConnecting = !isConnected && (status === 'connecting' || status === 'Connecting');
  const isSaving = saveStatus === 'saving';

  // Determine connection quality color
  const netQuality = quality || (
    !isConnected
      ? 'bad'
      : livePing > 0 && livePing < 100
      ? 'good'
      : livePing >= 100 && livePing <= 300
      ? 'ok'
      : livePing > 300
      ? 'bad'
      : 'good'
  );

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 select-none text-xs font-mono shrink-0">
      {/* 1. Network Status Pill with Fixed-Width Live Ping (Digital Clock Style, No Resizing) */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors duration-200 whitespace-nowrap ${
          isConnecting
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : !isConnected
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : netQuality === 'good'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : netQuality === 'ok'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}
        title={`Status: ${isConnected ? 'Connected' : isConnecting ? 'Connecting' : 'Disconnected'} | Ping: ${livePing}ms`}
      >
        {/* Quality Dot Indicator */}
        <span
          className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-200 ${
            isConnecting
              ? 'bg-amber-400 animate-pulse'
              : !isConnected
              ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
              : netQuality === 'good'
              ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
              : netQuality === 'ok'
              ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
              : 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
          }`}
        />

        {/* Live Status + Fixed-Width Ping: Digital clock style constant width */}
        <div className="flex items-center text-[10px] sm:text-[11px] font-sans font-semibold tracking-wide">
          {isConnected ? (
            <div className="inline-flex items-center gap-1">
              <span>Connected</span>
              <span className="ping-value inline-flex items-center gap-0.5 font-mono text-[11px] tracking-wide ml-0.5">
                <span
                  className="ping-number inline-block w-[28px] text-right font-mono font-medium tabular-nums"
                  style={{ color: getQualityColor(livePing) }}
                >
                  {formatPing(livePing)}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono font-normal">ms</span>
              </span>
            </div>
          ) : isConnecting ? (
            <span>Connecting...</span>
          ) : (
            <span>Disconnected</span>
          )}
        </div>
      </div>

      {/* 2. Document Sync / Save State */}
      <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300 text-[10px] sm:text-[11px]">
        {isSaving ? (
          <>
            <FontAwesomeIcon icon={faArrowsRotate} className="animate-spin text-amber-400 text-[9px] sm:text-[10px]" />
            <span className="text-amber-300 font-sans font-medium hidden sm:inline">Syncing...</span>
          </>
        ) : (
          <>
            <FontAwesomeIcon icon={faCheck} className="text-emerald-400 text-[9px] sm:text-[10px]" />
            <span className="text-neutral-400 font-sans hidden sm:inline">{isSynced ? 'Synced' : 'Ready'}</span>
          </>
        )}
      </div>

      {/* 3. Active Collaborators Pill */}
      <div
        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300 text-[10px] sm:text-[11px]"
        title={`${userCount} active collaborator${userCount === 1 ? '' : 's'} in room`}
      >
        <FontAwesomeIcon icon={faUsers} className="text-neutral-400 text-[10px]" />
        <span className="font-sans font-medium text-white">{userCount}</span>
        <span className="text-neutral-500 hidden md:inline">online</span>
      </div>
    </div>
  );
}

export default ConnectionStatus;
