/**
 * Conteos físicos (9B.07). `stock_counts` guarda el ciclo de vida
 * OPEN -> COUNTED -> APPROVED|REJECTED; `stock_count_lines` guarda la cantidad
 * contada por artículo/lote; `stock_count_differences` congela la diferencia
 * calculada al cerrar. Ninguna tabla admite borrado físico.
 */
export const stockCountsSql = `
  create table stock_counts (
    id text primary key,
    status text not null check (status in ('OPEN', 'COUNTED', 'APPROVED', 'REJECTED')),
    opened_by text not null,
    opened_at integer not null,
    closed_at integer,
    approved_by text,
    approved_at integer,
    rejected_by text,
    rejected_at integer,
    rejection_reason text,
    version integer not null check (version > 0)
  );

  create table stock_count_lines (
    id text primary key,
    stock_count_id text not null references stock_counts(id),
    product_id text not null,
    stock_item_id text not null,
    batch_id text,
    counted_quantity_scaled integer not null check (counted_quantity_scaled >= 0),
    counted_quantity_scale integer not null,
    unique (stock_count_id, stock_item_id, batch_id)
  );

  create table stock_count_differences (
    line_id text primary key references stock_count_lines(id),
    stock_count_id text not null references stock_counts(id),
    stock_item_id text not null,
    batch_id text,
    quantity_scale integer not null,
    expected_scaled integer not null,
    counted_scaled integer not null,
    difference_scaled integer not null
  );

  create trigger stock_counts_no_delete
  before delete on stock_counts
  begin
    select raise(abort, 'stock counts cannot be deleted');
  end;

  /**
   * Mientras el conteo está OPEN, una línea corregida reemplaza físicamente a
   * la anterior en la misma transacción (es estado de borrador, no evidencia
   * cerrada). Una vez que el conteo deja OPEN, sus líneas quedan congeladas y
   * el trigger bloquea cualquier borrado.
   */
  create trigger stock_count_lines_no_delete
  before delete on stock_count_lines
  when (select status from stock_counts where id = old.stock_count_id) != 'OPEN'
  begin
    select raise(abort, 'stock count lines cannot be deleted once the count is no longer open');
  end;

  create trigger stock_count_differences_no_delete
  before delete on stock_count_differences
  begin
    select raise(abort, 'stock count differences cannot be deleted');
  end;
`;
