(function() {
  window.Animations = {
    pointPopup(parentEl, amount) {
      const popup = document.createElement('div');
      popup.className = 'point-popup ' + (amount >= 0 ? 'point-popup-positive' : 'point-popup-negative');
      popup.textContent = (amount >= 0 ? '+' : '') + '$' + Math.abs(amount);
      parentEl.style.position = 'relative';
      parentEl.appendChild(popup);
      popup.addEventListener('animationend', () => popup.remove());
    },

    rankChange(el, direction) {
      const cls = direction === 'up' ? 'rank-up' : 'rank-down';
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 600);
    },

    confettiBurst(originEl) {
      const rect = originEl.getBoundingClientRect();
      const colors = ['#FFE400', '#4CAF50', '#2196F3', '#FF5722', '#9C27B0', '#FF9800'];
      for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        particle.style.backgroundColor = colors[i % colors.length];
        const angle = (i / 12) * 360;
        particle.style.setProperty('--angle', angle + 'deg');
        particle.style.left = (rect.left + rect.width / 2) + 'px';
        particle.style.top = (rect.top + rect.height / 2) + 'px';
        document.body.appendChild(particle);
        particle.addEventListener('animationend', () => particle.remove());
      }
    },

    revealStandings(container, standings) {
      container.innerHTML = '';
      standings.forEach((player, i) => {
        const div = document.createElement('div');
        div.className = 'reveal-item';
        div.style.animationDelay = (i * 1) + 's';
        const medals = ['🥇', '🥈', '🥉'];
        div.innerHTML = `<span class="reveal-medal">${medals[i] || ''}</span> `
          + `<span class="reveal-name">${player.name}</span> — `
          + `<span class="reveal-score">$${player.score}</span>`;
        container.appendChild(div);
      });
    }
  };
})();
