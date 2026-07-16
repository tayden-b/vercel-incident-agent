import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

// Prisma returns BigInt for the log timestamps; make them JSON-serializable.
declare global {
    interface BigInt { toJSON(): number }
}
BigInt.prototype.toJSON = function () { return Number(this) }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
