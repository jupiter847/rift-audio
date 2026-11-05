const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function installMaterialInspection() {
  const cleanups = [];
  const previews = [
    ['.cushion-shape', 'Ear cushion material preview'],
    ['.metal-shape', 'Metal frame material preview'],
    ['.control-shape', 'Tactile controls material preview'],
  ];

  for (const [selector, name] of previews) {
    const shape = document.querySelector(`.material-art ${selector}`);
    const surface = shape?.closest('.material-art');
    if (!shape || !surface || surface.hasAttribute('data-inspect')) continue;

    const previousAttributes = new Map(
      ['aria-hidden', 'tabindex', 'role', 'aria-label', 'data-inspect', 'data-inspect-x', 'data-inspect-y']
        .map((attribute) => [attribute, surface.getAttribute(attribute)]),
    );
    const previousTranslate = shape.style.translate;
    const previousRotate = shape.style.rotate;
    const previousTouchAction = surface.style.touchAction;
    const previousCursor = surface.style.cursor;
    let x = 0;
    let y = 0;
    let drag = null;

    surface.removeAttribute('aria-hidden');
    surface.setAttribute('data-inspect', '');
    surface.tabIndex = 0;
    surface.setAttribute('role', 'group');
    surface.setAttribute('aria-label', `${name}. Drag to inspect. Arrow keys move the object. Home resets it.`);
    surface.style.touchAction = 'pan-y';

    const hint = document.createElement('span');
    hint.className = 'inspect-hint';
    hint.textContent = 'DRAG TO INSPECT / ARROWS / HOME';
    hint.setAttribute('aria-hidden', 'true');
    surface.append(hint);

    const update = (nextX, nextY) => {
      const narrow = surface.getBoundingClientRect().width <= 180;
      x = clamp(nextX, narrow ? -20 : -28, narrow ? 20 : 28);
      y = clamp(nextY, narrow ? -17 : -22, narrow ? 17 : 22);
      shape.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      shape.style.rotate = `0 1 0 ${clamp(x * 1.1, -28, 28).toFixed(1)}deg`;
      surface.dataset.inspectX = x.toFixed(1);
      surface.dataset.inspectY = y.toFixed(1);
    };

    const stopDrag = (event) => {
      if (!drag || (event && event.pointerId !== drag.id)) return;
      const pointerId = drag.id;
      drag = null;
      surface.style.cursor = previousCursor;
      if (surface.hasPointerCapture?.(pointerId)) surface.releasePointerCapture(pointerId);
    };

    const onPointerDown = (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      drag = {
        id: event.pointerId,
        type: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        objectX: x,
        objectY: y,
        active: false,
      };
      surface.focus({ preventScroll: true });
      if (event.pointerType !== 'touch') surface.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (!drag.active) {
        if (Math.hypot(deltaX, deltaY) < 5) return;
        if (drag.type === 'touch' && Math.abs(deltaY) > Math.abs(deltaX) * 1.1) {
          stopDrag(event);
          return;
        }
        drag.active = true;
        surface.setPointerCapture?.(event.pointerId);
        surface.style.cursor = 'grabbing';
      }
      update(drag.objectX + deltaX * 0.45, drag.objectY + deltaY * 0.45);
    };

    const onKeyDown = (event) => {
      const amount = event.shiftKey ? 8 : 4;
      if (event.key === 'ArrowLeft') update(x - amount, y);
      else if (event.key === 'ArrowRight') update(x + amount, y);
      else if (event.key === 'ArrowUp') update(x, y - amount);
      else if (event.key === 'ArrowDown') update(x, y + amount);
      else if (event.key === 'Home') update(0, 0);
      else return;
      event.preventDefault();
    };

    surface.addEventListener('pointerdown', onPointerDown);
    surface.addEventListener('pointermove', onPointerMove);
    surface.addEventListener('pointerup', stopDrag);
    surface.addEventListener('pointercancel', stopDrag);
    surface.addEventListener('lostpointercapture', stopDrag);
    surface.addEventListener('keydown', onKeyDown);
    update(0, 0);

    cleanups.push(() => {
      stopDrag();
      surface.removeEventListener('pointerdown', onPointerDown);
      surface.removeEventListener('pointermove', onPointerMove);
      surface.removeEventListener('pointerup', stopDrag);
      surface.removeEventListener('pointercancel', stopDrag);
      surface.removeEventListener('lostpointercapture', stopDrag);
      surface.removeEventListener('keydown', onKeyDown);
      hint.remove();
      shape.style.translate = previousTranslate;
      shape.style.rotate = previousRotate;
      surface.style.touchAction = previousTouchAction;
      surface.style.cursor = previousCursor;
      for (const [attribute, value] of previousAttributes) {
        if (value === null) surface.removeAttribute(attribute);
        else surface.setAttribute(attribute, value);
      }
    });
  }

  const hero = document.querySelector('.hero');
  if (hero?.querySelector('.schematic')) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const previousX = hero.style.getPropertyValue('--hud-x');
    const previousY = hero.style.getPropertyValue('--hud-y');
    let lastX = null;
    let lastY = null;
    const setOffset = (x, y) => {
      const nextX = `${clamp(x, -5, 5).toFixed(2)}px`;
      const nextY = `${clamp(y, -5, 5).toFixed(2)}px`;
      if (nextX === lastX && nextY === lastY) return;
      lastX = nextX;
      lastY = nextY;
      hero.style.setProperty('--hud-x', nextX);
      hero.style.setProperty('--hud-y', nextY);
    };
    const resetOffset = () => setOffset(0, 0);
    const onHeroMove = (event) => {
      if (event.pointerType === 'touch' || reducedMotion.matches) return;
      const bounds = hero.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      setOffset(((event.clientX - bounds.left) / bounds.width - 0.5) * 10,
        ((event.clientY - bounds.top) / bounds.height - 0.5) * 10);
    };
    const onMotionPreference = () => { if (reducedMotion.matches) resetOffset(); };
    hero.addEventListener('pointermove', onHeroMove);
    hero.addEventListener('pointerleave', resetOffset);
    reducedMotion.addEventListener('change', onMotionPreference);
    cleanups.push(() => {
      hero.removeEventListener('pointermove', onHeroMove);
      hero.removeEventListener('pointerleave', resetOffset);
      reducedMotion.removeEventListener('change', onMotionPreference);
      if (previousX) hero.style.setProperty('--hud-x', previousX); else hero.style.removeProperty('--hud-x');
      if (previousY) hero.style.setProperty('--hud-y', previousY); else hero.style.removeProperty('--hud-y');
    });
  }

  return () => cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
}
