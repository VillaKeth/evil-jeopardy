# Evil Jeopardy 1.2 - Sheldon MVP: Complete Tech Stack

## RECOMMENDED APPROACH: iPad + Motorized Base

### Why This Path for 10 Days?
- **Reliability:** iPad is battle-tested, stable hardware
- **Speed:** No soldering, minimal assembly
- **Quality:** Professional appearance
- **Flexibility:** Can run web apps easily
- **All-in cost:** ~$1200-1500 for complete setup

---

## Hardware Stack

### PRIMARY COMPONENTS
1. **iPad Air (2024)** - $599
   - 11" screen (good visibility from distance)
   - A17 Pro chip (smooth video)
   - Lightweight for robot base
   - Alternatives: iPad Pro (larger, more expensive)

2. **Motorized Robot Base** - $800-1200
   - **Option A:** Adept MobileRobots Pioneer 3-DX (~$800, used market)
   - **Option B:** Turtlebot 3 Waffle (~$1200, newer)
   - **Option C:** Custom build with DC motors + wheels (~$400-600, more assembly)
   - Requirements: Payload 10+ lbs, speed 1-2 ft/sec, battery life 4-6 hours
   
3. **Mount for iPad** - $30-50
   - Adjustable tablet holder that clamps to robot base
   - Should allow ~45° tilt for screen visibility

4. **Audio Upgrades** - $200-300
   - Directional microphone (pointing at room) - Blue Yeti ($100)
   - Small wireless speaker (mounted on base) OR use iPad speakers
   - Better than relying on iPad's built-in audio

5. **Power & Charging** - $100-150
   - Battery pack for robot (usually included)
   - iPad charger (mobile charging cart recommended)
   - Power strips for charging station

### OPTIONAL UPGRADES (if budget allows)
- 360° camera (for better visibility) - $150
- Better speakers/microphone array - $200+
- LED ring light (for dramatic Sheldon effect) - $30

---

## Software Stack

### VIDEO/AUDIO BACKEND
**Use Jitsi Meet** (self-hosted WebRTC, no licensing)
- Pros: Open-source, reliable, supports up to 100 participants
- Cons: Requires server to host
- Alternative: Twilio (easier but $$$ per participant)

**Quick Setup:**
```
1. Host Jitsi on cloud server (AWS EC2 t3.small ~$10/mo)
2. Remote user joins Jitsi room from their computer
3. iPad in room joins same Jitsi room (locked, no duplicate audio)
4. Audio/video flows through Jitsi bridge
```

### ROBOT CONTROL BACKEND
**Node.js + Socket.io + ROS (Robot Operating System)**
- Robot base runs ROS (pre-installed on many platforms)
- Node.js server communicates with ROS via rosbridge_websocket
- Socket.io sends movement commands from web interface

**Simplified if using off-the-shelf robot:**
- Many have built-in web interfaces (just customize)
- Can control via simple HTTP requests

### WEB INTERFACE (for in-room controls)
**Framework:** React or Vue (simple dashboard)
- Forward/Back/Left/Right buttons
- Camera pan/tilt if motorized camera
- Volume control
- Status display

**Deployment:** Same Node.js server, or separate frontend service

---

## Network Architecture

```
┌─────────────────────────────────────────────────────┐
│            EVIL JEOPARDY GAME ROOM                  │
│                                                     │
│  ┌──────────────────────────────────────┐          │
│  │  iPad on Robot Base (Sheldon MVP)    │          │
│  │  - Running Jitsi web app            │          │
│  │  - Camera feed to remote user       │          │
│  │  - Microphone listening to room     │          │
│  └──────────────────────────────────────┘          │
│           │                          │              │
│           │ WiFi                     │ BLE/WiFi    │
│           ▼                          ▼              │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │  Game Server     │      │ Robot Controller │   │
│  │  (Node.js)       │      │ (ROS/Custom)     │   │
│  │  Port: 3000      │      │                  │   │
│  └──────────────────┘      └──────────────────┘   │
│           │                                        │
│  ┌────────┴──────────────────────────┐            │
│  │        INTERNET (home WiFi)       │            │
│  └────────┬──────────────────────────┘            │
│           │                                        │
│           ▼                                        │
│  ┌─────────────────────────────────────┐         │
│  │     JITSI MEET SERVER (Cloud)       │         │
│  │     (AWS / DigitalOcean)            │         │
│  └─────────────────────────────────────┘         │
│           △                                        │
│           │ Internet                              │
│           │                                        │
└───────────┼────────────────────────────────────────┘
            │
       ┌────┴─────────────┐
       │                  │
       ▼                  ▼
    Remote User      (Game Control
   (Computer/        Optional:
    Phone)          Same interface)
```

---

## Day-by-Day Timeline

**Days 1-2: PROCUREMENT**
- Order iPad Air
- Order robot base
- Order iPad mount
- Order microphone/speaker kit
- Research cloud server options

**Days 3-4: HARDWARE ASSEMBLY**
- Receive parts
- Mount iPad on robot base
- Test robot movement
- Install microphone/speaker
- Charge all batteries

**Days 5-6: SERVER SETUP**
- Spin up Jitsi instance on cloud server
- Set up Node.js backend on same server
- Test local network connection
- Create simple web dashboard for controls

**Days 7-8: INTEGRATION**
- iPad connects to Jitsi room
- Test audio/video quality
- Integrate robot control into dashboard
- Test movement commands from in-room interface

**Days 9-10: TESTING & TWEAKS**
- Full dry run with remote participant
- Audio quality fixes (mute/unmute, volume balancing)
- Latency testing
- Buffer day for troubleshooting

---

## Cost Breakdown

| Item | Cost | Notes |
|------|------|-------|
| iPad Air | $599 | Buy new or refurbished |
| Robot Base | $800-1200 | Used robot or TurtleBot 3 |
| Mount + cables | $80 | iPad mount + power cables |
| Microphone | $100 | Blue Yeti or USB mic |
| Speaker | $50 | Small Bluetooth speaker |
| Cloud Server (Jitsi) | $10-20/mo | AWS EC2 t3.small |
| Misc (batteries, adapters) | $100 | | 
| **TOTAL** | **~$1,740-2,050** | |

---

## Key Decisions Needed

1. **Robot Base:** New TurtleBot ($1200+) vs used Pioneer ($600-800)?
2. **Jitsi:** Self-hosted vs Twilio/3CX managed?
3. **Remote Control:** Who controls movement—remote user or in-room players?
4. **Camera Quality:** Built-in iPad cam vs USB camera for better angle?

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Robot base delays | Order TODAY, have backup: use desktop on wheels |
| WiFi instability | Dedicated 5GHz channel, wired fallback with long Ethernet |
| Audio feedback loops | Mute iPad speakers when using external speaker |
| Video latency | Use wired connection if possible, or close 5G bands interference |
| iPad crashes | Restart daily, disable auto-updates during event |

---

## "Evil" Features to Add Later

- Randomly disconnect remote user (if doing full evil mode)
- Low-battery warnings for comedic effect
- Slight delay in audio/video (technical "issues")
- Robot moves unpredictably when remote user tries to control it
- Screen rotation jokes

