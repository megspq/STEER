#include <Arduino.h>
#include "USB.h"
#include "USBHIDKeyboard.h"

// define 5 LEDs and 5 buttons for the XIAO ESP32S3
// Physical button wiring -> game lane mapping:
//  D5 = lane 0 (leftmost, blue, A)
//  D6 = lane 1 (red, S)
//  D9 = lane 2 (middle, green, D)
//  D8 = lane 3 (yellow, F)
//  D7 = lane 4 (rightmost, white, G)
const int ledPins[5] = {D0, D1, D4, D3, D2};
const int buttonPins[5] = {D5, D6, D9, D8, D7};
const char keys[5] = {'a', 's', 'g', 'f', 'd'};

USBHIDKeyboard Keyboard;
bool lastReading[5] = {false, false, false, false, false};
bool stableState[5] = {false, false, false, false, false};
unsigned long lastChangeTime[5] = {0, 0, 0, 0, 0};
const unsigned long debounceMs = 10;

void setup() {
  USB.begin();
  Keyboard.begin();
  delay(500);

  for (int i = 0; i < 5; ++i) {
    pinMode(ledPins[i], OUTPUT);
    pinMode(buttonPins[i], INPUT_PULLUP);
    digitalWrite(ledPins[i], LOW);
    lastReading[i] = false;
    stableState[i] = false;
    lastChangeTime[i] = 0;
  }

  if (USB) {
    Keyboard.releaseAll();
  }

  for (int i = 0; i < 3; ++i) {
    for (int j = 0; j < 5; ++j) {
      digitalWrite(ledPins[j], HIGH);
    }
    delay(100);
    for (int j = 0; j < 5; ++j) {
      digitalWrite(ledPins[j], LOW);
    }
    delay(100);
  }
}

void loop() {
  unsigned long now = millis();

  for (int i = 0; i < 5; ++i) {
    bool reading = digitalRead(buttonPins[i]) == LOW;

    if (reading != lastReading[i]) {
      lastChangeTime[i] = now;
      lastReading[i] = reading;
    }

    if ((now - lastChangeTime[i] > debounceMs) && (stableState[i] != reading)) {
      stableState[i] = reading;
      if (reading) {
        Keyboard.press(keys[i]);
        digitalWrite(ledPins[i], HIGH);
      } else {
        Keyboard.release(keys[i]);
        digitalWrite(ledPins[i], LOW);
      }
    }
  }
}
