import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '../api/schemas'
import type { ClientEntitlement } from '../app/metadata'

type CartLine = {
  productId: string
  name: string
  priceCents: number
  quantity: number
  keys?: Record<string, string>
}

type AppState = {
  session: Session | null
  selectedProgramId: string | null
  cart: CartLine[]
  setSession: (session: Session | null) => void
  selectProgram: (programId: string) => void
  addToCart: (line: Omit<CartLine, 'quantity'>) => void
  removeFromCart: (productId: string) => void
  clearCart: () => void
}

function latestProgram<T extends { year: number }>(programs: T[]): T | undefined {
  return programs.reduce<T | undefined>(
    (latest, program) => (!latest || program.year > latest.year ? program : latest),
    undefined,
  )
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      session: null,
      selectedProgramId: null,
      cart: [],
      setSession: (session) =>
        set({
          session,
          selectedProgramId: latestProgram(session?.user.programs ?? [])?.id ?? null,
          ...(session === null ? { cart: [] } : {}),
        }),
      selectProgram: (selectedProgramId) => set({ selectedProgramId }),
      addToCart: (line) =>
        set((state) => {
          const existing = state.cart.find((item) => item.productId === line.productId)
          return {
            cart: existing
              ? state.cart.map((item) =>
                  item.productId === line.productId ? { ...item, quantity: item.quantity + 1 } : item,
                )
              : [...state.cart, { ...line, quantity: 1 }],
          }
        }),
      removeFromCart: (productId) =>
        set((state) => ({ cart: state.cart.filter((item) => item.productId !== productId) })),
      clearCart: () => set({ cart: [] }),
    }),
    {
      name: 'wrg-platform-state',
      partialize: ({ selectedProgramId, cart }) => ({ selectedProgramId, cart }),
    },
  ),
)

export function useSelectedProgram() {
  return useAppStore((state) => {
    const programs = state.session?.user.programs ?? []
    return (
      programs.find((program) => program.id === state.selectedProgramId) ??
      latestProgram(programs) ??
      null
    )
  })
}

export function hasEntitlement(entitlement: ClientEntitlement): boolean {
  const state = useAppStore.getState()
  if (state.session?.user.role === 'promotional') return false
  const programs = state.session?.user.programs ?? []
  const selected =
    programs.find((program) => program.id === state.selectedProgramId) ?? latestProgram(programs)
  return selected?.entitlements[entitlement] === 'yes'
}
