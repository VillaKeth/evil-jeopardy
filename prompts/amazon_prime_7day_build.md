# AMAZON PRIME - 7-10 DAY SHELDON MVP BUILD

## EXACT AMAZON LINKS (1-2 Day Delivery with Prime)

### ORDER THESE TODAY:

**1. DC Motors + Wheels Kit** - $12-15
- **Link:** https://www.amazon.com/LAFVIN-Reduction-Plastic-Motor-Wheel/dp/B07NR1ZPPY/
- **Search:** "DC Motor 6V Robot Wheel Kit"
- **Specs:** 2x 200RPM motors, 2 wheels, caster, gearbox
- **Shipping:** 2-3 days Prime

**2. L298N Motor Driver Module** - $8-10
- **Link:** https://www.amazon.com/HiLetgo-Controller-Stepper-Stepping-Driving/dp/B00YRKI6R2/
- **Search:** "L298N Motor Driver Module"
- **Shipping:** 2-3 days Prime

**3. Arduino Nano CH340 Clone** - $8-12  
- **Link:** https://www.amazon.com/LAFVIN-Arduino-Compatible-CH340-Bootloader/dp/B07G99NNQM/
- **Search:** "Arduino Nano CH340"
- **Important:** Get CH340 version (better drivers)
- **Shipping:** 2-3 days Prime

**4. HC-05 Bluetooth Module** - $8-12
- **Link:** https://www.amazon.com/DSD-TECH-Bluetooth-Serial-Transceiver/dp/B01G9KSAF6/
- **Search:** "HC-05 Bluetooth Module"
- **Shipping:** 2-3 days Prime

**5. 6V Battery Holder (4xAA)** - $5-8
- **Link:** https://www.amazon.com/Batteries-Holder-Switch-4xAA-6V/dp/B07DGYKBV3/
- **Search:** "4xAA Battery Holder 6V with Switch"
- **Shipping:** 2-3 days Prime

**6. Jumper Wire Assortment** - $6-10
- **Link:** https://www.amazon.com/ELEGOO-Breadboard-Jumping-Wires-Arduino/dp/B01EV70C78/
- **Search:** "Jumper Wire Male to Male Kit"
- **Shipping:** 2-3 days Prime

**7. USB Cable (likely have this)**
- Arduino Nano uses Micro-USB
- Check if you have one first!

### OPTIONAL (But helpful):
- **Breadboard** ($5) - Makes wiring cleaner
- **AA Batteries (8-pack)** ($8) - Get quality ones, cheap ones die fast
- **Hot glue gun** ($8) - For mounting components

### USED iPad (OFF-SITE):
- **Facebook Marketplace / Craigslist:** $30-50
- Search: "iPad Air" or "iPad" + your city
- Doesn't need to be fancy—just needs WiFi + screen

---

## YOUR AMAZON CART (Copy-Paste Total):

```
Motor Kit:             $12
L298N Driver:          $9
Arduino Nano:          $10
HC-05 Bluetooth:       $9
Battery Holder:        $6
Jumper Wires:          $8
────────────────────────
SUBTOTAL:              $54
+ Tax:                 ~$5
────────────────────────
TOTAL (Electronics):   ~$59
```

---

## DELIVERY TIMELINE WITH PRIME

| Day | Task |
|-----|------|
| **Today (Day 1)** | Order all parts from Amazon |
| **Day 2-3** | Parts arrive (Prime 1-2 day) |
| **Day 4-5** | Assemble hardware, solder connections |
| **Day 6-7** | Upload code, test motors + Bluetooth |
| **Day 8** | Mount iPad, test video + audio |
| **Day 9** | Full dry run with remote person |
| **Day 10** | Buffer day / Final tweaks |

---

## WHAT TO DO WHILE WAITING FOR PARTS

### Download & Install NOW (takes 20 min):

1. **Arduino IDE** (free)
   - Download: https://www.arduino.cc/en/software
   - Install on your computer
   - You'll use this to program the Arduino

2. **Node.js LTS** (free)
   - Download: https://nodejs.org/
   - This runs the control server

3. **USB CH340 Drivers** (if on Windows)
   - Download: https://sparkfun.com/products/15096
   - Install BEFORE connecting Arduino to USB
   - (Not needed if you just wait for Arduino to arrive with drivers)

### Get familiar with:
- Opening Terminal/PowerShell
- Navigating folders with commands
- Basic Node.js setup

---

## DAY 2 (WHEN PARTS ARRIVE) - ASSEMBLY

### Step 1: Motor Assembly (15 min)
1. Connect DC motor wires to L298N OUT1/OUT2 and OUT3/OUT4
2. Glue/bolt motors to PVC pipe or wooden base
3. Attach wheels to motor shafts
4. Mount caster wheel in front/back (for balance)

### Step 2: Electronics Wiring (30 min)
- Connect L298N to Arduino using jumper wires (see diagram below)
- Connect HC-05 Bluetooth to Arduino
- Connect 6V battery to L298N

### Step 3: Code Upload (15 min)
- Plug Arduino into USB
- Copy-paste Arduino code (provided earlier)
- Click Upload in Arduino IDE
- Wait for "Done uploading" message

**Time to working motors: 1 hour total**

---

## WIRING DIAGRAM (L298N → Arduino Nano)

```
ARDUINO NANO (Top View):
┌─────────────────────┐
│ GND  TX0  RX1  REST │
│ VIN  TX1  RX0  D13  │
│ 3.3V D12 D11 D10    │
│ REF  D9  D8  D7     │
│ A0   D6  D5  D4     │
│ A1   D3  D2  D1     │
└─────────────────────┘

L298N Module Pins:
GND ─────────────────► Arduino GND
+5V (or 12V) ────────► Arduino 5V
IN1 ─────────────────► Arduino D5 (PWM pin)
IN2 ─────────────────► Arduino D6 (PWM pin)
IN3 ─────────────────► Arduino D10 (PWM pin)
IN4 ─────────────────► Arduino D11 (PWM pin)

Motor Connections:
OUT1 & OUT2 ────────► Motor 1 (black & red wires)
OUT3 & OUT4 ────────► Motor 2 (black & red wires)

Battery Connection (6V):
RED  ─────────────────► L298N +12V (or +6V input)
BLACK ────────────────► L298N GND

HC-05 Bluetooth (Optional - Arduino serial):
GND ──────────────────► Arduino GND
VCC (5V) ─────────────► Arduino 5V (with voltage regulator if needed)
TX ───────────────────► Arduino RX0 (pin 0) via voltage divider
RX ───────────────────► Arduino TX1 (pin 1)

VOLTAGE DIVIDER FOR HC-05 RX (if using 3.3V RX):
HC-05 TX ──[1K resistor]──┬──► Arduino RX0
                         └──[2K resistor]──► GND
```

---

## QUICK TEST AFTER UPLOAD

1. Plug Arduino into USB (using different USB port than before)
2. Open Arduino IDE → **Tools → Serial Monitor**
3. Set baud rate to **9600**
4. You should see: `=== Sheldon MVP Arduino Controller Ready ===`
5. Type in the monitor:
   - `F` → Motors spin forward
   - `B` → Motors spin backward
   - `L` → Turn left
   - `R` → Turn right
   - `S` → Stop

If you see commands print but motors don't move:
- Check battery voltage (should be ~6V)
- Check motor wires are seated in L298N outputs
- Try swapping motor wires (reverse polarity)

---

## SHOPPING CHECKLIST

- [ ] DC Motor Kit ($12)
- [ ] L298N Driver ($9)
- [ ] Arduino Nano CH340 ($10)
- [ ] HC-05 Bluetooth ($9)
- [ ] 6V Battery Holder ($6)
- [ ] Jumper Wires ($8)
- [ ] AA Batteries (4-pack minimum for testing)
- [ ] Used iPad (local: Marketplace/Craigslist) ($30-50)
- [ ] PVC pipe or wood board (local hardware store) ($3-5)

---

## TOTAL COST BREAKDOWN

| Category | Cost |
|----------|------|
| Electronics (Amazon Prime) | $59 |
| iPad (used, local) | $40 |
| PVC/Wood Base | $5 |
| **GRAND TOTAL** | **$104** |

Within budget! ✅

---

## TROUBLESHOOTING PREP

Download these before you need them:
- CH340 USB drivers: https://sparkfun.com/products/15096
- Arduino board files: https://github.com/espressif/arduino-esp32
- Node.js setup guide: https://nodejs.org/en/docs/

