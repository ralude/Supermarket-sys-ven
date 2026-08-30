export const cashOperationalIntegritySql = `
create trigger cash_movements_no_update
before update on cash_movements begin
  select raise(abort, 'cash_movements is append-only');
end;

create trigger cash_movements_no_delete
before delete on cash_movements begin
  select raise(abort, 'cash_movements is append-only');
end;

create trigger shift_closing_balances_no_update
before update on shift_closing_balances begin
  select raise(abort, 'shift_closing_balances is immutable');
end;

create trigger shift_closing_balances_no_delete
before delete on shift_closing_balances begin
  select raise(abort, 'shift_closing_balances is immutable');
end;

create trigger shifts_closed_no_update
before update on shifts when old.status = 'CLOSED' begin
  select raise(abort, 'closed shifts are immutable');
end;

create trigger shifts_no_delete
before delete on shifts begin
  select raise(abort, 'shifts cannot be deleted');
end;
`;
