// src/FloatingMessage.jsx
import React, { useState } from "react";
import { useSelector } from "react-redux";
import "./Alert.css";

const Alert = () => {
  const visible = useSelector((state) => state.common.alert);

  return (
    <div className="floating-message-container">
      <div className={`floating-message error ${visible ? "show" : ""}`}>
        <i className={`fa fa-info-circle`}></i>
        <div className="msg-body">
          <h3>Flooding Prone area</h3>
          <p>Please evacuvate the region immediately</p>
        </div>
      </div>
    </div>
  );
};

export default Alert;
