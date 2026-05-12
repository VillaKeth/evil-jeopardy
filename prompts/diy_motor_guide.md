# DIY Wheeled Base + Bluetooth Motor Control - Complete Guide

## MOTOR SELECTION ($30-40)

### Option A: 2x DC Motors + L298N Motor Driver (EASIEST) ⭐ RECOMMENDED
**What to buy on Amazon:**
1. **2x 6V DC Motors with wheels** - "DC Motor with wheel kit" (~$15)
   - Search: "6V DC motor wheel kit"
   - Comes with: 2 motors, 2 wheels, 1 caster wheel
   - Specs: 200-300 RPM, 6V nominal
   
2. **L298N Motor Driver Module** (~$8)
   - Allows you to control 2 motors independently
   - PWM speed control + direction (forward/back)
   - Draws 5V logic signal, drives 6-12V motors
   
3. **HC-05 Bluetooth Module** (~$8)
   - Serial communication over Bluetooth
   - Plugs into Arduino/microcontroller
   - Range ~10 meters
   
4. **Arduino Nano or Elegoo microcontroller** (~$10)
   - Small, cheap, easy to program
   - Interfaces with: L298N motor driver, HC-05 Bluetooth

### Option B: Servo Motors (Simpler wiring, less control)
- Buy: 2x Servo motors (~$20 total)
- Con: Limited speed control, less dynamic movement

**MY RECOMMENDATION: Option A** - DC motors + L298N + Bluetooth is industry standard and easiest to debug.

---

## TECH STACK ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                    REMOTE FRIEND'S COMPUTER              │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Web Dashboard (localhost:3000)                   │ │
│  │  - Forward / Back / Left / Right buttons         │ │
│  │  - Jitsi Video/Audio (iPad on wheeled base)      │ │
│  └───────────────────────────────────────────────────┘ │
│              │                                          │
│              │ WebSocket (Socket.io)                    │
│              ▼                                          │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Node.js Server (Node.js running locally)        │ │
│  │  - Receives: "FORWARD", "LEFT", "RIGHT", "BACK" │ │
│  │  - Sends: Serial commands via USB to Arduino    │ │
│  └───────────────────────────────────────────────────┘ │
└──────────────┬──────────────────────────────────────────┘
               │ USB Serial (via node-serialport)
               ▼
      ┌────────────────────┐
      │   Arduino Nano     │
      │  + HC-05 Bluetooth │  ← This wirelessly talks to motors
      │  + L298N Driver    │
      └────────┬───────────┘
               │ Bluetooth
               ▼
    ┌──────────────────────────┐
    │  DIY Wheeled Base        │
    │  2x DC Motors            │
    │  + Caster wheel          │
    │  + iPad mounted on top   │
    └──────────────────────────┘


SIMPLER ALTERNATIVE (No Arduino):

┌─────────────────────────────────┐
│  Tablet/PC with Bluetooth       │
│  Running Node.js app            │
└─────────────┬───────────────────┘
              │ Bluetooth Direct
              ▼
    ┌──────────────────────────┐
    │ Bluetooth Motor Module   │
    │ (Bluetooth receiver)     │
    │ + L298N Driver           │
    └─────────────────────────┘
              ▼
    ┌──────────────────────────┐
    │ 2x DC Motors + Wheels    │
    └──────────────────────────┘
```

---

## STEP-BY-STEP BUILD & CODE

### HARDWARE ASSEMBLY
1. Glue/bolt 2x DC motors to PVC pipe or wood base
2. Connect motors to L298N driver:
   - Motor1 → OUT1, OUT2 on L298N
   - Motor2 → OUT3, OUT4 on L298N
3. Connect L298N to Arduino:
   - L298N IN1 → Arduino D5 (PWM)
   - L298N IN2 → Arduino D6 (PWM)
   - L298N IN3 → Arduino D10 (PWM)
   - L298N IN4 → Arduino D11 (PWM)
   - L298N GND → Arduino GND
4. Connect HC-05 Bluetooth to Arduino:
   - HC-05 TX → Arduino RX (pin 0) or Software Serial
   - HC-05 RX → Arduino TX (pin 1) with voltage divider
   - HC-05 GND → Arduino GND
5. Connect 6V battery to L298N +6V and GND
6. Mount iPad on top

### ARDUINO CODE (sketch)
```cpp
#include <SoftwareSerial.h>

// Motor pins
#define IN1 5   // Motor 1 direction
#define IN2 6   // Motor 1 speed
#define IN3 10  // Motor 2 direction
#define IN4 11  // Motor 2 speed

// Bluetooth serial (RX=9, TX=8)
SoftwareSerial btSerial(9, 8);

void setup() {
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  
  Serial.begin(9600);    // USB Serial
  btSerial.begin(9600);  // Bluetooth module
  
  Serial.println("Sheldon MVP Ready");
}

void loop() {
  if (btSerial.available()) {
    char cmd = btSerial.read();
    
    switch(cmd) {
      case 'F':  // Forward
        moveForward();
        break;
      case 'B':  // Backward
        moveBackward();
        break;
      case 'L':  // Left (left motor slower)
        turnLeft();
        break;
      case 'R':  // Right (right motor slower)
        turnRight();
        break;
      case 'S':  // Stop
        stopMotors();
        break;
    }
  }
}

void moveForward() {
  analogWrite(IN2, 200);  // Motor 1 speed
  analogWrite(IN4, 200);  // Motor 2 speed
  digitalWrite(IN1, HIGH);
  digitalWrite(IN3, HIGH);
}

void moveBackward() {
  analogWrite(IN2, 200);
  analogWrite(IN4, 200);
  digitalWrite(IN1, LOW);
  digitalWrite(IN3, LOW);
}

void turnLeft() {
  analogWrite(IN2, 100);  // Left motor slower
  analogWrite(IN4, 200);  // Right motor faster
  digitalWrite(IN1, HIGH);
  digitalWrite(IN3, HIGH);
}

void turnRight() {
  analogWrite(IN2, 200);
  analogWrite(IN4, 100);
  digitalWrite(IN1, HIGH);
  digitalWrite(IN3, HIGH);
}

void stopMotors() {
  analogWrite(IN2, 0);
  analogWrite(IN4, 0);
}
```

### NODE.JS BACKEND (server.js)
```javascript
const express = require('express');
const SerialPort = require('serialport');
const socketIO = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Find Arduino USB port
const port = new SerialPort.SerialPort({
  path: 'COM3', // Change to your Arduino port
  baudRate: 9600
});

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('move', (direction) => {
    const cmd = direction.toUpperCase()[0]; // 'F', 'B', 'L', 'R', 'S'
    port.write(cmd, (err) => {
      if (err) console.log('Error:', err);
      else console.log('Sent:', cmd);
    });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
    port.write('S'); // Stop motors
  });
});

server.listen(3000, () => {
  console.log('Sheldon MVP server running on http://localhost:3000');
});
```

### SIMPLE WEB INTERFACE (public/index.html)
```html
<!DOCTYPE html>
<html>
<head>
  <title>Sheldon MVP Control</title>
  <style>
    body { text-align: center; padding: 50px; }
    .controls { font-size: 24px; margin: 20px; }
    button { width: 60px; height: 60px; font-size: 20px; margin: 5px; }
    .arrow-up { margin-bottom: 20px; }
    .arrow-left { margin-right: 10px; }
    .arrow-stop { margin: 20px; background: red; color: white; width: 100px; height: 100px; }
  </style>
</head>
<body>
  <h1>Sheldon MVP - Remote Control</h1>
  
  <div class="controls">
    <div class="arrow-up">
      <button onclick="move('F')">↑ Forward</button>
    </div>
    
    <div>
      <button class="arrow-left" onclick="move('L')">← Left</button>
      <button class="arrow-stop" onclick="move('S')">STOP</button>
      <button onclick="move('R')">Right →</button>
    </div>
    
    <div>
      <button onclick="move('B')">↓ Back</button>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    
    function move(direction) {
      socket.emit('move', direction);
      console.log('Moving:', direction);
    }
  </script>
</body>
</html>
```

---

## AUDIO/VIDEO FOR REMOTE FRIEND

**The iPad runs:**
1. **Jitsi Meet** (web app) - connects remote friend's audio/video
2. **Bluetooth connection to motors** - allows remote control

**In-room players see:**
- iPad screen (shows remote friend's face/video)
- Hear audio from iPad speakers

**Remote friend sees/hears:**
- iPad camera feed (room)
- Mic pickup from room
- Can control robot movement via web dashboard OR you control it for "evil" effect

---

## PARTS SHOPPING LIST (~$95-110)

| Item | Cost | Link/Search |
|------|------|------------|
| 2x DC Motor + Wheel Kit | $15 | Amazon: "DC motor 6V wheel kit" |
| L298N Motor Driver | $8 | Amazon: "L298N motor driver module" |
| HC-05 Bluetooth Module | $8 | Amazon: "HC-05 Bluetooth module" |
| Arduino Nano | $10 | Amazon: "Arduino Nano CH340" |
| 6V Battery + Holder | $15 | Amazon: "6V battery holder 4xAA" |
| USB Cable (Arduino) | $5 | Probably have this |
| PVC Pipe/Wood Base | $10 | Local hardware store |
| iPad (used) | $30-50 | Facebook Marketplace |
| Misc (solder, wires, hot glue) | $10 | Hardware store |
| **TOTAL** | **~$95-130** | |

---

## 10-DAY TIMELINE

**Days 1-2:** Order all parts (overnight if possible)
**Days 3-4:** Assemble wheeled base + motors
**Days 5-6:** Set up Arduino + Bluetooth code
**Days 7-8:** Set up Node.js server + web dashboard
**Day 9:** Mount iPad + test full integration
**Day 10:** Final testing + comedy debugging

---

## TIPS FOR SUCCESS

1. **Test each component separately first** - motors, Bluetooth, Arduino code
2. **Start with manual motor testing** - USB cable to Arduino, send commands to verify movement
3. **Add Jitsi video LAST** - get mechanics working first
4. **Bluetooth range** - HC-05 works ~10m, move your control computer closer if issues
5. **Power management** - 6V battery will last ~2-3 hours, charge beforehand

---

## "EVIL" FEATURES YOU CAN ADD

- Random brief disconnects (very brief!)
- Slow response time on commands
- Motors cut out occasionally
- Audio on iPad mic "stops working" momentarily
- Robot spins in wrong direction on purpose
- Speed up/slow down unpredictably

