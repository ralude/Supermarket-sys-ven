/**
 * Puerto para obtener el instante actual. Permite congelar el tiempo en tests.
 */
export interface Clock {
  now(): Date;
}
