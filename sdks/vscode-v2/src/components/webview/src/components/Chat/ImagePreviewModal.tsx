import React from 'react'
import { Modal } from 'antd'

interface ImagePreviewModalProps {
  visible: boolean
  src: string
  alt?: string
  filename?: string
  onClose: () => void
}

/**
 * Image preview modal component for displaying full-size images
 * Shows a large image in a modal with click-to-close functionality
 */
export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  src,
  alt,
  filename,
  onClose
}) => {
  const handleCancel = () => {
    onClose()
  }

  return (
    <Modal
      open={visible}
      onCancel={handleCancel}
      footer={null}
      centered
      width="90vw"
      style={{
        maxWidth: '1200px'
      }}
      styles={{
        body: {
          padding: '20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#1e1e1e'
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '100%'
        }}
      >
        <img
          src={src}
          alt={alt || filename || 'Image'}
          style={{
            maxWidth: '100%',
            maxHeight: '80vh',
            objectFit: 'contain',
            borderRadius: '8px'
          }}
        />
        {filename && (
          <div
            style={{
              marginTop: '12px',
              color: '#888888',
              fontSize: '12px',
              textAlign: 'center'
            }}
          >
            {filename}
          </div>
        )}
      </div>
    </Modal>
  )
}

