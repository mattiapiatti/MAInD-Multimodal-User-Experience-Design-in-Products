# esp32_eyes — companion face on the Waveshare ESP32-S3-Touch-LCD-2.8C

The "face" half of the health companion. Renders the **13 Maind X states**
(github.com/g10rg10/state-hormones) as an animated **face** — round white eyes +
a white smile / talking mouth on a dark orb — on a Waveshare
**ESP32-S3-Touch-LCD-2.8C** (**2.8″ ROUND, 480×480**, **ST7701** RGB + **TCA9554**
I/O expander). This is the **`face.html`** look from the project, NOT the cyan EMO
eyes of `states.html`. The warm-orange glow halo is EXTERNAL (the Uno Q LED ring),
so the LCD shows only the orb + the white face.

Companion to [`../sketch`](../sketch) (the Arduino Uno Q): that board drives the
**light halo** (NeoPixel ring); **this** board shows the **face**. They share the
same 13-state set, so the host can drive both with one state index (table below).

The panel bring-up started from the upstream `Hormy_eyes` firmware (which targets
this board but shipped with the ST7701 init as a TODO). The **rendering + animation
were then rewritten for the `face` design**: `anim.h` is a 6-layer engine (face
group / eyes / dots / mouth / smile / open-mouth), `timelines.h` transcribes
`face-keyframes.css` for all 13 states, and `draw.h` draws the orb + white face.
`A4_clock` uses a real **Arial Rounded Bold** GFX font (`clockfont.h`, generated
with Adafruit `fontconvert` from the macOS TTF) for the rounded numerals.

## States → faces

| idx | id | face |
|----|------|------|
| 0 | A1_off | dark screen |
| 1 | A2_wake | fade-in + waking blink |
| 2 | A3_idle | breathing + drift + natural blinks |
| 3 | A4_clock | tall digital clock HH:MM |
| 4 | B1_speaking | speech-rhythm breathing |
| 5 | B2_listening | still, attentive + notepad overlay |
| 6 | B3_thinking | gaze drift + half-blink |
| 7 | C1_confirm | eyes morph to a check ✓ |
| 8 | C2_didnt_catch | slow blink + head tilt |
| 9 | D1_reminder | eyes morph to a ringing bell |
| 10 | D2_wakeword | attentive pop |
| 11 | E2_quirk | look-around + double blink |
| 12 | E4_wink | asymmetric wink |

Indices match `arduino/sketch.ino`'s `S_*` enum and the Linux core's
`mcu.set_light_state(int)`.

## Build & flash (arduino-cli)

Already set up on this machine: arduino-cli + core `esp32:esp32@3.3.5` + lib
`GFX Library for Arduino@1.6.4`, sharing `~/Library/Arduino15`.

```sh
FQBN="esp32:esp32:esp32s3:USBMode=hwcdc,CDCOnBoot=cdc,FlashSize=16M,PartitionScheme=app3M_fat9M_16MB,PSRAM=opi"
arduino-cli compile -b "$FQBN" esp32_eyes
arduino-cli upload  -b "$FQBN" -p /dev/cu.usbmodem201301 esp32_eyes
```

In the Arduino IDE the equivalent is *ESP32S3 Dev Module* with **PSRAM = OPI**
(required — the framebuffers live in PSRAM), **Flash 16MB**, **USB CDC On Boot = Enabled**.

## Driving it

- **Auto (default):** power on → Wake → Idle → Clock after 5 min → (demo auto-wake) → Listening → face.
- **UART** (USB Serial @115200, one line per command):
  `0`…`12` pin a state · `wake` · `resume`/`auto` · `next` · `spd <f>`.

## Bring-up notes — why this board is tricky (read before changing panel_config.h)

This board fought back; the hard-won fixes, all in [panel_config.h](panel_config.h):

1. **It is NOT the 2.0″ rectangular ESP32-S3-Touch-LCD-2** (ST7789). It's the 2.8″
   ROUND ST7701. Backlight is **GPIO6** (active-high), not GPIO1.
2. **ST7701 init is sent manually.** SCK=GPIO2 / SDA=GPIO1 are real GPIOs but the
   SPI **CS** and the LCD **reset** are on the TCA9554 (0x20, I2C SDA15/SCL7):
   EXIO0=LCD-RST, EXIO1=TP-RST, EXIO2=LCD-CS. The ST7701 needs **CS toggled per
   command**; Arduino_GFX's stock buses can't do "real-GPIO SCK/MOSI + expander CS",
   so `st7701SendInit()` bit-bangs the 9-bit SPI and pulses CS via the expander
   around each command. (Holding CS low for the whole init — what `Arduino_SWSPI`
   does — leaves the panel uninitialised: lit but blank.)
3. **Double buffer.** Drawing the animated frame straight into the single scanned
   framebuffer tears/flickers. `gfx` is an `Arduino_Canvas` (subclassed to allocate
   its 460KB buffer in **PSRAM** — the stock `aligned_alloc` lands in internal RAM
   and fails); `panelFlush()` copies the finished frame in one pass.
4. **Bounce buffer (`480*40` px).** Without it, the flush's 460KB PSRAM write burst
   starves the LCD DMA and the whole image flashes/blanks. The bounce buffer lets
   the scan-out ride the bus from internal SRAM through the burst.

If you ever see: black → check it really is the 2.8C + PSRAM-OPI on; lit-but-blank
→ the ST7701 init/CS path; flashing/blanking → raise the bounce buffer; sparkly
pixels → flip `PCLK_NEG`; rolling/shifted → try the alt RGB timing in the comments;
wrong colours → RGB/BGR order.

## Known limits (panel/library, not bugs)

- **Residual tearing.** The Arduino_GFX RGB driver exposes no vsync, so a frame
  update can occasionally "cut" one scan line. Double-buffer + bounce buffer keep
  it to a faint single line; eliminating it would need esp_lcd `num_fbs=2` + a
  vsync swap (bypassing Arduino_GFX).
- **Aliased edges.** Arduino_GFX shapes/fonts are 1-bit (no anti-aliasing), so
  curved edges step slightly. The smile is drawn as a dense round-brush stroke to
  minimise it; the eyes/clock keep hard edges.

## TODO

- **Wire the host link:** feed the same state int the Linux core sends the Uno Q
  (`set_light_state`) to this board's UART so the face tracks the conversation.
- **Real clock:** `getTime()` in draw.h is a placeholder counter (regenerate
  `clockfont.h` from SFNSRounded.ttf if you want SF Pro Rounded instead of Arial).
- **Touch** (GT911 @ 0x5D, INT=GPIO16, RST=EXIO1) is wired on the board but unused.
