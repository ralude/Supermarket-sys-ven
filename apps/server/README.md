# @supermarket/server

Aplicacion Fastify para el nodo standalone o LAN.

## Comandos

- `pnpm --filter @supermarket/server dev`: inicia el servidor con watch.
- `pnpm --filter @supermarket/server start`: inicia el servidor en `127.0.0.1:3000`.
- `pnpm --filter @supermarket/server test`: ejecuta las pruebas del servidor.
- `pnpm --filter @supermarket/server typecheck`: verifica TypeScript.
- `pnpm seed:products -- --database <ruta> --currency <ABC>
  --tax-rate-basis-points <entero>`: aplica migraciones y genera el catálogo
  básico de ejemplo en una base local explícita.

El seed agrega tres categorías, una unidad y cinco productos con IDs y barcodes
estables. Es repetible y transaccional. La moneda y la tasa se indican al
ejecutarlo porque el proyecto no presupone valores fiscales ni regulatorios.

Ejemplo para una base de demostración; sustituye la moneda y la tasa por las
que decidas probar:

```bash
pnpm seed:products -- --database ./supermarket-demo.sqlite --currency USD --tax-rate-basis-points 0
```

El servidor expone salud y contratos autenticados bajo `/api/v1`. La
composición de negocio reside en el proceso Fastify y el renderer no abre la
base de datos.

El comando `dev` carga una identidad de nodo local y no secreta desde
`config/node-identity.development.json`. El comando `start` conserva la
identidad provisionada en `%ProgramData%\SupermarketPlatform\node-identity.json`
o en la ruta indicada mediante `NODE_IDENTITY_PATH`.

## Acceso inicial y usuarios de prueba

Una base local nueva no contiene usuarios ni credenciales predeterminadas. Por
eso la pantalla de inicio no permite entrar hasta provisionar el primer
administrador. En desarrollo, desde `apps/server`, ejecuta:

```bash
npm run bootstrap-admin:dev
```

El comando solicita de forma interactiva el código del operador, el nombre
visible y un PIN numérico de 6–12 dígitos. Usa la misma base
`supermarket-node.sqlite` y la misma identidad local que `npm run dev`.

Para un nodo instalado se usa `npm run bootstrap-admin`; ese comando exige la
identidad provisionada en `%ProgramData%` o mediante `NODE_IDENTITY_PATH`.

Las pruebas automatizadas crean temporalmente el fixture `OP001`, con nombre
visible `Operador` y PIN `123456`, dentro de bases SQLite en memoria. Ese
usuario se destruye al terminar cada prueba, no se inserta en
`supermarket-node.sqlite` y no constituye una credencial de desarrollo o
producción.

`SERVER_HOST` y `SERVER_PORT` permiten cambiar el bind y el puerto para desarrollo. El valor por defecto es loopback (`127.0.0.1`) para el modo standalone.
