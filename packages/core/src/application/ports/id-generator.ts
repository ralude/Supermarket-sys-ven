/**
 * Puerto para generar identificadores únicos (UUIDv7/ULID).
 */
export interface IdGenerator {
  generate(): string;
}
