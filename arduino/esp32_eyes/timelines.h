// timelines.h — the 13 FACE state keyframe tables, transcribed from
// face-keyframes.css. Percents/values/easings follow the CSS. The mouth arc-morph
// (thinking), wavy mouth (didn't-catch), check (confirm) and bell (reminder) are
// rendered specially in draw.h from each state's progress.
#pragma once
#include "anim.h"

// ============================ A · system & power ============================
// A1_off — dark screen (no tracks).

// A2_wake — pop in, settle smiling. one-shot 4000, action 0-33%, chain -> A3_idle.
static const Kf a2_sx[] = {{0,1},{9,1.09f},{17,.96f},{25,1.03f},{33,1},{88,1},{100,1}};
static const Kf a2_sy[] = {{0,1},{9,.93f},{17,1.08f},{25,1},{33,1},{88,1},{100,1}};
static const Kf a2_ty[] = {{0,7},{9,2},{17,-4},{25,-1},{33,0},{88,0},{97,7},{100,7}};
static const Kf a2_op[] = {{0,0},{9,1},{33,1},{88,1},{97,0},{100,0}};
static const Track a2_tr[] = {
  {CH_F_SX, EASE_F_A2, 7, 4000, a2_sx}, {CH_F_SY, EASE_F_A2, 7, 4000, a2_sy},
  {CH_F_TY, EASE_F_A2, 8, 4000, a2_ty}, {CH_F_OP, EASE_F_A2, 6, 4000, a2_op},
};

// A3_idle — 9s choreographed look-around: gaze, head-lean, blinks, smile breath.
static const Kf a3_etx[] = {{0,0},{12,-17},{15,-15},{29,-15},{34,15},{37,13},{49,13},{54,3},{57,2},{69,2},{74,-7},{87,-7},{93,0},{100,0}};
static const Kf a3_ety[] = {{0,0},{12,3},{15,3},{29,4},{34,1},{37,1},{49,2},{54,-8},{57,-6},{69,-6},{74,5},{87,5},{93,0},{100,0}};
static const Kf a3_fsc[] = {{0,1},{15,1.015f},{29,1.025f},{37,1.03f},{49,1.02f},{57,1.04f},{69,1.03f},{74,1.02f},{87,1.02f},{93,1},{100,1}};
static const Kf a3_ftx[] = {{0,0},{15,-5},{29,-5},{37,5},{49,4},{57,1},{69,1},{74,-3},{87,-3},{93,0},{100,0}};
static const Kf a3_fty[] = {{0,0},{15,1},{29,1},{37,0},{49,0},{57,-2},{69,-2},{74,1},{87,1},{93,0},{100,0}};
static const Kf a3_frot[]= {{0,0},{15,-1},{29,-1},{37,1},{49,.8f},{57,0},{69,0},{74,-.6f},{87,-.6f},{93,0},{100,0}};
static const Kf a3_blink[]={{0,1},{10,1},{11.5f,.08f},{13,1},{52,1},{53.5f,.08f},{55,1},{91,1},{92.5f,.08f},{94,1},{100,1}};
static const Kf a3_mtx[] = {{0,0},{15,-7},{29,-7},{37,6},{49,6},{57,1},{69,1},{74,-3},{87,-3},{93,0},{100,0}};
static const Kf a3_smsc[]= {{0,1},{50,1.04f},{100,1}};
static const Track a3_tr[] = {
  {CH_E_TX, EASE_F_GAZE, 14, 9000, a3_etx}, {CH_E_TY, EASE_F_GAZE, 14, 9000, a3_ety},
  {CH_F_SC, EASE_F_GAZE, 11, 9000, a3_fsc}, {CH_F_TX, EASE_F_GAZE, 11, 9000, a3_ftx},
  {CH_F_TY, EASE_F_GAZE, 11, 9000, a3_fty}, {CH_F_ROT, EASE_F_GAZE, 11, 9000, a3_frot},
  {CH_DSY, EASE_F_BLINK, 11, 9000, a3_blink}, {CH_M_TX, EASE_F_GAZE, 11, 9000, a3_mtx},
  {CH_SM_SC, EASE_IN_OUT, 3, 9000, a3_smsc},
};

// A4_clock — display (clock overlay, no tracks).

// ======================= B · conversation turn-taking =======================

// B1_speaking — head bob + turn, eyes squint, mouth phonemes. loop.
static const Kf b1_fsc[] = {{0,1},{7,1.07f},{13,1.02f},{21,1.1f},{28,1.03f},{36,1.08f},{44,1.02f},{52,1.12f},{60,1.04f},{68,1.09f},{76,1.03f},{84,1.08f},{92,1.04f},{100,1}};
static const Kf b1_fty[] = {{0,0},{7,-5},{13,-1},{21,-7},{28,-2},{36,-5},{44,-1},{52,-8},{60,-2},{68,-6},{76,-2},{84,-5},{92,-2},{100,0}};
static const Kf b1_frot[]= {{0,0},{16,0},{24,6},{36,6},{44,0},{58,0},{66,-6},{78,-6},{86,0},{100,0}};
static const Kf b1_dsy[] = {{0,1},{6,1},{8,.7f},{10,1},{20,1},{22,.55f},{24,1},{51,1},{53,.5f},{55,1},{68,1},{69,.07f},{70.5f,1},{100,1}};
static const Kf b1_smop[]= {{0,0},{100,0}};
static const Kf b1_opop[]= {{0,1},{100,1}};
static const Kf b1_opsx[]= {{0,.55f},{9,1.05f},{18,.55f},{27,.9f},{36,.55f},{45,1.18f},{54,.55f},{63,.95f},{72,.55f},{81,.85f},{90,.55f},{100,.55f}};
static const Kf b1_opsy[]= {{0,.2f},{9,.88f},{18,.22f},{27,1.05f},{36,.2f},{45,.8f},{54,.22f},{63,.92f},{72,.2f},{81,.62f},{90,.22f},{100,.2f}};
static const Track b1_tr[] = {
  {CH_F_SC, EASE_IN_OUT, 14, 3400, b1_fsc}, {CH_F_TY, EASE_IN_OUT, 14, 3400, b1_fty},
  {CH_F_ROT, EASE_IN_OUT, 10, 8700, b1_frot}, {CH_DSY, EASE_DOT_46, 14, 3400, b1_dsy},
  {CH_SM_OP, EASE_LINEAR, 2, 3800, b1_smop}, {CH_OP_OP, EASE_LINEAR, 2, 3800, b1_opop},
  {CH_OP_SX, EASE_F_OPEN, 12, 3800, b1_opsx}, {CH_OP_SY, EASE_F_OPEN, 12, 3800, b1_opsy},
};

// B2_listening — nod twice, then a curious head-tilt; rare blink; gentle mouth. loop.
static const Kf b2_fty[] = {{0,0},{16,0},{22,14},{29,0},{34,12},{41,0},{54,0},{86,0},{100,0}};
static const Kf b2_frot[]= {{0,0},{41,0},{54,9},{72,9},{86,0},{100,0}};
static const Kf b2_dsy[] = {{0,1},{54,1},{54.8f,.07f},{55.6f,1},{100,1}};
static const Kf b2_mty[] = {{0,0},{33,-2},{66,2},{100,0}};
static const Kf b2_smsc[]= {{0,.78f},{50,.84f},{100,.78f}};
static const Track b2_tr[] = {
  {CH_F_TY, EASE_IN_OUT, 9, 7000, b2_fty}, {CH_F_ROT, EASE_IN_OUT, 6, 7000, b2_frot},
  {CH_DSY, EASE_DOT_46, 5, 9000, b2_dsy}, {CH_M_TY, EASE_IN_OUT, 4, 2900, b2_mty},
  {CH_SM_SC, EASE_IN_OUT, 3, 2900, b2_smsc},
};

// B3_thinking — head tilts both ways, eyes scan; the mouth arc morphs (in draw.h). loop.
static const Kf b3_frot[]= {{0,0},{15,-11},{30,-10},{50,0},{65,8},{80,7},{100,0}};
static const Kf b3_ftx[] = {{0,0},{15,7},{30,8},{50,0},{65,-6},{80,-6},{100,0}};
static const Kf b3_fty[] = {{0,0},{15,-4},{30,-4},{50,-2},{65,-3},{80,-3},{100,0}};
static const Track b3_tr[] = {
  {CH_F_ROT, EASE_GRP_42, 7, 2000, b3_frot}, {CH_F_TX, EASE_GRP_42, 7, 2000, b3_ftx},
  {CH_F_TY, EASE_GRP_42, 7, 2000, b3_fty},
};

// ========================= C · feedback & confirm ===========================

// C1_confirm — face sucked in, eyes/smile fade, check shows (draw.h), snaps back. one-shot.
static const Kf c1_fsc[] = {{0,1},{12,.55f},{80,.55f},{90,1.1f},{96,.98f},{100,1}};
static const Kf c1_dop[] = {{0,1},{12,0},{80,0},{90,1},{100,1}};
static const Kf c1_smop[]= {{0,1},{12,0},{80,0},{90,1},{100,1}};
static const Track c1_tr[] = {
  {CH_F_SC, EASE_GRP_42, 6, 2400, c1_fsc}, {CH_DOP, EASE_GRP_42, 5, 2400, c1_dop},
  {CH_SM_OP, EASE_GRP_42, 5, 2400, c1_smop},
};

// C2_didnt_catch — confused wobble; the mouth goes wavy then back (draw.h). one-shot 1800.
static const Kf c2_frot[]= {{0,0},{3,-11},{6,9},{9,-7},{12,5},{17,0},{100,0}};
static const Kf c2_fty[] = {{0,0},{3,2},{6,-1},{9,2},{12,-1},{17,0},{100,0}};
static const Kf c2_smsc[]= {{0,1},{22,1.5f},{30,.85f},{38,1.4f},{46,1},{100,1}};
static const Track c2_tr[] = {
  {CH_F_ROT, EASE_F_C2, 7, 1800, c2_frot}, {CH_F_TY, EASE_F_C2, 7, 1800, c2_fty},
  {CH_SM_SC, EASE_IN_OUT, 6, 1800, c2_smsc},
};

// ========================== D · proactive moments ===========================

// D1_reminder — tremble in, bell pops (draw.h), snap back smiling. one-shot, chain -> B1.
static const Kf d1_fsc[] = {{0,1},{6,.6f},{30,.62f},{50,.62f},{70,.6f},{82,.6f},{90,1.22f},{96,.96f},{100,1}};
static const Kf d1_smop[]= {{0,1},{12,0},{82,0},{92,1},{100,1}};
static const Kf d1_dop[] = {{0,1},{12,0},{82,0},{92,1},{100,1}};   // eyes fade out behind the bell
static const Track d1_tr[] = {
  {CH_F_SC, EASE_F_D1, 9, 3200, d1_fsc}, {CH_SM_OP, EASE_F_D1, 5, 3200, d1_smop},
  {CH_DOP, EASE_F_D1, 5, 3200, d1_dop},
};

// D2_wakeword — attentive perk-up, small "o" then smile blooms. one-shot, chain -> B2.
static const Kf d2_fsx[] = {{0,1},{4,1.1f},{11,.94f},{18,1.05f},{26,1.07f},{86,1.07f},{94,1.05f},{100,1}};
static const Kf d2_fsy[] = {{0,1},{4,.9f},{11,1.14f},{18,1.03f},{26,1.07f},{86,1.07f},{94,1.02f},{100,1}};
static const Kf d2_fty[] = {{0,0},{4,0},{11,-6},{18,-2},{26,-4},{86,-4},{94,-1},{100,0}};
static const Kf d2_dsc[] = {{0,1},{10,1.15f},{18,1.04f},{25,1.08f},{86,1.08f},{100,1}};
static const Kf d2_opop[]= {{0,0},{8,1},{14,1},{22,0},{100,0}};
static const Kf d2_opsx[]= {{0,.35f},{8,.8f},{14,.65f},{22,.4f},{100,.4f}};
static const Kf d2_opsy[]= {{0,.3f},{8,.7f},{14,.56f},{22,.34f},{100,.34f}};
static const Kf d2_smop[]= {{0,0},{16,0},{26,1},{100,1}};
static const Kf d2_smsc[]= {{0,.5f},{16,.5f},{26,1.18f},{34,1},{100,1}};
static const Track d2_tr[] = {
  {CH_F_SX, EASE_F_D2, 8, 3400, d2_fsx}, {CH_F_SY, EASE_F_D2, 8, 3400, d2_fsy},
  {CH_F_TY, EASE_F_D2, 8, 3400, d2_fty}, {CH_DSC, EASE_F_D2, 6, 3400, d2_dsc},
  {CH_OP_OP, EASE_F_D2, 5, 3400, d2_opop}, {CH_OP_SX, EASE_F_D2, 5, 3400, d2_opsx},
  {CH_OP_SY, EASE_F_D2, 5, 3400, d2_opsy}, {CH_SM_OP, EASE_F_D2SM, 4, 3400, d2_smop},
  {CH_SM_SC, EASE_F_D2SM, 5, 3400, d2_smsc},
};

// ===================== E · personality / expressions ========================

// E2_quirk — big head turn left + shake, turn right + shake, snap back. one-shot 4200.
static const Kf e2_frot[]= {{0,0},{8,-16},{12,-15},{16,-17},{21,16},{25,15},{29,17},{35,0},{100,0}};
static const Kf e2_ftx[] = {{0,0},{8,-9},{12,-10},{16,-9},{21,9},{25,10},{29,9},{35,0},{100,0}};
static const Kf e2_fty[] = {{0,0},{8,3},{12,4},{16,3},{21,-3},{25,-4},{29,-3},{35,0},{100,0}};
static const Track e2_tr[] = {
  {CH_F_ROT, EASE_GRP_42, 9, 4200, e2_frot}, {CH_F_TX, EASE_GRP_42, 9, 4200, e2_ftx},
  {CH_F_TY, EASE_GRP_42, 9, 4200, e2_fty},
};

// E4_wink — playful nod + smile lift; right eye winks. one-shot 2600, action 0-56%.
static const Kf e4_frot[]= {{0,0},{18,6},{46,6},{56,0},{100,0}};
static const Kf e4_fty[] = {{0,0},{18,-3},{46,-3},{56,0},{100,0}};
static const Kf e4_smsc[]= {{0,1},{14,1},{20,1.18f},{46,1.18f},{56,1},{100,1}};
static const Kf e4_smsk[]= {{0,0},{14,0},{20,-5},{46,-5},{56,0},{100,0}};
static const Kf e4_dotR[]= {{0,1},{14,1},{20,.07f},{46,.07f},{54,1},{100,1}};
static const Kf e4_dotL[]= {{0,1},{18,1},{30,.78f},{46,.78f},{56,1},{100,1}};
static const Track e4_tr[] = {
  {CH_F_ROT, EASE_E4_DOTR, 5, 2600, e4_frot}, {CH_F_TY, EASE_E4_DOTR, 5, 2600, e4_fty},
  {CH_SM_SC, EASE_E4_DOTR, 6, 2600, e4_smsc}, {CH_SM_SKEW, EASE_E4_DOTR, 6, 2600, e4_smsk},
  {CH_DSYR, EASE_E4_DOTR, 6, 2600, e4_dotR}, {CH_DSYL, EASE_IN_OUT, 6, 2600, e4_dotL},
};

// ============================== state table =================================
#define NUM_STATES 13
static const StateDef STATES[NUM_STATES] = {
//  id              mode          baseDur action chain  nTr tracks    overlay      dotsOff
  { "A1_off",       MODE_STATIC,     0,    0,   0xFF, 0,  nullptr,   OV_NONE,    true  },
  { "A2_wake",      MODE_ONESHOT, 4000,   33,    2,   4,  a2_tr,     OV_NONE,    false },
  { "A3_idle",      MODE_LOOP,    9000,  100,   0xFF, 9,  a3_tr,     OV_NONE,    false },
  { "A4_clock",     MODE_DISPLAY,    0,    0,   0xFF, 0,  nullptr,   OV_CLOCK,   false },
  { "B1_speaking",  MODE_LOOP,    3400,  100,   0xFF, 8,  b1_tr,     OV_NONE,    false },
  { "B2_listening", MODE_LOOP,    7000,  100,   0xFF, 5,  b2_tr,     OV_NOTEPAD, false },
  { "B3_thinking",  MODE_LOOP,    2000,  100,   0xFF, 3,  b3_tr,     OV_NONE,    false },
  { "C1_confirm",   MODE_ONESHOT, 2400,   92,   0xFF, 3,  c1_tr,     OV_NONE,    false },
  { "C2_didnt_catch", MODE_ONESHOT, 1800, 100,  0xFF, 3,  c2_tr,     OV_NONE,    false },
  { "D1_reminder",  MODE_ONESHOT, 3200,   94,    4,   3,  d1_tr,     OV_NONE,    false },
  { "D2_wakeword",  MODE_ONESHOT, 3400,   30,    5,   9,  d2_tr,     OV_NONE,    false },
  { "E2_quirk",     MODE_ONESHOT, 4200,   35,   0xFF, 3,  e2_tr,     OV_NONE,    false },
  { "E4_wink",      MODE_ONESHOT, 2600,   56,   0xFF, 6,  e4_tr,     OV_NONE,    false },
};
