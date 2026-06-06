/**
 * HeroRunnerAnimator
 * -----------------------------------------------------------
 * Physics-inspired animation controller for the hero car.
 * Replaces the rigid CSS @keyframes with a requestAnimationFrame
 * loop driven by velocity / acceleration / micro-motion, so the
 * car accelerates, cruises, decelerates, and exits naturally.
 *
 * Inspired by Three.js render-loop patterns, but zero dependencies.
 */

/* ── helpers ──────────────────────────────────────────── */

const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const remap = (v, iLo, iHi, oLo, oHi) =>
  oLo + ((v - iLo) / (iHi - iLo)) * (oHi - oLo);
const vary  = (base, pct) => base * (1 + (Math.random() - 0.5) * 2 * pct);

  /* ── tunables ─────────────────────────────────────────── */

const CFG = {
    accelForce:      42,       // px / s²
    cruiseSpeed:     38,       // px / s
    decelForce:      36,       // px / s²
    cruiseSpeedVar:  0.06,     // ±6 % random variation per cycle
    idleDelayMin:    1.8,      // seconds before the car starts
    idleDelayMax:    3.6,
    exitFadeDur:     0.8,      // seconds for the opacity fade-out
    resetPause:      1.4,      // seconds the car stays invisible at start
    trackPadStart:   0,        // starting X offset (px)
    decelZone:       0.58,     // start braking earlier for gradual slow-down
    exitZone:        0.85,     // begin opacity fade here

    // Micro-motion
    suspFreq:        5,        // suspension oscillation Hz
    suspAmp:         0.06,     // suspension amplitude scale
    pitchAccel:     -0.35,     // degrees
    pitchCruise:     0,
    pitchDecel:      0.25,
    pitchLerp:       0.03,     // slower pitch transitions
    trailMinW:       12,       // trail width at low speed (px)
    trailMaxW:       36,
    headlightFreq:   4,
    headlightAmp:    0.03,
  };

  /* ── state ────────────────────────────────────────────── */

const STATES = {
    IDLE:    'idle',
    ACCEL:   'accel',
    CRUISE:  'cruise',
    DECEL:   'decel',
    EXIT:    'exit',
    RESET:   'reset',
  };

  /* ── animator class ──────────────────────────────────── */

class HeroRunnerAnimator {
    constructor() {
      // DOM references (resolved in init)
      this.runner      = null;
      this.wheels      = [];
      this.trail       = null;
      this.headlight   = null;
      this.body        = null;
      this.runway      = null;

      // Computed
      this.trackWidth  = 350;  // fallback; measured from runway

      // Motion state
      this.state       = STATES.IDLE;
      this.x           = 0;
      this.velocity    = 0;
      this.opacity     = 0;
      this.wheelRot    = 0;
      this.bodyPitch   = 0;
      this.suspY       = 0;
      this.trailOp     = 0;

      // Cycle-specific targets (randomised each loop)
      this.cruiseTarget = CFG.cruiseSpeed;
      this.idleDelay    = 0;

      // Timing
      this.elapsed      = 0;   // total elapsed since cycle began
      this.stateTime    = 0;   // time spent in current state
      this.lastFrame    = 0;
      this.rafId        = null;
      this._loopActive  = false;

      // Visibility
      this.isVisible    = true;
      this.observer     = null;
      this._resizeHandler = null;
      this._motionChangeHandler = null;
      this._reducedMotionQuery = null;
      this.reducedMotion = false;
    }

    /* ── lifecycle ──────────────────────────────────────── */

    init() {
      this.runner    = document.querySelector('.hero-runner');
      if (!this.runner) return;  // element not on page

      this.wheels    = [...this.runner.querySelectorAll('.runner-wheel')];
      this.trail     = this.runner.querySelector('.runner-trail');
      this.headlight = this.runner.querySelector('.runner-headlight');
      this.body      = this.runner.querySelector('.runner-body');
      this.runway    = document.querySelector('.hero-runway');

      // Check reduced-motion preference
      this._reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = this._reducedMotionQuery.matches;
      this._motionChangeHandler = (e) => {
        this.reducedMotion = e.matches;
        this._syncMotionMode();
      };
      if (typeof this._reducedMotionQuery.addEventListener === 'function') {
        this._reducedMotionQuery.addEventListener('change', this._motionChangeHandler);
      } else if (typeof this._reducedMotionQuery.addListener === 'function') {
        this._reducedMotionQuery.addListener(this._motionChangeHandler);
      }

      this._measureTrack();
      this._resizeHandler = () => this._measureTrack();
      window.addEventListener('resize', this._resizeHandler);

      // Pause off-screen
      this.observer = new IntersectionObserver(
        ([entry]) => {
          this.isVisible = entry.isIntersecting;
          if (!entry.isIntersecting) {
            this._stopRAFLoop();
            return;
          }

          if (this.reducedMotion) {
            this._applyReducedMotion();
          } else if (!this._loopActive) {
            this._startRAFLoop();
          }
        },
        { threshold: 0.05 }
      );
      this.observer.observe(this.runner);

      this._resetCycle();
      this._syncMotionMode();
    }

    destroy() {
      this._stopRAFLoop();
      if (this.observer) this.observer.disconnect();
      if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
      if (this._motionChangeHandler && this._reducedMotionQuery) {
        if (typeof this._reducedMotionQuery.removeEventListener === 'function') {
          this._reducedMotionQuery.removeEventListener('change', this._motionChangeHandler);
        } else if (typeof this._reducedMotionQuery.removeListener === 'function') {
          this._reducedMotionQuery.removeListener(this._motionChangeHandler);
        }
      }
    }

    /* ── internal ───────────────────────────────────────── */

    _measureTrack() {
      if (!this.runway) return;
      // Track is the runway width minus some padding for the car itself
      this.trackWidth = this.runway.offsetWidth - 16;
    }

    _startRAFLoop() {
      if (this._loopActive) return;
      this._loopActive = true;
      this.lastFrame = performance.now();
      const loop = (now) => {
        const dt = Math.min((now - this.lastFrame) / 1000, 0.06); // cap spike
        this.lastFrame = now;

        if (!this._loopActive) return;

        if (this.isVisible) {
          this._tick(dt);
          this._render();
        }

        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }

    _stopRAFLoop() {
      this._loopActive = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    _frameLerp(baseFactor, dt) {
      const frameScale = clamp(dt * 60, 0, 4);
      return 1 - Math.pow(1 - baseFactor, frameScale);
    }

    _syncMotionMode() {
      if (!this.runner) return;

      if (this.reducedMotion) {
        this._stopRAFLoop();
        this._applyReducedMotion();
        return;
      }

      this.runner.style.transition = '';
      this.runner.style.opacity = '';
      this._resetCycle();
      this._render();
      if (this.isVisible) this._startRAFLoop();
    }

    _resetCycle() {
      this.state       = STATES.IDLE;
      this.stateTime   = 0;
      this.elapsed     = 0;
      this.x           = CFG.trackPadStart;
      this.velocity    = 0;
      this.opacity     = 0;
      this.bodyPitch   = 0;
      this.suspY       = 0;
      this.trailOp     = 0;
      this.cruiseTarget = vary(CFG.cruiseSpeed, CFG.cruiseSpeedVar);
      this.idleDelay    = CFG.idleDelayMin +
                          Math.random() * (CFG.idleDelayMax - CFG.idleDelayMin);
    }

    _setState(s) {
      this.state     = s;
      this.stateTime = 0;
    }

    /* ── core tick (called every frame) ─────────────────── */

    _tick(dt) {
      this.elapsed   += dt;
      this.stateTime += dt;

      switch (this.state) {
        case STATES.IDLE:   this._tickIdle(dt);   break;
        case STATES.ACCEL:  this._tickAccel(dt);  break;
        case STATES.CRUISE: this._tickCruise(dt); break;
        case STATES.DECEL:  this._tickDecel(dt);  break;
        case STATES.EXIT:   this._tickExit(dt);   break;
        case STATES.RESET:  this._tickReset(dt);  break;
      }

      // Update position from velocity
      this.x += this.velocity * dt;

      // Micro-motions (always active except idle/reset)
      if (this.state !== STATES.IDLE && this.state !== STATES.RESET) {
        // Suspension bounce — frequency constant, amplitude tied to velocity
        const speedFrac = clamp(this.velocity / this.cruiseTarget, 0, 1.3);
        this.suspY = Math.sin(this.elapsed * CFG.suspFreq) * speedFrac * CFG.suspAmp;

        // Wheel rotation accumulates based on velocity
        // 16px wheel diameter → circumference ~50px → 1 rotation per 50px
        this.wheelRot += (this.velocity * dt / 50) * 360;

        // Trail opacity & width follow speed
        this.trailOp = remap(speedFrac, 0.1, 1, 0, 0.45);
      }
    }

    _tickIdle(dt) {
      // Fade car in gently while idling
      this.opacity = lerp(this.opacity, 0.95, this._frameLerp(0.06, dt));
      this.suspY = 0;

      if (this.stateTime >= this.idleDelay) {
        this._setState(STATES.ACCEL);
      }
    }

    _tickAccel(dt) {
      this.opacity = lerp(this.opacity, 1, this._frameLerp(0.1, dt));
      // Accelerate with an ease-out feel (force decreases as we approach cruise)
      const speedDelta = this.cruiseTarget - this.velocity;
      const accelFactor = clamp(speedDelta / this.cruiseTarget, 0.15, 1);
      this.velocity += CFG.accelForce * accelFactor * dt;

      // Body pitches backward (nose up) during acceleration
      this.bodyPitch = lerp(this.bodyPitch, CFG.pitchAccel, this._frameLerp(CFG.pitchLerp, dt));

      if (this.velocity >= this.cruiseTarget * 0.95) {
        this._setState(STATES.CRUISE);
      }
    }

    _tickCruise(dt) {
      // Maintain velocity with a very gentle sine variation for organic feel
      const driftSpeed = this.cruiseTarget +
                         Math.sin(this.elapsed * 0.9) * (this.cruiseTarget * 0.06);
      this.velocity = lerp(this.velocity, driftSpeed, this._frameLerp(0.08, dt));

      // Body levels out
      this.bodyPitch = lerp(this.bodyPitch, CFG.pitchCruise, this._frameLerp(CFG.pitchLerp, dt));

      // Start braking when we reach the decel zone
      if (this.x >= this.trackWidth * CFG.decelZone) {
        this._setState(STATES.DECEL);
      }
    }

    _tickDecel(dt) {
      // Decelerate with an ease-in feel
      const speedFrac = clamp(this.velocity / this.cruiseTarget, 0, 1);
      this.velocity -= CFG.decelForce * (0.3 + speedFrac * 0.7) * dt;
      this.velocity  = Math.max(this.velocity, 8); // keep a gentle crawl

      // Body pitches forward (nose down) during braking
      this.bodyPitch = lerp(this.bodyPitch, CFG.pitchDecel, this._frameLerp(CFG.pitchLerp, dt));

      if (this.x >= this.trackWidth * CFG.exitZone) {
        this._setState(STATES.EXIT);
      }
    }

    _tickExit(dt) {
      // Keep rolling at low speed
      this.velocity = lerp(this.velocity, 8, this._frameLerp(0.03, dt));
      // Fade out
      this.opacity = lerp(this.opacity, 0, this._frameLerp(0.06, dt));
      // Slight upward drift as it "leaves"
      this.suspY = lerp(this.suspY, -2, this._frameLerp(0.03, dt));
      // Body returns level
      this.bodyPitch = lerp(this.bodyPitch, 0, this._frameLerp(0.04, dt));

      if (this.opacity <= 0.02) {
        this._setState(STATES.RESET);
      }
    }

    _tickReset(dt) {
      this.velocity = 0;
      this.opacity  = 0;
      this.trailOp  = 0;

      if (this.stateTime >= CFG.resetPause) {
        this._resetCycle();
      }
    }

    /* ── render (apply transforms to DOM) ──────────────── */

    _render() {
      if (!this.runner) return;

      // Main transform: position + suspension + pitch
      const tx = this.x;
      const ty = this.suspY;
      const rot = this.bodyPitch;
      this.runner.style.transform =
        `translateX(${tx}px) translateY(${ty}px) rotate(${rot}deg)`;
      this.runner.style.opacity = clamp(this.opacity, 0, 1);

      // Wheels: rotation synced to actual velocity
      const wheelDeg = this.wheelRot % 360;
      for (const w of this.wheels) {
        w.style.transform = `rotate(${wheelDeg}deg)`;
      }

      // Trail: opacity + width follow speed
      if (this.trail) {
        this.trail.style.opacity = clamp(this.trailOp, 0, 1);
        const trailW = remap(
          clamp(this.velocity / this.cruiseTarget, 0, 1),
          0, 1, CFG.trailMinW, CFG.trailMaxW
        );
        this.trail.style.width = `${trailW}px`;
      }

      // Headlight subtle flicker
      if (this.headlight) {
        const hlOp = 0.85 + Math.sin(this.elapsed * CFG.headlightFreq) * CFG.headlightAmp;
        this.headlight.style.opacity = clamp(hlOp, 0.5, 1);
      }
    }

    /* ── reduced motion fallback ───────────────────────── */

    _applyReducedMotion() {
      if (!this.runner) return;
      const staticX = clamp(this.trackWidth * 0.34, 0, Math.max(this.trackWidth - 96, 0));
      this.runner.style.transition = 'none';
      this.runner.style.transform = `translateX(${staticX}px) translateY(0) rotate(0deg)`;
      this.runner.style.opacity = '0.85';

      for (const wheel of this.wheels) {
        wheel.style.transform = 'rotate(0deg)';
      }
      if (this.trail) {
        this.trail.style.opacity = '0';
        this.trail.style.width = `${CFG.trailMinW}px`;
      }
      if (this.headlight) {
        this.headlight.style.opacity = '0.65';
      }
    }
}

/* ── bootstrap ───────────────────────────────────────── */

const animator = new HeroRunnerAnimator();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => animator.init());
} else {
  animator.init();
}

// Expose for debugging in dev console only — no window global
