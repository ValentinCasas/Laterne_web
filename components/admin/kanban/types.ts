/**
 * @summary Tipos base para el sistema Kanban reutilizable de MenuClick.
 */

export type Density = "compact" | "comfortable";
export type BoardView = "board" | "list";

export interface BoardColumn {
  id: string;
  title: string;
  icon?: React.ReactNode;
  color?: string;
}

export interface BoardItem {
  id: string | number;
  columnId: string;
  order?: unknown;
}
