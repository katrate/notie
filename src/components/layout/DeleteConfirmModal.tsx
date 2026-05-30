interface DeleteConfirmModalProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ title, description, onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-surface border border-outline/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        style={{ animation: 'modalPop 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-error/15 flex items-center justify-center mb-4 mx-auto">
          <span className="material-symbols-outlined text-[26px] text-error">delete_forever</span>
        </div>

        {/* Text */}
        <h3 className="text-base font-bold text-on-surface text-center mb-1">{title}</h3>
        <p className="text-sm text-on-surface-variant text-center mb-6">{description}</p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-outline/20 text-on-surface-variant hover:bg-on-surface/10 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-error text-white hover:bg-error/80 transition-colors text-sm font-semibold shadow-[0_0_15px_rgba(186,26,26,0.3)]"
          >
            Delete
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export { DeleteConfirmModal };