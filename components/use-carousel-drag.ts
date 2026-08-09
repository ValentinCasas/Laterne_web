"use client";

import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

const DRAG_THRESHOLD = 10;

/** @summary Añade un arrastre horizontal suave sin interferir con clics normales ni gestos táctiles. */
export function useDragToScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const drag = useRef({ active: false, moved: false, pointerId: -1, startX: 0, scrollLeft: 0 });
  const [isDragging, setIsDragging] = useState(false);

  /** @summary Registra la posición inicial sin capturar todavía el clic del usuario. */
  function onPointerDown(event: ReactPointerEvent<T>) {
    if (event.pointerType !== "mouse" || event.button !== 0 || !ref.current) return;
    drag.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: ref.current.scrollLeft,
    };
  }

  /** @summary Desplaza el contenedor solamente después de superar un umbral intencional. */
  function onPointerMove(event: ReactPointerEvent<T>) {
    if (!drag.current.active || !ref.current) return;
    const distance = event.clientX - drag.current.startX;
    if (!drag.current.moved && Math.abs(distance) < DRAG_THRESHOLD) return;

    if (!drag.current.moved) {
      drag.current.moved = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    ref.current.scrollLeft = drag.current.scrollLeft - distance;
  }

  /** @summary Finaliza el arrastre y permite que el navegador acomode el elemento más cercano. */
  function finishDrag(event: ReactPointerEvent<T>) {
    if (!drag.current.active) return;
    drag.current.active = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  /** @summary Bloquea el clic posterior únicamente cuando hubo un desplazamiento real. */
  function onClickCapture(event: ReactMouseEvent<T>) {
    if (!drag.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current.moved = false;
  }

  return {
    ref,
    isDragging,
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onPointerLeave: finishDrag,
      onClickCapture,
    },
  };
}
