import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { loadNodeIdentity } from '@supermarket/driver-security';
import { ADMIN_PERMISSIONS, createSecurityRuntime } from './runtime.ts';

const terminal = createInterface({ input: stdin, output: stdout });
const runtime = createSecurityRuntime(
  process.env.DATABASE_PATH ?? 'supermarket-node.sqlite',
  loadNodeIdentity(process.env.NODE_IDENTITY_PATH)
);

const readSecret = (prompt: string): Promise<string> => new Promise((resolve, reject) => {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    reject(new Error('PIN provisioning requires an interactive local terminal.'));
    return;
  }
  stdout.write(prompt);
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  let value = '';
  const finish = (error?: Error): void => {
    stdin.off('keypress', onKeypress);
    stdin.setRawMode(false);
    stdin.pause();
    stdout.write('\n');
    if (error) reject(error);
    else resolve(value);
  };
  const onKeypress = (text: string, key: { name?: string; ctrl?: boolean }): void => {
    if (key.ctrl && key.name === 'c') return finish(new Error('Provisioning cancelled.'));
    if (key.name === 'return' || key.name === 'enter') return finish();
    if (key.name === 'backspace') {
      value = value.slice(0, -1);
      return;
    }
    if (text && !key.ctrl) value += text;
  };
  stdin.on('keypress', onKeypress);
});

try {
  const operatorCode = await terminal.question('Código del administrador: ');
  const displayName = await terminal.question('Nombre visible: ');
  terminal.close();
  const pin = await readSecret('PIN de 6–12 dígitos: ');
  const confirmation = await readSecret('Repetir PIN: ');
  if (pin !== confirmation) throw new Error('PIN confirmation does not match.');
  const result = await runtime.provisionInitialAdmin.execute({
    operatorCode,
    displayName,
    pin,
    permissions: ADMIN_PERMISSIONS
  });
  if (!result.ok) throw result.error;
  stdout.write(`Administrador creado: ${result.value.userId}\n`);
} catch (error) {
  stdout.write(`No se pudo crear el administrador: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exitCode = 1;
} finally {
  terminal.close();
  runtime.handle.close();
}
