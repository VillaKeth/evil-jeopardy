# ULTRA-CHEAP SHELDON MVP - AliExpress Knockoff Edition

## THE DIRT-CHEAP ALTERNATIVE

**ESP32 is your best friend** - It's $3-5 on AliExpress, has WiFi, Bluetooth, GPIO pins, AND costs 1/3 what Arduino costs.

**Teensy** - Overkill and actually MORE expensive than Arduino (not the move)

---

## ABSOLUTE CHEAPEST PARTS LIST

| Item | Price | Link/Source |
|------|-------|------------|
| **2x DC Motors + Wheels** | $8-10 | AliExpress: "DC motor 200rpm gear" (pack of 2) |
| **L298N Motor Driver** | $1-2 | AliExpress: "L298N motor driver" (bulk, $1.50 each) |
| **ESP32 DevKit** | $3-5 | AliExpress: "ESP32 DevKit CH340" |
| **HC-05 Bluetooth** | $2-3 | AliExpress: "HC-05 Bluetooth module" |
| **6V Battery + Holder** | $3-5 | AliExpress: "4xAA battery holder with switch" |
| **Jumper Wires** | $1-2 | AliExpress: "Breadboard jumper wires pack" |
| **USB Cable** | Free | Probably have one |
| **PVC/Wood Base** | $3-5 | Local dollar store |
| **iPad (used)** | $30-50 | Facebook Marketplace, Craigslist |
| **TOTAL** | **$54-87** | **Including iPad** |

---

## WHY ESP32 > Arduino for This Project

| Feature | Arduino Nano | ESP32 |
|---------|------------|-------|
| **Price** | $8-12 | $3-5 |
| **Processor** | 8-bit | 32-bit |
| **RAM** | 2KB | 520KB |
| **WiFi** | No | Yes |
| **Bluetooth** | No | Yes (built-in!) |
| **GPIO Pins** | 14 | 36 |
| **Speed** | 16 MHz | 240 MHz |
| **USB** | Micro | Micro |
| **Best for** | Simple projects | Complex projects + WiFi + BT |

**Translation:** ESP32 does everything Arduino does + WiFi + built-in Bluetooth = no HC-05 module needed!

---

## ABSOLUTE CHEAPEST BUILD ($55-80)

### Option A: ESP32 + Bluetooth (RECOMMENDED)
```
ESP32 DevKit:        $4
L298N Motor Driver:  $2
2x DC Motors:        $10
6V Battery Holder:   $4
Jumper Wires:        $1
HC-05 (if needed):   $0 (use built-in Bluetooth!)
Used iPad:           $40
PVC Base:            $3
─────────────────────────
TOTAL:               ~$64
```

**Benefit:** No HC-05 module needed—ESP32 has Bluetooth built-in!

---

## ALIEXPRESS SHOPPING LINKS

**Motor Kits (~$8-10):**
- Search: "DC motor 200rpm geared motor 6v" on AliExpress
- Exact: Item #32881451847 "DC Geared Motor 200RPM 6-12V"
- Gets: 2 motors + 2 wheels + gear box

**L298N Module ($1-2):**
- Search: "L298N motor driver" on AliExpress
- Cheapest seller usually China-based (~$1.50 shipped)

**ESP32 DevKit ($3-5):**
- Search: "ESP32 DevKit 30pin" on AliExpress
- Exact seller: Look for "DoitStudio" or "Robotlinking" (trusted sellers)
- Make sure it has USB + CH340 chip

**HC-05 Bluetooth ($2-3) - Optional if using ESP32:**
- Search: "HC-05 Bluetooth module" on AliExpress
- But honestly, ESP32's built-in BT is better

**6V Battery Holder ($3-5):**
- Search: "4xAA battery holder with switch" on AliExpress

**Jumper Wires ($1-2):**
- Search: "breadboard jumper wires kit" on AliExpress

---

## ALIEXPRESS TIPS TO SAVE MONEY

1. **Search "Button Electronics Wholesale"** - Bulk sellers with crazy cheap prices
2. **Use coupons:** AliExpress often has $1-3 off for new buyers
3. **Buy from China sellers directly** - They undercut US resellers
4. **Shipping:** Standard (2-3 weeks) = free. Express (3-5 days) = $10+
5. **No customs issues** - These parts under $50 total = no customs tax

**Timeline:** Order TODAY. Standard shipping takes 2-3 weeks from China. If you need it faster, you're stuck with Amazon.

---

## ESP32 CODE (Much simpler than Arduino!)

### Install ESP32 in Arduino IDE:
1. Arduino IDE → Preferences
2. Add this to "Additional Boards Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Tools → Boards Manager → Search "esp32" → Install
4. Select Board: "ESP32 Dev Module"

### Motor Control Code (ESP32):
```cpp
#include <BluetoothSerial.h>

BluetoothSerial SerialBT;

// Motor pins
#define MOTOR1_SPEED 32  // PWM capable pin
#define MOTOR1_DIR 33
#define MOTOR2_SPEED 25  // PWM capable pin
#define MOTOR2_DIR 26

// PWM settings
#define PWM_FREQ 5000
#define PWM_RESOLUTION 8

void setup() {
  Serial.begin(115200);
  SerialBT.begin("Sheldon-MVP");  // Bluetooth name
  
  pinMode(MOTOR1_SPEED, OUTPUT);
  pinMode(MOTOR1_DIR, OUTPUT);
  pinMode(MOTOR2_SPEED, OUTPUT);
  pinMode(MOTOR2_DIR, OUTPUT);
  
  ledcSetup(0, PWM_FREQ, PWM_RESOLUTION);
  ledcSetup(1, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(MOTOR1_SPEED, 0);
  ledcAttachPin(MOTOR2_SPEED, 1);
  
  stopMotors();
  Serial.println("ESP32 Sheldon MVP Ready");
}

void loop() {
  if (SerialBT.available()) {
    char cmd = SerialBT.read();
    Serial.print("Command: ");
    Serial.println(cmd);
    
    switch(cmd) {
      case 'F': moveForward(); break;
      case 'B': moveBackward(); break;
      case 'L': turnLeft(); break;
      case 'R': turnRight(); break;
      case 'S': stopMotors(); break;
    }
  }
}

void moveForward() {
  digitalWrite(MOTOR1_DIR, HIGH);
  digitalWrite(MOTOR2_DIR, HIGH);
  ledcWrite(0, 200);
  ledcWrite(1, 200);
  Serial.println("FORWARD");
}

void moveBackward() {
  digitalWrite(MOTOR1_DIR, LOW);
  digitalWrite(MOTOR2_DIR, LOW);
  ledcWrite(0, 200);
  ledcWrite(1, 200);
  Serial.println("BACKWARD");
}

void turnLeft() {
  digitalWrite(MOTOR1_DIR, HIGH);
  digitalWrite(MOTOR2_DIR, HIGH);
  ledcWrite(0, 100);
  ledcWrite(1, 200);
  Serial.println("LEFT");
}

void turnRight() {
  digitalWrite(MOTOR1_DIR, HIGH);
  digitalWrite(MOTOR2_DIR, HIGH);
  ledcWrite(0, 200);
  ledcWrite(1, 100);
  Serial.println("RIGHT");
}

void stopMotors() {
  ledcWrite(0, 0);
  ledcWrite(1, 0);
  Serial.println("STOP");
}
```

### Key Difference from Arduino:
- **No HC-05 needed!** ESP32 has native Bluetooth
- **Faster execution** (240 MHz vs 16 MHz)
- **WiFi capable** (could add remote web control via WiFi too!)
- **More RAM** (better for complex logic later)

---

## WIRING FOR ESP32 (Even simpler!)

```
ESP32 DevKit       L298N Motor Driver
─────────────      ─────────────────
GND          ──────  GND
3.3V or 5V   ──────  +5V (check module spec)
GPIO32       ──────  IN1
GPIO33       ──────  IN2
GPIO25       ──────  IN3
GPIO26       ──────  IN4

L298N OUT1/OUT2  ──────  Motor 1 wires
L298N OUT3/OUT4  ──────  Motor 2 wires

6V Battery   ──────  L298N +12V input (or +6V depending on module)
```

---

## COST COMPARISON

| Component | Arduino Nano | ESP32 (Cheap) |
|-----------|------------|--------------|
| Microcontroller | $8 | $4 |
| HC-05 Bluetooth | $8 | $0 (built-in!) |
| Motors | $10 | $10 |
| L298N | $2 | $2 |
| Battery | $4 | $4 |
| Misc | $5 | $5 |
| **SUBTOTAL** | **$37** | **$25** |
| iPad (used) | $40 | $40 |
| **TOTAL** | **$77** | **$65** |

**You save $12 by using ESP32.**

---

## ALIEXPRESS REALISTIC TIMELINE

⚠️ **Important:** Standard AliExpress shipping is 14-21 days from China.
- If you order TODAY: arrives ~May 20-27
- Your event is ~May 15

**This doesn't work if your event is sooner than 2 weeks!**

---

## EMERGENCY BACKUP: Go Local

If you need parts in 2-3 days:
- **Best Buy / Micro Center:** Arduino Nano ($15-20)
- **Radio Shack equivalents** at Best Buy
- **Local electronics suppliers**
- Costs 2x more but you get it fast

---

## My Recommendation

**If you have 14+ days:** AliExpress ESP32 route ($65 total) ✅
**If you need it in 7 days:** Amazon Arduino route ($77 total)
**If you need it in 2 days:** Local Best Buy + Amazon Prime

What's your actual event date?

