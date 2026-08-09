"use client";

import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/** @summary Añade desplazamiento horizontal mediante arrastre con el botón principal del mouse. */
export function useDragToScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });
  const [isDragging, setIsDragging] = useState(false);

  /** @summary Inicia el seguimiento del puntero y conserva la posición inicial del contenedor. */
  function onPointerDown(event: ReactPointerEvent<T>) {
    if (event.pointerType !== "mouse" || event.button !== 0 || !ref.current) return;
    drag.current = { active: true, moved: false, startX: event.clientX, scrollLeft: ref.current.scrollLeft };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  /** @summary Actualiza el desplazamiento horizontal mientras el usuario mantiene el arrastre. */
  function onPointerMove(event: ReactPointerEvent<T>) {
    if (!drag.current.active || !ref.current) return;
    const distance = event.clientX - drag.current.startX;
    drag.current.moved ||= Math.abs(distance) > 5;
    ref.current.scrollLeft = drag.current.scrollLeft - distance;
  }

  /** @summary Finaliza el arrastre activo y libera la captura del puntero. */
  function finishDrag(event: ReactPointerEvent<T>) {
    if (!drag.current.active) return;
    drag.current.active = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  /** @summary Evita activar enlaces o botones cuando el gesto realizado fue un arrastre. */
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
      onClickCapture,
    },
  };
}

/** @summary Convierte un gesto lateral en una navegación hacia el elemento anterior o siguiente. */
export function useSwipeCarousel(onPrevious: () => void, onNext: () => void) {
  const drag = useRef({ active: false, startX: 0 });
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  /** @summary Registra el punto donde comienza el gesto lateral del carrusel. */
  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    drag.current = { active: true, startX: event.clientX };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  /** @summary Refleja visualmente la distancia recorrida durante el gesto lateral. */
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    setOffset(event.clientX - drag.current.startX);
  }

  /** @summary Resuelve la dirección del gesto y cambia de elemento cuando supera el umbral. */
  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    const distance = event.clientX - drag.current.startX;
    drag.current.active = false;
    setIsDragging(false);
    setOffset(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (Math.abs(distance) < 50) return;
    if (distance > 0) onPrevious();
    else onNext();
  }

  return {
    offset,
    isDragging,
    swipeProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
    },
  };
}
