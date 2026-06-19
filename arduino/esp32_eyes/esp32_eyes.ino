// esp32_eyes.ino — EMO eyes + tall clock for the health companion, on the
// Waveshare ESP32-S3-Touch-LCD-2.8C (2.8" ROUND, 480x480, ST7701 RGB + Arduino_GFX).
//
// The 13 faces are the Maind X states (github.com/g10rg10/state-hormones) — the
// SAME state set the rest of the system uses: the Linux core's set_light_state()
// indices and arduino/sketch.ino's S_* enum line up 1:1 with STATES[] here:
//   0 A1_off  1 A2_wake  2 A3_idle  3 A4_clock  4 B1_speaking  5 B2_listening
//   6 B3_thinking  7 C1_confirm  8 C2_didnt_catch  9 D1_reminder  10 D2_wakeword
//   11 E2_quirk  12 E4_wink
//
// Two ways to drive it:
//   1. AUTO lifecycle (default): power on -> Wake -> Idle (face) -> Clock after
//      5 min idle -> (demo auto-wake) -> Listening -> face.
//   2. UART (host / Linux core): one line over USB Serial @115200 —
//        "<n>"      pin state index n (0..12)        e.g. "5" -> B2_listening
//        "wake"     play the wake-word animation -> listening
//        "resume"/"auto"  hand control back to the lifecycle
//        "next"     advance to the next state
//        "spd <f>"  global tempo (1.0 = as authored)
//
// ~30 fps loop, all timelines wall-clock driven (millis) with per-segment
// cubic-bezier easing. The RGB panel auto-flushes (draws land directly in the
// scanned-out PSRAM framebuffer), so there is NO manual flush.
#include "palette.h"
#include "easing.h"
#include "anim.h"
#include "timelines.h"
#include "panel_config.h"     // defines gfx (ST7701 RGB; VERIFY against your board)
#include "draw.h"

float g_spd = 1.0f;            // global tempo (the web "Tempo" slider); 1.0 = as authored

// ---- device lifecycle ----
enum { PH_WAKE, PH_IDLE, PH_CLOCK, PH_WAKEWORD, PH_LISTEN };
// state indices into STATES[] used by the lifecycle:
enum { S_A2_WAKE = 1, S_A3_IDLE = 2, S_A4_CLOCK = 3, S_B2_LISTEN = 5, S_D2_WAKEWORD = 10 };

static int      g_phase = PH_WAKE;
static uint32_t g_phaseStart = 0;
static int      g_override = -1;       // host pins a single state (-1 = run the lifecycle)
static uint32_t g_overrideStart = 0;
static int      g_cycleIdx = -1;
static uint32_t lastFrame = 0;

const uint32_t IDLE_TO_CLOCK_MS  = 5UL * 60 * 1000;  // 5 min of inactivity -> clock
const uint32_t CLOCK_AUTOWAKE_MS = 15000;            // demo: auto-wake (no mic yet); set 0 for real mic

static void setPhase(int p) { g_phase = p; g_phaseStart = millis(); }

// ---- hooks for the mic / host ----
void wakeWord()         { g_override = -1; setPhase(PH_WAKEWORD); }   // "Hey Kai"
void resumeLifecycle()  { g_override = -1; setPhase(PH_IDLE); }
void setStateIdx(int i) {
  if (i >= 0 && i < NUM_STATES) {
    g_override = i; g_overrideStart = millis(); g_cycleIdx = i;
    Serial.printf("state -> %d %s\n", i, STATES[i].id);
  }
}

// ---- UART command parser (one line per command) ----
static void handleSerial() {
  static char buf[32];
  static uint8_t len = 0;
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (len == 0) continue;
      buf[len] = 0; len = 0;
      if      (!strcmp(buf, "wake"))                            wakeWord();
      else if (!strcmp(buf, "resume") || !strcmp(buf, "auto"))  resumeLifecycle();
      else if (!strcmp(buf, "next"))                            setStateIdx((g_cycleIdx + 1) % NUM_STATES);
      else if (!strncmp(buf, "spd", 3))                         g_spd = atof(buf + 3);
      else if (buf[0] >= '0' && buf[0] <= '9')                  setStateIdx(atoi(buf));
    } else if (len < sizeof(buf) - 1) {
      buf[len++] = c;
    }
  }
}

void setup() {
  Serial.begin(115200);
  panelInit();
  gfx->fillScreen(pack565(BG));
  panelFlush();
  setPhase(PH_WAKE);
  Serial.println("esp32_eyes (2.8C round) ready — send a state index 0..12, or 'wake'/'resume'");
}

void loop() {
  handleSerial();

  uint32_t now = millis();
  int idx; uint32_t start;

  if (g_override >= 0) {                 // host pinned a single state
    idx = g_override; start = g_overrideStart;
  } else {
    switch (g_phase) {
      case PH_WAKE:                                  // A2_wake -> idle
        idx = S_A2_WAKE; start = g_phaseStart;
        if (oneShotDone(&STATES[S_A2_WAKE], now, g_phaseStart)) setPhase(PH_IDLE);
        break;
      case PH_IDLE:                                  // A3_idle -> clock after 5 min idle
        idx = S_A3_IDLE; start = g_phaseStart;
        if (now - g_phaseStart >= IDLE_TO_CLOCK_MS) setPhase(PH_CLOCK);
        break;
      case PH_CLOCK:                                 // A4_clock -> (wake word) face
        idx = S_A4_CLOCK; start = g_phaseStart;
        if (CLOCK_AUTOWAKE_MS && now - g_phaseStart >= CLOCK_AUTOWAKE_MS) wakeWord();
        break;
      case PH_WAKEWORD:                              // D2_wakeword -> listening
        idx = S_D2_WAKEWORD; start = g_phaseStart;
        if (oneShotDone(&STATES[S_D2_WAKEWORD], now, g_phaseStart)) setPhase(PH_LISTEN);
        break;
      default:                                       // PH_LISTEN: B2_listening -> face
        idx = S_B2_LISTEN; start = g_phaseStart;
        if (now - g_phaseStart >= 3000) setPhase(PH_IDLE);
        break;
    }
  }

  renderFrame(idx, now, start);
  panelFlush();                                 // push the finished frame to the panel

  uint32_t dt = millis() - lastFrame;           // ~30 fps pacing
  if (dt < 33) delay(33 - dt);
  lastFrame = millis();
}
