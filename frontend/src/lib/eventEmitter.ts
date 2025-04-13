/**
 * Simple event emitter system to handle cross-component communication
 */
export type EventHandler = (...args: any[]) => void;

export interface EventMap {
    [eventName: string]: EventHandler[];
}

class EventEmitter {
    private events: EventMap = {};

    /**
     * Subscribe to an event
     * @param eventName Name of the event to listen for
     * @param handler Function to call when event is emitted
     * @returns Function to unsubscribe from event
     */
    on(eventName: string, handler: EventHandler): () => void {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }

        this.events[eventName].push(handler);

        console.log(`[EventEmitter] Subscribed to event: ${eventName}, total handlers: ${this.events[eventName].length}`);

        // Return unsubscribe function
        return () => {
            this.off(eventName, handler);
        };
    }

    /**
     * Unsubscribe from an event
     * @param eventName Name of the event
     * @param handler Handler to remove
     */
    off(eventName: string, handler: EventHandler): void {
        if (!this.events[eventName]) {
            return;
        }

        const index = this.events[eventName].indexOf(handler);
        if (index !== -1) {
            this.events[eventName].splice(index, 1);
            console.log(`[EventEmitter] Unsubscribed from event: ${eventName}, remaining handlers: ${this.events[eventName].length}`);
        }
    }

    /**
     * Emit an event
     * @param eventName Name of the event to emit
     * @param args Arguments to pass to handlers
     */
    emit(eventName: string, ...args: any[]): void {
        const handlers = this.events[eventName];
        if (!handlers || handlers.length === 0) {
            console.log(`[EventEmitter] Event emitted with no handlers: ${eventName}`);
            return;
        }

        console.log(`[EventEmitter] Emitting event: ${eventName} to ${handlers.length} handlers`);

        // Make a copy to avoid issues if handlers are added/removed during emission
        [...handlers].forEach(handler => {
            try {
                handler(...args);
            } catch (error) {
                console.error(`[EventEmitter] Error in event handler for ${eventName}:`, error);
            }
        });
    }

    /**
     * Check if an event has subscribers
     * @param eventName Name of the event
     * @returns True if event has subscribers
     */
    hasListeners(eventName: string): boolean {
        return !!(this.events[eventName] && this.events[eventName].length > 0);
    }
}

// Create a singleton instance to be used throughout the app
export const eventEmitter = new EventEmitter();

// Define common event names to avoid string typos
export const AudioEvents = {
    PLAYBACK_STARTED: 'audio:playback:started',
    PLAYBACK_ENDED: 'audio:playback:ended',
    RECORDING_STARTED: 'audio:recording:started',
    RECORDING_ENDED: 'audio:recording:ended'
};

export default eventEmitter;