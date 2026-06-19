// draw.h — the FACE look (github.com/g10rg10/state-hormones · face.html):
// round WHITE eyes + a WHITE smile / open mouth on a shaded dark sphere, with the
// full per-state choreography (face-keyframes.css) driven by the engine + tables.
// The orange glow halo is EXTERNAL on the device (the Uno Q LED ring), so the LCD
// draws only the sphere + the white face.
#pragma once
#include <Arduino.h>
#include <Arduino_GFX_Library.h>
#include <math.h>
#include "timelines.h"       // engine + the 13 state tables (StateDef/Pose/STATES)
#include "clockfont.h"       // Arial Rounded Bold 72pt (digits + colon) for A4_clock

extern Arduino_GFX* gfx;     // defined in panel_config.h

// ----- 480x480 design space -----
static const int SCREEN = 480;
static const int CXC = 240, CYC = 240;
static const float FACE_CY = 248.0f;   // face (eyes+mouth) centre

// ----- face geometry (face.css) -----
static const float EYE_DX = 74.0f;     // half-distance between the two eye centres
static const float EYE_CY = 198.0f;    // eye centre y
static const float EYE_R  = 33.0f;     // eye (dot) radius
static const float MOUTH_CY = 308.0f;  // mouth centre y
static const float SMILE_HALF = 80.0f; // smile endpoint half-width
static const float SMILE_TOP  = 28.0f; // endpoints above the mouth centre
static const float SMILE_DEEP = 50.0f; // control point below the mouth centre
static const float SMILE_STK  = 9.0f;  // half stroke width

// ----- colours -----
static inline uint16_t C565(uint8_t r, uint8_t g, uint8_t b) {
  return (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}
static const uint16_t COL_FACE = C565(255, 254, 251);   // --g0 warm white
static const uint16_t COL_BG   = C565(6, 10, 14);       // solid near-black orb

// ----- face-group transform: face-local (px,py) relative to face centre -> screen -----
struct XF { float cs, sn, sx, sy, tx, ty; };
static XF g_xf;
static void setFaceXF(const Pose& p) {
  float a = p.fRot * (float)M_PI / 180.0f;
  g_xf.cs = cosf(a); g_xf.sn = sinf(a);
  g_xf.sx = p.fSx; g_xf.sy = p.fSy;
  g_xf.tx = CXC + p.fTx; g_xf.ty = FACE_CY + p.fTy;
}
static inline void xf(float px, float py, int& ox, int& oy) {
  float x = px * g_xf.sx, y = py * g_xf.sy;
  ox = (int)(g_xf.tx + x * g_xf.cs - y * g_xf.sn + 0.5f);
  oy = (int)(g_xf.ty + x * g_xf.sn + y * g_xf.cs + 0.5f);
}

// ---------------------------------------------------------------- background
// Flat solid near-black. (A vertical sphere gradient bands badly on RGB565 — it
// reads as horizontal stripes — so we keep the orb a clean solid; the round bezel
// + the external LED halo give the volume.)
static void drawBackground() {
  gfx->fillScreen(COL_BG);
}

// ---------------------------------------------------------------- eyes (white circles)
static void drawFaceEyes(const Pose& p) {
  if (p.fOp <= 0.40f || p.dOp <= 0.40f) return;
  for (int side = 0; side < 2; side++) {
    bool L = (side == 0);
    float lx = (L ? -EYE_DX : EYE_DX) + p.eTx;
    float ly = (EYE_CY - FACE_CY) + p.eTy;
    int cx, cy; xf(lx, ly, cx, cy);
    float dSy = L ? p.dSyL : p.dSyR;
    int rx = (int)(EYE_R * g_xf.sx * p.eSc * p.dSc + 0.5f);
    int ry = (int)(EYE_R * g_xf.sy * p.eSc * p.dSc * dSy + 0.5f);
    if (rx < 1) rx = 1; if (ry < 1) ry = 1;
    gfx->fillEllipse(cx, cy, rx, ry, COL_FACE);
  }
}

// ---------------------------------------------------------------- mouth: smile arc
// quadratic Bézier P0->C->P1 sampled as overlapping round dots, in face space.
// depthMul scales the smile depth (thinking arc); skew shears it (wink).
static void drawSmile(const Pose& p, float depthMul) {
  if (p.fOp <= 0.40f || p.smOp <= 0.40f) return;
  float sc = p.smSc;
  float my = (MOUTH_CY - FACE_CY) + p.mTy;
  float mx = p.mTx;
  float halfw = SMILE_HALF * sc, top = SMILE_TOP * sc, deep = SMILE_DEEP * sc * depthMul;
  float sk = tanf(p.smSkew * (float)M_PI / 180.0f);
  float p0x = mx - halfw, p0y = my - top;
  float c_x = mx,         c_y = my + deep;
  float p1x = mx + halfw, p1y = my - top;
  int r = (int)(SMILE_STK * sc * g_xf.sy + 0.5f); if (r < 2) r = 2;
  for (float t = 0; t <= 1.0001f; t += 0.020f) {   // dense -> smooth continuous stroke
    float u = 1 - t;
    float bx = u * u * p0x + 2 * u * t * c_x + t * t * p1x;
    float by = u * u * p0y + 2 * u * t * c_y + t * t * p1y;
    bx += sk * (by - my);                       // skewY shear
    int ox, oy; xf(bx, by, ox, oy);
    gfx->fillCircle(ox, oy, r, COL_FACE);
  }
}

// the "confused" wavy mouth (C2): M + 3 humps, morph 0=smile .. 1=wavy
static void drawWavyMouth(const Pose& p, float wavy) {
  if (p.fOp <= 0.40f) return;
  float sc = p.smSc;
  float my = (MOUTH_CY - FACE_CY) + p.mTy, mx = p.mTx;
  float halfw = SMILE_HALF * sc;
  int r = (int)(SMILE_STK * sc * g_xf.sy + 0.5f); if (r < 2) r = 2;
  for (float t = 0; t <= 1.0001f; t += 0.020f) {
    float bx = mx - halfw + 2 * halfw * t;
    float smileY = my + (SMILE_DEEP * sc) * (1 - (2 * t - 1) * (2 * t - 1)) - SMILE_TOP * sc;
    float waveY  = my + 14 * sc * sinf(t * (float)M_PI * 3.0f) - 4 * sc;
    float by = smileY + (waveY - smileY) * wavy;
    int ox, oy; xf(bx, by, ox, oy);
    gfx->fillCircle(ox, oy, r, COL_FACE);
  }
}

// open "talking" mouth: a white oval (face.css .open = 56x64, scaled by opSx/opSy)
static void drawOpenMouth(const Pose& p) {
  if (p.fOp <= 0.40f || p.opOp <= 0.40f) return;
  float my = (MOUTH_CY - FACE_CY) + p.mTy, mx = p.mTx;
  int ox, oy; xf(mx, my, ox, oy);
  int rx = (int)(28 * p.opSx * g_xf.sx + 0.5f);
  int ry = (int)(32 * p.opSy * g_xf.sy + 0.5f);
  if (rx < 1) rx = 1; if (ry < 1) ry = 1;
  gfx->fillEllipse(ox, oy, rx, ry, COL_FACE);
}

// ---------------------------------------------------------------- clock (white)
// HH:MM in the real Arial Rounded Bold font (clockfont.h, generated from the macOS
// TTF) — the rounded numerals match the reference. HH and MM are printed white and
// centred; the colon is two dim-grey dots (as in the reference).
//
// Real time comes from the host over the link: setRealTime(hh,mm,ss) stamps the
// wall-clock seconds-of-day against millis(); getTime() advances it locally and
// the host re-syncs periodically so drift never accumulates. Until the first sync
// arrives we fall back to a placeholder counter so the clock isn't blank.
static bool     g_haveTime    = false;
static uint32_t g_timeBaseSec = 0;     // wall-clock seconds-of-day at the last sync
static uint32_t g_timeBaseMs  = 0;     // millis() at the last sync
void setRealTime(int hh, int mm, int ss) {
  g_timeBaseSec = ((uint32_t)hh * 3600 + (uint32_t)mm * 60 + (uint32_t)ss) % 86400UL;
  g_timeBaseMs  = millis();
  g_haveTime    = true;
}
static void getTime(uint8_t& hh, uint8_t& mm) {
  uint32_t secs;
  if (g_haveTime) secs = (g_timeBaseSec + (millis() - g_timeBaseMs) / 1000) % 86400UL;
  else            secs = (10UL * 3600 + 8UL * 60 + millis() / 1000) % 86400UL;  // pre-sync placeholder
  mm = (secs / 60) % 60; hh = (secs / 3600) % 24;
}
// print a string digit-by-digit with a fixed (tight) advance per character
static void printStr(const char* s, int x, int baseY, int step) {
  for (; *s; ++s) { gfx->setCursor(x, baseY); gfx->print(*s); x += step; }
}
static void drawClock() {
  const int step = 72, digW = 70, gap = 40, bearing = 6;   // tight digits, symmetric colon gap
  int hhW   = step + digW;                          // visible width of a 2-digit block (142)
  int leftX = CXC - (2 * hhW + gap) / 2;            // visible left edge of HH:MM
  int X0    = leftX - bearing;                      // HH cursor
  int Xmm   = X0 + hhW + gap;                       // MM cursor

  // Pre-sync: show a dim "--:--" rather than a confident-but-fake time. The clock
  // font has no '-' glyph, so each dash is a bar; cleared the instant the host's
  // first T<hh>:<mm> sync lands (g_haveTime).
  if (!g_haveTime) {
    uint16_t dim = C565(96, 104, 112);
    const int dashW = 42, dashH = 12, dr = 6;
    int cx[4] = { X0 + digW / 2, X0 + step + digW / 2, Xmm + digW / 2, Xmm + step + digW / 2 };
    for (int i = 0; i < 4; i++) gfx->fillRoundRect(cx[i] - dashW / 2, CYC - dashH / 2, dashW, dashH, dr, dim);
    gfx->fillCircle(CXC, CYC - 26, 11, dim);
    gfx->fillCircle(CXC, CYC + 26, 11, dim);
    return;
  }

  uint8_t hh, mm; getTime(hh, mm);
  char sh[4], sm[4];
  snprintf(sh, sizeof(sh), "%02u", hh);
  snprintf(sm, sizeof(sm), "%02u", mm);
  gfx->setFont(&Arial_Rounded_Bold72pt7b);
  gfx->setTextSize(1);
  gfx->setTextColor(COL_FACE);
  int16_t bx, by; uint16_t bw, bh;
  gfx->getTextBounds("8", 0, 0, &bx, &by, &bw, &bh);
  int baseY = CYC - by - (int)bh / 2;               // baseline -> glyph block centred at CYC
  printStr(sh, X0, baseY, step);
  printStr(sm, Xmm, baseY, step);
  gfx->setFont(NULL);
  // colon: two dots centred in the (symmetric) gap, blink WHITE <-> grey
  uint16_t cc = ((millis() % 1000) < 550) ? COL_FACE : C565(74, 80, 88);
  gfx->fillCircle(CXC, CYC - 26, 11, cc);
  gfx->fillCircle(CXC, CYC + 26, 11, cc);
}

// ---------------------------------------------------------------- check (white) C1
static void drawCheck(float drawn) {
  const float ax = 165, ay = 250, bx = 215, by = 300, cx = 320, cy = 192;
  const float L1 = 70.7f, L2 = 142.0f, T = L1 + L2;
  float prog = drawn * T; if (prog > T) prog = T; int r = 9;
  for (float s = 0; s <= L1 && s <= prog; s += 5) { float t = s / L1; gfx->fillCircle((int)(ax + (bx - ax) * t), (int)(ay + (by - ay) * t), r, COL_FACE); }
  if (prog > L1) for (float s = 0; s <= L2 && s <= (prog - L1); s += 5) { float t = s / L2; gfx->fillCircle((int)(bx + (cx - bx) * t), (int)(by + (cy - by) * t), r, COL_FACE); }
}

// ---------------------------------------------------------------- bell (white) D1
static void drawBell(float swing) {
  int cx = CXC + (int)(swing * 22), cy = 244;
  gfx->fillCircle(cx, cy - 60, 11, COL_FACE);
  gfx->fillCircle(cx, cy - 4, 54, COL_FACE);
  gfx->fillRoundRect(cx - 66, cy + 28, 132, 34, 15, COL_FACE);
  gfx->fillRoundRect(cx - 44, cy + 38, 88, 12, 6, COL_BG);
  gfx->fillCircle(cx + (int)(swing * 8), cy + 78, 12, COL_FACE);
}

// ---------------------------------------------------------------- notepad (B2)
static void drawNotepad() {
  int w = 122, h = 104, nx = CXC - w / 2, ny = 352;
  ny += (int)(-3.0f * sinf(fmodf(millis() / 2600.0f, 1.0f) * (float)M_PI));
  uint16_t white = C565(234, 246, 243), line = C565(70, 86, 96), ring = C565(255, 220, 166);
  gfx->fillRoundRect(nx, ny, w, h, 13, white);
  int ry[4] = {15, 39, 63, 84};
  for (int i = 0; i < 4; i++) gfx->fillRoundRect(nx + w - 6, ny + ry[i], 16, 7, 4, ring);
  int ly[4] = {22, 40, 58, 76}; float lw[4] = {0.60f, 0.70f, 0.52f, 0.46f};
  for (int i = 0; i < 4; i++) gfx->fillRoundRect(nx + 16, ny + ly[i], (int)(w * lw[i]), 5, 3, line);
}

// ---------------------------------------------------------------- external LED feedback
float g_lightLevel = 0.0f;
bool  g_lightCool  = false;
static void updateLight(int idx, uint32_t now, float sc) {
  switch (idx) {
    case 0:  g_lightLevel = 0; g_lightCool = false; break;
    case 4:  g_lightLevel = 0.30f + (sc - 1.0f) * 3.5f; g_lightCool = false; break;
    case 5: case 10: g_lightLevel = 0.55f; g_lightCool = true; break;
    default: { float pp = fmodf(now / 4600.0f, 1.0f); g_lightLevel = 0.18f + 0.22f * (0.5f - 0.5f * cosf(pp * 2 * (float)M_PI)); g_lightCool = false; }
  }
}

// ---------------------------------------------------------------- frame
static void renderFrame(int stateIdx, uint32_t now, uint32_t startMs) {
  const StateDef* s = &STATES[stateIdx];
  drawBackground();
  if (s->dotsOff) { g_lightLevel = 0; return; }                          // A1_off
  if (s->overlay == OV_CLOCK) { g_lightLevel = 0; drawClock(); return; } // A4_clock

  Pose p = evalState(s, now, startMs);
  setFaceXF(p);
  updateLight(stateIdx, now, p.fSx);

  // C1_confirm: face shrinks + eyes/smile fade → check ✓ → return
  if (stateIdx == 7) {
    drawFaceEyes(p); drawSmile(p, 1.0f);
    uint32_t dur = (uint32_t)(s->baseDurMs * g_spd); float pr = (float)(now - startMs) / dur; if (pr > 0.92f) pr = 0.92f;
    float drawn = pr < 0.12f ? 0.0f : (pr < 0.40f ? (pr - 0.12f) / 0.28f : 1.0f);
    if (pr >= 0.10f && pr < 0.86f) drawCheck(drawn);
    return;
  }
  // D1_reminder: face shrinks/trembles → bell rings → return
  if (stateIdx == 9) {
    drawFaceEyes(p); drawSmile(p, 1.0f);
    uint32_t dur = (uint32_t)(s->baseDurMs * g_spd); float pr = (float)(now - startMs) / dur; if (pr > 0.94f) pr = 0.94f;
    float swing = 0.0f;
    if (pr >= 0.08f && pr < 0.56f) { float u = (pr - 0.08f) / 0.48f; swing = cosf(u * (float)M_PI * 5.0f) * (1.0f - u); }
    if (pr >= 0.06f && pr < 0.88f) drawBell(swing);
    return;
  }

  drawFaceEyes(p);

  if (stateIdx == 6) {                                  // B3_thinking — wide morphing arc
    float wp = fmodf(now / (2400.0f * g_spd), 1.0f);
    drawSmile(p, 0.50f + 0.30f * sinf(wp * 2 * (float)M_PI));
  } else if (stateIdx == 8) {                           // C2_didnt_catch — smile → wavy → smile
    uint32_t dur = (uint32_t)(s->baseDurMs * g_spd); float pr = (float)(now - startMs) / dur;
    float wavy = (pr > 0.10f && pr < 0.46f) ? sinf((pr - 0.10f) / 0.36f * (float)M_PI) : 0.0f;
    drawWavyMouth(p, wavy);
  } else {
    drawSmile(p, 1.0f);                                 // smile (driven by smOp/smSc/skew)
    drawOpenMouth(p);                                   // open mouth (driven by opOp/opSx/opSy)
  }

  if (s->overlay == OV_NOTEPAD) drawNotepad();
}
