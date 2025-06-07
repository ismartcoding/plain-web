export function initRippleEffect() {
  document.addEventListener('click', function (e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target) return;

    const rippleButton = target.closest('.btn-icon, .v-filled-button, .outlined-button, .info-btn, button[class*="btn-"]') as HTMLElement;
    if (!rippleButton) return;

    if (rippleButton.hasAttribute('disabled') || rippleButton.classList.contains('disabled')) {
      return;
    }

    const rect = rippleButton.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';

    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

    rippleButton.appendChild(ripple);

    ripple.addEventListener('animationend', () => {
      if (ripple.parentNode) {
        ripple.remove();
      }
    });
  });
}

export default {
  install() {
    initRippleEffect();
  }
}; 