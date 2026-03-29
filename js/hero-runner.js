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

(() => {
  'use strict';

  /* ── helpers ──────────────────────────────────────────── */

  const lerp  = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const remap = (v, iLo, iHi, oLo, oHi) =>
    oLo + ((v - iLo) / (iHi - iLo)) * (oHi - oLo);
  const vary  = (base, pct) => base * (1 + (Math.random() - 0.5) * 2 * pct);

  /* ── tunables ─────────────────────────────────────────── */

  const CFG = {
    accelForce:      65,       // px / s²  — gentle push-off
    cruiseSpeed:     62,       // px / s   — lazy drift, like carried by wind
    decelForce:      55,       // px / s²  — soft braking
    cruiseSpeedVar:  0.10,     // ±10 % random variation per cycle
    idleDelayMin:    0.6,      // seconds before the car starts
    idleDelayMax:    1.4,
    exitFadeDur:     0.8,      // seconds for the opacity fade-out
    resetPause:      0.6,      // seconds the car stays invisible at start
    trackPadStart:   0,        // starting X offset (px)
    decelZone:       0.58,     // start braking earlier for gradual slow-down
    exitZone:        0.85,     // begin opacity fade here

    // Micro-motion
    suspFreq:        8,        // suspension oscillation Hz (gentler)
    suspAmp:         0.18,     // suspension amplitude scale (subtler)
    pitchAccel:     -0.8,      // degrees — very slight nose-up during acceleration
    pitchCruise:     0,
    pitchDecel:      0.6,      // slight nose-down during braking
    pitchLerp:       0.03,     // slower pitch transitions
    trailMinW:       20,       // trail width at low speed (px)
    trailMaxW:       80,
    headlightFreq:   6,        // flicker Hz (calmer)
    headlightAmp:    0.10,     // flicker amplitude (subtler)
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

      // Visibility
      this.isVisible    = true;
      this.observer     = null;
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
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = mq.matches;
      mq.addEventListener('change', (e) => {
        this.reducedMotion = e.matches;
        if (this.reducedMotion) this._applyReducedMotion();
      });

      if (this.reducedMotion) {
        this._applyReducedMotion();
        return;
      }

      this._measureTrack();
      window.addEventListener('resize', () => this._measureTrack());

      // Pause off-screen
      this.observer = new IntersectionObserver(
        ([entry]) => {
          this.isVisible = entry.isIntersecting;
          if (this.isVisible && !this.rafId) this._startLoop();
        },
        { threshold: 0.05 }
      );
      this.observer.observe(this.runner);

      this._resetCycle();
      this._startLoop();
    }

    destroy() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      if (this.observer) this.observer.disconnect();
    }

    /* ── internal ───────────────────────────────────────── */

    _measureTrack() {
      if (!this.runway) return;
      // Track is the runway width minus some padding for the car itself
      this.trackWidth = this.runway.offsetWidth - 16;
    }

    _startLoop() {
      this.lastFrame = performance.now();
      const loop = (now) => {
        const dt = Math.min((now - this.lastFrame) / 1000, 0.06); // cap spike
        this.lastFrame = now;

        if (this.isVisible) {
          this._tick(dt);
          this._render();
        }

        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
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
        this.trailOp = remap(speedFrac, 0.1, 1, 0, 0.9);
      }
    }

    _tickIdle(dt) {
      // Fade car in gently while idling
      this.opacity = lerp(this.opacity, 0.95, 0.06);
      // Tiny idle oscillation (engine rumble)
      this.suspY = Math.sin(this.elapsed * 6) * 0.25;

      if (this.stateTime >= this.idleDelay) {
        this._setState(STATES.ACCEL);
      }
    }

    _tickAccel(dt) {
      this.opacity = lerp(this.opacity, 1, 0.1);
      // Accelerate with an ease-out feel (force decreases as we approach cruise)
      const speedDelta = this.cruiseTarget - this.velocity;
      const accelFactor = clamp(speedDelta / this.cruiseTarget, 0.15, 1);
      this.velocity += CFG.accelForce * accelFactor * dt;

      // Body pitches backward (nose up) during acceleration
      this.bodyPitch = lerp(this.bodyPitch, CFG.pitchAccel, CFG.pitchLerp);

      if (this.velocity >= this.cruiseTarget * 0.95) {
        this._setState(STATES.CRUISE);
      }
    }

    _tickCruise(dt) {
      // Maintain velocity with a very gentle sine variation for organic feel
      const driftSpeed = this.cruiseTarget +
                         Math.sin(this.elapsed * 0.9) * (this.cruiseTarget * 0.06);
      this.velocity = lerp(this.velocity, driftSpeed, 0.08);

      // Body levels out
      this.bodyPitch = lerp(this.bodyPitch, CFG.pitchCruise, CFG.pitchLerp);

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
      this.bodyPitch = lerp(this.bodyPitch, CFG.pitchDecel, CFG.pitchLerp);

      if (this.x >= this.trackWidth * CFG.exitZone) {
        this._setState(STATES.EXIT);
      }
    }

    _tickExit(dt) {
      // Keep rolling at low speed
      this.velocity = lerp(this.velocity, 8, 0.03);
      // Fade out
      this.opacity = lerp(this.opacity, 0, 0.06);
      // Slight upward drift as it "leaves"
      this.suspY = lerp(this.suspY, -2, 0.03);
      // Body returns level
      this.bodyPitch = lerp(this.bodyPitch, 0, 0.04);

      if (this.opacity < 0.02) {
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
      // Simple gentle side-to-side transition, no rapid motion
      this.runner.style.transition = 'transform 4s ease-in-out';
      this.runner.style.opacity = '0.85';

      let forward = true;
      const sway = () => {
        if (this.reducedMotion && this.runner) {
          const target = forward ? this.trackWidth * 0.4 : 0;
          this.runner.style.transform = `translateX(${target}px)`;
          forward = !forward;
        }
      };
      sway();
      this._reducedMotionInterval = setInterval(sway, 4200);
    }
  }

  /* ── bootstrap ───────────────────────────────────────── */

  const animator = new HeroRunnerAnimator();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => animator.init());
  } else {
    animator.init();
  }

  // Expose for debugging in dev console
  window.__heroRunner = animator;
})();
