export const idempotencySql = `
create table idempotency_key (
  scope text not null,
  key text not null,
  request_fingerprint text not null,
  status text not null check (status = 'COMPLETED'),
  result text not null check (json_valid(result)),
  created_at integer not null,
  expires_at integer not null,
  primary key (scope, key)
);

create index idempotency_key_expiration on idempotency_key(expires_at);
`;
