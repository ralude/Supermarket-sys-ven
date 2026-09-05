/**
 * Identificación opcional del receptor (9B.05). El snapshot vive en la propia
 * venta porque ADR-0018 no crea un maestro `Customer`: cada venta conserva su
 * copia y corregir el dato después no reescribe una venta ya emitida.
 *
 * La venta anónima sigue siendo válida, así que las columnas son nulables. Los
 * triggers exigen que el snapshot esté completo o ausente: país, tipo, valor y
 * valor normalizado viajan juntos, mientras que nombre y dirección quedan solo
 * cuando el operador los proporcionó.
 *
 * `fiscal_documents` recibe las mismas columnas porque el documento guarda su
 * propia copia: el contenido se persiste normalizado y debe poder rehidratarse
 * sin consultar la venta, que es un agregado distinto.
 */
export const saleRecipientSql = `
  alter table sales add column recipient_country text;
  alter table sales add column recipient_type text;
  alter table sales add column recipient_value text;
  alter table sales add column recipient_normalized_value text;
  alter table sales add column recipient_name text;
  alter table sales add column recipient_address text;

  create trigger sales_recipient_insert_complete
  before insert on sales
  when (new.recipient_country is null) != (new.recipient_type is null)
    or (new.recipient_country is null) != (new.recipient_value is null)
    or (new.recipient_country is null) != (new.recipient_normalized_value is null)
    or (new.recipient_country is null
      and (new.recipient_name is not null or new.recipient_address is not null))
    or (new.recipient_normalized_value is not null
      and trim(new.recipient_normalized_value) = '')
  begin
    select raise(abort, 'sale recipient snapshot must be complete or absent');
  end;

  alter table fiscal_documents add column recipient_country text;
  alter table fiscal_documents add column recipient_type text;
  alter table fiscal_documents add column recipient_value text;
  alter table fiscal_documents add column recipient_normalized_value text;
  alter table fiscal_documents add column recipient_name text;
  alter table fiscal_documents add column recipient_address text;

  create trigger sales_recipient_update_complete
  before update on sales
  when (new.recipient_country is null) != (new.recipient_type is null)
    or (new.recipient_country is null) != (new.recipient_value is null)
    or (new.recipient_country is null) != (new.recipient_normalized_value is null)
    or (new.recipient_country is null
      and (new.recipient_name is not null or new.recipient_address is not null))
    or (new.recipient_normalized_value is not null
      and trim(new.recipient_normalized_value) = '')
  begin
    select raise(abort, 'sale recipient snapshot must be complete or absent');
  end;
`;
