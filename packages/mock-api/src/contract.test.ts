import { afterAll, beforeAll, describe } from 'vitest'
import { registerContractSuite } from '@nexus-elements/contracts/suite'
import { createMockServer } from './server.js'

describe('mock-api contract', () => {
  let base = ''
  let close: () => Promise<void> = async () => {}

  beforeAll(async () => {
    const server = await createMockServer({ port: 0 })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('no port')
    base = `http://127.0.0.1:${address.port}`
    close = () => new Promise((resolve) => server.close(() => resolve()))
  })

  afterAll(async () => {
    await close()
  })

  registerContractSuite(() => base)
})
