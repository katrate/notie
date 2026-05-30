import { create } from 'zustand'

interface CommandState {
  /** Signal to open the Settings modal */
  openSettingsModal: boolean
  setOpenSettingsModal: (v: boolean) => void
  /** Signal to open the Search modal */
  openSearchModal: boolean
  setOpenSearchModal: (v: boolean) => void
  /** Signal to open the Create Project modal */
  openCreateProjectModal: boolean
  setOpenCreateProjectModal: (v: boolean) => void
}

export const useCommandStore = create<CommandState>((set) => ({
  openSettingsModal: false,
  setOpenSettingsModal: (v) => set({ openSettingsModal: v }),
  openSearchModal: false,
  setOpenSearchModal: (v) => set({ openSearchModal: v }),
  openCreateProjectModal: false,
  setOpenCreateProjectModal: (v) => set({ openCreateProjectModal: v }),
}))
