export const initialBusinessSchemaSql = `
create table categories (
  id text primary key,
  name text not null,
  is_active integer not null check (is_active in (0, 1))
);

create table units_of_measure (
  id text primary key,
  code text not null unique,
  name text not null,
  quantity_scale integer not null check (quantity_scale >= 0),
  is_active integer not null check (is_active in (0, 1))
);

create table payment_methods (
  code text primary key,
  name text not null,
  kind text not null,
  currency_code text not null,
  is_active integer not null check (is_active in (0, 1))
);

create table cash_registers (
  id text primary key,
  name text not null,
  terminal_id text not null,
  origin_node_id text not null,
  is_active integer not null check (is_active in (0, 1))
);

create table exchange_rates (
  id text primary key,
  base_currency text not null,
  quote_currency text not null,
  rate_value integer not null check (rate_value > 0),
  rate_scale integer not null check (rate_scale >= 0),
  source text not null,
  valid_from integer not null,
  valid_until integer,
  registered_by text not null,
  check (base_currency <> quote_currency),
  check (valid_until is null or valid_until > valid_from)
);

create table products (
  id text primary key,
  name text not null,
  description text not null,
  category_id text not null references categories(id),
  unit_id text not null references units_of_measure(id),
  price_minor_units integer not null check (price_minor_units >= 0),
  currency_code text not null,
  tax_rate_basis_points integer not null check (tax_rate_basis_points >= 0),
  is_active integer not null check (is_active in (0, 1)),
  version integer not null check (version >= 0)
);

create table product_barcodes (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  value text not null,
  is_active integer not null check (is_active in (0, 1))
);

create unique index product_barcodes_active_value
  on product_barcodes(value) where is_active = 1;

create table product_price_history (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  price_minor_units integer not null check (price_minor_units >= 0),
  currency_code text not null,
  recorded_at integer not null,
  recorded_by text not null,
  reason text not null
);

create table sales (
  id text primary key,
  currency_code text not null,
  terminal_id text not null,
  origin_node_id text not null,
  started_by text not null,
  started_at integer not null,
  status text not null check (status in ('DRAFT', 'COMPLETED', 'VOIDED')),
  version integer not null check (version >= 0),
  financial_transaction_tax_minor_units integer not null default 0 check (financial_transaction_tax_minor_units >= 0),
  completed_at integer,
  voided_at integer,
  void_reason text,
  voided_by text
);

create table sale_items (
  id text primary key,
  sale_id text not null references sales(id) on delete cascade,
  product_id text not null,
  description text not null,
  price_minor_units integer not null check (price_minor_units >= 0),
  currency_code text not null,
  tax_rate_basis_points integer not null check (tax_rate_basis_points >= 0),
  unit_code text not null,
  unit_scale integer not null check (unit_scale >= 0),
  quantity_scaled integer not null check (quantity_scaled > 0),
  quantity_scale integer not null check (quantity_scale >= 0)
);

create table sale_discounts (
  id text primary key,
  sale_id text not null references sales(id) on delete cascade,
  item_id text references sale_items(id) on delete cascade,
  percentage_basis_points integer not null check (percentage_basis_points > 0),
  amount_minor_units integer not null check (amount_minor_units >= 0),
  currency_code text not null,
  reason text not null,
  applied_by text not null,
  applied_at integer not null
);

create table sale_payments (
  id text primary key,
  sale_id text not null references sales(id) on delete cascade,
  payment_method_code text not null,
  payment_method_name text not null,
  payment_method_kind text not null,
  amount_minor_units integer not null check (amount_minor_units > 0),
  currency_code text not null,
  amount_in_sale_currency_minor_units integer not null check (amount_in_sale_currency_minor_units > 0),
  sale_currency_code text not null,
  exchange_rate_id text,
  exchange_rate_base_currency text,
  exchange_rate_quote_currency text,
  exchange_rate_value integer,
  exchange_rate_scale integer,
  exchange_rate_source text,
  exchange_rate_valid_from integer,
  exchange_rate_valid_until integer,
  exchange_rate_registered_by text,
  registered_by text not null,
  registered_at integer not null
);

create table shifts (
  id text primary key,
  cash_register_id text not null references cash_registers(id),
  terminal_id text not null,
  origin_node_id text not null,
  opened_by text not null,
  opened_at integer not null,
  status text not null check (status in ('OPEN', 'CLOSED')),
  version integer not null check (version >= 0),
  closed_at integer,
  closed_by text
);

create unique index shifts_one_open_per_register
  on shifts(cash_register_id) where status = 'OPEN';

create table cash_movements (
  id text primary key,
  shift_id text not null references shifts(id) on delete cascade,
  type text not null,
  payment_method_code text not null,
  payment_method_name text not null,
  payment_method_kind text not null,
  amount_minor_units integer not null check (amount_minor_units > 0),
  currency_code text not null,
  reason text not null,
  registered_by text not null,
  registered_at integer not null
);

create table shift_closing_balances (
  shift_id text not null references shifts(id) on delete cascade,
  payment_method_code text not null,
  currency_code text not null,
  expected_minor_units integer not null,
  declared_minor_units integer not null,
  difference_minor_units integer not null,
  primary key (shift_id, payment_method_code, currency_code)
);
`;
