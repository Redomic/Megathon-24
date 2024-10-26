// components/LoadingOverlay.js
import React from "react";
import { useSelector } from "react-redux";
import "./LoadingOverlay.css"; // For styling

const LoadingOverlay = () => {
  const isLoading = useSelector((state) => state.common.loading);

  if (!isLoading) return null;

  return (
    <div className="loading-overlay">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="50"
        height="50"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid"
      >
        <circle
          cx="50"
          cy="50"
          fill="none"
          stroke="#fff"
          strokeWidth="10"
          r="35"
          strokeDasharray="164.93361431346415 56.97787143782138"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            repeatCount="indefinite"
            dur="1s"
            values="0 50 50;360 50 50"
            keyTimes="0;1"
          />
        </circle>
      </svg>
    </div>
  );
};

export default LoadingOverlay;
