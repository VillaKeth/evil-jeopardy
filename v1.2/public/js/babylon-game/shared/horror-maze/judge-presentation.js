// Evil Jeopardy 1.2 — Judge Presentation (Room 14 finale)
// Handles judge reveal, cake examination, verdict text, and final scoring.

class JudgePresentation {
  constructor(scene, hudTexture, cakeHealth, sounds) {
    this.scene = scene;
    this.hudTexture = hudTexture;
    this.cakeHealth = cakeHealth;
    this.sounds = sounds;
    this._disposed = false;
    this.state = 'IDLE';
    this.bonusRooms = 0;
  }

  setBonusRooms(count) {
    this.bonusRooms = count;
  }

  start(roomData, onComplete) {
    this.onComplete = onComplete;
    this.roomData = roomData;
    this.state = 'ENTRY';

    if (this.sounds) this.sounds.doorSlam();
    this._showText('The doors seal behind you...', 2000);

    setTimeout(() => {
      if (this._disposed) return;
      this._reveal();
    }, 2500);
  }

  _reveal() {
    this.state = 'REVEAL';
    this._showText('', 0);

    if (this.sounds) {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          if (!this._disposed && this.sounds) this.sounds.ambientDrip();
        }, i * 400);
      }
    }

    this._showText('🕯️ Candles ignite...', 2000);

    setTimeout(() => {
      if (this._disposed) return;
      this._showText('👹 THE JUDGES REVEAL THEMSELVES', 2500);
      if (this.sounds) this.sounds.entityRoar();

      setTimeout(() => {
        if (this._disposed) return;
        this._examine();
      }, 3000);
    }, 2500);
  }

  _examine() {
    this.state = 'EXAMINE';
    this._showText('The judges examine your cake...', 2500);

    if (this.sounds) this.sounds.heartbeat(0.8);

    setTimeout(() => {
      if (this._disposed) return;
      this._verdict();
    }, 3000);
  }

  _verdict() {
    this.state = 'VERDICT';
    const integrity = this.cakeHealth.getIntegrity();
    const baseScore = Math.floor(integrity * 85 / 100);
    const bonus = this.bonusRooms * 5;
    const finalScore = Math.min(100, baseScore + bonus);

    let verdictLines;
    if (finalScore >= 80) {
      verdictLines = [
        'BELPHEGOR: "...the mortal has skills."',
        'MOLOCH: "*grudging nod*"',
        'ASMODEUS: "ACCEPTABLE. YOU MAY LIVE."'
      ];
      if (this.sounds) this.sounds.gavelSmash();
    } else if (finalScore >= 50) {
      verdictLines = [
        'BELPHEGOR: "It\'s... edible. Barely."',
        'MOLOCH: "*SMASHES GAVEL* MEDIOCRE!"',
        'ASMODEUS: "I\'ve seen worse. In the ninth circle."'
      ];
      if (this.sounds) this.sounds.gavelSmash();
    } else {
      verdictLines = [
        'BELPHEGOR: "*maniacal laughter*"',
        'MOLOCH: "THIS IS AN ABOMINATION!"',
        'ASMODEUS: "Even Hell has standards."'
      ];
      if (this.sounds) this.sounds.jumpscareHit();
    }

    let delay = 0;
    verdictLines.forEach((line, i) => {
      setTimeout(() => {
        if (this._disposed) return;
        this._showText(line, 2500);
      }, delay);
      delay += 2800;
    });

    setTimeout(() => {
      if (this._disposed) return;
      this._showText(`📊 FINAL SCORE: ${finalScore}`, 3000);
      if (this.sounds) {
        if (finalScore >= 70) this.sounds.phaseComplete();
        else this.sounds.miss();
      }

      this.state = 'DONE';
      setTimeout(() => {
        if (this._disposed) return;
        if (this.onComplete) this.onComplete(finalScore, {
          integrity,
          bonusRooms: this.bonusRooms,
          verdict: finalScore >= 80 ? 'high' : finalScore >= 50 ? 'medium' : 'low'
        });
      }, 3500);
    }, delay + 500);
  }

  _showText(text, duration) {
    if (this._currentMsg) {
      this.hudTexture.removeControl(this._currentMsg);
      this._currentMsg.dispose();
      this._currentMsg = null;
    }
    if (!text) return;

    this._currentMsg = new BABYLON.GUI.TextBlock('judgeMsg', text);
    this._currentMsg.color = '#ffddaa';
    this._currentMsg.fontSize = 28;
    this._currentMsg.fontWeight = 'bold';
    this._currentMsg.outlineWidth = 3;
    this._currentMsg.outlineColor = '#000000';
    this._currentMsg.textWrapping = true;
    this._currentMsg.width = '600px';
    this.hudTexture.addControl(this._currentMsg);

    if (duration > 0) {
      setTimeout(() => {
        if (this._currentMsg && !this._disposed) {
          this.hudTexture.removeControl(this._currentMsg);
          this._currentMsg.dispose();
          this._currentMsg = null;
        }
      }, duration);
    }
  }

  dispose() {
    this._disposed = true;
    if (this._currentMsg) {
      this.hudTexture.removeControl(this._currentMsg);
      this._currentMsg.dispose();
    }
  }
}

window.JudgePresentation = JudgePresentation;
