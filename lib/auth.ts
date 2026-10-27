import bcrypt from 'bcryptjs'

// JWT tem uma implementação só, em lib/jwt.ts, que é Edge-safe e por isso serve
// tanto o middleware quanto as rotas Node. Aqui só se re-exporta, para não voltar
// a existir uma segunda cópia de verifyToken com regra própria.
export { signToken, verifyToken, type TokenPayload } from '@/lib/jwt'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
