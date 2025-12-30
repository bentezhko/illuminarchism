/**
 * Timeline Module
 * Handles temporal controls and playback
 */

export default class Timeline {
    constructor(app) {
        this.app = app;
        this.slider = null;
        this.yearDisplay = null;
        this.playButton = null;
        this.isPlaying = false;
        this.playInterval = null;
        this.init();
    }

    init() {
        this.slider = document.getElementById('time-slider');
        this.yearDisplay = document.getElementById('year-display');
        this.playButton = document.getElementById('btn-play');

        if (this.slider) {
            this.slider.addEventListener('input', (e) => {
                const year = parseInt(e.target.value);
                this.setYear(year);
            });
        }

        if (this.playButton) {
            this.playButton.addEventListener('click', () => {
                this.togglePlayback();
            });
        }
    }

    setYear(year) {
        this.app.currentYear = year;

        if (this.yearDisplay) {
            this.yearDisplay.textContent = `${year} AD`;
        }

        if (this.slider) {
            this.slider.value = year;
        }

        this.app.updateEntities();
        this.app.render();
    }

    getYear() {
        return this.app.currentYear;
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    }

    play() {
        this.isPlaying = true;

        if (this.playButton) {
            this.playButton.textContent = 'Halt';
        }

        this.playInterval = setInterval(() => {
            let newYear = this.app.currentYear + 1;

            // Loop back to start
            if (this.slider && newYear > parseInt(this.slider.max)) {
                newYear = parseInt(this.slider.min);
            }

            this.setYear(newYear);
        }, 200); // Matches CONFIG.ANIMATION_SPEED
    }

    stop() {
        this.isPlaying = false;

        if (this.playButton) {
            this.playButton.textContent = 'Play';
        }

        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }
}
