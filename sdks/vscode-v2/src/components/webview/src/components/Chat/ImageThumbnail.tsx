import React, { useState } from "react"

interface ImageThumbnailProps {
  src: string
  alt?: string
  filename?: string
  onPreview?: () => void
}

/**
 * Image thumbnail component for displaying images in chat messages
 * Shows a fixed-size thumbnail with click-to-preview functionality
 */
export const ImageThumbnail: React.FC<ImageThumbnailProps> = ({ src, alt, filename, onPreview }) => {
  const [loadError, setLoadError] = useState(false)

  const handleClick = () => {
    if (onPreview && !loadError) {
      onPreview()
    }
  }

  const handleError = () => {
    setLoadError(true)
  }

  if (loadError) {
    return (
      <div
        style={{
          width: "120px",
          height: "120px",
          background: "#1a1a1a",
          border: "1px solid #3e3e42",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#888888",
          fontSize: "11px",
          cursor: "default",
        }}
      >
        Failed to load
      </div>
    )
  }

  return (
    <div
      onClick={handleClick}
      style={{
        width: "120px",
        height: "120px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #3e3e42",
        cursor: "pointer",
        transition: "all 0.2s ease",
        background: "#1a1a1a",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#52c41a"
        e.currentTarget.style.transform = "scale(1.02)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#3e3e42"
        e.currentTarget.style.transform = "scale(1)"
      }}
    >
      <img
        src={src}
        alt={alt || filename || "Image"}
        onError={handleError}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  )
}
