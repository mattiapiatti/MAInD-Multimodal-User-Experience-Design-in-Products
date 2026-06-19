// panel_config.h — Waveshare ESP32-S3-Touch-LCD-2.8C (2.8" round, 480x480, ST7701
// RGB-parallel + TCA9554 I/O expander). Arduino_GFX path.
//
//   *** THIS IS THE ONLY BOARD-SPECIFIC FILE. ***
//
// Everything else (engine, states, drawing) is hardware-agnostic and draws through
// the `gfx` pointer defined here.
//
// HOW THE PANEL COMES UP (the tricky part on this board):
//   - The ST7701 is configured over a 3-wire (9-bit) SPI control channel, then a
//     16-bit parallel RGB bus continuously scans the framebuffer out of PSRAM.
//   - On THIS board: SCK=GPIO2 and SDA=GPIO1 are REAL GPIOs, but the SPI **CS** and
//     the LCD **reset** are on a TCA9554 I/O expander (I2C 0x20, SDA15/SCL7), bits:
//       EXIO0 = LCD_RST,  EXIO1 = TOUCH_RST,  EXIO2 = LCD_CS.
//   - The ST7701 needs CS toggled PER COMMAND. Arduino_GFX's stock buses can't do
//     "real-GPIO SCK/MOSI + expander CS", so we send the init OURSELVES: bit-bang
//     the 9-bit SPI on GPIO2/1 and pulse CS (EXIO2) via the expander around each
//     command. Then Arduino_RGB_Display runs RGB scan-out only (init = nullptr).
//
// Requirements:
//   - Arduino_GFX (moononournation) >= 1.4.x. The installed 1.6.4 has an
//     Arduino_ESP32RGBPanel patched for the ESP-IDF 5.x RGB API, so it builds on
//     arduino-esp32 core 3.x.
//   - Board "ESP32S3 Dev Module": PSRAM = OPI (8MB) ENABLED (REQUIRED — the
//     480x480x2 framebuffer lives in PSRAM), Flash 16MB, USB CDC On Boot = Enabled.
#pragma once
#include <Arduino.h>
#include <Wire.h>
#include <Arduino_GFX_Library.h>
#include <esp_heap_caps.h>
#include <esp_lcd_panel_rgb.h>     // drive the RGB panel directly (tear-free double-fb)
#include <esp_lcd_panel_ops.h>     // (FreeRTOS semaphore types come from Arduino.h)

// ---- RGB data + sync pins (CONFIRMED — Espressif board file + Waveshare schematic) ----
#define LCD_DE     40
#define LCD_VSYNC  39
#define LCD_HSYNC  38
#define LCD_PCLK   41
#define LCD_R0     46
#define LCD_R1      3
#define LCD_R2      8
#define LCD_R3     18
#define LCD_R4     17
#define LCD_G0     14
#define LCD_G1     13
#define LCD_G2     12
#define LCD_G3     11
#define LCD_G4     10
#define LCD_G5      9
#define LCD_B0      5
#define LCD_B1     45
#define LCD_B2     48
#define LCD_B3     47
#define LCD_B4     21
#define LCD_BL      6     // backlight, active-HIGH (confirmed working)

// ---- 3-wire SPI (ST7701 init): real GPIOs; CS/RST are on the expander ----
#define LCD_SCK     2
#define LCD_SDA     1

// ---- TCA9554 I/O expander (I2C 0x20 on SDA=15 / SCL=7) ----
#define EXP_ADDR     0x20
#define EXP_RST_BIT  0    // EXIO0 -> ST7701 reset
#define EXP_TP_BIT   1    // EXIO1 -> touch reset
#define EXP_CS_BIT   2    // EXIO2 -> ST7701 3-wire SPI chip-select

// ---- RGB timing (Espressif 2.8C set, paired with the init array below) ----
#define PCLK_HZ     (12UL * 1000 * 1000)   // 12 MHz: lower scan bandwidth -> less PSRAM
                                            // contention with the per-frame canvas copy
                                            // (was 16 MHz; raise back if the panel flickers)
#define HSYNC_PW    8
#define HSYNC_BP    10
#define HSYNC_FP    50
#define VSYNC_PW    2
#define VSYNC_BP    18
#define VSYNC_FP    8
#define PCLK_NEG    0      // PCLK active on rising edge (flip to 1 if pixels sparkle)

// ===================================================================
// ST7701 init for the 2.8C glass — VERBATIM from Espressif's official board file
// BOARD_WAVESHARE_ESP32_S3_TOUCH_LCD_2_8_C.h (byte-identical to the working ESPHome
// 2.8C config). Format: {cmd, nargs, {args...}, delay_ms}.
// ===================================================================
struct St7701Op { uint8_t cmd; uint8_t nargs; uint8_t args[16]; uint16_t delayMs; };
static const St7701Op ST7701_2V8C[] = {
  {0xFF, 5, {0x77,0x01,0x00,0x00,0x13}, 0},
  {0xEF, 1, {0x08}, 0},
  {0xFF, 5, {0x77,0x01,0x00,0x00,0x10}, 0},
  {0xC0, 2, {0x3B,0x00}, 0},
  {0xC1, 2, {0x10,0x0C}, 0},
  {0xC2, 2, {0x07,0x0A}, 0},
  {0xC7, 1, {0x00}, 0},
  {0xCC, 1, {0x10}, 0},
  {0xCD, 1, {0x08}, 0},
  {0xB0, 16, {0x05,0x12,0x98,0x0E,0x0F,0x07,0x07,0x09,0x09,0x23,0x05,0x52,0x0F,0x67,0x2C,0x11}, 0},
  {0xB1, 16, {0x0B,0x11,0x97,0x0C,0x12,0x06,0x06,0x08,0x08,0x22,0x03,0x51,0x11,0x66,0x2B,0x0F}, 0},
  {0xFF, 5, {0x77,0x01,0x00,0x00,0x11}, 0},
  {0xB0, 1, {0x5D}, 0},
  {0xB1, 1, {0x3E}, 0},
  {0xB2, 1, {0x81}, 0},
  {0xB3, 1, {0x80}, 0},
  {0xB5, 1, {0x4E}, 0},
  {0xB7, 1, {0x85}, 0},
  {0xB8, 1, {0x20}, 0},
  {0xC1, 1, {0x78}, 0},
  {0xC2, 1, {0x78}, 0},
  {0xD0, 1, {0x88}, 0},
  {0xE0, 3, {0x00,0x00,0x02}, 0},
  {0xE1, 11, {0x06,0x30,0x08,0x30,0x05,0x30,0x07,0x30,0x00,0x33,0x33}, 0},
  {0xE2, 12, {0x11,0x11,0x33,0x33,0xF4,0x00,0x00,0x00,0xF4,0x00,0x00,0x00}, 0},
  {0xE3, 4, {0x00,0x00,0x11,0x11}, 0},
  {0xE4, 2, {0x44,0x44}, 0},
  {0xE5, 16, {0x0D,0xF5,0x30,0xF0,0x0F,0xF7,0x30,0xF0,0x09,0xF1,0x30,0xF0,0x0B,0xF3,0x30,0xF0}, 0},
  {0xE6, 4, {0x00,0x00,0x11,0x11}, 0},
  {0xE7, 2, {0x44,0x44}, 0},
  {0xE8, 16, {0x0C,0xF4,0x30,0xF0,0x0E,0xF6,0x30,0xF0,0x08,0xF0,0x30,0xF0,0x0A,0xF2,0x30,0xF0}, 0},
  {0xE9, 2, {0x36,0x01}, 0},
  {0xEB, 7, {0x00,0x01,0xE4,0xE4,0x44,0x88,0x40}, 0},
  {0xED, 16, {0xFF,0x10,0xAF,0x76,0x54,0x2B,0xCF,0xFF,0xFF,0xFC,0xB2,0x45,0x67,0xFA,0x01,0xFF}, 0},
  {0xEF, 6, {0x08,0x08,0x08,0x45,0x3F,0x54}, 0},
  {0xFF, 5, {0x77,0x01,0x00,0x00,0x00}, 0},
  {0x11, 0, {0}, 120},   // Sleep Out + 120ms
  {0x3A, 1, {0x66}, 0},  // pixel format (RGB666 over the 16-bit bus)
  {0x36, 1, {0x00}, 0},  // MADCTL
  {0x35, 1, {0x00}, 0},  // TE on
  {0x29, 0, {0}, 20},    // Display On
};

// ---- RGB scan-out via esp_lcd DIRECTLY, with TWO framebuffers for a TEAR-FREE swap.
// Arduino_GFX's Arduino_ESP32RGBPanel hard-codes num_fbs=1, so a canvas flush copies
// straight into the LIVE scanned framebuffer — the scan reads a half-updated frame and
// you get tearing: white/black bands that split & shift the face during motion.
//
// We drive esp_lcd ourselves with num_fbs=2: panelFlush() hands the finished canvas to
// esp_lcd_panel_draw_bitmap(), which fills the OFF-screen framebuffer and swaps it in at
// the next VSYNC — a torn frame is never scanned out.
//
// *** num_fbs=2 alone fixes TEARING, not the PSRAM bandwidth. *** renderFrame rewrites the
// whole 460KB framebuffer every frame; with bounce=0 that PSRAM write burst starves the LCD
// scan-out (same PSRAM bus) -> the whole image flickers/blanks (exactly "lo schermo lampeggia",
// and the README's "flashing/blanking -> raise the bounce buffer"). So we keep BOTH: num_fbs=2
// for the tear-free swap AND a bounce buffer so the scan rides internal SRAM through the burst.
//
// The earlier "double-fb + bounce duplicates & shifts sideways" was bounce-restart DESYNC, not
// a real incompatibility. Two requirements make it stable, both met below:
//   1. bounce_buffer_size_px MUST divide h_res*v_res exactly (480*40 = 19200; 230400/19200 = 12)
//      — a non-dividing size restarts the bounce DMA mid-frame => the sideways shift.
//   2. bb_invalidate_cache = true — the FB lives in PSRAM and is written through cache; without
//      the invalidate the bounce DMA can latch stale cache lines => duplicated/garbled bands.
// If the sideways desync STILL returns on this Arduino core (its prebuilt sdkconfig may not
// restart-the-bounce-in-vsync), the proven fallback is num_fbs=1 + this bounce buffer: zero
// flicker, only a faint single tear line during motion (the README's documented-stable state).
static esp_lcd_panel_handle_t g_rgbPanel = nullptr;
static uint16_t *g_fb0 = nullptr, *g_fb1 = nullptr, *g_drawFb = nullptr;  // driver FBs + current back
static SemaphoreHandle_t g_semGuiReady = nullptr, g_semVsyncEnd = nullptr;

// IDF two-semaphore tear-free handshake. panelFlush() requests a flip, GIVES gui_ready,
// then waits on vsync_end. on_vsync gives vsync_end ONLY on a vsync that occurs AFTER
// gui_ready was set — so we always wait for a real post-flip vsync and never proceed (and
// reuse a buffer) early. A single-semaphore version has a microscopic clear/give race that
// surfaced as an occasional 1-line glitch at the very top; this closes it.
static bool IRAM_ATTR onVsync(esp_lcd_panel_handle_t panel,
                              const esp_lcd_rgb_panel_event_data_t *edata, void *user) {
  BaseType_t hp = pdFALSE;
  if (g_semGuiReady && xSemaphoreTakeFromISR(g_semGuiReady, &hp) == pdTRUE) {
    xSemaphoreGiveFromISR(g_semVsyncEnd, &hp);
  }
  return hp == pdTRUE;
}

static bool rgbPanelInit() {
  esp_lcd_rgb_panel_config_t cfg = {
      .clk_src = LCD_CLK_SRC_DEFAULT,
      .timings = {
          .pclk_hz = PCLK_HZ, .h_res = 480, .v_res = 480,
          .hsync_pulse_width = HSYNC_PW, .hsync_back_porch = HSYNC_BP, .hsync_front_porch = HSYNC_FP,
          .vsync_pulse_width = VSYNC_PW, .vsync_back_porch = VSYNC_BP, .vsync_front_porch = VSYNC_FP,
          .flags = { .hsync_idle_low = 0, .vsync_idle_low = 0, .de_idle_high = 0,
                     .pclk_active_neg = PCLK_NEG, .pclk_idle_high = 0 },
      },
      .data_width = 16,
      .bits_per_pixel = 16,
      .num_fbs = 2,                       // <-- double framebuffer => tear-free VSYNC swap
      .bounce_buffer_size_px = 480 * 40,  // <-- scan rides internal SRAM through the PSRAM write
                                          //     burst (no flicker); 19200 divides 480*480 evenly
      .sram_trans_align = 8,
      .psram_trans_align = 64,
      .hsync_gpio_num = LCD_HSYNC, .vsync_gpio_num = LCD_VSYNC,
      .de_gpio_num = LCD_DE, .pclk_gpio_num = LCD_PCLK, .disp_gpio_num = GPIO_NUM_NC,
      .data_gpio_nums = { LCD_B0, LCD_B1, LCD_B2, LCD_B3, LCD_B4,
                          LCD_G0, LCD_G1, LCD_G2, LCD_G3, LCD_G4, LCD_G5,
                          LCD_R0, LCD_R1, LCD_R2, LCD_R3, LCD_R4 },
      .flags = { .disp_active_low = true, .refresh_on_demand = false, .fb_in_psram = true,
                 .double_fb = false, .no_fb = false, .bb_invalidate_cache = true },
  };
  if (esp_lcd_new_rgb_panel(&cfg, &g_rgbPanel) != ESP_OK) return false;
  // VSYNC semaphores + callback BEFORE init, so we catch flips from the first frame on.
  g_semGuiReady = xSemaphoreCreateBinary();
  g_semVsyncEnd = xSemaphoreCreateBinary();
  esp_lcd_rgb_panel_event_callbacks_t cbs = {};
  cbs.on_vsync = onVsync;
  esp_lcd_rgb_panel_register_event_callbacks(g_rgbPanel, &cbs, nullptr);
  esp_lcd_panel_reset(g_rgbPanel);
  esp_lcd_panel_init(g_rgbPanel);
  // Grab the two driver-owned framebuffers; we render STRAIGHT into the off-screen one
  // (no canvas copy -> no per-frame PSRAM write burst -> no bandwidth-contention glitch).
  esp_lcd_rgb_panel_get_frame_buffer(g_rgbPanel, 2, (void**)&g_fb0, (void**)&g_fb1);
  g_drawFb = g_fb1;   // fb0 is the initially-scanned buffer; draw into fb1 first
  return true;
}

// Double buffer. The eyes are drawn into this off-screen canvas, then flushed to
// the scanned framebuffer in one pass per frame (panelFlush). Drawing the full
// frame straight into the live framebuffer makes the eyes flicker/tear (the
// full-screen clear races the scan-out). Arduino_Canvas's own begin() would
// aligned_alloc the 460KB buffer in INTERNAL RAM (only ~300KB free => fails =>
// black); this subclass pre-allocates it in PSRAM so the base begin() reuses it.
class Arduino_Canvas_PSRAM : public Arduino_Canvas {
public:
  Arduino_Canvas_PSRAM(int16_t w, int16_t h, Arduino_G* out) : Arduino_Canvas(w, h, out) {}
  bool begin(int32_t speed = GFX_NOT_DEFINED) override {
    if (!_framebuffer) {
      _framebuffer = (uint16_t*)heap_caps_aligned_alloc(
          16, (size_t)_width * _height * 2, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    }
    return Arduino_Canvas::begin(speed);
  }
  // Point the canvas at an EXTERNAL buffer (one of the esp_lcd framebuffers) so draw
  // calls land straight in it — no separate canvas allocation, no flush memcpy.
  void useFramebuffer(uint16_t* fb) { _framebuffer = fb; }
};

// Off-screen draw target (PSRAM). output = nullptr: it is NOT flushed through an
// Arduino_GFX output — panelFlush() hands it to the esp_lcd panel (copy + VSYNC swap).
static Arduino_Canvas_PSRAM* g_canvas = new Arduino_Canvas_PSRAM(480, 480, nullptr);
Arduino_GFX* gfx = g_canvas;   // draw.h draws through this Arduino_GFX*

// ---- TCA9554 expander helpers (raw I2C) ----
static uint8_t g_expOut = 0xFF;
static void expWrite(uint8_t v) {
  g_expOut = v;
  Wire.beginTransmission(EXP_ADDR);
  Wire.write(0x01);            // output port register
  Wire.write(v);
  Wire.endTransmission();
}
static inline void expBit(uint8_t bit, bool high) {
  expWrite(high ? (g_expOut | (1 << bit)) : (g_expOut & ~(1 << bit)));
}

// ---- bit-banged 9-bit ST7701 SPI on the REAL GPIOs (mode 0, MSB first) ----
static inline void spi9(uint8_t dc, uint8_t b) {
  digitalWrite(LCD_SCK, LOW);  digitalWrite(LCD_SDA, dc);              digitalWrite(LCD_SCK, HIGH);
  for (int8_t i = 7; i >= 0; i--) {
    digitalWrite(LCD_SCK, LOW); digitalWrite(LCD_SDA, (b >> i) & 1);   digitalWrite(LCD_SCK, HIGH);
  }
}
static void st7701SendInit() {
  for (size_t i = 0; i < sizeof(ST7701_2V8C) / sizeof(ST7701_2V8C[0]); i++) {
    const St7701Op& op = ST7701_2V8C[i];
    expBit(EXP_CS_BIT, false);              // CS low (assert) for this command
    spi9(0, op.cmd);                        // D/C = 0 : command
    for (uint8_t a = 0; a < op.nargs; a++) spi9(1, op.args[a]);   // D/C = 1 : data
    expBit(EXP_CS_BIT, true);               // CS high (deassert)
    if (op.delayMs) delay(op.delayMs);
  }
}

// ---- panel bring-up ----
static void panelInit() {
  Wire.begin(15, 7);
  Wire.setClock(400000);

  // TCA9554: all EXIO outputs; reset the ST7701 (EXIO0) low->high; idle CS high.
  Wire.beginTransmission(EXP_ADDR); Wire.write(0x03); Wire.write(0x00); Wire.endTransmission(); // all outputs
  expWrite(0b00000000); delay(20);          // RST/TP_RST/CS all low (reset asserted)
  expWrite(0b00000111); delay(120);         // RST=1, TP_RST=1, CS=1 (idle); ST7701 post-reset settle

  pinMode(LCD_SCK, OUTPUT); digitalWrite(LCD_SCK, HIGH);
  pinMode(LCD_SDA, OUTPUT); digitalWrite(LCD_SDA, HIGH);
  st7701SendInit();                         // manual ST7701 init, CS toggled per command

  rgbPanelInit();                            // start the RGB scan-out (esp_lcd, 2 fbs, no bounce)
  g_canvas->useFramebuffer(g_drawFb);        // draw straight into the off-screen FB (no copy)
  g_canvas->begin();                         // init canvas state (FB already set -> no alloc)

  pinMode(LCD_BL, OUTPUT);
  digitalWrite(LCD_BL, HIGH);                // backlight on
}

// Present the just-rendered off-screen framebuffer, then hand the canvas the OTHER one
// for the next frame. The VSYNC handshake is the key: after asking esp_lcd to flip in
// g_drawFb, we BLOCK until the flip actually happens, so by the time the next renderFrame
// runs, g_drawFb points at a buffer that is no longer being scanned. No copy, no tearing,
// no sideways desync. (Stale-give is cleared first so we wait for the RIGHT vsync.)
static inline void panelFlush() {
  // (draw_bitmap of a driver-owned FB already flushes its cache to PSRAM internally — do
  //  NOT add a second esp_cache_msync here; that double PSRAM write burst re-triggers the
  //  scan-out contention and the sideways desync.)
  esp_lcd_panel_draw_bitmap(g_rgbPanel, 0, 0, 480, 480, g_drawFb);  // request flip at next vsync
  xSemaphoreGive(g_semGuiReady);                                    // arm: signal me at the next vsync
  xSemaphoreTake(g_semVsyncEnd, portMAX_DELAY);                     // wait until that (post-flip) vsync
  g_drawFb = (g_drawFb == g_fb0) ? g_fb1 : g_fb0;                   // the other FB is now free
  g_canvas->useFramebuffer(g_drawFb);
}

// Partial present: flip but flush only the vertical band [y0, y0+h). Everything outside it
// is solid BG, primed into BOTH framebuffers once at boot (see setup) and never rewritten —
// so this shrinks the per-frame PSRAM write burst that occasionally underran the scan FIFO
// and left a black line at the top, WITHOUT a bounce buffer (which breaks num_fbs=2 here).
// renderFrame still fills the whole back FB each frame, so the band stays self-consistent
// across the two buffers. The handshake is identical to panelFlush().
static inline void panelFlushRect(int y0, int h) {
  esp_lcd_panel_draw_bitmap(g_rgbPanel, 0, y0, 480, y0 + h, g_drawFb);
  xSemaphoreGive(g_semGuiReady);
  xSemaphoreTake(g_semVsyncEnd, portMAX_DELAY);
  g_drawFb = (g_drawFb == g_fb0) ? g_fb1 : g_fb0;
  g_canvas->useFramebuffer(g_drawFb);
}
