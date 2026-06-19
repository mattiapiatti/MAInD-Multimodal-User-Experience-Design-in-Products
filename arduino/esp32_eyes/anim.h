// anim.h — animation engine for the FACE design (round white eyes + smile mouth).
// 6-layer keyframe model faithful to face.html: the face group (whole face), the
// eyes group (gaze), each dot (blink/squint/widen/fade), the mouth container, the
// smile arc (scale/opacity/skew/arc-morph) and the open "talking" mouth.
// Per-segment cubic-bezier easing (CSS semantics). Data tables live in timelines.h.
#pragma once
#include <Arduino.h>
#include "easing.h"

// ---- animation channels: what a track drives ----
enum {
  CH_F_SX = 0, CH_F_SY, CH_F_SC, CH_F_TX, CH_F_TY, CH_F_ROT, CH_F_OP,  // .face group (SC = uniform scale)
  CH_E_TX, CH_E_TY, CH_E_SC,                                  // .eyes group (gaze drift / scale)
  CH_DSY, CH_DSYL, CH_DSYR, CH_DSC, CH_DOP,                   // .dot scaleY both / L / R, uniform scale, opacity
  CH_M_TX, CH_M_TY,                                           // .mouth container translate
  CH_SM_SC, CH_SM_OP, CH_SM_SKEW, CH_SM_ARC,                  // .smile scale / opacity / skewY / arc-morph
  CH_OP_OP, CH_OP_SX, CH_OP_SY,                               // .open opacity / scaleX / scaleY
};

enum { MODE_STATIC = 0, MODE_LOOP, MODE_ONESHOT, MODE_DISPLAY };
enum { OV_NONE = 0, OV_CLOCK, OV_NOTEPAD };

struct Kf  { float pct; float v; };                  // keyframe: percent 0..100 -> value
struct Track {
  uint8_t  ch;       // CH_*
  uint8_t  ease;     // EASE_*  (this track's timing-function)
  uint8_t  nKf;
  uint32_t durMs;    // this track's OWN period (loops free-run on it)
  const Kf* kf;
};
struct StateDef {
  const char* id;
  uint8_t  mode;          // MODE_*
  uint32_t baseDurMs;     // cycle length used for the one-shot action window
  float    actionEndPct;  // one-shot: play 0..this, then hold / chain
  uint8_t  chainTo;       // state index to enter after a one-shot (0xFF = stay)
  uint8_t  nTracks;
  const Track* tracks;
  uint8_t  overlay;       // OV_*
  bool     dotsOff;       // A1 = dark screen
};

// resolved transform for one frame
struct Pose {
  float fSx = 1, fSy = 1, fTx = 0, fTy = 0, fRot = 0, fOp = 1;   // face group
  float eTx = 0, eTy = 0, eSc = 1;                                // eyes group
  float dSyL = 1, dSyR = 1, dSc = 1, dOp = 1;                     // dots
  float mTx = 0, mTy = 0;                                         // mouth container
  float smSc = 1, smOp = 1, smSkew = 0, smArc = 1;               // smile
  float opOp = 0, opSx = 1, opSy = 1;                            // open mouth
};

extern float g_spd;   // global tempo multiplier (1.0). Defined in the .ino.

// playhead in percent (0..100) for a track, given mode.
static inline float trackPlayhead(uint32_t now, uint32_t startMs, uint32_t durMs,
                                  uint8_t mode, float actionEndPct) {
  uint32_t durScaled = (uint32_t)(durMs * g_spd);
  if (durScaled == 0) return 0;
  uint32_t el = now - startMs;
  if (mode == MODE_LOOP) {
    return fmodf((float)el / durScaled, 1.0f) * 100.0f;
  }
  // one-shot: advance to actionEndPct, then hold there
  float p = (float)el / durScaled * 100.0f;
  if (p > actionEndPct) p = actionEndPct;
  return p;
}

// sample one track at a given percent, with per-segment easing (CSS semantics).
static inline float sampleTrack(const Track* t, float pct) {
  if (t->nKf == 1) return t->kf[0].v;
  int i = 0;
  while (i < t->nKf - 1 && t->kf[i + 1].pct <= pct) i++;
  const Kf& a = t->kf[i];
  const Kf& b = t->kf[(i + 1 < t->nKf) ? i + 1 : i];
  if (b.pct <= a.pct) return b.v;
  float local = (pct - a.pct) / (b.pct - a.pct);
  if (local < 0) local = 0; else if (local > 1) local = 1;
  float e = easeSample(t->ease, local);
  return a.v + (b.v - a.v) * e;
}

// evaluate a whole state into a Pose.
static inline Pose evalState(const StateDef* s, uint32_t now, uint32_t startMs) {
  Pose p;
  for (uint8_t k = 0; k < s->nTracks; k++) {
    const Track* t = &s->tracks[k];
    float pct = trackPlayhead(now, startMs, t->durMs, s->mode, s->actionEndPct);
    float v   = sampleTrack(t, pct);
    switch (t->ch) {
      case CH_F_SX:    p.fSx = v; break;
      case CH_F_SY:    p.fSy = v; break;
      case CH_F_SC:    p.fSx = v; p.fSy = v; break;
      case CH_F_TX:    p.fTx = v; break;
      case CH_F_TY:    p.fTy = v; break;
      case CH_F_ROT:   p.fRot = v; break;
      case CH_F_OP:    p.fOp = v; break;
      case CH_E_TX:    p.eTx = v; break;
      case CH_E_TY:    p.eTy = v; break;
      case CH_E_SC:    p.eSc = v; break;
      case CH_DSY:     p.dSyL = v; p.dSyR = v; break;
      case CH_DSYL:    p.dSyL = v; break;
      case CH_DSYR:    p.dSyR = v; break;
      case CH_DSC:     p.dSc = v; break;
      case CH_DOP:     p.dOp = v; break;
      case CH_M_TX:    p.mTx = v; break;
      case CH_M_TY:    p.mTy = v; break;
      case CH_SM_SC:   p.smSc = v; break;
      case CH_SM_OP:   p.smOp = v; break;
      case CH_SM_SKEW: p.smSkew = v; break;
      case CH_SM_ARC:  p.smArc = v; break;
      case CH_OP_OP:   p.opOp = v; break;
      case CH_OP_SX:   p.opSx = v; break;
      case CH_OP_SY:   p.opSy = v; break;
    }
  }
  return p;
}

// is a one-shot past its action window? (used by the lifecycle / host chaining)
static inline bool oneShotDone(const StateDef* s, uint32_t now, uint32_t startMs) {
  if (s->mode != MODE_ONESHOT) return false;
  uint32_t durScaled = (uint32_t)(s->baseDurMs * g_spd);
  if (durScaled == 0) return true;
  float p = (float)(now - startMs) / durScaled * 100.0f;
  return p >= s->actionEndPct;
}
