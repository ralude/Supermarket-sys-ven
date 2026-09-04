export const identitySecuritySql = `
  create table identity_users (
    id text primary key,
    operator_code text not null collate nocase unique,
    display_name text not null,
    is_active integer not null check (is_active in (0, 1)),
    authorization_version integer not null check (authorization_version > 0),
    created_at integer not null
  );

  create table identity_roles (
    id text primary key,
    code text not null unique,
    name text not null,
    is_active integer not null check (is_active in (0, 1)),
    is_assignable integer not null check (is_assignable in (0, 1))
  );

  create table identity_permissions (
    code text primary key,
    name text not null,
    is_active integer not null check (is_active in (0, 1))
  );

  create table identity_user_roles (
    user_id text not null references identity_users(id),
    role_id text not null references identity_roles(id),
    primary key (user_id, role_id)
  );

  create table identity_role_permissions (
    role_id text not null references identity_roles(id),
    permission_code text not null references identity_permissions(code),
    primary key (role_id, permission_code)
  );

  create table identity_credentials (
    user_id text primary key references identity_users(id),
    pin_hash text not null,
    version integer not null check (version > 0),
    updated_at integer not null
  );

  create table auth_lockouts (
    origin_node_id text not null,
    user_id text not null references identity_users(id),
    window_started_at integer not null,
    failed_count integer not null check (failed_count >= 0),
    locked_until integer,
    primary key (origin_node_id, user_id)
  );

  create table auth_sessions (
    token_hash text primary key,
    user_id text not null references identity_users(id),
    origin_node_id text not null,
    terminal_id text not null,
    authorization_version integer not null,
    created_at integer not null,
    last_seen_at integer not null,
    idle_expires_at integer not null,
    absolute_expires_at integer not null,
    revoked_at integer,
    check (idle_expires_at <= absolute_expires_at)
  );

  create index auth_sessions_user_active_idx
    on auth_sessions (user_id, revoked_at, absolute_expires_at);
`;

