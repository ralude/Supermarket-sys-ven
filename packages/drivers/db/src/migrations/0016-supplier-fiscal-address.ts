/**
 * La dirección fiscal deja de ser texto libre y pasa a la representación mínima
 * evaluable por dominio y aplicación: país y línea. Las filas anteriores
 * conservan su texto como línea y toman el país de su identidad fiscal, que es
 * el único país conocido de esas filas.
 */
export const supplierFiscalAddressSql = `
  alter table suppliers add column fiscal_address_country text;
  alter table suppliers add column fiscal_address_line text;

  update suppliers
  set fiscal_address_country = tax_country,
      fiscal_address_line = trim(fiscal_address)
  where fiscal_address is not null and trim(fiscal_address) != '';

  alter table suppliers drop column fiscal_address;

  create trigger suppliers_fiscal_address_insert_complete
  before insert on suppliers
  when (new.fiscal_address_country is null) != (new.fiscal_address_line is null)
    or (new.fiscal_address_line is not null and trim(new.fiscal_address_line) = '')
  begin
    select raise(abort, 'supplier fiscal address requires country and line');
  end;

  create trigger suppliers_fiscal_address_update_complete
  before update on suppliers
  when (new.fiscal_address_country is null) != (new.fiscal_address_line is null)
    or (new.fiscal_address_line is not null and trim(new.fiscal_address_line) = '')
  begin
    select raise(abort, 'supplier fiscal address requires country and line');
  end;
`;
