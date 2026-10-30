/**
 * Генерация уникальных идентификаторов для UI-сущностей.
 * Вынесено из компонента, чтобы не нарушать чистоту рендера
 * (Date.now/Math.random нельзя вызывать в теле компонента).
 */
export function newId(prefix = 'id') {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}
