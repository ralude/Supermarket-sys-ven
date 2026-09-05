/**
 * Sucursales y dispositivos (9B.11). `branches` es dato maestro y etiqueta de
 * pertenencia: no gobierna autoridad de escritura ni sincronización.
 * `devices` es inventario administrativo de aparatos declarados por una
 * estación; declarar uno, incluida una impresora fiscal, no habilita ninguna
 * capacidad real. Ninguna tabla admite borrado físico.
 */
export const branchesAndDevicesSql = `
  create table branches (
    id text primary key,
    code text not null unique,
    name text not null,
    status text not null check (status in ('ACTIVE', 'INACTIVE')),
    created_at integer not null,
    updated_at integer not null,
    version integer not null check (version > 0)
  );

  create table devices (
    id text primary key,
    type text not null check (type in ('FISCAL_PRINTER', 'BARCODE_SCANNER', 'SCALE', 'CASH_DRAWER')),
    identifier text not null,
    terminal_id text not null,
    branch_id text references branches(id),
    status text not null check (status in ('ACTIVE', 'INACTIVE')),
    created_at integer not null,
    updated_at integer not null,
    version integer not null check (version > 0)
  );

  create trigger branches_identity_immutable
  before update on branches
  when new.id != old.id or new.code != old.code or new.created_at != old.created_at
  begin
    select raise(abort, 'branch technical identity is immutable');
  end;

  create trigger branches_no_delete
  before delete on branches
  begin
    select raise(abort, 'branches cannot be deleted');
  end;

  create trigger devices_identity_immutable
  before update on devices
  when new.id != old.id or new.type != old.type or new.terminal_id != old.terminal_id
    or new.created_at != old.created_at
  begin
    select raise(abort, 'device identity is immutable');
  end;

  create trigger devices_no_delete
  before delete on devices
  begin
    select raise(abort, 'devices cannot be deleted');
  end;
`;
