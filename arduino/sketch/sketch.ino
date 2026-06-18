#include <Arduino_RouterBridge.h>
#include <Arduino_LED_Matrix.h>
#include "Adafruit_NeoPixel.h"

// ---- NeoPixel ring (24 LEDs on pin 6) ----------------------------------------
#define NEO_PIN   6
#define NEO_COUNT 24

Adafruit_NeoPixel strip(NEO_COUNT, NEO_PIN, NEO_GRB + NEO_KHZ800);

// ---- Activation button -------------------------------------------------------
// A Cherry MX switch (2 pins = a plain momentary contact): one pin to D2, the
// other to GND. INPUT_PULLUP means the pin reads HIGH when released, LOW when
// pressed. We debounce it and expose the HELD state; the Linux side polls that
// (only while idle) — held = listening ON + halo on, released = OFF (hold to talk).
#define BUTTON_PIN 2
#define BTN_DEBOUNCE_MS 30
int  btnStable     = HIGH;   // debounced state (HIGH = released, LOW = held)
int  btnLastRead   = HIGH;
unsigned long btnLastChangeMs = 0;

// ---- States (github.com/g10rg10/state-hormones — Maind X spec) ---------------
// The eyes/faces will live on a SEPARATE ESP32 over UART. Here the NeoPixel ring
// is only the EXTERNAL light halo (Maind X §0): every state maps to a light
// "mode" = a brightness LEVEL + a warm↔cool TINT, with its own envelope.
enum {
  S_A1_OFF = 0, S_A2_WAKE, S_A3_IDLE, S_A4_CLOCK,
  S_B1_SPEAKING, S_B2_LISTENING, S_B3_THINKING,
  S_C1_CONFIRM, S_C2_DIDNT_CATCH, S_D1_REMINDER, S_D2_WAKEWORD,
  S_E2_QUIRK, S_E4_WINK
};

// Light modes (Maind X §0 · Light states). Every mode is a FLAT colour with NO
// continuous animation: strip.show() masks IRQs ~0.7ms and drops serial RPC bytes,
// so it must run ONLY when the colour changes (a state transition), never on a
// timer — otherwise a wake/state RPC arriving mid-show loses a byte and freezes the
// MCU bridge. The "alive" breathing belongs on the ESP32 (RMT, no IRQ masking).
enum { L_OFF = 0, L_IDLE, L_SPEAK, L_LISTEN, L_THINK };

static int lightModeForState(int s) {
  switch (s) {
    case S_A1_OFF:
    case S_A4_CLOCK:        return L_OFF;
    case S_B1_SPEAKING:
    case S_C1_CONFIRM:                           // brief ack → speak colour
    case S_C2_DIDNT_CATCH:
    case S_D1_REMINDER:    return L_SPEAK;       // flat warm
    case S_B2_LISTENING:
    case S_D2_WAKEWORD:    return L_LISTEN;      // flat cool "your turn"
    case S_B3_THINKING:    return L_THINK;       // flat dim
    case S_A2_WAKE:                              // power-on → settle to idle glow
    case S_A3_IDLE:
    case S_E2_QUIRK:
    case S_E4_WINK:
    default:               return L_IDLE;        // static dim warm glow
  }
}

// Warm/cool tint anchors for the halo (lerped by tCool 0..1).
static const float WARM_R = 255, WARM_G = 168, WARM_B = 82;
static const float COOL_R = 96,  COOL_G = 196, COOL_B = 255;

int   curState   = S_A3_IDLE;
int   lightMode  = L_IDLE;
unsigned long lastNeoRenderMs = 0;  // ring render cadence
// strip.show() masks IRQs ~0.7ms and would drop a serial RPC byte if it ran while
// one is arriving. Every RPC handler stamps lastRpcMs; the ring only show()s once
// the bridge has been QUIET for NEO_QUIET_MS — i.e. in the gap between messages,
// so a show() can never overlap an in-flight byte. No freeze, no hardware change.
volatile unsigned long lastRpcMs = 0;
const unsigned long NEO_QUIET_MS = 30;

// These are written from the bridge RPC context and read in loop() — volatile so
// loop() never reads a stale cached copy.
volatile bool wakeWordActive = false;
volatile bool voiceActive    = false;
volatile int  audioLevel     = 0;
volatile unsigned long lastAudioLevelUpdate = 0;
volatile bool scanResetPending = false;  // setVoiceState requests a scanner reset

float smoothLevel  = 0.0;
float phase        = 0.0;
float scanPos      = 0.0;   // owned solely by renderMatrix() (loop context)
float scanDir      = 1.0;

unsigned long lastMatrixUpdate     = 0;

ArduinoLEDMatrix matrix;
uint8_t matrixFrame[8 * 13];

int led3_r = 0, led3_g = 0, led3_b = 0;
int led4_r = 0, led4_g = 0, led4_b = 0;

// ---- NeoPixel RPC + render ------------------------------------------------

void setLightState(int state) {
  lastRpcMs = millis();
  if (state == curState) return;
  curState  = state;
  lightMode = lightModeForState(state);
}

void renderNeopixel() {
  // Flat colour per mode (no animation). Pushed to the LEDs ONLY when the colour
  // changed, so strip.show() (IRQs off ~0.7ms) fires ~once per state transition and
  // never overlaps an in-flight serial RPC → no dropped bytes, no bridge freeze.
  float tLvl, tCool;
  switch (lightMode) {
    case L_OFF:    tLvl = 0.00f; tCool = 0.20f; break;
    case L_SPEAK:  tLvl = 0.80f; tCool = 0.06f; break;  // warm
    case L_LISTEN: tLvl = 0.78f; tCool = 0.95f; break;  // cool "your turn"
    case L_THINK:  tLvl = 0.34f; tCool = 0.62f; break;  // dim
    case L_IDLE:
    default:       tLvl = 0.22f; tCool = 0.20f; break;  // static dim warm glow
  }

  uint8_t r = (uint8_t)constrain((WARM_R + (COOL_R - WARM_R) * tCool) * tLvl, 0.0f, 255.0f);
  uint8_t g = (uint8_t)constrain((WARM_G + (COOL_G - WARM_G) * tCool) * tLvl, 0.0f, 255.0f);
  uint8_t b = (uint8_t)constrain((WARM_B + (COOL_B - WARM_B) * tCool) * tLvl, 0.0f, 255.0f);

  // Only push when the colour changed AND the bridge has been quiet for a beat, so
  // show() (IRQs off) lands in the gap between RPCs and can't corrupt one. If the
  // line is busy we just skip this tick and retry on the next one (~20ms later).
  static uint8_t lastR = 1, lastG = 1, lastB = 1;
  if ((r != lastR || g != lastG || b != lastB) && (millis() - lastRpcMs >= NEO_QUIET_MS)) {
    for (int i = 0; i < NEO_COUNT; i++) strip.setPixelColor(i, strip.Color(r, g, b));
    strip.show();
    lastR = r; lastG = g; lastB = b;
  }
}

// ---- RPC handlers ----------------------------------------------------------

void setLedColor(int led_id, int r, int g, int b) {
  lastRpcMs = millis();
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

void setWakeWordState(bool active) { lastRpcMs = millis(); wakeWordActive = active; }

void setVoiceState(bool active) {
  lastRpcMs = millis();
  // Don't touch scanPos/scanDir here (loop() read-modify-writes them) — just flag
  // the reset; renderMatrix() applies it. Single-writer = no lost-update race.
  if (active && !voiceActive) scanResetPending = true;
  voiceActive = active;
}

void setAudioLevel(int level) {
  lastRpcMs = millis();
  audioLevel = constrain(level, 0, 100);
  lastAudioLevelUpdate = millis();
}

// Debounce the button each loop tick; btnStable holds the settled level.
void pollButton() {
  int r = digitalRead(BUTTON_PIN);
  if (r != btnLastRead) { btnLastRead = r; btnLastChangeMs = millis(); }
  if (millis() - btnLastChangeMs >= BTN_DEBOUNCE_MS) btnStable = r;
}

// Host polls this (while idle): 1 = held (listen), 0 = released (off).
long getButton() { lastRpcMs = millis(); return (long)(btnStable == LOW ? 1 : 0); }

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
  if (scanResetPending) { scanPos = -5.0; scanDir = 1.0; scanResetPending = false; }
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

  pinMode(BUTTON_PIN, INPUT_PULLUP);  // Cherry switch: D2 ↔ GND, pressed = LOW

  Bridge.begin();
  Bridge.provide("set_color",           setLedColor);
  Bridge.provide("set_wake_word_state", setWakeWordState);
  Bridge.provide("set_voice_state",     setVoiceState);
  Bridge.provide("set_audio_level",     setAudioLevel);
  Bridge.provide("set_light_state",     setLightState);
  Bridge.provide("get_button",          getButton);
}

void loop() {
  unsigned long now = millis();

  pollButton();  // debounce + count presses (Linux polls the count when idle)

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

  // Matrix at ~25 FPS (its draw() is ISR/timer-backed — it does NOT mask IRQs).
  if (now - lastMatrixUpdate >= 40) {
    renderMatrix();
    lastMatrixUpdate = now;
  }

  // Poll the ring often (~50 Hz) so it can grab a quiet gap quickly, but it only
  // actually drives the LEDs (show(), IRQs off) on a colour change during quiet.
  if (now - lastNeoRenderMs >= 20) {
    renderNeopixel();
    lastNeoRenderMs = now;
  }

  delay(5);
}
