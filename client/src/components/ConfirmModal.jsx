import { useEffect, useRef } from 'react';

export default function ConfirmModal({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onClose, danger = false }) {
  const overlayRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close when clicking the backdrop
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div className="confirm-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="confirm-modal">
        <h3 className="confirm-modal__title">⚠️ {title}</h3>
        <p className="confirm-modal__message">{message}</p>
        <div className="confirm-modal__actions">
          <button className="retro-btn retro-btn--ghost confirm-modal__cancel" onClick={onClose}>
            {cancelText}
          </button>
          <button
            className={`retro-btn ${danger ? 'retro-btn--danger' : 'retro-btn--primary'} confirm-modal__confirm`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
