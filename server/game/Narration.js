/**
 * Narration buffer — collects frame and clause records during event resolution,
 * then flushes them to chat messages at event-window boundaries.
 *
 * See docs/messaging-overhaul.md §6 for the design.
 */
class Narration {
    constructor(game) {
        this.game = game;
        this.buffer = [];
    }

    /**
     * Push a frame record (the head line of a beat).
     * @param {Object} frame
     * @param {string} frame.verb - e.g. 'reap', 'fight', 'play'
     * @param {Object} frame.player - the acting player
     * @param {Object} [frame.source] - the resolving card
     * @param {Object} [frame.args] - additional render args
     */
    pushFrame(frame) {
        this.buffer.push({ type: 'frame', ...frame });
    }

    /**
     * Push a clause record (a structured outcome of a game action).
     * @param {Object} clause
     * @param {string} clause.verb - e.g. 'amber', 'deal-damage', 'destroy'
     * @param {Object} clause.args - slot data for the renderer
     */
    pushClause(clause) {
        this.buffer.push({ type: 'clause', ...clause });
    }

    /**
     * Flush the buffer — render accumulated records into chat messages.
     * Called at the close of each EventWindow.
     */
    flush() {
        if (this.buffer.length === 0) {
            return;
        }

        for (let i = 0; i < this.buffer.length; i++) {
            const record = this.buffer[i];
            if (record.type === 'frame') {
                // Collect clauses that belong to this frame (everything up to
                // the next frame or end of buffer)
                const clauses = [];
                while (i + 1 < this.buffer.length && this.buffer[i + 1].type === 'clause') {
                    i++;
                    clauses.push(this.buffer[i]);
                }

                this.renderFrame(record, clauses);
            }
        }

        this.buffer = [];
    }

    /**
     * Render a frame + its clauses into a chat message.
     */
    renderFrame(frame, clauses) {
        if (frame.verb === 'reap') {
            this.renderReap(frame, clauses);
        }
        // Other verbs (fight, play, etc.) will be added as they're migrated.
    }

    renderReap(frame, clauses) {
        const amberClause = clauses.find((c) => c.verb === 'amber');
        if (amberClause) {
            const { operation, amount } = amberClause.args;
            const verb = operation === 'steal' ? 'steal' : 'gain';
            this.game.addMessage(
                '{0} reaps with {1} to ' + verb + ' ' + amount + ' amber',
                frame.player,
                frame.source
            );
        } else {
            // Fallback — no amber clause (e.g. the gain was prevented entirely)
            this.game.addMessage('{0} reaps with {1}', frame.player, frame.source);
        }
    }
}

module.exports = Narration;
