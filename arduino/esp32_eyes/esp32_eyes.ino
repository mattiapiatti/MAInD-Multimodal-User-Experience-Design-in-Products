// esp32_eyes.ino — companion FACE on the Waveshare ESP32-S3-Touch-LCD-2.8C
// (2.8" ROUND, 480x480, ST7701 RGB + Arduino_GFX). The face now TRACKS THE LIVE
// CONVERSATION: the Arduino Uno Q forwards the host's state stream to this board
// over a hardware UART (the "host link"), so the same state ints that drive the
// Uno Q light halo (set_light_state) drive the face here — the two front-ends stay
// in lock-step.
//
// The 13 faces are the Maind X states (github.com/g10rg10/state-hormones) — the
// SAME set the rest of the system uses (host set_light_state() indices == the
// arduino/sketch.ino S_* enum == STATES[] here):
//   0 A1_off  1 A2_wake  2 A3_idle  3 A4_clock  4 B1_speaking  5 B2_listening
//   6 B3_thinking  7 C1_confirm  8 C2_didnt_catch  9 D1_reminder  10 D2_wakeword
//   11 E2_quirk  12 E4_wink
//
// ============================ HOST LINK PROTOCOL ============================
// One line per message, 115200 8N1, '\n' (or '\r') terminated. Fed from BOTH the
// USB Serial (dev/manual) and the UART link from the Uno Q (LINK below):
//   S<n>                 SEMANTIC light-state event 0..12 (a set_light_state from
//                        the host). The FACE POLICY is applied — see onLightState():
//                          0 (off)        -> show the CLOCK (standby), not a dark screen
//                          2 (idle) from clock -> play the WAKE animation, settle to idle
//                          10/5/6/4/...   -> wakeword / listening / thinking / speaking
//   T<hh>:<mm>[:<ss>]    wall-clock time sync (the Linux core has NTP time) -> drives A4_clock
//   <n>                  RAW state 0..12 — pin a state DIRECTLY (dev preview, no policy)
//   wake | resume | auto | next | spd <f>    dev helpers
//
// ============================ WIRING (UART, CROSSED) ========================
// These defaults are the board's 4-pin UART header, silkscreened "TXD RXD GND 3V3"
// (TXD = GPIO43, RXD = GPIO44 — confirmed against the Waveshare 2.8C docs). It is
// free: the USB-CDC console runs over native USB (GPIO19/20), not this UART.
// Cross TX/RX to the Uno Q (and share GND — do NOT wire the header's 3V3):
//      Uno Q TX  ->  ESP32 header "RXD" (GPIO44 = LINK_RX_PIN)
//      Uno Q RX  ->  ESP32 header "TXD" (GPIO43 = LINK_TX_PIN)
//      Uno Q GND <-> ESP32 header "GND"
// NOTE: leave the board's *UART* Type-C port UNPLUGGED (it mux-disables this
// header); power/flash via the other (USB) Type-C port.
//
// ~30 fps loop, all timelines wall-clock driven (millis) with per-segment
// cubic-bezier easing. The RGB panel auto-flushes via panelFlush().
#include "palette.h"
#include "easing.h"
#include "anim.h"
#include "timelines.h"
#include "panel_config.h"     // defines gfx (ST7701 RGB; VERIFY against your board)
#include "draw.h"             // defines setRealTime() used by the clock

float g_spd = 1.0f;           // global tempo (the web "Tempo" slider); 1.0 = as authored

// ---- host link (hardware UART to the Arduino Uno Q) ----
#define LINK        Serial1   // UART1 (Serial = USB-CDC console, kept for dev)
#define LINK_BAUD   115200
#define LINK_RX_PIN 44        // board header "RXD" (U0RXD) <- Uno Q TX
#define LINK_TX_PIN 43        // board header "TXD" (U0TXD) -> Uno Q RX

// ---- state indices (match sketch.ino S_* and the host's set_light_state) ----
enum {
  S_OFF = 0, S_WAKE = 1, S_IDLE = 2, S_CLOCK = 3, S_SPEAKING = 4, S_LISTENING = 5,
  S_THINKING = 6, S_CONFIRM = 7, S_DIDNT = 8, S_REMINDER = 9, S_WAKEWORD = 10,
  S_QUIRK = 11, S_WINK = 12,
};

static int      g_face      = S_CLOCK;   // current face state index into STATES[]
static uint32_t g_faceStart = 0;
static uint32_t lastFrame   = 0;

// Enter a face state (restarts its timeline). Re-entering the SAME state is a no-op
// so a redundant event (e.g. the host's listening(5) after wakeword already chained
// to listening) doesn't visibly restart a loop.
static void setFace(int i) {
  if (i < 0 || i >= NUM_STATES || i == g_face) return;
  g_face = i;
  g_faceStart = millis();
}

// Map a SEMANTIC light-state event (set_light_state) to a face, applying the device
// face policy: standby shows the CLOCK (not a dark screen), and the first wake-up
// out of the clock plays the WAKE animation (which one-shot-chains to idle/waiting).
// Every other state passes straight through and tracks the conversation.
static void onLightState(int n) {
  if (n < 0 || n >= NUM_STATES) return;
  int target = n;
  if (n == S_OFF)                                               target = S_CLOCK; // button released -> clock
  else if ((g_face == S_CLOCK || g_face == S_OFF) && n == S_IDLE) target = S_WAKE;  // button pressed -> wake
  // Let a one-shot finish on its OWN timeline: the host emits the next state (e.g.
  // listening) for the halo well before the wakeword/didnt-catch animation has
  // played out. If that incoming state is exactly what this one-shot already chains
  // to, ignore it — the chain (below, in loop) will land there once the animation
  // completes. Without this the perk-up / wobble is cut to a brief flash.
  const StateDef* cur = &STATES[g_face];
  if (cur->mode == MODE_ONESHOT && cur->chainTo == target &&
      !oneShotDone(cur, millis(), g_faceStart)) {
    return;
  }
  setFace(target);
}

// One line from either serial source -> an action.
static void handleLine(const char* buf) {
  if      (!strcmp(buf, "wake"))                            onLightState(S_WAKEWORD);
  else if (!strcmp(buf, "resume") || !strcmp(buf, "auto"))  setFace(S_CLOCK);
  else if (!strcmp(buf, "next"))                            setFace((g_face + 1) % NUM_STATES);
  else if (!strncmp(buf, "spd", 3))                         g_spd = atof(buf + 3);
  else if (buf[0] == 'T') { int hh, mm, ss = 0;
                            if (sscanf(buf, "T%d:%d:%d", &hh, &mm, &ss) >= 2) setRealTime(hh, mm, ss); }
  else if (buf[0] == 'S' && buf[1] >= '0' && buf[1] <= '9')  onLightState(atoi(buf + 1));  // semantic event
  else if (buf[0] >= '0' && buf[0] <= '9')                   setFace(atoi(buf));            // raw preview (dev)
}

// Accumulate bytes from a stream into its own line buffer; dispatch on newline.
static void pumpStream(Stream& in, char* buf, uint8_t& len) {
  while (in.available()) {
    char c = in.read();
    if (c == '\n' || c == '\r') {
      if (len) { buf[len] = 0; handleLine(buf); len = 0; }
    } else if (len < 31) {
      buf[len++] = c;
    }
  }
}

void setup() {
  Serial.begin(115200);                                       // USB-CDC console (dev)
  LINK.begin(LINK_BAUD, SERIAL_8N1, LINK_RX_PIN, LINK_TX_PIN); // host link from the Uno Q
  panelInit();
  gfx->fillScreen(pack565(BG));
  panelFlush();
  g_face = S_CLOCK; g_faceStart = millis();                   // standby = clock until the host speaks
  Serial.println("esp32_eyes ready — host link on Serial1; send S<n>, T<hh>:<mm>, or a raw state 0..12");
}

void loop() {
  static char ub[32]; static uint8_t ul = 0;   // USB-serial line buffer
  static char lb[32]; static uint8_t ll = 0;   // host-link line buffer
  pumpStream(Serial, ub, ul);
  pumpStream(LINK,   lb, ll);

  uint32_t now = millis();

  // One-shot chaining: when a one-shot finishes its action window, advance to its
  // chainTo (A2_wake -> idle, D2_wakeword -> listening, D1_reminder -> speaking).
  // chainTo == 0xFF holds the final frame until the host sends the next state.
  const StateDef* s = &STATES[g_face];
  if (s->mode == MODE_ONESHOT && oneShotDone(s, now, g_faceStart) &&
      s->chainTo != 0xFF && s->chainTo != g_face) {
    setFace(s->chainTo);
  }

  renderFrame(g_face, now, g_faceStart);
  panelFlush();                                 // push the finished frame to the panel

  uint32_t dt = millis() - lastFrame;           // ~30 fps pacing
  if (dt < 33) delay(33 - dt);
  lastFrame = millis();
}
