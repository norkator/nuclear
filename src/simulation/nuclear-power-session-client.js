/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// A socket belongs to this console instance. No process-wide singleton, queued
// offline commands, automatic Start, or persistent plant state.
export function sessionCommandId() {
    // getRandomValues also works over plain HTTP on a LAN. randomUUID is only
    // exposed in secure contexts, so it cannot be required for tablet pairing.
    return [...crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('');
}

export class SessionConnection {
    constructor({ role, onMessage, onStatus, WebSocketClass = globalThis.WebSocket, url } = {}) {
        this.role = role;
        this.onMessage = onMessage;
        this.onStatus = onStatus;
        this.WebSocketClass = WebSocketClass;
        const endpoint = url || new URL('/session', globalThis.location.href);
        this.url = String(endpoint).replace(/^http/, 'ws');
        this.closed = false;
        this.retry = 0;
    }

    connect(credentials) {
        this.credentials = credentials;
        this.closed = false;
        this.open();
    }

    open() {
        if (this.closed) return;
        this.onStatus('connecting');
        const socket = this.socket = new this.WebSocketClass(this.url);
        socket.addEventListener('open', () => {
            if (socket !== this.socket || this.closed) return;
            this.retry = 0;
            this.send(this.credentials || { type: this.role === 'host' ? 'host' : 'join' });
        });
        socket.addEventListener('message', event => {
            if (socket !== this.socket || this.closed) return;
            let message;
            try { message = JSON.parse(event.data); } catch { return; }
            if (message.type === 'hosted') {
                this.credentials = { type: 'resume-host', roomId: message.roomId, ownerToken: message.ownerToken };
                this.onStatus('connected');
            } else if (message.type === 'joined') {
                this.credentials = { type: 'resume-device', roomId: message.roomId, deviceId: message.deviceId, deviceToken: message.deviceToken };
                this.onStatus('connected');
            }
            this.onMessage(message);
            if (message.type === 'ended' || message.type === 'error') this.disconnect();
        });
        socket.addEventListener('error', () => {});
        socket.addEventListener('close', () => {
            if (socket !== this.socket || this.closed) return;
            this.onStatus('disconnected');
            this.reconnectTimer = setTimeout(() => this.open(), Math.min(5000, 500 * 2 ** this.retry++));
        });
    }

    send(message) {
        if (this.closed || this.socket?.readyState !== 1 || this.socket.bufferedAmount > 1024 * 1024) return false;
        this.socket.send(JSON.stringify(message));
        return true;
    }

    disconnect(message) {
        if (message) this.send(message);
        this.closed = true;
        clearTimeout(this.reconnectTimer);
        this.socket?.close(1000);
    }
}
