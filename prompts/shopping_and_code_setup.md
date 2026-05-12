# Shopping Links & Code Setup Guide

## EXACT SHOPPING LINKS (Amazon)

**Motor + Wheels Kit** (~$15)
- Search: "DC Motor 6V 200 RPM Robot Car Wheel"
- Exact product: https://www.amazon.com/LAFVIN-Reduction-Plastic-Motor-Wheel/dp/B07NR1ZPPY/
- Gets you: 2 motors, 2 wheels, 1 caster, gearbox

**L298N Motor Driver** (~$8)
- Search: "L298N Motor Driver Module"
- Exact product: https://www.amazon.com/HiLetgo-Controller-Stepper-Stepping-Driving/dp/B00YRKI6R2/
- Includes: PCB module, all pins labeled

**HC-05 Bluetooth Module** (~$8)
- Search: "HC-05 Bluetooth Module Wireless Serial"
- Exact product: https://www.amazon.com/DSD-TECH-Bluetooth-Serial-Transceiver/dp/B01G9KSAF6/

**Arduino Nano Clone** (~$10)
- Search: "Arduino Nano CH340 USB"
- Exact product: https://www.amazon.com/LAFVIN-Arduino-Compatible-CH340-Bootloader/dp/B07G99NNQM/
- Note: CH340 is the USB chip (better than older versions)

**6V Battery Holder** (~$5-10)
- Search: "4x AA Battery Holder with Switch 6V"
- Exact product: https://www.amazon.com/Batteries-Holder-Switch-4xAA-6V/dp/B07DGYKBV3/

**Optional Essentials:**
- Jumper wires assortment (~$6): "Breadboard Jumper Wires 10cm Male to Male"
- Breadboard (~$5): "830 Point Breadboard Solderless"
- Solder + Soldering Iron (~$15): "60W Soldering Iron Kit"

**TOTAL TIME FOR DELIVERY:** 2-3 days for Amazon Prime, 5-7 days standard

---

## CODE SETUP - STEP BY STEP

### STEP 1: Get Arduino IDE Running
1. Download: https://www.arduino.cc/en/software
2. Install on your computer
3. Open Arduino IDE
4. Go to **Tools → Board → Select "Arduino Nano"**
5. Go to **Tools → Processor → Select "ATmega328P"**
6. Go to **Tools → Port → Select your COM port** (will see COM3, COM4, etc.)

### STEP 2: Flash Arduino with Motor Control Sketch
1. Paste this code into Arduino IDE:

```cpp
#include <SoftwareSerial.h>

// Motor control pins
#define MOTOR1_SPEED 5    // PWM pin for motor 1 speed
#define MOTOR1_DIR 6      // Direction pin for motor 1
#define MOTOR2_SPEED 10   // PWM pin for motor 2 speed
#define MOTOR2_DIR 11     // Direction pin for motor 2

// Bluetooth serial (software serial on pins 9, 8)
SoftwareSerial btSerial(9, 8);

void setup() {
  // Set motor pins as output
  pinMode(MOTOR1_SPEED, OUTPUT);
  pinMode(MOTOR1_DIR, OUTPUT);
  pinMode(MOTOR2_SPEED, OUTPUT);
  pinMode(MOTOR2_DIR, OUTPUT);
  
  // Start serial communications
  Serial.begin(9600);       // USB for debugging
  btSerial.begin(9600);     // HC-05 Bluetooth module
  
  // Stop motors on startup
  stopMotors();
  
  Serial.println("=== Sheldon MVP Arduino Controller Ready ===");
}

void loop() {
  // Check if Bluetooth has data
  if (btSerial.available()) {
    char cmd = btSerial.read();
    Serial.print("Received command: ");
    Serial.println(cmd);
    
    switch(cmd) {
      case 'F':
      case 'f':
        moveForward();
        break;
      case 'B':
      case 'b':
        moveBackward();
        break;
      case 'L':
      case 'l':
        turnLeft();
        break;
      case 'R':
      case 'r':
        turnRight();
        break;
      case 'S':
      case 's':
        stopMotors();
        break;
      default:
        Serial.print("Unknown command: ");
        Serial.println(cmd);
    }
  }
}

void moveForward() {
  digitalWrite(MOTOR1_DIR, HIGH);
  digitalWrite(MOTOR2_DIR, HIGH);
  analogWrite(MOTOR1_SPEED, 200);  // Speed 0-255
  analogWrite(MOTOR2_SPEED, 200);
  Serial.println("Moving FORWARD");
}

void moveBackward() {
  digitalWrite(MOTOR1_DIR, LOW);
  digitalWrite(MOTOR2_DIR, LOW);
  analogWrite(MOTOR1_SPEED, 200);
  analogWrite(MOTOR2_SPEED, 200);
  Serial.println("Moving BACKWARD");
}

void turnLeft() {
  digitalWrite(MOTOR1_DIR, HIGH);
  digitalWrite(MOTOR2_DIR, HIGH);
  analogWrite(MOTOR1_SPEED, 100);  // Left motor slower
  analogWrite(MOTOR2_SPEED, 200);  // Right motor faster
  Serial.println("Turning LEFT");
}

void turnRight() {
  digitalWrite(MOTOR1_DIR, HIGH);
  digitalWrite(MOTOR2_DIR, HIGH);
  analogWrite(MOTOR1_SPEED, 200);  // Left motor faster
  analogWrite(MOTOR2_SPEED, 100);  // Right motor slower
  Serial.println("Turning RIGHT");
}

void stopMotors() {
  analogWrite(MOTOR1_SPEED, 0);
  analogWrite(MOTOR2_SPEED, 0);
  Serial.println("Motors STOPPED");
}
```

2. Click **Upload** (arrow button)
3. Wait for "Done uploading" message
4. Arduino is now programmed ✅

### STEP 3: Set Up Node.js Server

#### Prerequisites:
- Install Node.js: https://nodejs.org/ (LTS version)
- Install npm (comes with Node.js)

#### Create project folder:
```bash
mkdir sheldon-mvp
cd sheldon-mvp
npm init -y
npm install express socket.io serialport
```

#### Create file: `server.js`
```javascript
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { SerialPort } = require('serialport');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*" }
});

app.use(express.static('public'));

// Try to find Arduino on common ports
let port = null;
const tryPorts = ['COM3', 'COM4', 'COM5', 'COM6', '/dev/ttyUSB0', '/dev/ttyACM0'];

function connectArduino() {
  SerialPort.list().then(ports => {
    console.log('Available serial ports:', ports);
    
    // Find Arduino port (usually contains "Arduino" or "CH340")
    const arduinoPort = ports.find(p => 
      p.manufacturer?.includes('Arduino') || 
      p.manufacturer?.includes('CH340') ||
      p.path.includes('COM')
    );
    
    if (arduinoPort) {
      console.log('Found Arduino on:', arduinoPort.path);
      port = new SerialPort({ path: arduinoPort.path, baudRate: 9600 });
      
      port.on('error', (err) => {
        console.log('Serial error:', err.message);
      });
      
      port.on('data', (data) => {
        console.log('Arduino says:', data.toString().trim());
      });
    }
  });
}

connectArduino();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('move', (direction) => {
    if (!port) {
      console.log('ERROR: No Arduino connected!');
      return;
    }
    
    const cmd = direction.toUpperCase()[0];
    console.log('Sending to Arduino:', cmd);
    port.write(cmd + '\n', (err) => {
      if (err) {
        console.log('Write error:', err.message);
      }
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    if (port) port.write('S\n');
  });
});

server.listen(3000, () => {
  console.log('🚀 Sheldon MVP Server running on http://localhost:3000');
  console.log('Make sure Arduino Nano is connected via USB!');
});
```

#### Create file: `public/index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sheldon MVP - Remote Control</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    .container {
      text-align: center;
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    
    h1 {
      color: #333;
      margin-bottom: 10px;
    }
    
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    
    .controls {
      display: grid;
      grid-template-columns: repeat(3, 100px);
      gap: 10px;
      justify-content: center;
      margin: 30px 0;
    }
    
    button {
      width: 80px;
      height: 80px;
      font-size: 20px;
      font-weight: bold;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      background: #667eea;
      color: white;
    }
    
    button:hover {
      transform: scale(1.05);
      background: #764ba2;
    }
    
    button:active {
      transform: scale(0.95);
    }
    
    .forward { grid-column: 2; }
    .left { grid-column: 1; }
    .stop { grid-column: 2; background: #e74c3c; }
    .right { grid-column: 3; }
    .backward { grid-column: 2; }
    
    .status {
      margin-top: 30px;
      padding: 15px;
      background: #f0f0f0;
      border-radius: 10px;
      color: #333;
      font-weight: bold;
    }
    
    .status.connected {
      background: #d4edda;
      color: #155724;
    }
    
    .status.disconnected {
      background: #f8d7da;
      color: #721c24;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 Sheldon MVP Control</h1>
    <p class="subtitle">Evil Jeopardy 1.2 Remote Presence Device</p>
    
    <div class="controls">
      <button class="forward" onclick="move('F')">⬆️</button>
      <button class="left" onclick="move('L')">⬅️</button>
      <button class="stop" onclick="move('S')">STOP</button>
      <button class="right" onclick="move('R')">➡️</button>
      <button class="backward" onclick="move('B')">⬇️</button>
    </div>
    
    <div class="status disconnected" id="status">⚠️ Connecting...</div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    const statusDiv = document.getElementById('status');
    
    socket.on('connect', () => {
      console.log('Connected to server!');
      statusDiv.textContent = '✅ Connected - Ready to control';
      statusDiv.classList.remove('disconnected');
      statusDiv.classList.add('connected');
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      statusDiv.textContent = '❌ Disconnected - Reconnecting...';
      statusDiv.classList.add('disconnected');
      statusDiv.classList.remove('connected');
    });
    
    function move(direction) {
      socket.emit('move', direction);
      console.log('Sent:', direction);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      switch(e.key.toLowerCase()) {
        case 'arrowup': move('F'); break;
        case 'arrowdown': move('B'); break;
        case 'arrowleft': move('L'); break;
        case 'arrowright': move('R'); break;
        case ' ': move('S'); break;
      }
    });
  </script>
</body>
</html>
```

### STEP 4: Run Everything

**Terminal 1 - Start Node.js server:**
```bash
cd sheldon-mvp
node server.js
```

You should see:
```
🚀 Sheldon MVP Server running on http://localhost:3000
Make sure Arduino Nano is connected via USB!
```

**Terminal 2 - Open browser:**
- Go to: `http://localhost:3000`
- You should see the control interface
- Buttons should light up when you click them
- Watch the Terminal 1 for "Sent to Arduino: F" messages

### STEP 5: Test Hardware Connection

1. **Check Arduino on USB:**
   - Plug Arduino into computer USB
   - You should see a COM port appear (COM3, COM4, etc.)
   - Windows Device Manager will show "Arduino" or "CH340"

2. **Test in Arduino IDE:**
   - Go to **Tools → Serial Monitor**
   - Set baud rate to 9600
   - You should see: "=== Sheldon MVP Arduino Controller Ready ==="

3. **Test Motor Command:**
   - In Serial Monitor, type: `F` (then Send)
   - Motors should spin forward
   - Type: `S` to stop

---

## WIRING DIAGRAM (L298N to Arduino)

```
L298N Module          Arduino Nano
─────────────         ─────────────
GND           ──────  GND
+5V           ──────  5V (or external power)
IN1 (pin 1)   ──────  D5 (PWM)
IN2 (pin 2)   ──────  D6 (PWM)
IN3 (pin 3)   ──────  D10 (PWM)
IN4 (pin 4)   ──────  D11 (PWM)
OUT1          ──────  Motor 1 Wire 1
OUT2          ──────  Motor 1 Wire 2
OUT3          ──────  Motor 2 Wire 1
OUT4          ──────  Motor 2 Wire 2

HC-05 Bluetooth Module    Arduino Nano
──────────────────        ────────────
GND                ──────  GND
VCC (5V)           ──────  5V
TX                 ──────  RX0 (D0) via voltage divider
RX                 ──────  TX1 (D1)

6V Battery
─────────
GND (Black)  ──────  L298N GND, Arduino GND
+6V (Red)    ──────  L298N +12V or +6V input
```

---

## TROUBLESHOOTING

**Problem:** Arduino doesn't appear in COM ports
- **Solution:** Install CH340 driver from: https://sparkfun.com/products/15096

**Problem:** "ERROR: No Arduino connected!"
- **Solution:** Check USB cable, try different USB port, verify Device Manager shows COM port

**Problem:** Motors don't move
- **Solution:** Check battery voltage with multimeter, verify motor wires are connected to L298N output

**Problem:** Buttons don't work in web interface
- **Solution:** Check browser console (F12 → Console), make sure `node server.js` is running

**Problem:** Bluetooth not working
- **Solution:** Pair HC-05 in Windows Bluetooth settings first (PIN usually 1234)

