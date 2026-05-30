import { useState, useEffect, useRef } from 'react'
import { useTemplateStore } from '../../stores/templateStore'
import { Tooltip } from '../Tooltip'

interface TemplateActionsProps {
  pageId: string
}

export function TemplateActions({ pageId }: TemplateActionsProps) {
  const [showPopover, setShowPopover] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { savePageAsTemplate } = useTemplateStore()

  useEffect(() => {
    if (showPopover) {
      setErrorMsg('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [showPopover])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false)
        setTemplateName('')
        setTemplateDesc('')
        setSuccessMsg('')
        setErrorMsg('')
      }
    }
    if (showPopover) {
      document.addEventListener('mousedown', handler)
    }
    return () => document.removeEventListener('mousedown', handler)
  }, [showPopover])

  const handleSave = async () => {
    if (!templateName.trim()) return
    setSaving(true)
    setSuccessMsg('')
    setErrorMsg('')
    const result = await savePageAsTemplate(pageId, templateName.trim(), templateDesc.trim())
    setSaving(false)
    if (result) {
      setSuccessMsg(`Template "${templateName.trim()}" saved!`)
      setTemplateName('')
      setTemplateDesc('')
      setTimeout(() => setSuccessMsg(''), 2500)
    } else {
      const err = useTemplateStore.getState().error
      setErrorMsg(err || 'Failed to save template. Check console for details.')
      setTimeout(() => setErrorMsg(''), 5000)
    }
  }

  return (
    <div className="relative">
      <Tooltip label="Save as template" position="bottom">
        <button
          onClick={() => setShowPopover(!showPopover)}
          className="p-2 rounded-lg hover:bg-surface/50 text-on-surface-variant hover:text-primary transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">bookmark</span>
        </button>
      </Tooltip>

      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 mt-2 w-80 bg-surface border border-outline/10 rounded-xl shadow-2xl p-4 z-[200] backdrop-blur-xl"
          style={{ animation: 'modalPop 0.15s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          {successMsg ? (
            <div className="flex items-center gap-2 py-3 text-sm text-emerald-400">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              {successMsg}
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="flex items-start gap-2 py-2 px-2 mb-3 rounded-lg bg-error/10 text-xs text-error">
                  <span className="material-symbols-outlined text-[14px] flex-shrink-0 mt-0.5">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Save as Template</p>
              <p className="text-[11px] text-on-surface-variant/70 mb-3">
                Saves the page structure (title, icon, type, tags, and children) — no content/data is included.
              </p>

              <input
                ref={inputRef}
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowPopover(false); }}
                placeholder="Template name..."
                className="w-full bg-background border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary mb-2"
              />
              <input
                type="text"
                value={templateDesc}
                onChange={e => setTemplateDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                placeholder="Description (optional)..."
                className="w-full bg-background border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary mb-3"
              />
              <button
                onClick={handleSave}
                disabled={!templateName.trim() || saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
                )}
                Save Template
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
