// palette.h — colors and RGB565 helpers for the EMO eyes firmware.
// Colors are kept in 8-bit RGB (faithful to the CSS hex) and packed to 565 only
// at draw time, so gradients / glow / alpha all blend in 8-bit precision.
#pragma once
#include <Arduino.h>

struct RGB { uint8_t r, g, b; };

// ---- EMO cyan tint (states.css  body.tint-cyan) ----
static const RGB G0   = {202, 255, 249};   // #cafff9  bright core / highlight
static const RGB G1   = { 94, 233, 223};   // #5ee9df
static const RGB G2   = { 37, 212, 203};   // #25d4cb
static const RGB G3   = { 18, 177, 170};   // #12b1aa  deep edge
static const RGB ISH  = {  2,  70,  68};   // inner bottom shadow rgb
static const RGB GLOW = { 60, 233, 222};   // outer bloom rgb
static const RGB WHT  = {255, 255, 255};   // gloss highlight
// stage background (states.css radial vignette, approximated solid near-black)
static const RGB BG   = {  6,  12,  15};

static inline uint16_t pack565(const RGB& c) {
  return (uint16_t)((c.r & 0xF8) << 8) | ((c.g & 0xFC) << 3) | (c.b >> 3);
}
static inline uint8_t  lerp8(uint8_t a, uint8_t b, float t) {
  int v = (int)(a + (b - a) * t + 0.5f);
  return (uint8_t)(v < 0 ? 0 : v > 255 ? 255 : v);
}
static inline RGB lerpRGB(const RGB& a, const RGB& b, float t) {
  return { lerp8(a.r, b.r, t), lerp8(a.g, b.g, t), lerp8(a.b, b.b, t) };
}
static inline RGB mulRGB(const RGB& a, float k) {     // multiply, for the CSS brightness() filter
  int r = (int)(a.r * k + .5f), g = (int)(a.g * k + .5f), b = (int)(a.b * k + .5f);
  return { (uint8_t)(r > 255 ? 255 : r), (uint8_t)(g > 255 ? 255 : g), (uint8_t)(b > 255 ? 255 : b) };
}

// 4-stop vertical gradient of the eye body (radial in CSS, approximated vertical:
// the radial focus at 50%/22% is dominated by its vertical axis here).
// fy = 0 at the top of the eye, 1 at the bottom.
static inline RGB eyeGradient(float fy) {
  if (fy <= 0.30f) return lerpRGB(G0, G1, fy / 0.30f);
  if (fy <= 0.66f) return lerpRGB(G1, G2, (fy - 0.30f) / 0.36f);
  return lerpRGB(G2, G3, (fy - 0.66f) / 0.34f);
}
