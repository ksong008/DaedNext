import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const coreRoot = process.env.RUST_WORKSPACE || process.env.DAENEXT_ROOT
if (!coreRoot) {
  throw new Error('RUST_WORKSPACE or DAENEXT_ROOT must identify the DaeNext checkout')
}

const coreFixture = resolve(
  coreRoot,
  'crates/dae-resident-dataplane/tests/fixtures/resident_protocol_exact_shapes.json',
)
const productFixture = resolve(
  'apps/web/src/components/ConfigureNodeFormModal/protocols/fixtures/resident_protocol_exact_shapes.json',
)

const [core, product] = await Promise.all([
  readFile(coreFixture, 'utf8'),
  readFile(productFixture, 'utf8'),
])

if (core !== product) {
  throw new Error(
    'resident protocol exact-shape fixtures differ between DaeNext and DaedNext',
  )
}
