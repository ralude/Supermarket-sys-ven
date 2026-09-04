export const operationalPoliciesSql = `
  create table operational_policy_versions (
    id text primary key,
    policy_type text not null check (policy_type in ('DISCOUNT', 'FINANCIAL_TRANSACTION_TAX')),
    version integer not null check (version > 0),
    is_active integer not null check (is_active in (0, 1)),
    valid_from integer not null,
    created_by text not null,
    created_at integer not null,
    reason text not null,
    unique (policy_type, version)
  );

  create unique index operational_policy_one_active
    on operational_policy_versions (policy_type) where is_active = 1;

  create table discount_policy_configuration (
    policy_id text primary key references operational_policy_versions(id),
    maximum_basis_points integer not null check (
      maximum_basis_points >= 0 and maximum_basis_points <= 10000
    )
  );

  create table financial_transaction_tax_policy_configuration (
    policy_id text primary key references operational_policy_versions(id),
    rate_basis_points integer not null check (
      rate_basis_points >= 0 and rate_basis_points <= 10000
    )
  );

  create table financial_transaction_tax_payment_methods (
    policy_id text not null references operational_policy_versions(id),
    payment_method_code text not null,
    primary key (policy_id, payment_method_code)
  );

  create table financial_transaction_tax_currencies (
    policy_id text not null references operational_policy_versions(id),
    currency_code text not null,
    primary key (policy_id, currency_code)
  );

  create trigger operational_policy_versions_restrict_update
  before update on operational_policy_versions
  when new.id != old.id
    or new.policy_type != old.policy_type
    or new.version != old.version
    or new.valid_from != old.valid_from
    or new.created_by != old.created_by
    or new.created_at != old.created_at
    or new.reason != old.reason
    or old.is_active != 1
    or new.is_active != 0
  begin
    select raise(abort, 'operational policy versions are immutable except deactivation');
  end;

  create trigger operational_policy_versions_no_delete
  before delete on operational_policy_versions
  begin
    select raise(abort, 'operational policy versions are append-only');
  end;

  create trigger discount_policy_configuration_no_update
  before update on discount_policy_configuration
  begin
    select raise(abort, 'discount policy configuration is immutable');
  end;

  create trigger discount_policy_configuration_no_delete
  before delete on discount_policy_configuration
  begin
    select raise(abort, 'discount policy configuration is append-only');
  end;

  create trigger financial_transaction_tax_policy_configuration_no_update
  before update on financial_transaction_tax_policy_configuration
  begin
    select raise(abort, 'financial transaction tax policy is immutable');
  end;

  create trigger financial_transaction_tax_policy_configuration_no_delete
  before delete on financial_transaction_tax_policy_configuration
  begin
    select raise(abort, 'financial transaction tax policy is append-only');
  end;

  create trigger financial_transaction_tax_payment_methods_no_update
  before update on financial_transaction_tax_payment_methods
  begin
    select raise(abort, 'financial transaction tax payment methods are immutable');
  end;

  create trigger financial_transaction_tax_payment_methods_no_delete
  before delete on financial_transaction_tax_payment_methods
  begin
    select raise(abort, 'financial transaction tax payment methods are append-only');
  end;

  create trigger financial_transaction_tax_currencies_no_update
  before update on financial_transaction_tax_currencies
  begin
    select raise(abort, 'financial transaction tax currencies are immutable');
  end;

  create trigger financial_transaction_tax_currencies_no_delete
  before delete on financial_transaction_tax_currencies
  begin
    select raise(abort, 'financial transaction tax currencies are append-only');
  end;
`;
