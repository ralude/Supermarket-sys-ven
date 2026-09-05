export const purchaseReceiptsAndCostSql = `
alter table stock_movements add column unit_cost_minor_units integer;
alter table stock_movements add column cost_currency_code text;

create table purchase_receipts (
  id text primary key not null,
  supplier_id text not null,
  supplier_legal_name text not null,
  supplier_trade_name text,
  supplier_tax_country text not null,
  supplier_tax_type text not null,
  supplier_tax_value text not null,
  supplier_tax_normalized_value text not null,
  supplier_fiscal_address_country text,
  supplier_fiscal_address_line text,
  source_type text not null check (source_type in ('INVOICE', 'DELIVERY_NOTE')),
  source_number text not null,
  source_series text,
  source_control_number text,
  source_issued_at integer,
  effective_at integer not null,
  status text not null check (status in ('DRAFT', 'COMPLETED', 'REVERSED')),
  version integer not null check (version > 0),
  created_by text not null,
  created_at integer not null,
  completed_at integer,
  reversed_at integer,
  reversed_by text,
  reversal_reason text,
  replaces_receipt_id text,
  foreign key (supplier_id) references suppliers(id),
  foreign key (replaces_receipt_id) references purchase_receipts(id)
);

create table purchase_receipt_lines (
  id text primary key not null,
  receipt_id text not null,
  product_id text not null,
  stock_item_id text not null,
  quantity_scaled integer not null check (quantity_scaled > 0),
  quantity_scale integer not null check (quantity_scale >= 0),
  batch_id text,
  purchase_unit_cost_minor_units integer not null check (purchase_unit_cost_minor_units >= 0),
  purchase_currency_code text not null,
  valuation_unit_cost_minor_units integer not null check (valuation_unit_cost_minor_units >= 0),
  valuation_currency_code text not null,
  exchange_rate_id text,
  exchange_rate_base_currency text,
  exchange_rate_quote_currency text,
  exchange_rate_value integer,
  exchange_rate_scale integer,
  exchange_rate_source text,
  exchange_rate_valid_from integer,
  exchange_rate_valid_until integer,
  exchange_rate_registered_by text,
  foreign key (receipt_id) references purchase_receipts(id),
  foreign key (stock_item_id) references stock_items(id),
  foreign key (batch_id) references stock_batches(id)
);

create unique index purchase_receipts_active_source_unique
on purchase_receipts(supplier_id, source_type, coalesce(source_series, ''), upper(source_number))
where status = 'COMPLETED';
create unique index purchase_receipts_active_control_unique
on purchase_receipts(supplier_id, upper(source_control_number))
where status = 'COMPLETED' and source_control_number is not null;
create index purchase_receipt_lines_receipt_idx on purchase_receipt_lines(receipt_id);

create trigger purchase_receipt_lines_immutable_update before update on purchase_receipt_lines begin
  select raise(abort, 'purchase receipt lines are immutable');
end;
create trigger purchase_receipt_lines_immutable_delete before delete on purchase_receipt_lines begin
  select raise(abort, 'purchase receipt lines are immutable');
end;
create trigger purchase_receipts_no_delete before delete on purchase_receipts begin
  select raise(abort, 'purchase receipts cannot be deleted');
end;
`;
