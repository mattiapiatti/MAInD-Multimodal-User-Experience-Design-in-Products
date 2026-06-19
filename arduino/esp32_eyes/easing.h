// easing.h — cubic-bezier timing functions, matching the CSS animation-timing
// -function used by each track. Applied PER SEGMENT (between adjacent keyframes),
// exactly like CSS. Overshoot curves (y2 > 1) are kept un-clamped so the elastic
// "pop" of D1/D2/E3 survives.
#pragma once
#include <Arduino.h>

// Named easing presets actually used by the gallery (index = Ease enum below).
enum {
  EASE_LINEAR = 0,
  EASE_IN_OUT,        // ease-in-out
  EASE_OUT,           // ease-out
  EASE_STEPS1,        // steps(1, end) — the clock colon
  EASE_A2_GRP,        // cubic-bezier(.22,1,.36,1)
  EASE_A2_DOT,        // cubic-bezier(.45,0,.3,1)
  EASE_DOT_46,        // cubic-bezier(.4,0,.6,1)  (A3/B1/B2/C1/E2 dot)
  EASE_GRP_42,        // cubic-bezier(.4,0,.2,1)  (B3/E2 group)
  EASE_C2_EYE,        // cubic-bezier(.34,1.05,.5,1)
  EASE_D1_GRP,        // cubic-bezier(.22,1.2,.36,1)
  EASE_D2_GRP,        // cubic-bezier(.22,1.3,.36,1)
  EASE_E3_GRP,        // cubic-bezier(.3,1.2,.5,1)
  EASE_E3_DOT,        // cubic-bezier(.3,1.25,.5,1)
  EASE_E4_DOTR,       // cubic-bezier(.4,0,.35,1)
  EASE_E5_DOT,        // cubic-bezier(.4,0,.4,1)
  // ---- face-keyframes.css presets ----
  EASE_F_A2,          // cubic-bezier(.3,1.3,.4,1)   A2 pop
  EASE_F_GAZE,        // cubic-bezier(.45,0,.25,1)   idle gaze/head/mouth
  EASE_F_BLINK,       // cubic-bezier(.3,0,.3,1)     idle blink
  EASE_F_OPEN,        // cubic-bezier(.3,0,.4,1)     B1 talking mouth
  EASE_F_C2,          // cubic-bezier(.4,.2,.3,1)    C2 wobble
  EASE_F_D1,          // cubic-bezier(.4,1.6,.4,1)   D1 spring
  EASE_F_D2,          // cubic-bezier(.22,1.6,.36,1) D2 perk
  EASE_F_D2SM,        // cubic-bezier(.34,1.5,.4,1)  D2 smile bloom
  EASE_COUNT
};

struct Bez { float x1, y1, x2, y2; };
static const Bez EASES[EASE_COUNT] = {
  {0, 0, 1, 1},          // LINEAR
  {.42f, 0, .58f, 1},    // IN_OUT
  {0, 0, .58f, 1},       // OUT
  {0, 0, 1, 1},          // STEPS1 (handled specially)
  {.22f, 1, .36f, 1},    // A2_GRP
  {.45f, 0, .3f, 1},     // A2_DOT
  {.4f, 0, .6f, 1},      // DOT_46
  {.4f, 0, .2f, 1},      // GRP_42
  {.34f, 1.05f, .5f, 1}, // C2_EYE
  {.22f, 1.2f, .36f, 1}, // D1_GRP
  {.22f, 1.3f, .36f, 1}, // D2_GRP
  {.3f, 1.2f, .5f, 1},   // E3_GRP
  {.3f, 1.25f, .5f, 1},  // E3_DOT
  {.4f, 0, .35f, 1},     // E4_DOTR
  {.4f, 0, .4f, 1},      // E5_DOT
  {.3f, 1.3f, .4f, 1},   // F_A2
  {.45f, 0, .25f, 1},    // F_GAZE
  {.3f, 0, .3f, 1},      // F_BLINK
  {.3f, 0, .4f, 1},      // F_OPEN
  {.4f, .2f, .3f, 1},    // F_C2
  {.4f, 1.6f, .4f, 1},   // F_D1
  {.22f, 1.6f, .36f, 1}, // F_D2
  {.34f, 1.5f, .4f, 1},  // F_D2SM
};

// Solve cubic-bezier: input p = progress along X (time, 0..1), return Y.
static inline float bezierY(float p, const Bez& b) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  float t = p;                                   // initial guess
  for (int i = 0; i < 8; i++) {                  // Newton-Raphson on X(t)=p
    float t1 = 1 - t;
    float x  = 3 * t1 * t1 * t * b.x1 + 3 * t1 * t * t * b.x2 + t * t * t;
    float dx = 3 * t1 * t1 * b.x1 + 6 * t1 * t * (b.x2 - b.x1) + 3 * t * t * (1 - b.x2);
    float err = x - p;
    if (err < 0) err = -err;
    if (err < 1e-4f) break;
    if (dx > -1e-6f && dx < 1e-6f) break;
    t -= (x - p) / dx;
    if (t < 0) t = 0; else if (t > 1) t = 1;
  }
  float t1 = 1 - t;
  return 3 * t1 * t1 * t * b.y1 + 3 * t1 * t * t * b.y2 + t * t * t;   // may exceed [0,1] = overshoot
}

// Apply easing index to a 0..1 segment progress.
static inline float easeSample(uint8_t e, float p) {
  if (e == EASE_LINEAR) return p;
  if (e == EASE_STEPS1) return (p >= 1.f) ? 1.f : 0.f;   // hold start until the segment end
  return bezierY(p, EASES[e]);
}
