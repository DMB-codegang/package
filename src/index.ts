import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'

type Bindings = {
  packageData: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  c.env.packageData.prepare('SELECT * FROM packages')
  return c.json({ message: 'Hello Hono!' })
})

export default app
