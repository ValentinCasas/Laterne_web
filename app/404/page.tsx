import { notFound } from "next/navigation";

/** @summary Ruta neutral a la que el proxy deriva los hosts y contenidos no permitidos. */
export default function NeutralNotFoundRoute() {
  notFound();
}
