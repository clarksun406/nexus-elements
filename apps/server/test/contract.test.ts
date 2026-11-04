import { afterAll, beforeAll, describe } from 'vitest'
import { registerContractSuite } from '@nexus-elements/contracts/suite'
import { startApp } from './helpers.js'

describe('server contract', () => {
  let base = ''
  let close: () => Promise<void> = async () => {}

  beforeAll(async () => {
    const started = await startApp()
    base = started.base
    close = () => started.app.close()
  })

  afterAll(async () => {
    await close()
  })

  registerContractSuite(() => base)
})
