import type { Member, SupportType } from '../types'

export const DEFAULT_MEMBER_AXIAL_STIFFNESS_KN = 1_000_000
export const LEGACY_FIXED_SUPPORT = 'fixed'

export type RuntimeSupportType = SupportType | typeof LEGACY_FIXED_SUPPORT

export function normalizeSupportType(
  support: RuntimeSupportType | undefined,
): SupportType | undefined {
  if (support === LEGACY_FIXED_SUPPORT) {
    return 'pinned'
  }

  return support
}

export function getMemberAxialStiffnessKn(
  member: Pick<Member, 'axialStiffnessKn'> | { axialStiffnessKn?: number },
): number {
  const axialStiffnessKn = member.axialStiffnessKn

  return Number.isFinite(axialStiffnessKn) && axialStiffnessKn !== undefined && axialStiffnessKn > 0
    ? axialStiffnessKn
    : DEFAULT_MEMBER_AXIAL_STIFFNESS_KN
}
