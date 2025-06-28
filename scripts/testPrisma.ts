import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany()
  console.log('Users:', users)
}

main()
  .catch((e) => console.error(e))
  .finally(() => process.exit())
