(function() {
  window.ReplayEngine = {
    create(events) {
      const parsedEvents = events.map(e => ({
        ...e,
        data: typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data
      }));

      return {
        events: parsedEvents,
        currentIndex: -1,
        totalEvents: parsedEvents.length,
        playing: false,
        speed: 1,
        _timer: null,

        stepForward() {
          if (this.currentIndex >= this.totalEvents - 1) return null;
          this.currentIndex++;
          return this.events[this.currentIndex];
        },

        stepBack() {
          if (this.currentIndex <= 0) return null;
          this.currentIndex--;
          return this.events[this.currentIndex];
        },

        seekTo(index) {
          this.currentIndex = Math.max(-1, Math.min(index, this.totalEvents - 1));
          return this.events[this.currentIndex] || null;
        },

        getProgress() {
          if (this.totalEvents <= 1) return this.currentIndex >= 0 ? 100 : 0;
          return Math.round(((this.currentIndex + 1) / this.totalEvents) * 100);
        },

        getCurrentEvent() {
          return this.currentIndex >= 0 ? this.events[this.currentIndex] : null;
        },

        play(onEvent) {
          if (this.playing) return;
          this.playing = true;
          const self = this;
          const tick = () => {
            if (!self.playing) return;
            const event = self.stepForward();
            if (!event) { self.playing = false; return; }
            if (onEvent) onEvent(event, self.currentIndex, self.totalEvents);
            const next = self.events[self.currentIndex + 1];
            const delay = next
              ? Math.max(100, (next.timestamp - event.timestamp) / self.speed)
              : 0;
            if (next) self._timer = setTimeout(tick, Math.min(delay, 3000));
            else self.playing = false;
          };
          tick();
        },

        pause() {
          this.playing = false;
          if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        },

        setSpeed(speed) {
          this.speed = speed;
        }
      };
    }
  };
})();
