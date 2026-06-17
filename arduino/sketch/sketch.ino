#include <Arduino_RouterBridge.h>
#include <Arduino_LED_Matrix.h>
#include "Adafruit_NeoPixel.h"

// ---- NeoPixel ring (24 LEDs on pin 6) ----------------------------------------
#define NEO_PIN   6
#define NEO_COUNT 24

Adafruit_NeoPixel strip(NEO_COUNT, NEO_PIN, NEO_GRB + NEO_KHZ800);

// Light states
#define NEO_IDLE         0   // slow breathe, waiting for wake word
#define NEO_WAKE         1   // fade-in neutral, settling to floor
#define NEO_SPEAK        2   // yellow — companion talking
#define NEO_LISTEN       3   // green  — waiting for user
#define NEO_CONFIRM      4   // single brightness pulse
#define NEO_USER_TALKING 5   // red    — user speaking
#define NEO_THINKING     6   // purple — AI processing

// Base colors per state at full brightness
static const float NEO_CR[] = {200, 220, 220,   0, 255, 200, 140};
static const float NEO_CG[] = {165, 200, 175, 200, 240,   0,   0};
static const float NEO_CB[] = {130, 175,   0,   0, 190,   0, 220};
//                          IDLE  WAKE  SPK  LST  CNF  TLK  THK

int   neoState      = NEO_IDLE;
float neoBri        = 0.20f;
float neoBlendR     = 200, neoBlendG = 165, neoBlendB = 130;
float breathPhase   = 0.0f;
float confirmBri    = 0.0f;
int   confirmReturn = NEO_LISTEN;
unsigned long lastNeoMs = 0;

bool wakeWordActive = false;
bool voiceActive    = false;

int   audioLevel   = 0;
float smoothLevel  = 0.0;
float phase        = 0.0;
float scanPos      = 0.0;
float scanDir      = 1.0;

unsigned long lastAudioLevelUpdate = 0;
unsigned long lastMatrixUpdate     = 0;

ArduinoLEDMatrix matrix;
uint8_t matrixFrame[8 * 13];

int led3_r = 0, led3_g = 0, led3_b = 0;
int led4_r = 0, led4_g = 0, led4_b = 0;

// ---- NeoPixel RPC + render ------------------------------------------------

void setLightState(int state) {
  if (state == NEO_CONFIRM) {
    confirmBri    = 1.0f;
    confirmReturn = (neoState != NEO_CONFIRM) ? neoState : confirmReturn;
    neoState      = NEO_CONFIRM;
    return;
  }
  neoState = state;
}

void renderNeopixel() {
  unsigned long now = millis();
  float dt = constrain((float)(now - lastNeoMs) / 1000.0f, 0.001f, 0.1f);
  lastNeoMs = now;

  float tR, tG, tB;

  if (neoState == NEO_CONFIRM) {
    tR = NEO_CR[NEO_CONFIRM]; tG = NEO_CG[NEO_CONFIRM]; tB = NEO_CB[NEO_CONFIRM];
    confirmBri = max(0.0f, confirmBri - dt * 2.5f);
    neoBri     = 0.55f + 0.45f * confirmBri;
    if (confirmBri <= 0.0f) neoState = confirmReturn;
  } else {
    tR = NEO_CR[neoState]; tG = NEO_CG[neoState]; tB = NEO_CB[neoState];
    switch (neoState) {
      case NEO_IDLE:
        breathPhase += dt * (TWO_PI / 4.5f);
        neoBri = 0.18f + 0.12f * (0.5f + 0.5f * sinf(breathPhase));
        break;
      case NEO_WAKE:
        neoBri += (0.55f - neoBri) * constrain(dt * 4.0f, 0.0f, 1.0f);
        break;
      case NEO_SPEAK:
      case NEO_LISTEN:
      case NEO_USER_TALKING:
      case NEO_THINKING:
        neoBri = 0.80f;
        break;
    }
  }

  neoBri = constrain(neoBri, 0.0f, 1.0f);

  // Smooth color blend toward target (~200ms)
  float cb   = constrain(dt * 5.0f, 0.0f, 1.0f);
  neoBlendR += (tR - neoBlendR) * cb;
  neoBlendG += (tG - neoBlendG) * cb;
  neoBlendB += (tB - neoBlendB) * cb;

  uint8_t r = (uint8_t)(neoBlendR * neoBri);
  uint8_t g = (uint8_t)(neoBlendG * neoBri);
  uint8_t b = (uint8_t)(neoBlendB * neoBri);
  for (int i = 0; i < NEO_COUNT; i++)
    strip.setPixelColor(i, strip.Color(r, g, b));
  strip.show();
}

// ---- RPC handlers ----------------------------------------------------------

void setLedColor(int led_id, int r, int g, int b) {
  r = constrain(r, 0, 255);
  g = constrain(g, 0, 255);
  b = constrain(b, 0, 255);

  if (led_id == 3) {
    analogWrite(LED3_R, r);
    analogWrite(LED3_G, g);
    analogWrite(LED3_B, b);
    led3_r = r; led3_g = g; led3_b = b;
  } else if (led_id == 4) {
    digitalWrite(LED4_R, r > 0 ? LOW : HIGH);
    digitalWrite(LED4_G, g > 0 ? LOW : HIGH);
    digitalWrite(LED4_B, b > 0 ? LOW : HIGH);
    led4_r = r > 0 ? 255 : 0;
    led4_g = g > 0 ? 255 : 0;
    led4_b = b > 0 ? 255 : 0;
  }
}

void setWakeWordState(bool active) { wakeWordActive = active; }

void setVoiceState(bool active) {
  if (active && !voiceActive) { scanPos = -5.0; scanDir = 1.0; }
  voiceActive = active;
}

void setAudioLevel(int level) {
  audioLevel = constrain(level, 0, 100);
  lastAudioLevelUpdate = millis();
}

// ---- LED matrix helpers ----------------------------------------------------

uint8_t scanBrightness(int col, float head, float tail) {
  float dist = fabs((float)col - head);
  if (dist > tail) return 0;
  float t = 1.0 - dist / tail;
  t = t * t * t;
  return (uint8_t)(t * 7.0 + 0.5);
}

void renderMatrix() {
  memset(matrixFrame, 0, sizeof(matrixFrame));
  // Hold the dim line briefly so wake-to-voice does not flash blank.
  static unsigned long blank_since = 0;

  if (!voiceActive && !wakeWordActive) {
    if (blank_since == 0) blank_since = millis();
    if (millis() - blank_since < 500) {
      for (int c = 0; c < 13; c++) { matrixFrame[3*13+c] = 1; matrixFrame[4*13+c] = 1; }
      matrix.draw(matrixFrame);
    } else {
      blank_since = 0;
      matrix.clear();
    }
    return;
  }
  blank_since = 0;

  // Wake word on, no session: dim center track.
  if (!voiceActive) {
    for (int c = 0; c < 13; c++) { matrixFrame[3*13+c] = 1; matrixFrame[4*13+c] = 1; }
    matrix.draw(matrixFrame);
    return;
  }

  // Voice session active
  float norm = smoothLevel / 100.0;

  // Advance the scanner.
  float speed = 0.3 + norm * 0.45;
  scanPos += scanDir * speed;
  if (scanPos >= 12.0) { scanPos = 12.0; scanDir = -1.0; }
  if (scanPos <=  0.0 && scanDir < 0) { scanPos = 0.0; scanDir = 1.0; }

  // Dim centre track baseline
  for (int c = 0; c < 13; c++) { matrixFrame[3*13+c] = 1; matrixFrame[4*13+c] = 1; }

  if (smoothLevel < 0.5) {
    // Idle: scanner only.
    for (int c = 0; c < 13; c++) {
      uint8_t b = scanBrightness(c, scanPos, 5.0);
      if (b > 0) {
        matrixFrame[3*13+c] = max(matrixFrame[3*13+c], b);
        matrixFrame[4*13+c] = max(matrixFrame[4*13+c], b);
        if (b > 2) { matrixFrame[2*13+c] = b/3; matrixFrame[5*13+c] = b/3; }
      }
    }
    matrix.draw(matrixFrame);
    return;
  }

  // Assistant speaking: audio wave.
  float maxH = norm * 3.5;
  for (int c = 0; c < 13; c++) {
    float w = sin(phase*1.2 + c*0.55)*0.5 + sin(phase*2.1 + c*0.95)*0.3 + sin(phase*0.7 + c*0.3)*0.2;
    int h = constrain((int)(fabs(w) * maxH + 1.0), 1, 4);
    int bri = 1 + (int)(norm * 4.0);
    for (int r = 4-h; r <= 3+h; r++) {
      float fall = fabs(r - 3.5) / max(1.0f, (float)h);
      int rb = constrain((int)(bri * (1.0 - fall*0.5)), 1, 5);
      if (rb > matrixFrame[r*13+c]) matrixFrame[r*13+c] = rb;
    }
  }

  // Scanner overlay.
  float tail = 4.0 + norm * 4.0;
  for (int c = 0; c < 13; c++) {
    uint8_t b = scanBrightness(c, scanPos, tail);
    if (b < 2) continue;
    for (int r = 0; r < 8; r++) {
      if (matrixFrame[r*13+c] > 0 || r == 3 || r == 4) {
        int nb = constrain((int)matrixFrame[r*13+c] + b/2, 0, 7);
        if (nb > matrixFrame[r*13+c]) matrixFrame[r*13+c] = nb;
      }
    }
  }
  matrix.draw(matrixFrame);
}

// ---- Arduino lifecycle -----------------------------------------------------

void setup() {
  analogWrite(LED3_R, 0);
  analogWrite(LED3_G, 0);
  analogWrite(LED3_B, 0);
  pinMode(LED4_R, OUTPUT);
  pinMode(LED4_G, OUTPUT);
  pinMode(LED4_B, OUTPUT);
  digitalWrite(LED4_R, HIGH);
  digitalWrite(LED4_G, HIGH);
  digitalWrite(LED4_B, HIGH);

  matrix.begin();
  matrix.setGrayscaleBits(3);
  matrix.clear();

  strip.begin();
  strip.clear();
  strip.show();
  lastNeoMs = millis();

  Bridge.begin();
  Bridge.provide("set_color",           setLedColor);
  Bridge.provide("set_wake_word_state", setWakeWordState);
  Bridge.provide("set_voice_state",     setVoiceState);
  Bridge.provide("set_audio_level",     setAudioLevel);
  Bridge.provide("set_light_state",     setLightState);
}

void loop() {
  unsigned long now = millis();

  // Decay audio level if no update for 150 ms
  if (audioLevel > 0 && now - lastAudioLevelUpdate > 150)
    audioLevel = max(0, audioLevel - 8);

  // Smooth interpolation
  float target = (float)audioLevel;
  if (target > smoothLevel) smoothLevel += (target - smoothLevel) * 0.8;
  else                      smoothLevel += (target - smoothLevel) * 0.22;
  if (smoothLevel < 0.5 && audioLevel == 0) smoothLevel = 0;

  float phaseSpeed = 0.015 + (smoothLevel / 100.0) * 0.18;
  phase += phaseSpeed;

  // Render at ~25 FPS
  if (now - lastMatrixUpdate >= 40) {
    renderMatrix();
    renderNeopixel();
    lastMatrixUpdate = now;
  }

  delay(5);
}
