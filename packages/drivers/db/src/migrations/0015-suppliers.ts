export const suppliersSql = `
  create table supplier_code_sequence (
    id integer primary key check (id = 1),
    last_value integer not null check (last_value >= 0)
  );

  insert into supplier_code_sequence (id, last_value) values (1, 0);

  create table suppliers (
    id text primary key,
    code text not null unique,
    legal_name text not null,
    trade_name text,
    fiscal_address text,
    tax_country text not null,
    tax_type text not null,
    tax_value text not null,
    tax_normalized_value text not null,
    status text not null check (status in ('ACTIVE', 'BLOCKED', 'INACTIVE')),
    created_at integer not null,
    updated_at integer not null,
    version integer not null check (version > 0),
    unique (tax_country, tax_type, tax_normalized_value)
  );

  create trigger suppliers_identity_immutable
  before update on suppliers
  when new.id != old.id or new.code != old.code or new.created_at != old.created_at
  begin
    select raise(abort, 'supplier technical identity is immutable');
  end;

  create trigger suppliers_no_delete
  before delete on suppliers
  begin
    select raise(abort, 'suppliers cannot be deleted');
  end;
`;

