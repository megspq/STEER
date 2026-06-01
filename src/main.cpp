#include <Arduino.h>
#include "USB.h"
#include "USBHIDKeyboard.h"

USBHIDKeyboard Keyboard;

// ==========================
// PIN MAPPING (your setup)
// ==========================

// LEDs: D0–D4
const int ledPins[5] = {D0, D1, D2, D3, D4};

// Buttons: D5–D9
const int buttonPins[5] = {D5, D6, D7, D8, D9};

// Keys sent to Mac (must match your JS game)
const char keys[5] = {'a', 's', 'd', 'f', 'g'};

// ==========================
// STATE
// ==========================
bool lastState[5];

// debounce timing (simple + safe)
unsigned long lastChangeTime[5];
const unsigned long debounceMs = 10;

// ==========================
// SETUP
// ==========================
void setup() {

  Keyboard.begin();
  USB.begin();

  for (int i = 0; i < 5; i++) {

    pinMode(ledPins[i], OUTPUT);
    pinMode(buttonPins[i], INPUT_PULLUP);

    digitalWrite(ledPins[i], LOW);

    lastState[i] = HIGH;
    lastChangeTime[i] = 0;
  }
}

// ==========================
// LOOP
// ==========================
void loop() {

  unsigned long now = millis();

  for (int i = 0; i < 5; i++) {

    bool reading = digitalRead(buttonPins[i]);

    // if state changed, reset timer
    if (reading != lastState[i]) {
      lastChangeTime[i] = now;
      lastState[i] = reading;
    }

    // only act if stable
    if ((now - lastChangeTime[i]) > debounceMs) {

      // PRESSED
      if (reading == LOW && digitalRead(buttonPins[i]) == LOW) {
        Keyboard.press(keys[i]);
        digitalWrite(ledPins[i], HIGH);
      }

      // RELEASED
      else if (reading == HIGH) {
        Keyboard.release(keys[i]);
        digitalWrite(ledPins[i], LOW);
      }
    }
  }
}