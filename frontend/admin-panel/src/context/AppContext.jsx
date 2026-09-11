import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [activeModal, setActiveModal] = useState(null)
  const [modalData, setModalData] = useState(null)
  const [toasts, setToasts] = useState([])
  const [projectsVersion, setProjectsVersion] = useState(0)
  const [dataVersion, setDataVersion] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => !v)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const refreshProjects = useCallback(() => {
    setProjectsVersion((v) => v + 1)
    setDataVersion((v) => v + 1)
  }, [])

  const refreshData = useCallback(() => {
    setDataVersion((v) => v + 1)
  }, [])

  const openModal = useCallback((id, data = null) => {
    setActiveModal(id)
    setModalData(data)
  }, [])

  const closeModal = useCallback(() => {
    setActiveModal(null)
    setModalData(null)
  }, [])

  const toast = useCallback((type, msg) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, type, msg }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2800)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        closeModal()
        closeSidebar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeModal, closeSidebar])

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <AppContext.Provider
      value={{
        activeModal, modalData, openModal, closeModal, toast, toasts,
        projectsVersion, refreshProjects, dataVersion, refreshData,
        sidebarOpen, toggleSidebar, closeSidebar,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
